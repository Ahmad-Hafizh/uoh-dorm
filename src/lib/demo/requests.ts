import type { Store, User, DocumentRequest, Permission } from './models.ts';
import { documentCreate, documentUpdate, permissionCreate, permissionUpdate, announcementCreate, announcementUpdate, defaultGeofenceSettings, defaultPermissionSettings } from './models.ts';
import { roles, find, fail, base, sorted, own, attachments, now, isFormClosed, enrichAnnouncement } from './helpers.ts';
import { announcements } from './dashboard.ts';

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}

/*
// ============================================================================
// DRAFT PRISMA FUNCTIONS (For Neon PostgreSQL Production Migration)
// ============================================================================
//
// import { prisma } from '@/lib/prisma';
// import type { PermissionType, PermissionStatus } from '@prisma/client';
//
// 1. Get permissions query:
// export async function getPermissionsPrisma(user: { id: string; role: string }) {
//   const isStaff = user.role === 'ADMIN' || user.role === 'STAFF';
//   return prisma.permission.findMany({
//     where: isStaff ? {} : { user_id: user.id },
//     orderBy: { createdAt: 'desc' },
//   });
// }
//
// 2. Create permission query:
// export async function createPermissionPrisma(
//   user: { id: string; name: string },
//   input: {
//     permission_type: PermissionType;
//     destination?: string | null;
//     transportation_mode?: string | null;
//     overnight_address?: string | null;
//     emergency_contact?: string | null;
//     ticket_attachment_id?: string | null;
//     start_date: string;
//     end_date: string;
//     reason: string;
//   }
// ) {
//   return prisma.permission.create({
//     data: {
//       user_id: user.id,
//       user_name: user.name,
//       permission_type: input.permission_type,
//       destination: input.destination || null,
//       transportation_mode: input.transportation_mode || null,
//       overnight_address: input.overnight_address || null,
//       emergency_contact: input.emergency_contact || null,
//       ticket_attachment_id: input.ticket_attachment_id || null,
//       start_date: new Date(input.start_date),
//       end_date: new Date(input.end_date),
//       reason: input.reason,
//       status: 'PENDING',
//     },
//   });
// }
//
// 3. Update permission (Self Check-in / Check-out & Staff Review):
// export async function updatePermissionPrisma(
//   id: string,
//   user: { id: string; role: string },
//   input: { status?: PermissionStatus; admin_note?: string }
// ) {
//   const perm = await prisma.permission.findUnique({ where: { id } });
//   if (!perm) throw new Error('Not found');
//
//   if (user.role === 'STUDENT') {
//     if (perm.user_id !== user.id) throw new Error('Forbidden');
//     if (perm.status === 'APPROVED' && input.status === 'ACTIVE') {
//       return prisma.permission.update({
//         where: { id },
//         data: { status: 'ACTIVE' },
//       });
//     }
//     if (perm.status === 'ACTIVE' && input.status === 'COMPLETED') {
//       return prisma.permission.update({
//         where: { id },
//         data: { status: 'COMPLETED' },
//       });
//     }
//     if ((perm.status === 'APPROVED' || perm.status === 'PENDING') && input.status === 'CANCELLED') {
//       return prisma.permission.update({
//         where: { id },
//         data: { status: 'CANCELLED', ...(input.admin_note ? { admin_note: input.admin_note } : {}) },
//       });
//     }
//     throw new Error('Invalid status transition');
//   }
//
//   // Auto-start journey draft (24 hours past departure):
//   // const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
//   // await prisma.permission.updateMany({
//   //   where: { status: 'APPROVED', start_date: { lte: oneDayAgo } },
//   //   data: { status: 'ACTIVE', updated_at: new Date() }
//   // });
//
//   // Admin / Staff review
//   return prisma.permission.update({
//     where: { id },
//     data: {
//       ...(input.status ? { status: input.status } : {}),
//       ...(input.admin_note !== undefined ? { admin_note: input.admin_note } : {}),
//     },
//   });
// }
//
// 4. Create document request with active duplicate prevention:
// export async function createDocumentRequestPrisma(
//   user: { id: string; name: string },
//   input: {
//     request_type: string;
//     notes?: string | null;
//     attachment_file_ids?: string[] | null;
//     dynamic_data?: any;
//   }
// ) {
//   const activeRequest = await prisma.documentRequest.findFirst({
//     where: {
//       user_id: user.id,
//       request_type: input.request_type,
//       status: { in: ['PENDING', 'IN_PROGRESS', 'pending', 'in_progress'] },
//     },
//   });
//   if (activeRequest) {
//     throw new ApiError(409, 'You already have an active request of this type. Please wait until it is processed.');
//   }
//   return prisma.documentRequest.create({
//     data: {
//       user_id: user.id,
//       user_name: user.name,
//       request_type: input.request_type,
//       notes: input.notes || null,
//       attachment_file_ids: input.attachment_file_ids || [],
//       dynamic_data: input.dynamic_data || null,
//       status: 'PENDING',
//     },
//   });
// }
// ============================================================================
*/

