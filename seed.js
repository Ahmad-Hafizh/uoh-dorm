const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('Membuat ulang akun demo sesuai PRD...');

    // ✅ TAMBAHKAN 2 BARIS INI AGAR TIDAK ERROR DUPLIKAT SAAT DI-SEED ULANG:
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();

    const passwordHash = await bcrypt.hash('password123', 10);

    // --- 1. Buat Akun ADMIN ---
    const admin = await prisma.user.create({
        data: {
            email: 'admin@uoh.edu.sa',
            name: 'Admin Sakan UoH',
            emailVerified: true,
            role: 'ADMIN',
            createdAt: new Date(),
            updatedAt: new Date()
        },
    });

    await prisma.account.create({
        data: {
            userId: admin.id,
            accountId: admin.id,
            providerId: 'credential',
            password: passwordHash,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    });

    // --- 2. Buat Akun STAFF ---
    const staff = await prisma.user.create({
        data: {
            email: 'staff@uoh.edu.sa',
            name: 'Staff Sakan UoH',
            emailVerified: true,
            role: 'STAFF',
            createdAt: new Date(),
            updatedAt: new Date()
        },
    });

    await prisma.account.create({
        data: {
            userId: staff.id,
            accountId: staff.id,
            providerId: 'credential',
            password: passwordHash,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    });

    // --- 3. Buat Akun STUDENT ---
    const student = await prisma.user.create({
        data: {
            email: 'student@uoh.edu.sa',
            name: 'Student UoH',
            emailVerified: true,
            role: 'STUDENT',
            createdAt: new Date(),
            updatedAt: new Date()
        },
    });

    await prisma.account.create({
        data: {
            userId: student.id,
            accountId: student.id,
            providerId: 'credential',
            password: passwordHash,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    });

    console.log('✅ Akun demo berhasil dibuat!');
    console.log('--------------------------------------------------');
    console.log('👉 Akun Admin   : admin@uoh.edu.sa   | Pass: password123');
    console.log('👉 Akun Staff   : staff@uoh.edu.sa   | Pass: password123');
    console.log('👉 Akun Student : student@uoh.edu.sa | Pass: password123');
    console.log('--------------------------------------------------');
}


main()
    .catch((e) => {
        console.error('Gagal membuat akun:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });