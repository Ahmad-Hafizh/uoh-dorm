import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs"; // ✅ Import bcryptjs ditambahkan

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
        // ✅ Konfigurasi bcrypt diaktifkan agar bisa membaca password dari seed.js
        password: {
            hash: async (password) => {
                return await bcrypt.hash(password, 10);
            },
            verify: async ({ hash, password }) => {
                return await bcrypt.compare(password, hash);
            }
        }
    },
    // Mengizinkan custom payload dari Prisma ke Session client-side
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 Hari
    },
    user: {
        additionalFields: {
            role: {
                type: "string",
                required: false,
                defaultValue: "STUDENT"
            },
            announcementsLastReadAt: {
                type: "date",
                required: false
            },
            permissionsLastReadAt: {
                type: "date",
                required: false
            }
        }
    }
});