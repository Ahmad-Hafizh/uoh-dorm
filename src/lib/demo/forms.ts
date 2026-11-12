import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import type { Store, User, FormRecord, FormResponse } from './models.ts';
import { formCreate, formUpdate, responseCreate } from './models.ts';
import { roles, find, fail, base, sorted, recount, now, isFormClosed, validateQuestions, validateAnswers } from './helpers.ts';

async function exportToExcel(form: FormRecord, rows: FormResponse[]): Promise<Response> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'UoH Dormitory Management';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Responses', {
        views: [{ rightToLeft: false }],
    });

    const baseHeaders = [
        { header: 'Respondent', key: 'user_name', width: 25 },
        { header: 'Submitted At', key: 'submitted_at', width: 22 },
        { header: 'Updated At', key: 'updated_at', width: 22 },
    ];

    const questionHeaders = form.questions.map(q => ({
        header: q.label,
        key: `q_${q.id}`,
        width: Math.max(20, Math.min(q.label.length + 8, 50)),
    }));

    worksheet.columns = [...baseHeaders, ...questionHeaders];

    // Style Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }, // Slate-800
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 28;

    for (const row of rows) {
        const rowData: Record<string, unknown> = {
            user_name: row.user_name,
            submitted_at: row.submitted_at ? new Date(row.submitted_at).toLocaleString() : '',
            updated_at: row.updated_at ? new Date(row.updated_at).toLocaleString() : '',
        };
        for (const q of form.questions) {
            const val = row.answers[q.id];
            rowData[`q_${q.id}`] = Array.isArray(val) ? val.join(', ') : (val ?? '');
        }
        const addedRow = worksheet.addRow(rowData);
        addedRow.alignment = { vertical: 'middle' };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const safeTitle = form.title.replace(/[/\\?%*:|"<>]/g, '_') || 'responses';
    const encodedFilename = encodeURIComponent(safeTitle);

    return new Response(buffer, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${encodedFilename}.xlsx"; filename*=UTF-8''${encodedFilename}.xlsx`,
            'Cache-Control': 'no-store',
        },
    });
}

export async function forms(db: Store, user: User, id: string | undefined, action: string | undefined, extra: string | undefined, method: string, input: unknown): Promise<unknown> {
    if (!id && method === 'GET')
        return sorted(db.forms.filter(form => user.role !== 'student' || form.is_active)).map(form => ({
            ...form,
            is_closed: isFormClosed(form),
            response_count: db.responses.filter(row => row.form_id === form.id).length,
            my_submitted: db.responses.some(row => row.form_id === form.id && row.user_id === user.id),
        }));
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
            return { ...form, is_closed: isFormClosed(form) };
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
    if (action === 'clone' && method === 'POST') {
        roles(user, 'admin', 'staff');
        const cloned: FormRecord = {
            ...form,
            id: `form-${Date.now()}`,
            title: `${form.title} (Copy)`,
            is_active: false,
            closes_at: null,
            created_by: user.id,
            author_name: user.name,
            response_count: 0,
            created_at: now(),
            questions: form.questions.map(q => ({
                ...q,
                id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            })),
        };
        db.forms.push(cloned);
        return cloned;
    }
    if ((action === 'export' || (action === 'responses' && extra === 'export')) && method === 'GET') {
        roles(user, 'admin', 'staff');
        const rows = db.responses.filter(row => row.form_id === id).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
        return await exportToExcel(form, rows);
    }
    if (action === 'my-response' && method === 'GET') {
        roles(user, 'student');
        return db.responses.find(row => row.form_id === id && row.user_id === user.id) ?? fail(404, 'No response yet');
    }
    if (action === 'responses') {
        if (method === 'GET') {
            roles(user, 'admin', 'staff');
            if (extra)
                fail(404, 'Not found');
            const rows = db.responses.filter(row => row.form_id === id).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
            return rows;
        }
        if (method === 'POST' && !extra) {
            roles(user, 'student');
            if (isFormClosed(form))
                fail(400, 'This form is closed');
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
