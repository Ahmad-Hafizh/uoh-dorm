import type { Store, User, Complaint, ComplaintCategory, ComplaintMessage } from './models.ts';
import { complaintCategorySchema, complaintCategoryUpdate, complaintMessageCreate } from './models.ts';
import { roles, find, fail, base, now } from './helpers.ts';

const DEFAULT_CATEGORIES: ComplaintCategory[] = [
    { id: 'cat-elec', name: 'الكهرباء والإنارة (Electrical)', description: 'Lighting, power outlets, switches, fuses', is_active: true },
    { id: 'cat-plumb', name: 'السباكة والمياه (Plumbing)', description: 'Faucets, pipes, drainage, water supply, leaks', is_active: true },
    { id: 'cat-ac', name: 'التكييف والتهوية (HVAC & AC)', description: 'AC units, heating, ventilation filters', is_active: true },
    { id: 'cat-net', name: 'الإنترنت والشبكات (Internet & Wi-Fi)', description: 'Wi-Fi connectivity, Ethernet ports, router', is_active: true },
    { id: 'cat-furn', name: 'الأثاث والنجارة (Furniture & Doors)', description: 'Beds, desks, wardrobes, window blinds, door locks', is_active: true },
    { id: 'cat-clean', name: 'النظافة ومكافحة الآفات (Cleanliness & Pest Control)', description: 'Room cleaning, hallways, pest issues', is_active: true },
    { id: 'cat-other', name: 'مرافق عامة أخرى (General Facilities)', description: 'Elevators, laundry rooms, study rooms, general maintenance', is_active: true },
];

export function ensureComplaintDefaults(db: Store) {
    if (!db.complaint_categories || db.complaint_categories.length === 0) {
        db.complaint_categories = [...DEFAULT_CATEGORIES];
    }
    if (!db.complaint_messages) {
        db.complaint_messages = [];
    }
    // Migrate legacy complaints if missing ticket_number or category_id
    if (db.complaints) {
        db.complaints.forEach((c, idx) => {
            if (!c.ticket_number) {
                const yyyymm = (c.created_at || now()).slice(0, 7).replace('-', '');
                c.ticket_number = `CMP-${yyyymm}-${String(idx + 1).padStart(3, '0')}`;
            }
            if (!c.priority) {
                c.priority = 'MEDIUM';
            }
            if (!c.status) {
                c.status = 'PENDING';
            } else if (typeof c.status === 'string') {
                c.status = c.status.toUpperCase();
            }
            if (!c.category_id) {
                const match = db.complaint_categories?.find(cat =>
                    cat.id.includes(c.category || '') || cat.name.toLowerCase().includes((c.category || '').toLowerCase())
                );
                c.category_id = match ? match.id : 'cat-other';
                c.category_name = match ? match.name : c.category || 'General';
            }
            if (!c.student_id) {
                c.student_id = c.user_id || 'student';
                c.student_name = c.user_name || 'Student';
            }
        });
    }
}

export function complaintCategories(db: Store, user: User, id: string | undefined, method: string, input: unknown): unknown {
    ensureComplaintDefaults(db);
    if (!id && method === 'GET') {
        const list = db.complaint_categories || [];
        if (user.role === 'student') {
            return list.filter(c => c.is_active);
        }
        return list;
    }
    if (!id && method === 'POST') {
        roles(user, 'admin');
        const data = complaintCategorySchema.parse(input);
        const cat: ComplaintCategory = {
            id: `cat-${Date.now()}`,
            name: data.name,
            description: data.description || null,
            is_active: data.is_active ?? true,
            created_at: now(),
            updated_at: null,
        };
        db.complaint_categories!.push(cat);
        return cat;
    }
    if (id) {
        const cat = (db.complaint_categories || []).find(c => c.id === id);
        if (!cat) fail(404, 'Category not found');
        if (method === 'GET') return cat;
        if (method === 'PATCH') {
            roles(user, 'admin');
            const data = complaintCategoryUpdate.parse(input);
            Object.assign(cat, data, { updated_at: now() });
            return cat;
        }
        if (method === 'DELETE') {
            roles(user, 'admin');
            db.complaint_categories = (db.complaint_categories || []).filter(c => c.id !== id);
            return { ok: true };
        }
    }
    fail(405, 'Method not allowed');
}

