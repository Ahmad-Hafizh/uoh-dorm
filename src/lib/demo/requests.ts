import type { Store, User, DocumentRequest, Permission } from './models.ts';
import { documentCreate, documentUpdate, permissionCreate, permissionUpdate, announcementCreate } from './models.ts';
import { roles, find, fail, base, sorted, own, attachments, now } from './helpers.ts';
import { announcements } from './dashboard.ts';
export function requests(db: Store, user: User, resource: string, id: string | undefined, method: string, input: unknown): unknown {
    if (resource === 'announcements') {
        if (!id && method === 'GET')
            return announcements(db);
        roles(user, 'admin', 'staff');
        if (!id && method === 'POST') {
            const row = { ...base(), ...announcementCreate.parse(input), author_name: user.name, form_id: null };
            db.announcements.push(row);
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
    if (!id && method === 'GET')
        return sorted(own<DocumentRequest | Permission>(db[resource], user));
    const common = { ...base(), user_id: user.id, user_name: user.name, updated_at: null, status: 'pending' as const };
    if (!id && method === 'POST') {
        roles(user, 'student');
        if (resource === 'documents') {
            const data = documentCreate.parse(input);
            attachments(db, data.attachment_file_ids, user.id);
            const row: DocumentRequest = { ...common, ...data, admin_note: '' };
            db.documents.push(row);
            return row;
        }
        const data = permissionCreate.parse(input);
        if (data.end_date < data.start_date)
            fail(422, 'End date must be on or after start date');
        const row: Permission = { ...common, ...data, admin_note: '' };
        db.permissions.push(row);
        return row;
    }
    if (id && method === 'PATCH') {
        roles(user, 'admin', 'staff');
        if (resource === 'documents') {
            const row = find(db.documents, id);
            Object.assign(row, documentUpdate.parse(input), { updated_at: now() });
            return row;
        }
        const row = find(db.permissions, id);
        Object.assign(row, permissionUpdate.parse(input), { updated_at: now() });
        return row;
    }
    fail(405, 'Method not allowed');
}
