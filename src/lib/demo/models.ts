import { z } from 'zod';
export const roleSchema = z.enum(['admin', 'staff', 'student']);
export type Role = z.infer<typeof roleSchema>;
export interface User {
    id: string;
    name: string;
    email: string;
    role: Role;
    created_at: string;
    announcements_last_read_at?: string;
    permissions_last_read_at?: string;
}
const text = z.string().trim().min(1);
export const profileSchema = z.object({ full_name: text, nationality: text, passport_number: text, passport_expiry: z.string().date(), iqomah_number: text, iqomah_expiry: z.string().date(), phone: text, building: text, room_number: text, program: text, academic_year: text });
export const fileFields = z.object({ passport_file_id: z.string().nullable().optional(), iqomah_file_id: z.string().nullable().optional() });
export const studentCreate = profileSchema.merge(fileFields).extend({ email: z.string().email(), password: z.string().min(1) });
export const studentUpdate = profileSchema.partial().merge(fileFields);
export type Student = z.infer<typeof profileSchema> & {
    id: string;
    user_id: string;
    created_at: string;
    passport_file_id: string | null;
    iqomah_file_id: string | null;
    photo_url?: string | null;
};
export const staffCreate = z.object({ name: text, email: z.string().email(), password: z.string().min(1), role: z.enum(['admin', 'staff']) });
export const staffUpdate = staffCreate.omit({ email: true }).partial();
export const complaintCreate = z.object({ category: z.enum(['facility', 'academic', 'roommate', 'other']), title: text, description: text });
export const complaintUpdate = z.object({ status: z.enum(['pending', 'in_progress', 'resolved', 'rejected']), admin_response: z.string().optional() });
export const documentCreate = z.object({ request_type: z.enum(['iqomah_renewal', 'return_ticket', 'letter_of_enrollment', 'exit_reentry_visa', 'other']), notes: z.string().default(''), attachment_file_ids: z.array(z.string()).default([]) });
export const documentUpdate = z.object({ status: z.enum(['pending', 'in_progress', 'approved', 'rejected', 'completed']), admin_note: z.string().optional() });
export const permissionCreate = z.object({ permission_type: z.enum(['outing', 'overnight', 'vacation']), destination: text, start_date: z.string().date(), end_date: z.string().date(), reason: text });
export const permissionUpdate = z.object({ status: z.enum(['pending', 'approved', 'rejected']), admin_note: z.string().optional() });
interface Owned {
    id: string;
    user_id: string;
    user_name: string;
    created_at: string;
    updated_at: string | null;
}
export type Complaint = Owned & z.infer<typeof complaintCreate> & {
    status: z.infer<typeof complaintUpdate>['status'];
    admin_response: string;
};
export type DocumentRequest = Owned & z.infer<typeof documentCreate> & {
    status: z.infer<typeof documentUpdate>['status'];
    admin_note: string;
};
export type Permission = Owned & z.infer<typeof permissionCreate> & {
    status: z.infer<typeof permissionUpdate>['status'];
    admin_note: string;
};
export const announcementCreate = z.object({ title_en: text, title_ar: text, body_en: text, body_ar: text, pinned: z.boolean().default(false) });
export type Announcement = z.infer<typeof announcementCreate> & {
    id: string;
    author_name: string;
    created_at: string;
    form_id?: string | null;
};
export const questionSchema = z.object({ id: text, label: text, type: z.enum(['text', 'textarea', 'single_choice', 'multi_choice', 'number', 'date']), options: z.array(text).nullable().optional(), required: z.boolean().default(false) });
export const formCreate = z.object({ title: text, description: z.string().default(''), questions: z.array(questionSchema).min(1), is_active: z.boolean().default(true) });
export const formUpdate = formCreate.partial();
export type Question = z.infer<typeof questionSchema>;
export type FormRecord = z.infer<typeof formCreate> & {
    id: string;
    created_by: string;
    author_name: string;
    response_count: number;
    created_at: string;
};
export const responseCreate = z.object({ answers: z.record(z.union([z.string(), z.number(), z.array(z.string()), z.null()])) });
export type Answers = z.infer<typeof responseCreate>['answers'];
export interface FormResponse {
    id: string;
    form_id: string;
    user_id: string;
    user_name: string;
    answers: Answers;
    submitted_at: string;
    updated_at: string | null;
}
export interface FileRecord {
    id: string;
    storage_path: string;
    original_filename: string;
    content_type: string;
    size: number;
    kind: string;
    uploaded_by: string;
    is_deleted: boolean;
    created_at: string;
}
export interface Store {
    users: User[];
    students: Student[];
    complaints: Complaint[];
    documents: DocumentRequest[];
    permissions: Permission[];
    announcements: Announcement[];
    forms: FormRecord[];
    responses: FormResponse[];
    files: FileRecord[];
}
