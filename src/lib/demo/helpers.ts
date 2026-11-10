import { randomUUID } from 'node:crypto';
import type { Store, User, Role, Question, Answers } from './models.ts';
export class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) { super(message); this.status = status; }
}
export function fail(status: number, message: string): never { throw new ApiError(status, message); }
export const now = () => new Date().toISOString();
export const base = () => ({ id: randomUUID(), created_at: now() });
export const json = (value: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
export function roles(user: User, ...allowed: Role[]) { if (!allowed.includes(user.role))
    fail(403, 'Forbidden'); }
export function find<T extends {
    id: string;
}>(rows: T[], id: string | undefined, label = 'Record'): T { return rows.find(row => row.id === id) ?? fail(404, `${label} not found`); }
export function own<T extends {
    user_id: string;
}>(rows: T[], user: User) { return user.role === 'student' ? rows.filter(row => row.user_id === user.id) : rows; }
export function sorted<T extends {
    created_at: string;
}>(rows: T[]) { return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)); }
export function attachments(db: Store, ids: (string | null | undefined)[], owner: string) { for (const id of ids.filter(Boolean))
    if (!db.files.some(file => file.id === id && file.uploaded_by === owner && !file.is_deleted))
        fail(400, 'Invalid attachment'); }
export function assignProfileFiles(db: Store, ids: (string | null | undefined)[], actor: string, owner: string) { for (const id of ids.filter(Boolean)) {
    const file = find(db.files, id ?? undefined, 'File');
    if (file.is_deleted || ![actor, owner].includes(file.uploaded_by))
        fail(400, 'Invalid attachment');
} for (const id of ids.filter(Boolean))
    find(db.files, id ?? undefined).uploaded_by = owner; }
export function recount(db: Store) { for (const form of db.forms)
    form.response_count = db.responses.filter(row => row.form_id === form.id).length; }
export function days(date: string) { return Math.floor((Date.parse(date + 'T00:00:00Z') - Date.parse(now().slice(0, 10) + 'T00:00:00Z')) / 86400000); }
export function csv(value: unknown) { let text = Array.isArray(value) ? value.join(', ') : String(value ?? ''); if (/^\s*[=+@-]/.test(text))
    text = "'" + text; return '"' + text.replaceAll('"', '""') + '"'; }
export function validateQuestions(questions: Question[]) { const ids = new Set<string>(); for (const question of questions) {
    if (ids.has(question.id))
        fail(422, 'Question IDs must be unique');
    ids.add(question.id);
    if (['single_choice', 'multi_choice'].includes(question.type) && !question.options?.length)
        fail(422, 'Choice questions need options');
} }
export function validateAnswers(questions: Question[], answers: Answers) { for (const question of questions) {
    const answer = answers[question.id], empty = answer == null || answer === '' || Array.isArray(answer) && !answer.length;
    if (empty) {
        if (question.required)
            fail(422, `Required: ${question.label}`);
        continue;
    }
    if (question.type === 'multi_choice') {
        if (!Array.isArray(answer) || answer.some(value => !question.options?.includes(value)))
            fail(422, 'Invalid choice');
    }
    else {
        if (Array.isArray(answer))
            fail(422, 'Invalid answer');
        if (question.type === 'single_choice' && !question.options?.includes(String(answer)))
            fail(422, 'Invalid choice');
        if (question.type === 'number' && !Number.isFinite(Number(answer)))
            fail(422, 'Invalid number');
        if (question.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(String(answer)))
            fail(422, 'Invalid date');
    }
} }
