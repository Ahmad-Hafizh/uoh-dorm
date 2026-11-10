import { randomUUID } from 'node:crypto';
import type { Store, User, FormRecord, FormResponse } from './models.ts';
import { formCreate, formUpdate, responseCreate } from './models.ts';
import { roles, find, fail, base, sorted, recount, now, csv, validateQuestions, validateAnswers } from './helpers.ts';
export function forms(db: Store, user: User, id: string | undefined, action: string | undefined, extra: string | undefined, method: string, input: unknown): unknown {
    if (!id && method === 'GET')
        return sorted(db.forms.filter(form => user.role !== 'student' || form.is_active)).map(form => ({ ...form, response_count: db.responses.filter(row => row.form_id === form.id).length, my_submitted: db.responses.some(row => row.form_id === form.id && row.user_id === user.id) }));
    if (!id && method === 'POST') {
        roles(user, 'admin', 'staff');
        const data = formCreate.parse(input);
        validateQuestions(data.questions);
        const form: FormRecord = { ...base(), ...data, created_by: user.id, author_name: user.name, response_count: 0 };
        db.forms.push(form);
        if (form.is_active)
            db.announcements.push({ ...base(), title_en: `New form: ${form.title}`, title_ar: `نموذج جديد: ${form.title}`, body_en: 'Please complete the new form.', body_ar: 'يرجى تعبئة النموذج الجديد.', pinned: false, author_name: user.name, form_id: form.id });
        return form;
    }
    const form = find(db.forms, id, 'Form');
    if (!action) {
        if (method === 'GET') {
            if (user.role === 'student' && !form.is_active)
                fail(404, 'Form not found');
            return form;
        }
        if (method === 'PATCH') {
            roles(user, 'admin', 'staff');
            const data = formUpdate.parse(input);
            if (!Object.keys(data).length)
                fail(400, 'No fields to update');
            if (data.questions)
                validateQuestions(data.questions);
            Object.assign(form, data);
            return form;
        }
        if (method === 'DELETE') {
            roles(user, 'admin');
            db.forms = db.forms.filter(row => row.id !== id);
            db.responses = db.responses.filter(row => row.form_id !== id);
            db.announcements = db.announcements.filter(row => row.form_id !== id);
            return { ok: true };
        }
    }
    if (action === 'my-response' && method === 'GET') {
        roles(user, 'student');
        return db.responses.find(row => row.form_id === id && row.user_id === user.id) ?? fail(404, 'No response yet');
    }
    if (action === 'responses') {
        if (method === 'GET') {
            roles(user, 'admin', 'staff');
            const rows = db.responses.filter(row => row.form_id === id).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
            if (extra === 'export') {
                const lines = [['Respondent', 'Submitted at', 'Updated at', ...form.questions.map(q => q.label)], ...rows.map(row => [row.user_name, row.submitted_at, row.updated_at, ...form.questions.map(q => row.answers[q.id])])];
                return new Response('\ufeff' + lines.map(line => line.map(csv).join(',')).join('\r\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="responses.csv"', 'Cache-Control': 'no-store' } });
            }
            if (extra)
                fail(404, 'Not found');
            return rows;
        }
        if (method === 'POST' && !extra) {
            roles(user, 'student');
            if (!form.is_active)
                fail(400, 'Form is closed');
            const { answers } = responseCreate.parse(input);
            validateAnswers(form.questions, answers);
            const existing = db.responses.find(row => row.form_id === id && row.user_id === user.id);
            const response: FormResponse = existing ?? { id: randomUUID(), form_id: form.id, user_id: user.id, user_name: user.name, submitted_at: now(), updated_at: null, answers };
            response.answers = answers;
            if (existing)
                response.updated_at = now();
            else
                db.responses.push(response);
            recount(db);
            return response;
        }
    }
    fail(405, 'Method not allowed');
}
