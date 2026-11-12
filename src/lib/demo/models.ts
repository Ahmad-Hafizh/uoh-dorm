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
export const profileSchema = z.object({
    full_name: z.string().optional(),
    arabicName: z.string().optional(),
    englishName: z.string().optional(),
    universityId: z.union([z.string(), z.number()]).optional(),
    arrivalDate: z.string().optional().nullable(),
    programStudy: z.string().optional(),
    academicYear: z.string().optional(),
    residenceStatus: z.enum(['INSIDE_SAKAN', 'OUTSIDE_SAKAN']).optional().default('INSIDE_SAKAN'),
    address: z.string().optional().nullable(),
    academicStatus: z.enum(['ACTIVE', 'ON_LEAVE']).optional().default('ACTIVE'),
    adminNotes: z.string().optional().nullable(),
    nationality: text,
    passport_number: text,
    passport_expiry: z.string(),
    iqomah_number: text,
    iqomah_expiry: z.string(),
    phone: text,
    building: z.string().optional(),
    room_number: z.string().optional().nullable(),
    program: z.string().optional(),
    academic_year: z.string().optional()
});
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
export type ComplaintStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';
export type ComplaintPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface ComplaintCategory {
    id: string;
    name: string;
    description?: string | null;
    is_active: boolean;
    created_at?: string;
    updated_at?: string | null;
}

export const complaintCategorySchema = z.object({
    name: text,
    description: z.string().optional().nullable(),
    is_active: z.boolean().default(true),
});
export const complaintCategoryUpdate = complaintCategorySchema.partial();

export interface ComplaintMessage {
    id: string;
    complaint_id: string;
    sender_id: string;
    sender_name: string;
    sender_role: string;
    message: string;
    attachments?: string[] | null;
    is_internal_note: boolean;
    created_at: string;
}

export const complaintMessageCreate = z.object({
    message: text,
    attachments: z.array(z.string()).optional().nullable(),
    is_internal_note: z.boolean().default(false),
});

export const complaintCreateSchema = z.object({
    title: text,
    description: text,
    category_id: text,
    location_details: z.string().optional().nullable(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
    attachments: z.array(z.string()).optional().nullable(),
});

export const complaintUpdateSchema = z.object({
    status: z.enum(['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED']).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    assigned_to_id: z.string().optional().nullable(),
    admin_response: z.string().optional().nullable(),
});

export const complaintCreate = z.object({ category: z.string().default('facility'), title: text, description: text });
export const complaintUpdate = z.object({ status: z.string().optional(), admin_response: z.string().optional() });
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
export interface Complaint extends Owned {
    ticket_number: string;
    title: string;
    description: string;
    location_details?: string | null;
    attachments?: string[] | null;
    status: any;
    priority: ComplaintPriority;
    category_id: string;
    category_name?: string;
    student_id: string;
    student_name: string;
    student_email?: string;
    assigned_to_id?: string | null;
    assigned_to_name?: string | null;
    messages?: ComplaintMessage[];
    category?: string;
    admin_response?: string;
}
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
export const questionSchema = z.object({
    id: text,
    label: text,
    type: z.enum(['text', 'textarea', 'single_choice', 'multi_choice', 'number', 'date', 'time', 'dropdown', 'file']),
    options: z.array(text).nullable().optional(),
    is_required: z.boolean().default(false),
    required: z.boolean().default(false),
}).transform(q => ({
    ...q,
    is_required: q.is_required || q.required,
    required: q.is_required || q.required,
}));
export const formCreate = z.object({
    title: text,
    description: z.string().default(''),
    closes_at: z.string().nullable().optional(),
    questions: z.array(questionSchema).min(1),
    is_active: z.boolean().default(true),
});
export const formUpdate = formCreate.partial();
export type Question = z.infer<typeof questionSchema>;
export type FormRecord = z.infer<typeof formCreate> & {
    id: string;
    created_by: string;
    author_name: string;
    response_count: number;
    created_at: string;
    closes_at?: string | null;
    is_closed?: boolean;
};
export const responseCreate = z.object({ answers: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.string()), z.null()])) });
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
export interface ProfileEditSettings {
    allowArabicName: boolean;
    allowEnglishName: boolean;
    allowPhone: boolean;
    allowNationality: boolean;
    allowUniversityId: boolean;
    allowProgramStudy: boolean;
    allowAcademicYear: boolean;
    allowArrivalDate: boolean;
    allowResidenceStatus: boolean;
    allowRoomNumber: boolean;
    allowAddress: boolean;
    allowPassportInfo: boolean;
    allowIqamahInfo: boolean;
    allowDocumentsUpload: boolean;
}
export const defaultProfileEditSettings: ProfileEditSettings = {
    allowArabicName: false,
    allowEnglishName: false,
    allowPhone: true,
    allowNationality: false,
    allowUniversityId: false,
    allowProgramStudy: false,
    allowAcademicYear: false,
    allowArrivalDate: false,
    allowResidenceStatus: false,
    allowRoomNumber: false,
    allowAddress: true,
    allowPassportInfo: false,
    allowIqamahInfo: false,
    allowDocumentsUpload: true,
};
export interface StudyProgram {
    id: string;
    name_ar: string;
    name_en: string;
    created_at: string;
}
export const studyProgramSchema = z.object({
    name_ar: text,
    name_en: text,
});
export const studyProgramUpdate = studyProgramSchema.partial();

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
    profile_edit_settings?: ProfileEditSettings;
    programs?: StudyProgram[];
    complaint_categories?: ComplaintCategory[];
    complaint_messages?: ComplaintMessage[];
}
