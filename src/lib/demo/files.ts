import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { Store, User, FileRecord } from './models.ts';
import { base, find, fail } from './helpers.ts';
import { dataPath } from './store.ts';
function pathFor(key: string) { const base = resolve(dirname(dataPath()), 'uploads'); const target = resolve(base, key); if (!target.startsWith(base + sep))
    fail(400, 'Invalid file path'); return target; }
const meta = (file: FileRecord) => { const { storage_path: _path, ...result } = file; return result; };
export async function files(db: Store, user: User, id: string | undefined, action: string | undefined, request: Request, save: (value: unknown) => Promise<Response>): Promise<Response | unknown> {
    if (id === 'upload' && request.method === 'POST') {
        const payload = await request.formData(), file = payload.get('file'), kind = payload.get('kind') ?? 'general';
        if (!(file instanceof File) || typeof kind !== 'string' || kind.length > 50)
            fail(400, 'Invalid upload');
        if (file.size > 10 * 1024 * 1024)
            fail(413, 'File exceeds 10MB limit');
        if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'].includes(file.type))
            fail(422, 'Upload a PDF, JPEG, PNG, GIF or WebP file');
        const record: FileRecord = { ...base(), original_filename: file.name, content_type: file.type, size: file.size, kind, uploaded_by: user.id, is_deleted: false, storage_path: randomUUID() };
        const path = pathFor(record.storage_path);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, new Uint8Array(await file.arrayBuffer()));
        db.files.push(record);
        try {
            return await save(meta(record));
        }
        catch (error) {
            await unlink(path).catch(() => undefined);
            throw error;
        }
    }
    const file = find(db.files.filter(file => !file.is_deleted), id, 'File');
    if (user.role === 'student' && file.uploaded_by !== user.id)
        fail(404, 'File not found');
    if (request.method === 'GET' && action === 'download') {
        let bytes: Buffer;
        try {
            bytes = await readFile(pathFor(file.storage_path));
        }
        catch {
            fail(404, 'File content not found');
        }
        return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': file.content_type, 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.original_filename)}`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' } });
    }
    if (request.method === 'GET' && !action)
        return meta(file);
    fail(405, 'Method not allowed');
}
