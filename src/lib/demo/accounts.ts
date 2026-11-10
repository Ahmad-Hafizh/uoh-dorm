import type { Store, User, Student } from './models.ts';
import { studentCreate, studentUpdate, staffCreate, staffUpdate, fileFields } from './models.ts';
import { roles, find, fail, base, sorted, attachments, assignProfileFiles, recount } from './helpers.ts';
export function accounts(db: Store, user: User, resource: string, id: string | undefined, method: string, input: unknown): unknown {
    if (resource === 'students') {
        if (id === 'me') {
            roles(user, 'student');
            const profile = db.students.find(row => row.user_id === user.id) ?? fail(404, 'Profile not found');
            if (method === 'GET')
                return profile;
            if (method === 'PATCH') {
                const data = fileFields.parse(input);
                if (!Object.keys(data).length)
                    fail(400, 'No fields to update');
                attachments(db, Object.values(data), user.id);
                Object.assign(profile, data);
                return profile;
            }
            fail(405, 'Method not allowed');
        }
        roles(user, 'admin', 'staff');
        if (!id && method === 'GET')
            return sorted(db.students);
        if (!id && method === 'POST') {
            const { email, password: _password, ...profile } = studentCreate.parse(input);
            if (db.users.some(row => row.email === email.toLowerCase()))
                fail(400, 'Email already registered');
            const account: User = { ...base(), email: email.toLowerCase(), name: profile.full_name, role: 'student' };
            assignProfileFiles(db, [profile.passport_file_id, profile.iqomah_file_id], user.id, account.id);
            const student: Student = { ...base(), ...profile, user_id: account.id, passport_file_id: profile.passport_file_id ?? null, iqomah_file_id: profile.iqomah_file_id ?? null, photo_url: null };
            db.users.push(account);
            db.students.push(student);
            return student;
        }
        const profile = find(db.students, id, 'Student');
        if (method === 'PATCH') {
            const data = studentUpdate.parse(input);
            if (!Object.keys(data).length)
                fail(400, 'No fields to update');
            assignProfileFiles(db, [data.passport_file_id, data.iqomah_file_id], user.id, profile.user_id);
            Object.assign(profile, data);
            const account = db.users.find(row => row.id === profile.user_id);
            if (account && data.full_name)
                account.name = data.full_name;
            return profile;
        }
        if (method === 'DELETE') {
            roles(user, 'admin');
            db.students = db.students.filter(row => row.id !== id);
            db.users = db.users.filter(row => row.id !== profile.user_id);
            db.responses = db.responses.filter(row => row.user_id !== profile.user_id);
            recount(db);
            return { ok: true };
        }
        fail(405, 'Method not allowed');
    }
    roles(user, 'admin');
    if (!id && method === 'GET')
        return db.users.filter(row => row.role !== 'student');
    if (!id && method === 'POST') {
        const { password: _password, ...data } = staffCreate.parse(input);
        data.email = data.email.toLowerCase();
        if (db.users.some(row => row.email === data.email))
            fail(400, 'Email already registered');
        const account: User = { ...base(), ...data };
        db.users.push(account);
        return account;
    }
    const account = find(db.users.filter(row => row.role !== 'student'), id, 'Staff');
    if (method === 'PATCH') {
        const { password: _password, ...data } = staffUpdate.parse(input);
        if (account.id === user.id && data.role && data.role !== 'admin')
            fail(400, 'Cannot demote yourself');
        Object.assign(account, data);
        return account;
    }
    if (method === 'DELETE') {
        if (account.id === user.id)
            fail(400, 'Cannot delete yourself');
        db.users = db.users.filter(row => row.id !== id);
        return { ok: true };
    }
    fail(405, 'Method not allowed');
}