export function complaints(
    db: Store,
    user: User,
    id: string | undefined,
    action: string | undefined,
    method: string,
    input: unknown,
    url: string
): unknown {
    ensureComplaintDefaults(db);

    // List Complaints
    if (!id && method === 'GET') {
        let list = [...(db.complaints || [])];

        // Role filtering: Student sees only their own tickets
        if (user.role === 'student') {
            list = list.filter(c => c.student_id === user.id || c.user_id === user.id);
        }

        // Query params filtering
        try {
            const urlObj = new URL(url);
            const status = urlObj.searchParams.get('status')?.toUpperCase();
            const priority = urlObj.searchParams.get('priority')?.toUpperCase();
            const categoryId = urlObj.searchParams.get('categoryId') || urlObj.searchParams.get('category_id');

            if (status && status !== 'ALL') {
                list = list.filter(c => String(c.status).toUpperCase() === status);
            }
            if (priority && priority !== 'ALL') {
                list = list.filter(c => String(c.priority).toUpperCase() === priority);
            }
            if (categoryId && categoryId !== 'ALL') {
                list = list.filter(c => c.category_id === categoryId);
            }
        } catch {}

        // Populate category name, message counts, and assigned staff
        return list
            .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
            .map(c => {
                const cat = (db.complaint_categories || []).find(k => k.id === c.category_id);
                const assigned = c.assigned_to_id ? db.users.find(u => u.id === c.assigned_to_id) : null;
                const msgCount = (db.complaint_messages || []).filter(
                    m => m.complaint_id === c.id && (user.role !== 'student' || !m.is_internal_note)
                ).length;
                return {
                    ...c,
                    status: String(c.status).toUpperCase(),
                    priority: String(c.priority || 'MEDIUM').toUpperCase(),
                    category_name: cat ? cat.name : (c.category_name || c.category || 'General'),
                    assigned_to_name: assigned ? assigned.name : (c.assigned_to_name || null),
                    messages_count: msgCount,
                };
            });
    }

    // Create Complaint
    if (!id && method === 'POST') {
        const body = (typeof input === 'object' && input ? input : {}) as Record<string, any>;
        const title = String(body.title || '').trim();
        const description = String(body.description || '').trim();
        const category_id = String(body.category_id || body.categoryId || 'cat-other').trim();
        const location_details = body.location_details ? String(body.location_details).trim() : null;
        const priority = (['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(String(body.priority).toUpperCase())
            ? String(body.priority).toUpperCase()
            : 'MEDIUM') as any;
        const attachments = Array.isArray(body.attachments) ? body.attachments : [];

        if (!title || !description) {
            fail(422, 'Title and description are required');
        }

        const nowD = new Date();
        const yyyymm = nowD.getFullYear().toString() + String(nowD.getMonth() + 1).padStart(2, '0');
        const countThisMonth = (db.complaints || []).filter(c => (c.created_at || '').startsWith(nowD.toISOString().slice(0, 7))).length + 1;
        const ticket_number = `CMP-${yyyymm}-${String(countThisMonth).padStart(3, '0')}`;

        const cat = (db.complaint_categories || []).find(k => k.id === category_id);

        const newComplaint: Complaint = {
            id: `cmp-${Date.now()}`,
            ticket_number,
            title,
            description,
            location_details,
            attachments,
            status: 'PENDING',
            priority,
            category_id,
            category_name: cat ? cat.name : 'General',
            student_id: user.id,
            student_name: user.name,
            student_email: user.email,
            assigned_to_id: null,
            assigned_to_name: null,
            created_at: now(),
            updated_at: null,
            // legacy
            user_id: user.id,
            user_name: user.name,
            category: cat ? cat.name : 'facility',
            admin_response: '',
        };

        if (!db.complaints) db.complaints = [];
        db.complaints.push(newComplaint);
        return newComplaint;
    }

    // Specific Complaint
    if (id) {
        const complaint = (db.complaints || []).find(c => c.id === id || c.ticket_number === id);
        if (!complaint) fail(404, 'Complaint not found');

        // Permission check
        if (user.role === 'student' && complaint.student_id !== user.id && complaint.user_id !== user.id) {
            fail(403, 'Access denied');
        }

        // Messages Sub-resource: POST /api/complaints/[id]/messages
        if (action === 'messages') {
            if (method === 'GET') {
                const msgs = (db.complaint_messages || []).filter(
                    m => m.complaint_id === complaint.id && (user.role !== 'student' || !m.is_internal_note)
                );
                return msgs.sort((a, b) => a.created_at.localeCompare(b.created_at));
            }
            if (method === 'POST') {
                const parsed = complaintMessageCreate.parse(input);
                const isInternal = user.role !== 'student' && Boolean(parsed.is_internal_note);
                const msg: ComplaintMessage = {
                    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    complaint_id: complaint.id,
                    sender_id: user.id,
                    sender_name: user.name,
                    sender_role: user.role,
                    message: parsed.message,
                    attachments: parsed.attachments || [],
                    is_internal_note: isInternal,
                    created_at: now(),
                };
                if (!db.complaint_messages) db.complaint_messages = [];
                db.complaint_messages.push(msg);

                // If staff replies publicly and status was PENDING, auto move to IN_PROGRESS
                if (user.role !== 'student' && !isInternal && complaint.status === 'PENDING') {
                    complaint.status = 'IN_PROGRESS';
                    complaint.updated_at = now();
                }
                return msg;
            }
            fail(405, 'Method not allowed');
        }

        // GET /api/complaints/[id]
        if (!action && method === 'GET') {
            const cat = (db.complaint_categories || []).find(k => k.id === complaint.category_id);
            const assigned = complaint.assigned_to_id ? db.users.find(u => u.id === complaint.assigned_to_id) : null;
            const msgs = (db.complaint_messages || []).filter(
                m => m.complaint_id === complaint.id && (user.role !== 'student' || !m.is_internal_note)
            );

            return {
                ...complaint,
                status: String(complaint.status).toUpperCase(),
                priority: String(complaint.priority || 'MEDIUM').toUpperCase(),
                category_name: cat ? cat.name : (complaint.category_name || complaint.category || 'General'),
                assigned_to_name: assigned ? assigned.name : (complaint.assigned_to_name || null),
                messages: msgs.sort((a, b) => a.created_at.localeCompare(b.created_at)),
            };
        }

        // PATCH /api/complaints/[id]
        if (!action && method === 'PATCH') {
            const body = (typeof input === 'object' && input ? input : {}) as Record<string, any>;

            // Student role: can only mark as RESOLVED ("Selesai")
            if (user.role === 'student') {
                if (body.status === 'RESOLVED') {
                    complaint.status = 'RESOLVED';
                    complaint.updated_at = now();
                    return complaint;
                }
                fail(403, 'Students can only mark tickets as resolved');
            }

            // Staff & Admin roles: full ticket management
            roles(user, 'admin', 'staff');
            if (body.status) {
                const s = String(body.status).toUpperCase();
                if (['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'].includes(s)) {
                    complaint.status = s as any;
                }
            }
            if (body.priority) {
                const p = String(body.priority).toUpperCase();
                if (['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(p)) {
                    complaint.priority = p as any;
                }
            }
            if ('assigned_to_id' in body) {
                complaint.assigned_to_id = body.assigned_to_id || null;
                const assigned = complaint.assigned_to_id ? db.users.find(u => u.id === complaint.assigned_to_id) : null;
                complaint.assigned_to_name = assigned ? assigned.name : null;
                if (complaint.assigned_to_id && complaint.status === 'PENDING') {
                    complaint.status = 'ASSIGNED';
                }
            }
            if (body.admin_response) {
                complaint.admin_response = String(body.admin_response);
            }
            complaint.updated_at = now();
            return complaint;
        }

        // DELETE /api/complaints/[id]
        if (!action && method === 'DELETE') {
            roles(user, 'admin');
            db.complaints = (db.complaints || []).filter(c => c.id !== complaint.id);
            db.complaint_messages = (db.complaint_messages || []).filter(m => m.complaint_id !== complaint.id);
            return { ok: true };
        }
    }

    fail(405, 'Method not allowed');
}

