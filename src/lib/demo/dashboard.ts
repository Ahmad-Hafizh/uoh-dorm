import type { Store, User } from './models.ts';
import { roles, fail, days, sorted, own, now, enrichAnnouncement } from './helpers.ts';
import { autoStartApprovedPermissions } from './requests.ts';

export const announcements = (db: Store) =>
    sorted(db.announcements).sort((a, b) => {
        const aUrgent = (a.category || '').toUpperCase() === 'URGENT' ? 1 : 0;
        const bUrgent = (b.category || '').toUpperCase() === 'URGENT' ? 1 : 0;
        if (bUrgent !== aUrgent) return bUrgent - aUrgent;
        if (Number(b.pinned) !== Number(a.pinned)) return Number(b.pinned) - Number(a.pinned);
        return 0;
    });

/*
// ============================================================================
// DRAFT PRISMA QUERIES FOR DASHBOARD (Neon PostgreSQL Production Migration)
// ============================================================================
//
// 1. Overstay query for Admin/Staff Dashboard:
// export async function getOverstayPermissionsPrisma() {
//   const today = new Date();
//   return prisma.permission.findMany({
//     where: {
//       status: 'ACTIVE',
//       end_date: {
//         lt: today,
//       },
//     },
//     orderBy: {
//       end_date: 'asc', // Longest overdue first
//     },
//   });
// }
//
// 2. Pending permissions query:
// export async function getPendingPermissionsPrisma() {
//   return prisma.permission.findMany({
//     where: { status: 'PENDING' },
//     orderBy: { createdAt: 'desc' },
//     take: 5,
//   });
// }
// ============================================================================
*/

export function dashboard(db: Store, user: User, kind: string | undefined) {
    autoStartApprovedPermissions(db.permissions);
    if (kind === 'admin') {
        roles(user, 'admin', 'staff');
        const count = (rows: {
            status: string;
        }[], statuses: string[]) => rows.filter(row => statuses.map(s => s.toLowerCase()).includes((row.status || '').toLowerCase())).length;
        const nationalities = new Map<string, number>();
        for (const student of db.students)
            nationalities.set(student.nationality, (nationalities.get(student.nationality) ?? 0) + 1);

        const todayStr = now().slice(0, 10);
        const todayDate = new Date();

        // Smart Overstay detection:
        // Status is ACTIVE but end_date has already passed today
        const overstay_permissions = db.permissions
            .filter(row => {
                const s = (row.status || '').toUpperCase();
                if (s !== 'ACTIVE') return false;
                const endDateStr = (row.end_date || '').slice(0, 10);
                return endDateStr < todayStr;
            })
            .map(row => {
                const student = db.students.find(s => s.user_id === row.user_id) ?? null;
                const endMs = new Date(row.end_date).setHours(0, 0, 0, 0);
                const todayMs = todayDate.setHours(0, 0, 0, 0);
                const days_overdue = Math.max(1, Math.round((todayMs - endMs) / (1000 * 60 * 60 * 24)));
                return {
                    id: row.id,
                    user_id: row.user_id,
                    user_name: row.user_name,
                    permission_type: row.permission_type,
                    destination: row.destination || row.overnight_address || 'N/A',
                    start_date: row.start_date,
                    end_date: row.end_date,
                    days_overdue,
                    room_number: student?.room_number ?? null,
                    phone: student?.phone ?? null,
                    nationality: student?.nationality ?? null,
                };
            })
            .sort((a, b) => b.days_overdue - a.days_overdue);

        return {
            total_students: db.students.length,
            complaints: {
                pending: count(db.complaints, ['pending']),
                in_progress: count(db.complaints, ['in_progress']),
                resolved: count(db.complaints, ['resolved'])
            },
            documents: {
                pending: count(db.documents, ['pending', 'in_progress']),
                completed: count(db.documents, ['approved', 'completed'])
            },
            permissions_pending: count(db.permissions, ['pending']),
            recent_permissions_pending: sorted(db.permissions.filter(row => (row.status || '').toUpperCase() === 'PENDING')).slice(0, 5),
            overstay_permissions,
            iqomah_expiring: db.students
                .map(student => ({ ...student, days_left: days(student.residency_expiry || student.iqomah_expiry || "") }))
                .filter(student => Number.isFinite(student.days_left) && student.days_left <= 30)
                .sort((a, b) => a.days_left - b.days_left)
                .slice(0, 10),
            nationalities: [...nationalities].map(([nationality, count]) => ({ nationality, count }))
        };
    }

    if (kind !== 'student')
        fail(404, 'Dashboard not found');

    roles(user, 'student');
    const complaints = own(db.complaints, user),
        documents = own(db.documents, user),
        permissions = own(db.permissions, user),
        profile = db.students.find(row => row.user_id === user.id) ?? null;

    const open = (rows: {
        status: string;
    }[]) => rows.filter(row => ['pending', 'in_progress'].includes(row.status)).length;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const document_updates = sorted(
        documents.filter(row => {
            const s = (row.status || '').toLowerCase();
            // 1. Never show cancelled in dashboard
            if (s === 'cancelled') return false;
            // 2. Active running requests
            if (['pending', 'in_progress'].includes(s)) return true;
            // 3. Unread updates
            const isUnread = (row.updated_at ?? '') > (user.documents_last_read_at ?? '');
            if (isUnread) return true;
            // 4. Completed with result file within last 7 days
            if (s === 'completed' && row.result_file_id) {
                const dateToCheck = row.updated_at || row.created_at;
                if (dateToCheck >= sevenDaysAgo) return true;
            }
            return false;
        })
    ).slice(0, 10).map(doc => ({
        id: doc.id,
        request_type: doc.request_type,
        status: doc.status,
        admin_note: doc.admin_note || null,
        result_file_id: doc.result_file_id || null,
        dynamic_data: doc.dynamic_data || null,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        is_unread: (doc.updated_at ?? '') > (user.documents_last_read_at ?? '')
    }));

    return {
        profile,
        iqomah_days_left: profile ? days(profile.residency_expiry || profile.iqomah_expiry || "") : null,
        complaints_total: complaints.length,
        complaints_open: open(complaints),
        documents_total: documents.length,
        documents_open: open(documents),
        permissions_total: permissions.length,
        document_updates,
        documents_unread_count: document_updates.filter(d => d.is_unread).length,
        active_permissions: sorted(
            permissions.filter(row => {
                const s = (row.status || '').toUpperCase();
                return s === 'PENDING' || s === 'APPROVED' || s === 'ACTIVE';
            })
        ).slice(0, 20),
        recent_announcements: announcements(db)
            .slice(0, 3)
            .map(a => enrichAnnouncement(a, db, user))
    };
}