export function autoStartApprovedPermissions(permissions: Permission[]): boolean {
    let changed = false;
    const nowMs = Date.now();
    for (const p of permissions) {
        if ((p.status || '').toUpperCase() === 'APPROVED' && p.start_date) {
            const startMs = new Date(p.start_date.includes('T') ? p.start_date : `${p.start_date}T00:00:00`).getTime();
            if (!isNaN(startMs) && (nowMs - startMs >= 24 * 60 * 60 * 1000)) {
                p.status = 'ACTIVE';
                p.updated_at = now();
                changed = true;
            }
        }
    }
    return changed;
}

export function requests(db: Store, user: User, resource: string, id: string | undefined, method: string, input: unknown, action?: string): unknown {
    if (resource === 'announcements') {
        if (id && action === 'acknowledge' && method === 'POST') {
            const row = find(db.announcements, id, 'Announcement');
            if (!row.acknowledged_by) row.acknowledged_by = [];
            if (!row.acknowledged_by.includes(user.id)) {
                row.acknowledged_by.push(user.id);
            }
            return {
                ok: true,
                id: row.id,
                acknowledged_count: row.acknowledged_by.length,
                has_acknowledged: true,
            };
        }
        if (!id && method === 'GET') {
            return announcements(db).map(item => enrichAnnouncement(item, db, user));
        }
        roles(user, 'admin', 'staff');
        if (!id && method === 'POST') {
            const parsed = announcementCreate.parse(input);
            const row = {
                ...base(),
                ...parsed,
                author_name: user.name,
                category: parsed.category || 'GENERAL',
                attachment_file_ids: parsed.attachment_file_ids || [],
                acknowledged_by: parsed.acknowledged_by || [],
                form_id: parsed.form_id || null,
            };
            db.announcements.push(row);
            return row;
        }
        if (id && method === 'PATCH') {
            const row = find(db.announcements, id, 'Announcement');
            const patch = announcementUpdate.parse(input);
            Object.assign(row, patch);
            return row;
        }
        if (id && method === 'DELETE') {
            find(db.announcements, id);
            db.announcements = db.announcements.filter(row => row.id !== id);
            return { ok: true };
        }
        fail(405, 'Method not allowed');
    }

    if (resource !== 'documents' && resource !== 'permissions')
        fail(404, 'Not found');

    if (resource === 'permissions') {
        autoStartApprovedPermissions(db.permissions);
    }

    if (!id && method === 'GET') {
        const isStudent = (user.role || '').toLowerCase() === 'student';
        if (resource === 'documents') {
            const list = isStudent ? db.documents.filter(d => d.user_id === user.id) : db.documents;
            return sorted(list);
        }
        if (resource === 'permissions') {
            const list = isStudent ? db.permissions.filter(p => p.user_id === user.id) : db.permissions;
            return sorted(list);
        }
        return sorted(own<DocumentRequest | Permission>(db[resource], user));
    }

    if (id && method === 'GET') {
        if (resource === 'documents') {
            const row = find(db.documents, id, 'Document request');
            const isStudent = (user.role || '').toLowerCase() === 'student';
            if (isStudent && row.user_id !== user.id) {
                fail(403, 'Unauthorized access to document');
            }
            return row;
        }
        if (resource === 'permissions') {
            const row = find(db.permissions, id, 'Permission request');
            const isStudent = (user.role || '').toLowerCase() === 'student';
            if (isStudent && row.user_id !== user.id) {
                fail(403, 'Unauthorized access to permission');
            }
            return row;
        }
    }

    const common = { ...base(), user_id: user.id, user_name: user.name, updated_at: null };

    if (!id && method === 'POST') {
        roles(user, 'student');
        if (resource === 'documents') {
            const data = documentCreate.parse(input);

            // Duplicate prevention: check if user already has an active request of this type
            const activeStatuses = ['pending', 'in_progress'];
            const hasActive = db.documents.some(doc =>
                doc.user_id === user.id &&
                doc.request_type === data.request_type &&
                activeStatuses.includes((doc.status || '').toLowerCase())
            );
            if (hasActive) {
                fail(409, 'You already have an active request of this type. Please wait until it is processed.');
            }

            // Residency check: Exit/Re-entry Visa is only allowed for Iqomah holders
            if (data.request_type === 'exit_reentry_visa') {
                const student = db.students.find(s => s.user_id === user.id);
                const residencyType = student?.residency_type || (student as any)?.residencyType;
                const residencyNumber = student?.residency_number || (student as any)?.residencyNumber || '';
                const isVisa = residencyType === 'STUDENT_VISA' || residencyNumber.startsWith('3') || residencyNumber.startsWith('4');
                if (isVisa) {
                    fail(403, 'Exit/Re-entry Visa is only available for students holding an Iqomah residency.');
                }

                // Check visa validity against Iqomah expiration date
                const iqomahExp = student?.residency_expiry || (student as any)?.residencyExpiry;
                if (iqomahExp && data.dynamic_data) {
                    const dyn = data.dynamic_data;
                    if (dyn.visa_validity_type === 'return_before' && dyn.return_to_ksa_before) {
                        if (String(dyn.return_to_ksa_before) > String(iqomahExp)) {
                            fail(400, 'The requested return date cannot exceed your Iqomah expiration date.');
                        }
                    } else if (dyn.visa_validity_type === 'duration_days' && dyn.duration_days) {
                        const now = new Date();
                        now.setHours(0, 0, 0, 0);
                        const expDate = new Date(iqomahExp.includes('T') ? iqomahExp : `${iqomahExp}T00:00:00`);
                        const maxDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                        if (Number(dyn.duration_days) > maxDays) {
                            fail(400, 'The requested visa duration cannot exceed your Iqomah validity period.');
                        }
                    }
                }
            }

            attachments(db, data.attachment_file_ids, user.id);
            const row: DocumentRequest = { ...common, ...data, dynamic_data: data.dynamic_data ?? null, status: 'pending' as const, admin_note: '' };
            db.documents.push(row);
            return row;
        }
        const data = permissionCreate.parse(input);
        if (data.end_date < data.start_date)
            fail(422, 'End date must be on or after start date');
        const row: Permission = {
            ...common,
            ...data,
            permission_type: (data.permission_type || 'OUT_OF_TOWN').toUpperCase(),
            status: 'PENDING',
            admin_note: '',
        };
        db.permissions.push(row);
        return row;
    }

    if (id && method === 'PATCH') {
        if (resource === 'documents') {
            const row = find(db.documents, id);
            const patch = documentUpdate.parse(input);
            const currentStatus = (row.status || '').toLowerCase();

            // Student operations on own pending document
            const isStudent = (user.role || '').toLowerCase() === 'student';
            if (isStudent) {
                if (row.user_id !== user.id) {
                    fail(403, 'Unauthorized access to document');
                }
                if (currentStatus !== 'pending') {
                    fail(400, 'Only pending document requests can be edited or cancelled');
                }

                const newStatus = (patch.status || '').toLowerCase();
                // Students can only change status to 'cancelled'
                if (patch.status !== undefined) {
                    if (newStatus === 'cancelled') {
                        row.status = 'cancelled';
                        row.updated_at = now();
                        return row;
                    }
                    fail(403, 'Unauthorized access to document');
                }

                if (patch.admin_note !== undefined) {
                    fail(403, 'Unauthorized access to document');
                }

                // Editing notes, attachments, dynamic_data
                if (patch.notes !== undefined) row.notes = patch.notes;
                if (patch.attachment_file_ids !== undefined) {
                    attachments(db, patch.attachment_file_ids, user.id);
                    row.attachment_file_ids = patch.attachment_file_ids;
                }
                if (patch.dynamic_data !== undefined) {
                    if (row.request_type === 'exit_reentry_visa' && patch.dynamic_data) {
                        const student = db.students.find(s => s.user_id === user.id);
                        const iqomahExp = student?.residency_expiry || (student as any)?.residencyExpiry;
                        if (iqomahExp) {
                            const dyn = patch.dynamic_data;
                            if (dyn.visa_validity_type === 'return_before' && dyn.return_to_ksa_before) {
                                if (String(dyn.return_to_ksa_before) > String(iqomahExp)) {
                                    fail(400, 'The requested return date cannot exceed your Iqomah expiration date.');
                                }
                            } else if (dyn.visa_validity_type === 'duration_days' && dyn.duration_days) {
                                const now = new Date();
                                now.setHours(0, 0, 0, 0);
                                const expDate = new Date(iqomahExp.includes('T') ? iqomahExp : `${iqomahExp}T00:00:00`);
                                const maxDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                if (Number(dyn.duration_days) > maxDays) {
                                    fail(400, 'The requested visa duration cannot exceed your Iqomah validity period.');
                                }
                            }
                        }
                    }
                    row.dynamic_data = patch.dynamic_data;
                }
                row.updated_at = now();
                return row;
            }

            roles(user, 'admin', 'staff');
            const newStatus = (patch.status || '').toUpperCase();

            // Validate that softcopy letter of enrollment requires result_file_id when marked COMPLETED
            if (
                row.request_type === 'letter_of_enrollment' &&
                row.dynamic_data?.delivery_method === 'softcopy' &&
                newStatus === 'COMPLETED' &&
                !patch.result_file_id &&
                !row.result_file_id
            ) {
                fail(400, 'A finalized letter PDF file must be uploaded before completing a softcopy letter of enrollment.');
            }

            Object.assign(row, patch, { updated_at: now() });

            // Hook: Automate student profile synchronization on COMPLETED
            if (newStatus === 'COMPLETED') {
                const student = db.students.find(s => s.user_id === row.user_id);
                if (student && row.dynamic_data) {
                    const dyn = row.dynamic_data;

                    if (row.request_type === 'update_passport') {
                        const newPassNum = dyn.new_passport_number || dyn.passport_number;
                        const newExp = dyn.date_of_expiry || dyn.passport_expiry;
                        const newIssue = dyn.date_of_issue || dyn.passport_issue_date;
                        const newOffice = dyn.issuing_office || dyn.passport_issuing_office;
                        const newFile = dyn.passport_file || dyn.passport_file_id;

                        if (newPassNum) {
                            student.passport_number = String(newPassNum);
                            (student as any).passportNumber = String(newPassNum);
                        }
                        if (newExp) {
                            student.passport_expiry = String(newExp);
                            (student as any).passportExpiry = String(newExp);
                        }
                        if (newIssue) {
                            (student as any).passport_issue_date = String(newIssue);
                            (student as any).passportIssueDate = String(newIssue);
                        }
                        if (newOffice) {
                            (student as any).passport_issuing_office = String(newOffice);
                            (student as any).passportIssuingOffice = String(newOffice);
                        }
                        if (newFile) {
                            student.passport_file_id = String(newFile);
                            (student as any).passportFileId = String(newFile);
                        }
                    } else if (row.request_type === 'iqomah_renewal') {
                        // Iqomah renewal is a staff-handled request.
                        // When staff completes it, notify student to update their Iqomah number in profile.
                        if (!row.admin_note) {
                            row.admin_note = "تم اكتمال تجديد الإقامة. يرجى التوجه إلى صفحة الملف الشخصي لتحديث رقم الإقامة وموعد الانتهاء الجديد. / Iqomah renewal completed. Please update your new Iqomah number & expiry in your Profile.";
                        }
                        const studentName = student.arabicName || student.englishName || student.full_name || row.user_name;
                        db.announcements.push({
                            id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                            title_en: "Iqomah Renewal Completed - Please Update Profile",
                            title_ar: "تم اكتمال تجديد الإقامة - يرجى تحديث الملف الشخصي",
                            body_en: `The Iqomah renewal request for ${studentName} has been completed by dormitory staff. Please update your new residency number and expiry date in your profile.`,
                            body_ar: `تم الانتهاء من تجديد الإقامة للطالب ${studentName} بنجاح. يرجى التوجه إلى صفحة الملف الشخصي لتحديث رقم الإقامة الجديد.`,
                            category: "IMMIGRATION",
                            attachment_file_ids: [],
                            author_name: user.name,
                            pinned: true,
                            form_id: null,
                            created_at: now(),
                        });
                    }
                }
            }

            return row;
        }

        if (resource === 'permissions') {
            const row = find(db.permissions, id);
            const data = permissionUpdate.parse(input);
            const newStatus = (data.status || '').toUpperCase();
            const currentStatus = (row.status || '').toUpperCase();

            // Student operations
            if (user.role === 'student') {
                if (row.user_id !== user.id) {
                    fail(403, 'Forbidden: You can only update your own permissions');
                }

                // 1. Student editing an existing PENDING permission
                if (currentStatus === 'PENDING' && !newStatus) {
                    const startDate = data.start_date || row.start_date;
                    const endDate = data.end_date || row.end_date;
                    if (endDate < startDate) {
                        fail(422, 'End date must be on or after start date');
                    }
                    if (data.permission_type) row.permission_type = data.permission_type.toUpperCase();
                    if (data.destination !== undefined) row.destination = data.destination;
                    if (data.transportation_mode !== undefined) row.transportation_mode = data.transportation_mode;
                    if (data.overnight_address !== undefined) row.overnight_address = data.overnight_address;
                    if (data.emergency_contact !== undefined) row.emergency_contact = data.emergency_contact;
                    if (data.ticket_attachment_id !== undefined) row.ticket_attachment_id = data.ticket_attachment_id;
                    if (data.start_date) row.start_date = data.start_date;
                    if (data.end_date) row.end_date = data.end_date;
                    if (data.reason) row.reason = data.reason;
                    row.updated_at = now();
                    return row;
                }

                // 2. Student Self Check-in ("Mulai Perjalanan": APPROVED -> ACTIVE)
                if (currentStatus === 'APPROVED' && newStatus === 'ACTIVE') {
                    row.status = 'ACTIVE';
                    row.updated_at = now();
                    return row;
                }

                // 3. Student Self Check-out ("Saya Sudah Kembali" / Arrived: ACTIVE -> COMPLETED) with Geofence check
                if (currentStatus === 'ACTIVE' && newStatus === 'COMPLETED') {
                    const geo = db.geofence_settings || defaultGeofenceSettings;
                    if (geo.enabled && data.latitude != null && data.longitude != null) {
                        const dist = getDistanceMeters(data.latitude, data.longitude, geo.latitude, geo.longitude);
                        if (dist > geo.radius_meters) {
                            fail(400, `Geofence validation failed: You are ${dist}m away from ${geo.name || 'dormitory'} (allowed radius: ${geo.radius_meters}m).`);
                        }
                    }
                    row.status = 'COMPLETED';
                    row.updated_at = now();
                    return row;
                }

                // 4. Student Cancelling an APPROVED or PENDING permission
                if ((currentStatus === 'APPROVED' || currentStatus === 'PENDING') && newStatus === 'CANCELLED') {
                    row.status = 'CANCELLED';
                    if (data.admin_note) {
                        row.admin_note = data.admin_note;
                    }
                    row.updated_at = now();
                    return row;
                }

                fail(400, `Cannot update permission in status ${currentStatus}`);
            }

            // Staff & Admin update (Shortcut Approve/Reject or Edit/Review dialog)
            roles(user, 'admin', 'staff');
            if (data.status) {
                row.status = newStatus;
            }
            if (data.admin_note !== undefined) {
                row.admin_note = data.admin_note;
            } else if (newStatus === 'APPROVED' && !row.admin_note) {
                row.admin_note = db.permission_settings?.default_approval_note || defaultPermissionSettings.default_approval_note;
            }
            if (data.destination !== undefined) row.destination = data.destination;
            if (data.reason !== undefined) row.reason = data.reason;
            if (data.start_date) row.start_date = data.start_date;
            if (data.end_date) row.end_date = data.end_date;
            row.updated_at = now();
            return row;
        }
    }

    if (id && method === 'DELETE') {
        if (resource === 'documents') {
            const row = find(db.documents, id);
            const isStudent = (user.role || '').toLowerCase() === 'student';
            if (isStudent) {
                if (row.user_id !== user.id) fail(403, 'Unauthorized access to document');
                if ((row.status || '').toLowerCase() !== 'pending') {
                    fail(400, 'Only pending document requests can be cancelled');
                }
                row.status = 'cancelled';
                row.updated_at = now();
                return { ok: true, status: 'cancelled' };
            }
            roles(user, 'admin', 'staff');
            db.documents = db.documents.filter(d => d.id !== id);
            return { ok: true };
        }
    }

    fail(405, 'Method not allowed');
}
