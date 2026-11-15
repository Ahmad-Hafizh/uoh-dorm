import { z } from 'zod';
import type { Store, StudyProgram } from './models.ts';
import { defaultProfileEditSettings, defaultGeofenceSettings, defaultPermissionSettings, defaultSystemSettings, studyProgramSchema, studyProgramUpdate } from './models.ts';
import { withStore, writeStore } from './store.ts';
import { ApiError, fail, json, now } from './helpers.ts';
import { accounts } from './accounts.ts';
import { requests } from './requests.ts';
import { forms } from './forms.ts';
import { files } from './files.ts';
import { dashboard } from './dashboard.ts';
import { complaintCategories, complaints } from './complaints.ts';
async function dispatch(request: Request, db: Store): Promise<Response> {
    const parts = new URL(request.url).pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean), [resource, id, action, extra] = parts, method = request.method;
    let input: unknown = {};
    if (['POST', 'PATCH'].includes(method) && resource !== 'files') {
        try {
            const text = await request.text();
            input = text.trim() ? JSON.parse(text) : {};
        }
        catch {
            fail(400, 'Invalid JSON');
        }
    }
    const rawCookie = request.headers.get('cookie')?.match(/(?:^|;\s*)demo_user=([^;]+)/)?.[1];
    let cookieIdentifier: string | undefined;
    if (rawCookie) {
        try {
            cookieIdentifier = decodeURIComponent(rawCookie).trim().toLowerCase();
        } catch {
            cookieIdentifier = rawCookie.trim().toLowerCase();
        }
    }
    const current = cookieIdentifier
        ? db.users.find((u) => {
            const normId = u.id?.toLowerCase();
            const normEmail = u.email?.toLowerCase();
            const normPrefix = normEmail ? normEmail.split('@')[0] : '';
            return (
                normId === cookieIdentifier ||
                normEmail === cookieIdentifier ||
                normPrefix === cookieIdentifier
            );
        })
        : undefined;
    if (resource === 'auth') {
        if (id === 'login' && method === 'POST') {
            const credentials = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(input);
            const user = db.users.find(row => row.email === credentials.email.toLowerCase().trim()) ?? fail(401, 'Unknown demo account');
            return json({ user }, 200, { 'Set-Cookie': `demo_user=${user.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200` });
        }
        if (id === 'logout' && method === 'POST')
            return json({ ok: true }, 200, { 'Set-Cookie': 'demo_user=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' });
        if (id === 'me' && method === 'GET')
            return current ? json(current) : json({ detail: 'Not authenticated' }, 401);
        fail(405, 'Method not allowed');
    }
    if (!resource && method === 'GET')
        return json({ status: 'ok', mode: 'local-json-demo' });
    const user = current ?? fail(401, 'Not authenticated');
    const save = async (value: unknown) => { await writeStore(db); return json(value); };
    let result: unknown;
    if (resource === 'dashboard' && method === 'GET')
        return json(dashboard(db, user, id));
    if (resource === 'notifications') {
        if (id === 'mark-read' && method === 'POST') {
            const { resource: read } = z.object({ resource: z.enum(['announcements', 'permissions', 'documents']) }).parse(input);
            const key = read === 'announcements'
                ? 'announcements_last_read_at'
                : read === 'permissions'
                    ? 'permissions_last_read_at'
                    : 'documents_last_read_at';
            user[key] = now();
            return save({ ok: true });
        }
        if (id === 'counts' && method === 'GET') {
            if (user.role !== 'student') {
                return json({
                    forms_unread: 0,
                    announcements_unread: 0,
                    permissions_pending: db.permissions.filter(row => (row.status || '').toLowerCase() === 'pending').length,
                    permissions_updates: 0,
                    documents_pending: db.documents.filter(row => ['pending', 'in_progress'].includes((row.status || '').toLowerCase())).length,
                    documents_updates: 0,
                });
            } else {
                return json({
                    forms_unread: db.forms.filter(form => form.is_active && !db.responses.some(row => row.form_id === form.id && row.user_id === user.id)).length,
                    announcements_unread: db.announcements.filter(row => row.created_at > (user.announcements_last_read_at ?? '')).length,
                    permissions_pending: 0,
                    permissions_updates: db.permissions.filter(row => row.user_id === user.id && ['approved', 'rejected'].includes((row.status || '').toLowerCase()) && (row.updated_at ?? '') > (user.permissions_last_read_at ?? '')).length,
                    documents_pending: 0,
                    documents_updates: db.documents.filter(row => row.user_id === user.id && (row.updated_at ?? '') > (user.documents_last_read_at ?? '')).length,
                });
            }
        }
        fail(405, 'Method not allowed');
    }
    if (resource === 'settings') {
        if (id === 'profile-permissions') {
            if (method === 'GET')
                return json(db.profile_edit_settings || defaultProfileEditSettings);
            if (method === 'PATCH' || method === 'POST') {
                if (user.role !== 'admin')
                    fail(403, 'Admin only');
                db.profile_edit_settings = {
                    ...defaultProfileEditSettings,
                    ...(db.profile_edit_settings || {}),
                    ...(typeof input === 'object' && input ? input : {})
                };
                return save(db.profile_edit_settings);
            }
            fail(405, 'Method not allowed');
        }
        if (id === 'geofence') {
            if (method === 'GET')
                return json(db.geofence_settings || defaultGeofenceSettings);
            if (method === 'PATCH' || method === 'POST') {
                if (user.role !== 'admin')
                    fail(403, 'Admin only');
                db.geofence_settings = {
                    ...defaultGeofenceSettings,
                    ...(db.geofence_settings || {}),
                    ...(typeof input === 'object' && input ? input : {})
                };
                return save(db.geofence_settings);
            }
            fail(405, 'Method not allowed');
        }
        if (id === 'permissions') {
            if (method === 'GET')
                return json(db.permission_settings || defaultPermissionSettings);
            if (method === 'PATCH' || method === 'POST') {
                if (user.role !== 'admin')
                    fail(403, 'Admin only');
                db.permission_settings = {
                    ...defaultPermissionSettings,
                    ...(db.permission_settings || {}),
                    ...(typeof input === 'object' && input ? input : {})
                };
                return save(db.permission_settings);
            }
            fail(405, 'Method not allowed');
        }
        if (id === 'system' || id === 'ticket-window') {
            if (method === 'GET')
                return json(db.system_settings || defaultSystemSettings);
            if (method === 'PATCH' || method === 'POST') {
                if (user.role !== 'admin' && user.role !== 'staff')
                    fail(403, 'Admin or staff only');
                db.system_settings = {
                    ...defaultSystemSettings,
                    ...(db.system_settings || {}),
                    ...(typeof input === 'object' && input ? input : {}),
                    updated_at: now(),
                };
                return save(db.system_settings);
            }
            fail(405, 'Method not allowed');
        }
        fail(404, 'Not found');
    }
    if (resource === 'programs') {
        if (method === 'GET') {
            return json(db.programs || []);
        }
        if (user.role !== 'admin')
            fail(403, 'Admin only');
        if (method === 'POST') {
            const parsed = studyProgramSchema.parse(input);
            if (!db.programs) db.programs = [];
            const newProgram: StudyProgram = {
                id: `prog-${Date.now()}`,
                name_ar: parsed.name_ar,
                name_en: parsed.name_en,
                created_at: now(),
            };
            db.programs.push(newProgram);
            return save(newProgram);
        }
        if (method === 'PATCH') {
            if (!id) fail(400, 'Program ID required');
            const prog = (db.programs || []).find(p => p.id === id);
            if (!prog) fail(404, 'Program not found');
            const parsed = studyProgramUpdate.parse(input);
            Object.assign(prog, parsed);
            return save(prog);
        }
        if (method === 'DELETE') {
            if (!id) fail(400, 'Program ID required');
            const idx = (db.programs || []).findIndex(p => p.id === id);
            if (idx === -1) fail(404, 'Program not found');
            db.programs!.splice(idx, 1);
            return save({ ok: true });
        }
        fail(405, 'Method not allowed');
    }
    if (resource === 'students' || resource === 'staff')
        result = accounts(db, user, resource, id, method, input);
    else if (resource === 'complaint-categories')
        result = complaintCategories(db, user, id, method, input);
    else if (resource === 'complaints')
        result = complaints(db, user, id, action, method, input, request.url);
    else if (['documents', 'permissions', 'announcements'].includes(resource))
        result = requests(db, user, resource, id, method, input);
    else if (resource === 'forms')
        result = await forms(db, user, id, action, extra, method, input);
    else if (resource === 'files')
        result = await files(db, user, id, action, request, save);
    else
        fail(404, 'Not found');
    if (result instanceof Response)
        return result;
    return method === 'GET' ? json(result) : save(result);
}
/** JSON-backed local demo; replace the cookie identity and storage boundary with Better Auth and Prisma before deploying real data. */
export async function demoHandler(request: Request): Promise<Response> {
    try {
        return await withStore(db => dispatch(request, db));
    }
    catch (error) {
        if (error instanceof ApiError)
            return json({ detail: error.message, message: error.message }, error.status);
        if (error instanceof z.ZodError)
            return json({ detail: error.issues.map(issue => ({ msg: issue.message, loc: issue.path })) }, 422);
        console.error('Demo API failed', error);
        return json({ detail: 'Demo request failed' }, 500);
    }
}
