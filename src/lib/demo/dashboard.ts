import type { Store, User } from './models.ts';
import { roles, fail, days, sorted, own, now } from './helpers.ts';
export const announcements = (db: Store) => sorted(db.announcements).sort((a, b) => Number(b.pinned) - Number(a.pinned));
export function dashboard(db: Store, user: User, kind: string | undefined) {
    if (kind === 'admin') {
        roles(user, 'admin', 'staff');
        const count = (rows: {
            status: string;
        }[], statuses: string[]) => rows.filter(row => statuses.includes(row.status)).length;
        const nationalities = new Map<string, number>();
        for (const student of db.students)
            nationalities.set(student.nationality, (nationalities.get(student.nationality) ?? 0) + 1);
        return { total_students: db.students.length, complaints: { pending: count(db.complaints, ['pending']), in_progress: count(db.complaints, ['in_progress']), resolved: count(db.complaints, ['resolved']) }, documents: { pending: count(db.documents, ['pending', 'in_progress']), completed: count(db.documents, ['approved', 'completed']) }, permissions_pending: count(db.permissions, ['pending']), recent_permissions_pending: sorted(db.permissions.filter(row => row.status === 'pending')).slice(0, 5), iqomah_expiring: db.students.map(student => ({ ...student, days_left: days(student.iqomah_expiry) })).filter(student => Number.isFinite(student.days_left) && student.days_left <= 30).sort((a, b) => a.days_left - b.days_left).slice(0, 10), nationalities: [...nationalities].map(([nationality, count]) => ({ nationality, count })) };
    }
    if (kind !== 'student')
        fail(404, 'Dashboard not found');
    roles(user, 'student');
    const complaints = own(db.complaints, user), documents = own(db.documents, user), permissions = own(db.permissions, user), profile = db.students.find(row => row.user_id === user.id) ?? null;
    const open = (rows: {
        status: string;
    }[]) => rows.filter(row => ['pending', 'in_progress'].includes(row.status)).length;
    return { profile, iqomah_days_left: profile ? days(profile.iqomah_expiry) : null, complaints_total: complaints.length, complaints_open: open(complaints), documents_total: documents.length, documents_open: open(documents), permissions_total: permissions.length, active_permissions: sorted(permissions.filter(row => row.status === 'pending' || row.status === 'approved' && row.end_date >= now().slice(0, 10) || row.status === 'rejected' && Date.parse(row.updated_at ?? '') > Date.now() - 3 * 86400000)).slice(0, 20), recent_announcements: announcements(db).slice(0, 5) };
}
