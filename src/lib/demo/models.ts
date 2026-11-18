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
    documents_last_read_at?: string;
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
    passport_issue_date: z.string().optional().nullable(),
    passportIssueDate: z.string().optional().nullable(),
    passport_issuing_office: z.string().optional().nullable(),
    passportIssuingOffice: z.string().optional().nullable(),
    residency_number: z
        .string()
        .min(10, "Nomor identitas minimal 10 digit")
        .regex(/^[234]\d{9}$/, "Nomor identitas harus 10 digit dan diawali angka 2, 3, atau 4"),
    residency_expiry: z.string(),
    residency_type: z.enum(["IQOMAH", "STUDENT_VISA"]).optional().default("IQOMAH"),
    iqomah_number: z.string().optional(),
    iqomah_expiry: z.string().optional(),
    phone: text,
    building: z.string().optional(),
    room_number: z.string().optional().nullable(),
    program: z.string().optional(),
    academic_year: z.string().optional()
});
export const fileFields = z.object({
    passport_file_id: z.string().nullable().optional(),
    iqomah_file_id: z.string().nullable().optional(),
    residency_file_id: z.string().nullable().optional(),
});
export const studentCreate = profileSchema.merge(fileFields).extend({ email: z.string().email(), password: z.string().min(1) });
export const studentUpdate = profileSchema.partial().merge(fileFields);
export type Student = z.infer<typeof profileSchema> & {
    id: string;
    user_id: string;
    created_at: string;
    passport_file_id: string | null;
    iqomah_file_id: string | null;
    residency_file_id?: string | null;
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
export const documentCreateBase = z.object({
    request_type: z.enum(['iqomah_renewal', 'return_ticket', 'letter_of_enrollment', 'exit_reentry_visa', 'update_passport', 'other']),
    notes: z.string().default(''),
    attachment_file_ids: z.array(z.string()).default([]),
    dynamic_data: z.record(z.string(), z.any()).optional().nullable(),
});

export const documentCreate = documentCreateBase.superRefine((data, ctx) => {
    if (data.request_type === 'letter_of_enrollment') {
        const dyn = data.dynamic_data || {};
        if (!dyn.addressed_to || typeof dyn.addressed_to !== 'string' || !dyn.addressed_to.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Addressed To is required for letter of enrollment',
                path: ['dynamic_data', 'addressed_to'],
            });
        }
        if (dyn.addressed_to === 'Other' && (!dyn.addressed_to_other || typeof dyn.addressed_to_other !== 'string' || !dyn.addressed_to_other.trim())) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Please specify the institution',
                path: ['dynamic_data', 'addressed_to_other'],
            });
        }
        if (!dyn.letter_language || !['ar', 'en'].includes(dyn.letter_language)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Language is required for letter of enrollment',
                path: ['dynamic_data', 'letter_language'],
            });
        }
    }
});
export const documentStatusEnum = z.enum(['pending', 'in_progress', 'approved', 'rejected', 'completed', 'cancelled']);
export type DocumentStatus = z.infer<typeof documentStatusEnum>;

export const documentUpdate = z.object({
    status: documentStatusEnum.optional(),
    admin_note: z.string().optional(),
    notes: z.string().optional(),
    attachment_file_ids: z.array(z.string()).optional(),
    dynamic_data: z.record(z.string(), z.any()).optional().nullable(),
    result_file_id: z.string().optional().nullable(),
});
export const permissionTypeEnum = z.enum(['OUT_OF_TOWN', 'OVERNIGHT', 'VACATION']);
export type PermissionType = z.infer<typeof permissionTypeEnum>;

export const permissionStatusEnum = z.enum(['PENDING', 'APPROVED', 'ACTIVE', 'COMPLETED', 'REJECTED', 'CANCELLED']);
export type PermissionStatus = z.infer<typeof permissionStatusEnum>;

