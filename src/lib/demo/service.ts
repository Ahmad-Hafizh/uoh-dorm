import { z } from 'zod';
import type { Store } from './models.ts';
import { withStore, writeStore } from './store.ts';
import { ApiError, fail, json, now } from './helpers.ts';
import { accounts } from './accounts.ts';
import { requests } from './requests.ts';
import { forms } from './forms.ts';
import { files } from './files.ts';
import { dashboard } from './dashboard.ts';
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
    const cookie = request.headers.get('cookie')?.match(/(?:^|;\s*)demo_user=([^;]+)/)?.[1], current = db.users.find(user => user.id === cookie);
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
            const { resource: read } = z.object({ resource: z.enum(['announcements', 'permissions']) }).parse(input);
            user[read === 'announcements' ? 'announcements_last_read_at' : 'permissions_last_read_at'] = now();
            return save({ ok: true });
        }
        if (id === 'counts' && method === 'GET')
            return json(user.role !== 'student' ? { forms_unread: 0, announcements_unread: 0, permissions_pending: db.permissions.filter(row => row.status === 'pending').length, permissions_updates: 0 } : { forms_unread: db.forms.filter(form => form.is_active && !db.responses.some(row => row.form_id === form.id && row.user_id === user.id)).length, announcements_unread: db.announcements.filter(row => row.created_at > (user.announcements_last_read_at ?? '')).length, permissions_pending: 0, permissions_updates: db.permissions.filter(row => row.user_id === user.id && ['approved', 'rejected'].includes(row.status) && (row.updated_at ?? '') > (user.permissions_last_read_at ?? '')).length });
        fail(405, 'Method not allowed');
    }
    if (resource === 'students' || resource === 'staff')
        result = accounts(db, user, resource, id, method, input);
    else if (['complaints', 'documents', 'permissions', 'announcements'].includes(resource))
        result = requests(db, user, resource, id, method, input);
    else if (resource === 'forms')
        result = forms(db, user, id, action, extra, method, input);
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
            return json({ detail: error.message }, error.status);
        if (error instanceof z.ZodError)
            return json({ detail: error.issues.map(issue => ({ msg: issue.message, loc: issue.path })) }, 422);
        console.error('Demo API failed', error);
        return json({ detail: 'Demo request failed' }, 500);
    }
}
