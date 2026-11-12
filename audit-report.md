# 🔍 UoH Dormitory — Full Migration Audit Report

## Masalah Utama: Login Gagal Setelah Migrasi

Proyek ini dalam keadaan **setengah migrasi** — beberapa bagian sudah menggunakan BetterAuth + Neon DB, tapi sebagian besar masih menggunakan sistem demo lama (JSON file + cookie `demo_user`). Ini menyebabkan konflik fatal.

---

## 🚨 Temuan Kritis

### 1. Dua Sistem Auth yang Saling Bentrok
| Komponen | Sistem Baru (BetterAuth) | Sistem Lama (Demo JSON) |
|---|---|---|
| **Login form** (`Login.tsx`) | ✅ `signIn.email()` | ❌ Tidak dipakai |
| **Route guard** (`screen.tsx`) | ✅ `useSession()` | ❌ Tidak dipakai |
| **Layout/Navbar** (`Layout.tsx`) | ✅ `useSession()` + `signOut()` | ❌ Tidak dipakai |
| **Semua screen** (8 file) | ❌ | ✅ `useAuth()` → `api.get("/auth/me")` |
| **NotificationsContext** | ❌ | ✅ `useAuth()` → `api.get("/notifications/counts")` |
| **API route** (`[[...path]]/route.ts`) | ✅ BetterAuth handler | ❌ |
| **Data API** (students, complaints, dll) | ❌ **TIDAK ADA** | ✅ demo JSON handler |

> [!CAUTION]
> **Root cause**: Login via BetterAuth berhasil membuat session, tapi semua data API (`/api/students`, `/api/dashboard`, dll) **tidak ada handler-nya** di server. Semua screen memanggil `useAuth()` yang melakukan `api.get("/auth/me")` — endpoint ini tidak ada di BetterAuth, sehingga user tampak tidak terautentikasi.

### 2. Konflik Provider: AuthContext vs BetterAuth Session
- `providers.tsx` membungkus app dengan `<AuthProvider>` (sistem lama)
- `AuthProvider` memanggil `api.get("/auth/me")` saat mount → **404** → `user = false`
- `NotificationsProvider` bergantung pada `useAuth()` → selalu `!user` → tidak load
- `screen.tsx` menggunakan `useSession()` (BetterAuth) → **session valid**
- Tapi semua screen anak menggunakan `useAuth()` → **user = false**

### 3. API Route Hanya Menangani BetterAuth
```
src/app/api/[[...path]]/route.ts
```
Hanya mengekspos `POST/GET` dari `toNextJsHandler(auth)`. Ini hanya melayani:
- `POST /api/auth/sign-in/email`
- `GET /api/auth/get-session`
- `POST /api/auth/sign-out`
- dll endpoint BetterAuth

**Tidak ada handler untuk**: `/api/students`, `/api/dashboard`, `/api/complaints`, `/api/documents`, `/api/permissions`, `/api/announcements`, `/api/forms`, `/api/files`, `/api/notifications`, `/api/settings`, `/api/programs`, `/api/staff`

### 4. Seed Script Tidak Sinkron
- `seed.js` membuat `Account.providerId = "credential"` — ✅ benar
- `seed.js` membuat `Account.accountId = admin.email` — ⚠️ BetterAuth v1.x mengharapkan `accountId = user.id`
- Password di-hash dengan bcrypt → ✅ benar (auth.ts sudah punya custom bcrypt verifier)

### 5. Console Log di Prisma Client
```typescript
// src/lib/prisma.ts
console.log("🚨 URL DATABASE NEXT.JS:", process.env.DATABASE_URL);
```
Ini mencetak connection string (termasuk password) ke log!

---

## 📋 Rencana Perbaikan

### Fase 1: Fix Auth Flow (Kritis)
1. **Hapus `AuthContext.tsx`** — ganti semua `useAuth()` dengan wrapper BetterAuth
2. **Buat auth context baru** yang menggunakan `useSession()` dari BetterAuth
3. **Update semua screen** yang import `useAuth()` → pakai context baru
4. **Update `NotificationsContext`** → pakai session BetterAuth

### Fase 2: Build Server API Routes
5. **Buat API routes** untuk semua endpoint menggunakan Prisma + Neon DB
6. **Implementasi middleware auth** — validasi session BetterAuth di setiap API call
7. **Migrasi query** dari demo JSON ke Prisma queries

### Fase 3: Database & Seed
8. **Fix seed script** — pastikan `accountId` sesuai BetterAuth convention
9. **Jalankan migration** ke Neon DB
10. **Hapus debug log** dari prisma.ts

### Fase 4: Cleanup
11. **Hapus atau isolasi demo system** (simpan sebagai fallback development)
12. **Update `providers.tsx`**

---

## ⚡ Quick Fix (Minimum Viable Fix)

Karena membangun seluruh API layer dari nol adalah pekerjaan besar, **quick fix** yang paling efisien adalah:

1. **Sinkronkan auth context** — buat `useAuth()` membaca dari BetterAuth session
2. **Integrasikan demo service** sebagai fallback API handler di route
3. **Fix seed script** untuk BetterAuth compatibility
4. **Re-seed database**

Ini akan membuat login bekerja tanpa harus menulis ulang semua API endpoint.