export const permissionCreate = z.object({
    permission_type: z.enum(['OUT_OF_TOWN', 'OVERNIGHT', 'VACATION', 'outing', 'overnight', 'vacation']),
    destination: z.string().optional().nullable(),
    transportation_mode: z.string().optional().nullable(),
    overnight_address: z.string().optional().nullable(),
    emergency_contact: z.string().optional().nullable(),
    ticket_attachment_id: z.string().optional().nullable(),
    start_date: z.string(),
    end_date: z.string(),
    reason: text,
});
export const permissionUpdate = z.object({
    status: z.enum(['PENDING', 'APPROVED', 'ACTIVE', 'COMPLETED', 'REJECTED', 'CANCELLED', 'pending', 'approved', 'active', 'completed', 'rejected', 'cancelled']).optional(),
    admin_note: z.string().optional(),
    permission_type: z.enum(['OUT_OF_TOWN', 'OVERNIGHT', 'VACATION', 'outing', 'overnight', 'vacation']).optional(),
    destination: z.string().optional().nullable(),
    transportation_mode: z.string().optional().nullable(),
    overnight_address: z.string().optional().nullable(),
    emergency_contact: z.string().optional().nullable(),
    ticket_attachment_id: z.string().optional().nullable(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    reason: text.optional(),
    latitude: z.number().optional().nullable(),
    longitude: z.number().optional().nullable(),
    distance_meters: z.number().optional().nullable(),
});
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
    status: DocumentStatus;
    admin_note: string;
    result_file_id?: string | null;
};
export type Permission = Owned & {
    permission_type: string;
    destination?: string | null;
    transportation_mode?: string | null;
    overnight_address?: string | null;
    emergency_contact?: string | null;
    ticket_attachment_id?: string | null;
    start_date: string;
    end_date: string;
    reason: string;
    status: string;
    admin_note: string;
};
export const announcementCategoryEnum = z.enum(['GENERAL', 'URGENT', 'TRANSPORT', 'IMMIGRATION', 'EVENT']);
export type AnnouncementCategory = z.infer<typeof announcementCategoryEnum>;

export const announcementCreate = z.object({
    title_en: text,
    title_ar: text,
    body_en: text,
    body_ar: text,
    category: announcementCategoryEnum.default('GENERAL'),
    attachment_file_ids: z.array(z.string()).nullable().optional().default([]),
    acknowledged_by: z.array(z.string()).optional().default([]),
    pinned: z.boolean().default(false),
    form_id: z.string().nullable().optional(),
});

export const announcementUpdate = z.object({
    title_en: text.optional(),
    title_ar: text.optional(),
    body_en: text.optional(),
    body_ar: text.optional(),
    category: announcementCategoryEnum.optional(),
    attachment_file_ids: z.array(z.string()).nullable().optional(),
    acknowledged_by: z.array(z.string()).optional(),
    pinned: z.boolean().optional(),
    form_id: z.string().nullable().optional(),
});

export interface AnnouncementFormStatus {
    form_id: string;
    title?: string;
    is_active: boolean;
    is_closed: boolean;
    has_responded: boolean;
    closes_at?: string | null;
    question_count?: number;
}

export type Announcement = {
    id: string;
    title_en: string;
    title_ar: string;
    body_en: string;
    body_ar: string;
    category: AnnouncementCategory | string;
    attachment_file_ids?: string[] | null;
    acknowledged_by?: string[];
    acknowledged_count?: number;
    has_acknowledged?: boolean;
    pinned: boolean;
    author_name: string;
    created_at: string;
    form_id?: string | null;
    form_status?: AnnouncementFormStatus | null;
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
export interface GeofenceSettings {
    enabled: boolean;
    name: string;
    latitude: number;
    longitude: number;
    radius_meters: number;
}

export const defaultGeofenceSettings: GeofenceSettings = {
    enabled: true,
    name: "University of Hail Student Housing",
    latitude: 27.5450,
    longitude: 41.7100,
    radius_meters: 500,
};

export interface PermissionSettings {
    default_approval_note: string;
}

export const defaultPermissionSettings: PermissionSettings = {
    default_approval_note: "Permission approved. Wishing you a safe trip and a safe return, fee amani Allah.",
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

export interface SystemSetting {
    id: string;
    is_ticket_window_open: boolean;
    print_letterhead_url?: string | null;
    print_logo_url?: string | null;
    print_header_title_ar?: string | null;
    print_header_subtitle_ar?: string | null;
    print_header_title_en?: string | null;
    print_header_subtitle_en?: string | null;
    print_layout_style?: "standard" | "custom_image" | string;
    print_signature_name?: string | null;
    print_footer_text?: string | null;
    updated_at?: string;
}
export const defaultSystemSettings: SystemSetting = {
    id: 'global',
    is_ticket_window_open: false,
    print_letterhead_url: null,
    print_logo_url: null,
    print_header_title_ar: 'المملكة العربية السعودية',
    print_header_subtitle_ar: 'وزارة التعليم\nجامعة حائل\nعمادة شؤون الطلاب · إدارة الإسكان الطلابي',
    print_header_title_en: 'Kingdom of Saudi Arabia',
    print_header_subtitle_en: 'Ministry of Education\nUniversity of Hail\nDeanship of Student Affairs · Housing Admin',
    print_layout_style: 'standard',
    print_signature_name: 'د. فهد الشمري (مشرف الإسكان)',
    print_footer_text: null,
};

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
    geofence_settings?: GeofenceSettings;
    permission_settings?: PermissionSettings;
    system_settings?: SystemSetting;
    programs?: StudyProgram[];
    complaint_categories?: ComplaintCategory[];
    complaint_messages?: ComplaintMessage[];
}
