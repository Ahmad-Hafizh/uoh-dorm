# PRD — UoH Dormitory Management System

> **Dokumen ini adalah SINGLE SOURCE OF TRUTH.**  
> Setiap AI agent, developer, atau kontributor **WAJIB** membaca dan mematuhi seluruh constraint, arsitektur, dan aturan yang tertulis di sini sebelum melakukan perubahan kode apapun. Perubahan yang melanggar constraint pada Bagian 14 akan merusak aplikasi.

---

## 1. Ringkasan Produk

**Nama Aplikasi:** UoH Dormitory Management System (`uoh-dorm`)  
**Institusi:** University of Hail (UoH), Arab Saudi  
**Tagline:** International Student Dormitory Management  
**Deskripsi:** Sistem manajemen asrama mahasiswa internasional berbasis web yang memungkinkan admin, staf, dan mahasiswa untuk mengelola data hunian, pengaduan, dokumen, pengumuman, izin keluar, dan formulir digital dalam satu platform terpadu.

---

## 2. Tech Stack

| Layer | Teknologi |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **Runtime** | Node.js ≥22.18 |
| **Language** | TypeScript 5.9 |
| **UI Library** | React 19 |
| **Styling** | Tailwind CSS 3 + `tailwind-merge` + `tailwindcss-animate` |
| **UI Components** | Radix UI (via shadcn/ui) |
| **Icons** | Lucide React |
| **HTTP Client** | Axios |
| **State/Cache** | TanStack React Query v5 |
| **Forms** | React Hook Form + Zod v4 |
| **Charts** | Recharts |
| **Notifications** | Sonner (toast) |
| **Database & ORM** | PostgreSQL (Neon DB) + Prisma v5 |
| **Authentication** | Better Auth v1.x dengan custom bcryptjs verifier |
| **Data API Backend** | Hybrid System (Better Auth + Demo JSON Fallback) |
| **Demo Backend** | Hono + JSON file store (lokal, in-process) |
| **i18n** | Custom context (`I18nContext`) — AR & EN |
| **File Upload** | `browser-image-compression` + multipart/form-data |
| **Export** | ExcelJS (CSV/Excel export) |

---

## 3. Arsitektur Sistem

### 3.1 Mode Saat Ini: Hybrid (Better Auth + Demo JSON Fallback)

Aplikasi berjalan dalam **mode hybrid** — autentikasi ditangani oleh **Better Auth** yang terkoneksi ke **Neon PostgreSQL** via Prisma, sementara endpoint data masih menggunakan **demo JSON handler** (Hono) dengan bridge cookie.

**Alur request pada catch-all route (`src/app/api/[[...path]]/route.ts`):**

```
Request masuk ke /api/*
    │
    ├── /api/auth/*  →  Better Auth handler (auth.handler)
    │                    Login, logout, session, sign-up dll.
    │                    Langsung return — tidak masuk demo handler.
    │
    └── /api/* (selain auth)  →  Dual-Write Sync + Session Bridge + Demo Handler
         │
         ├── [Temporary Dual-Write Account Sync]:
         │    Jika request adalah POST /api/students atau POST /api/staff,
         │    request di-clone (`request.clone()`) untuk sinkronisasi kredensial (User & Account)
         │    ke Neon PostgreSQL via Prisma (dengan bcryptjs hash) sebelum diteruskan.
         │    Hal ini memastikan akun baru dapat langsung login via Better Auth.
         │
         ├── 1. Ambil session dari Better Auth (auth.api.getSession)
         ├── 2. Gunakan full email session (`session.user.email`)
         ├── 3. Inject cookie `demo_user=${session.user.email}` ke request headers
         └── 4. Forward ke demoHandler (Hono JSON store dengan lookup user case-insensitive: id, email, atau prefix)
```

**Catatan Bridge & Resolusi User `demo_user`:**
- Pada `src/app/api/[[...path]]/route.ts`, bridge meneruskan full email `session.user.email` ke cookie `demo_user`.
- Pada `src/lib/demo/service.ts`, pencarian pengguna (`db.users.find`) dilakukan secara *case-insensitive* dengan mencocokkan `id`, full `email`, ATAU prefix email (`email.split("@")[0]`). Hal ini memastikan baik akun seed (`id: "admin"`, `"staff"`, `"student"`) maupun akun baru yang ber-UUID (seperti `"student1@uoh.edu.sa"`) dapat ditemukan secara tepat tanpa error 401. Backward compatibility untuk `AuthContext.tsx` (yang meng-inject prefix di browser cookie) tetap terjaga 100%.

**Catatan Sinkronisasi Dual-Write Akun (Temporary Dual-Write Account Sync):**
Selama sistem berada dalam mode hybrid, pembuatan mahasiswa (`POST /api/students`) dan staf (`POST /api/staff`) menerapkan mekanisme *dual-write*:
- Request dicegat pada `src/app/api/[[...path]]/route.ts` menggunakan stream cloning (`request.clone()`) agar payload stream asli tetap utuh dan dapat dibaca oleh `demoHandler`.
- Kredensial akun (`email`, `password` yang di-hash dengan `bcryptjs`, dan `role`: `STUDENT` atau `STAFF`/`ADMIN`) disimpan ke tabel `user` dan `account` di Neon PostgreSQL via Prisma jika belum ada. `accountId` pada tabel `account` wajib bernilai identik dengan `user.id`.
- Request asli kemudian diteruskan ke `demoHandler` untuk disimpan ke `demo/data.json`.
- Seluruh proses dual-write dibungkus dalam blok `try/catch` fail-safe agar peringatan database dicatat ke konsol tanpa memblokir eksekusi `demoHandler`.

**Client-side bridge (`AuthContext.tsx`):**
- `AuthProvider` membungkus `useSession()` dari Better Auth
- Saat session aktif, cookie `demo_user` ditanamkan via `document.cookie` agar request browser ke data endpoint juga membawa identitas demo
- Cookie dibersihkan saat logout

> [!CAUTION]
> **JANGAN PERNAH** menghapus atau memodifikasi `demoHandler` di `route.ts` atau cookie injector `demo_user` di `AuthContext.tsx`. Kedua komponen ini adalah **critical bridge** antara Better Auth dan legacy JSON data store. Menghapusnya akan memutus seluruh data API.

### 3.2 Target Arsitektur (Production — Masa Depan)

```
Next.js App Router
  ├── Frontend (React 19 + Tailwind)
  └── API Route → Better Auth + Prisma v5 → Neon (PostgreSQL)
                  (tanpa demo JSON fallback)
```

Target ini dicapai melalui **migrasi endpoint bertahap** — satu per satu endpoint data dipindahkan dari demo JSON handler ke Prisma queries langsung.

### 3.3 Struktur Direktori

```
uoh-dorm/
├── prisma/
│   └── schema.prisma          # ⭐ Prisma schema (PostgreSQL) — Better Auth + Domain models
├── seed.js                    # ⭐ Database seeder (Neon DB accounts)
├── demo/
│   ├── data.json              # Runtime data store (demo mode)
│   └── seed.json              # Data awal (seed) untuk demo
├── src/
│   ├── app/                   # Next.js App Router pages
│   │   ├── layout.tsx         # Root layout (RTL default, provider wrap)
│   │   ├── providers.tsx      # QueryClient, I18n, Auth, Notifications, Toaster
│   │   ├── screen.tsx         # Route guard & screen switcher (Better Auth session)
│   │   ├── page.tsx           # → screen "dashboard"
│   │   ├── login/page.tsx
│   │   ├── students/page.tsx
│   │   ├── staff/page.tsx
│   │   ├── complaints/page.tsx
│   │   ├── documents/page.tsx
│   │   ├── announcements/page.tsx
│   │   ├── permissions/page.tsx
│   │   ├── forms/page.tsx
│   │   ├── profile/page.tsx
│   │   └── api/[[...path]]/route.ts  # ⭐ Unified catch-all (Better Auth + Demo bridge)
│   ├── screens/               # Screen components (satu per halaman)
│   ├── components/
│   │   ├── Layout.tsx         # Sidebar + topbar layout wrapper
│   │   ├── FileUpload.tsx     # Upload + preview component
│   │   ├── FilePreview.tsx    # Inline file viewer
│   │   └── ui/                # shadcn/ui components
│   ├── context/
│   │   ├── AuthContext.tsx    # ⭐ Better Auth wrapper + demo_user cookie bridge
│   │   ├── I18nContext.tsx    # lang, t(), dir
│   │   └── NotificationsContext.tsx  # badge counts, markRead
│   ├── lib/
│   │   ├── auth.ts            # ⭐ Better Auth server config (LOCKED — jangan diubah)
│   │   ├── auth-client.ts     # ⭐ Better Auth client config (LOCKED — jangan diubah)
│   │   ├── prisma.ts          # ⭐ Prisma client singleton
│   │   ├── api.ts             # Axios instance (baseURL: /api)
│   │   ├── utils.ts
│   │   └── demo/              # Demo backend (Hono JSON handlers)
│   │       ├── service.ts     # Router utama + demoHandler export
│   │       ├── store.ts       # Baca/tulis demo/data.json
│   │       ├── models.ts      # Zod schema & TypeScript types
│   │       ├── helpers.ts     # Utility (ApiError, json, now, fail)
│   │       ├── accounts.ts    # Handler students & staff
│   │       ├── complaints.ts  # Handler complaints & categories
│   │       ├── requests.ts    # Handler documents, permissions, announcements
│   │       ├── forms.ts       # Handler forms & responses
│   │       ├── files.ts       # Handler upload/download file
│   │       └── dashboard.ts   # Kalkulasi data dashboard
│   ├── i18n/
│   │   └── translations.ts   # AR + EN kamus
│   └── constants/
│       ├── countries.ts       # Daftar negara & helper
│       └── testIds/           # Test ID constants
```

---

## 4. User Roles & Akses

Terdapat **3 role** dalam sistem:

| Role | Akses |
|------|-------|
| `admin` (DB: `ADMIN`) | Full access — semua fitur termasuk manajemen staff dan hapus mahasiswa |
| `staff` (DB: `STAFF`) | Lihat mahasiswa, respond komplain, proses dokumen, buat pengumuman, update permissions |
| `student` (DB: `STUDENT`) | Lihat dashboard pribadi, ajukan komplain/dokumen/izin, isi formulir, lihat profil & pengumuman |

> [!NOTE]
> Database menyimpan role dalam UPPERCASE (`ADMIN`, `STAFF`, `STUDENT`). `AuthContext.tsx` melakukan `.toLowerCase()` otomatis agar screen components yang lama tetap bekerja dengan `"admin"`, `"staff"`, `"student"`. Sedangkan `screen.tsx` membandingkan langsung dengan UPPERCASE karena membaca dari `useSession()` Better Auth.

### Route Guard (screen.tsx)
- Belum login → redirect ke `/login`
- Sudah login di halaman login → redirect ke `/`
- Student coba akses `/students` atau `/staff` → redirect ke `/`
- Admin only: hapus mahasiswa, manajemen staf

### Akun Production Default (Neon DB)

Akun berikut dibuat oleh `seed.js` dan tersimpan di **Neon PostgreSQL** (tabel `user` + `account`):

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@uoh.edu.sa` | `password123` |
| **Staff** | `staff@uoh.edu.sa` | `password123` |
| **Student** | `student@uoh.edu.sa` | `password123` |

> [!IMPORTANT]
> - Password di-hash menggunakan `bcryptjs` (10 rounds) di `seed.js`.
> - Login melalui `/api/auth/sign-in/email` ditangani **langsung oleh Better Auth** — bukan oleh demo handler.
> - Better Auth menggunakan custom bcryptjs verifier (lihat `auth.ts`) untuk mencocokkan password hash dari seed.

---

## 5. Fitur & Modul

### 5.1 Autentikasi (`/login`)
- Login dengan email & password via **Better Auth** (`signIn.email()`)
- Endpoint `/api/auth/*` ditangani natively oleh Better Auth
- Language switcher (AR/EN) di halaman login
- Toast success/error
- Session-based auth (Better Auth session token + `demo_user` cookie bridge)
- Logo + hero image University of Hail
- Stats display: 120+ students, 15 nationalities, 3 buildings

### 5.2 Dashboard

#### Admin/Staff Dashboard (`/`)
- **Stat cards:** Total students, Pending complaints, Docs processed, Iqomah expiring ≤30 hari, Pending permissions
- **Bar chart:** Distribusi mahasiswa per nationality
- **Pie chart:** Overview status komplain (pending/in_progress/resolved)
- **Tabel:** Izin pending terbaru (5 item)
- **Alert list:** Mahasiswa dengan iqomah hampir expired

#### Student Dashboard (`/`)
- **Stat cards:** Sisa hari iqomah, Komplain open/total, Dokumen open/total, Total permissions
- **Card profil:** Data pribadi ringkas
- **Recent announcements:** 5 pengumuman terbaru + link ke detail

### 5.3 Manajemen Mahasiswa (`/students`) — Staff & Admin only

**Fitur:**
- List mahasiswa dengan search (nama, kebangsaan, nomor kamar, nomor identitas/iqomah)
- Filter tab: All / Missing Passport / Missing Iqomah/Residency / Missing Any
- Create mahasiswa baru (dengan email & password akun)
- Edit data mahasiswa (tanpa ubah email)
- Hapus mahasiswa (admin only) + cascade hapus user & responses
- Upload passport & file dokumen identitas (Iqomah / Visa Pelajar) per mahasiswa
- View thumbnail file yang sudah diupload
- **Smart Form Auto-Detection (React Hook Form + Zod):**
  - Label input: `"Nomor Identitas (Iqomah / Zair)"` (menggantikan "Nomor Iqomah").
  - **Logika Auto-Detect Nomor Identitas Saudi:**
    - Jika dimulai angka `"2"` (contoh: 2553322559) ➔ Set `residency_type` secara background menjadi `IQOMAH`.
    - Jika dimulai angka `"3"` atau `"4"` (contoh: 4344396017) ➔ Set `residency_type` secara background menjadi `STUDENT_VISA`.
  - **Badge Real-time (Shadcn UI):**
    - Terdeteksi `"2"`: Menampilkan badge biru bertuliskan `"Hawiyyah Muqim (Iqomah)"`.
    - Terdeteksi `"3"` atau `"4"`: Menampilkan badge hijau bertuliskan `"Visa Ta'limiyyah (Zair)"`.

**Fields mahasiswa:**
`full_name`, `arabic_name`, `english_name`, `university_id`, `nationality`, `passport_number`, `passport_expiry`, `residency_number`, `residency_expiry`, `residency_type`, `phone`, `building`, `room_number`, `program`, `academic_year`, `passport_file_id`, `residency_file_id` (dengan backward-compatibility `iqomah_number`, `iqomah_expiry`, `iqomah_file_id`)

**Validasi:**
- `passport_expiry` & `residency_expiry` → format ISO date
- `residency_number` → Wajib diisi, minimal 10 digit, regex `/^[234]\d{9}$/` (tepat 10 digit numerik dan diawali angka 2, 3, atau 4)
- `residency_type` → Di-*infer* otomatis sebelum submit berdasarkan digit pertama `residency_number`
- Email unik

### 5.4 Manajemen Staf (`/staff`) — Admin only

**Fitur:**
- List staff (admin & staff roles, exclude student)
- Create staff baru (email, nama, role, password)
- Edit staff (nama, role, password opsional)
- Hapus staff (tidak bisa hapus diri sendiri)
- Self-row indicator
- Tidak bisa demote diri sendiri dari admin

**Roles staf:** `admin` | `staff`

### 5.5 Komplain (`/complaints`)

**Student:** Buat komplain baru, lihat status & respons admin
**Staff/Admin:** Lihat semua komplain, respond + update status

**Kategori:** `facility` | `academic` | `roommate` | `other` (+ dynamic categories via `complaint_categories`)

**Status lifecycle:**
```
pending → assigned → in_progress → resolved
                                  → rejected
```

**Fields:** `category`, `title`, `description`, `priority`, `status`, `assigned_to_id`, `assigned_to_name`, `attachments`, `admin_response`

**Fitur tambahan (Prisma schema):**
- `ComplaintCategory` — kategori dinamis yang bisa ditambah/edit/hapus oleh admin
- `ComplaintMessage` — thread pesan per komplain (termasuk internal notes)
- `ticket_number` — nomor tiket unik per komplain

### 5.6 Permintaan Dokumen / Watsa'iq (`/documents`)

Modul pengurusan dokumen imigrasi, akademik, dan perizinan resmi mahasiswa internasional Universitas Ha'il.

**Student:** 
- Mengajukan permohonan dokumen baru melalui formulir dinamis sesuai residency type (`IQOMAH` atau `STUDENT_VISA`).
- Mengedit catatan/lampiran/data dinamis atau membatalkan permohonan selama status masih `pending`.
- Mengunduh berkas surat digital resmi (PDF softcopy) yang telah disetujui dan diunggah oleh staf/admin.
- Memantau status permohonan dan menerima notifikasi update di dashboard dan badge menu sidebar.

**Staff/Admin:** 
- Melihat seluruh permohonan dokumen masuk, melakukan filter pencarian berdasarkan nama/identitas/tipe/status.
- Membuka dossier mahasiswa lengkap dengan scan identitas resmi (paspor & iqomah/visa).
- Mencetak berkas resmi (*A4 Official Printable Dossier*) siap tanda tangan untuk diajukan ke Jawazat/Kementerian.
- Mengunggah berkas surat hasil (*finalized softcopy PDF*) sebelum menyelesaikan status permohonan `letter_of_enrollment`.
- Menyesuaikan tata letak dan teks kop surat cetak (*Print Settings*) dengan fitur *Live Preview* A4.
- Mengontrol buka-tutup periode pengajuan tiket pesawat (*Ticket Window* toggle switch).

**Tipe Dokumen & Alur Khusus:**
1. `iqomah_renewal` (تجديد الإقامة) — Pembaruan iqomah. Permohonan murni tanpa upload dokumen; ketika staf menyelesaikan pembaruan, sistem mengirimkan notifikasi agar mahasiswa memperbarui nomor/masa berlaku iqomah pada profilnya.
2. `return_ticket` (تذكرة سفر) — Tiket pulang tahunan:
   - **Ticket Window Gating:** Hanya dapat diajukan jika staf/admin mengaktifkan `is_ticket_window_open` melalui switch toggle di halaman `/documents`.
   - **Airport Combobox:** Pemilihan bandara tujuan terintegrasi pencarian kode IATA, kota, dan negara.
   - **Trip Type & Dynamic Date Picker:** Pilihan `one_way` (Single Date Picker untuk departure) atau `round_trip` (Shadcn Date Range Picker terintegrasi popover untuk memilih tanggal keberangkatan dan kepulangan sekaligus).
3. `letter_of_enrollment` (خطاب قيد) — Surat keterangan mahasiswa aktif:
   - **Addressed To:** Pilihan instansi tujuan ("Bank", "Jawazat / Immigration", "Embassy", "Other" dengan kolom input teks spesifik).
   - **Letter Language:** Pilihan bahasa surat ("Arabic" / "English").
   - **Delivery Method:** Pilihan metode pengambilan ("Softcopy via app" / "Hardcopy pick up at office").
   - **Admin Mandatory Upload:** Jika mahasiswa memilih "Softcopy", admin diwajibkan mengunggah file PDF surat yang telah distempel/ditandatangani (`result_file_id`) sebelum status dapat diubah menjadi `COMPLETED`.
   - **Student Download:** Mahasiswa dapat langsung mengunduh file surat digital resmi melalui tombol "Download Letter".
4. `exit_reentry_visa` (تأشيرة خروج وعودة) — Visa keluar dan masuk kembali:
   - **Residency Gating:** Hanya dapat diajukan oleh mahasiswa berstatus `IQOMAH`.
   - **Visa Validity Mode:** Pilihan "Return to KSA before" (Date picker) atau "Duration in Days" (Input angka durasi hari).
   - **Validasi Masa Berlaku Iqomah:** Tanggal kembali atau durasi hari yang diminta tidak boleh melebihi sisa masa berlaku Iqomah mahasiswa. Jika melebihi, sistem memblokir submit form, menonaktifkan tombol, dan menampilkan alert peringatan imigrasi.
5. `update_passport` (تحديث الجواز) — Permohonan pembaruan data paspor baru:
   - Form dinamis: Nomor paspor baru, tanggal terbit (`date_of_issue`), tanggal kedaluwarsa (`date_of_expiry`), kantor penerbit (`issuing_office`), dan upload scan paspor baru (`passport_file`).
   - **Automated Profile Sync:** Saat admin menyetujui dan menandai status `COMPLETED`, sistem backend secara otomatis menyinkronkan data paspor baru ke profil mahasiswa (`Student`).
6. `other` (أخرى) — Permohonan dokumen administratif lainnya.

**Pencegahan Duplikasi (Anti-Spam Request):**
- Validasi server-side dan client-side mencegah pengajuan berulang untuk tipe dokumen yang sama jika masih memiliki permohonan berstatus `pending` atau `in_progress` (HTTP 409 Conflict).

**Kustomisasi Cetak & Live Preview A4:**
- Modal *Print Settings* dengan sistem Tabs (Shadcn Tabs):
  - **Tab Editor:** Pemilihan gaya kop surat (`standard` teks 3 kolom dinamis + logo tengah vs `custom_image` banner penuh), input teks baris kop kanan (Arab) dan kiri (Inggris), upload logo 1:1, nama tanda tangan pengawas asrama (`print_signature_name`), dan catatan footer (`print_footer_text`).
  - **Tab Preview:** Pratinjau lembar kerja A4 langsung (`aspect-[1/1.414]`) yang secara reaktif menampilkan hasil cetak dokumen dummy dan area tanda tangan secara real-time.

**Sistem Keamanan & Proteksi IDOR (Data Privacy & Access Control):**
- Mengacu pada Bagian 14 Aturan ke-3, mahasiswa HANYA dapat melihat dan mengelola dokumen miliknya sendiri (`user_id === session.user.id`).
- Akses langsung (`GET /api/documents/:id`) ke dokumen milik orang lain ditolak instan (HTTP 403 Forbidden).
- Mahasiswa dilarang mengubah status dokumen menjadi `approved`/`completed` atau mengisi `admin_note` (HTTP 403 Forbidden).
- Berkas unduhan surat hasil (`result_file_id`) diisolasi agar hanya pemilik permohonan dan admin/staff yang dapat mengunduhnya.
- Elemen UI manajemen dokumen ("Print Report", "Student Dossier", "Update Status") disembunyikan sepenuhnya dari tampilan akun mahasiswa.

**Status lifecycle:**
```
pending → in_progress → approved → completed
                      → rejected
        → cancelled (oleh mahasiswa)
```

**Fields:** `user_id`, `user_name`, `request_type`, `notes`, `attachment_file_ids[]`, `dynamic_data` (Json), `result_file_id` (String?), `status`, `admin_note`, `createdAt`, `updatedAt`

### 5.7 Pengumuman (`/announcements`)

**All roles:** Lihat semua pengumuman (bilingual AR/EN)
**Staff/Admin:** Buat pengumuman baru, hapus pengumuman, pin/unpin

**Features:**
- Bilingual: title & body dalam EN + AR
- Pin announcement (muncul di urutan teratas)
- Unread badge (counter untuk student)
- Auto‑announcement saat form baru dibuat

**Fields:** `title_en`, `title_ar`, `body_en`, `body_ar`, `pinned`, `author_name`

### 5.8 Izin Keluar (`/permissions`)

**Student:** Ajukan izin baru, lakukan Self Check-in ("Mulai Perjalanan") dan Check-out ("Saya Sudah Kembali")
**Staff/Admin:** Review & update status izin, pantau Overstay di Dashboard

**Tipe izin:**
- `OUT_OF_TOWN` — Safar Luar Kota / Domestik (memerlukan kota tujuan & moda transportasi)
- `OVERNIGHT` — Menginap / Mabit di dalam kota (memerlukan alamat menginap & kontak darurat)
- `VACATION` — Liburan / Safar Internasional (opsi lampiran tiket perjalanan)

**Status lifecycle:**
```
PENDING → APPROVED → ACTIVE (On Leave) → COMPLETED (Returned)
        → REJECTED
        → CANCELLED (Dibatalkan oleh mahasiswa)
```

**Fields:** `permission_type`, `destination`, `transportation_mode`, `overnight_address`, `emergency_contact` (opsional), `ticket_attachment_id`, `start_date`, `end_date`, `reason`, `admin_note`

**Validasi & Fitur Krusial:**
- `end_date >= start_date`
- **Validasi Iqomah 3 Bulan:** Pada saat tipe `VACATION` dipilih, sistem membandingkan `start_date` dengan masa berlaku `iqomah_expiry`. Jika tersisa kurang dari 90 hari (3 bulan), muncul alert peringatan imigrasi & visa exit/re-entry.
- **Edit Izin Status PENDING:** Mahasiswa dapat mengedit data permohonan izinnya selama statusnya masih `PENDING`.
- **Self Check-in / Check-out & Geofencing:**
  - Mahasiswa dapat menekan tombol **"Start Journey"** saat izin berstatus `APPROVED` dan tanggal hari ini sudah mencapai `start_date` (mengubah status ke `ACTIVE`).
  - **Auto Start Journey (24 Jam):** Jika mahasiswa lupa atau belum menekan tombol "Start Journey", sistem secara otomatis memicu start journey dan mengubah status izin menjadi `ACTIVE` dalam waktu 24 jam setelah jadwal `start_date`.
  - **Manual Return Only:** Tombol **"I Have Returned"** (`COMPLETED`) HANYA dapat ditekan secara manual oleh mahasiswa melalui verifikasi lokasi geofencing (tidak di-auto-complete oleh sistem).
  - **Pembatalan Perjalanan (Cancel Journey):** Tersedia tombol "Cancel Trip" pada izin yang telah di-approve jika mahasiswa batal berangkat. Dilengkapi modal konfirmasi untuk menghindari klik tidak sengaja, mengubah status menjadi `CANCELLED` dan memindahkannya ke tab History.
  - **Sistem Peringatan Terlambat (Late Return / Overstay Warning):** Muncul peringatan otomatis di Dashboard Mahasiswa, kartu izin, dan Dashboard Admin jika izin berstatus `ACTIVE` namun tanggal hari ini telah melewati `end_date`.
  - **Validasi Geofencing (Lokasi GPS):** Saat menekan "I Have Returned", sistem mendeteksi koordinat GPS mahasiswa dan memvalidasi jaraknya terhadap koordinat asrama menggunakan rumus Haversine. Jika berada di luar radius yang ditentukan (misal > 500m), sistem menolak check-in dan menampilkan peringatan jarak.
  - **Pengaturan Geofencing & Approval Note Admin:** Khusus role `Admin`, tersedia modal pengaturan terpadu dengan tab konfigurasi Default Approval Note (mendukung template bilingual EN/AR) dan tab Geofencing lokasi asrama.
- **Shortcut Aksi Cepat Staff & Admin:**
  - **Tombol Approve (Hijau):** Otomatis menyetujui izin dan melampirkan default admin note sesuai bahasa aktif aplikasi (English atau Arabic).
  - **Tombol Reject (Merah):** Membuka popup konfirmasi penolakan dengan input catatan alasan (`admin_note`) opsional.

### 5.9 Formulir Digital (`/forms`)

**Staff/Admin:**
- Buat form baru dengan form builder (drag‑able questions)
- Edit form (title, description, questions, is_active)
- **Clone existing form** (`POST /api/forms/{id}/clone`)
- Toggle aktif/nonaktif form
- Lihat semua respons
- Export respons ke CSV (UTF‑8 BOM)

**Student:**
- Lihat form aktif
- Isi & submit respons
- Edit respons yang sudah disubmit
- Badge unread (form aktif yang belum direspons)

**Tipe pertanyaan:** `text` | `textarea` | `single_choice` | `multi_choice` | `number` | `date`

**Tipe pertanyaan tambahan (Prisma schema):** `time` | `dropdown` | `file`

**Form auto‑announcement:** Saat form baru dibuat dan `is_active=true`, sistem otomatis membuat pengumuman bilingual.

**Export CSV:** Tersedia via link download langsung (`/api/forms/{id}/responses/export`)

### 5.10 Profil (`/profile`)

**All roles:** Lihat info akun (nama, email, role badge)
**Student only:**
- Lihat data profil lengkap (data akademik, paspor, nomor identitas)
- **Label Identitas Adaptif:**
  - Jika `residency_type === "IQOMAH"` ➔ menampilkan label `"Nomor Iqomah"` (atau "رقم الإقامة").
  - Jika `residency_type === "STUDENT_VISA"` ➔ menampilkan label `"Nomor Visa Pelajar"` (atau "رقم فيزا الطالب").
- Upload/replace/hapus file paspor dan dokumen identitas (Iqomah / Visa Pelajar)

### 5.11 File Management

**Upload:**
- Endpoint: `POST /api/files/upload` (multipart/form-data)
- Maks 10MB
- Format: JPEG, PNG, GIF, WebP, PDF
- Client‑side compression untuk image (max 0.5MB, max 2000px, kualitas 85%)
- Phase indicator: "compressing" → "uploading"

**Download/View:**
- Endpoint: `GET /api/files/{id}/download`
- Inline preview (PDF + image)
- Student hanya bisa akses file milik sendiri

**Fields:** `id`, `original_filename`, `content_type`, `size`, `kind`, `uploaded_by`

**Kinds:** `passport` | `iqomah` (dokumen identitas Iqomah / Visa Pelajar) | `general`

### 5.12 Program Studi (`/api/programs`)

**Admin:** CRUD program studi (nama AR + EN)
**All auth:** List program studi

### 5.13 Pengaturan Profil (`/api/settings/profile-permissions`)

**Admin:** Konfigurasi field mana yang boleh diedit oleh mahasiswa di profil mereka
**All auth:** Ambil konfigurasi saat ini

---

## 6. Internasionalisasi (i18n)

- **Default language:** Arabic (`ar`, RTL)
- **Supported:** `ar` (Arabic) + `en` (English)
- **Persistence:** `localStorage` key `lang`
- **DOM:** `document.documentElement.dir` & `lang` diupdate otomatis
- **CSS classes:** `font-arabic` / `font-english` pada body
- **Pengumuman bilingual:** Stored sebagai dua field terpisah (`title_en`, `title_ar`, `body_en`, `body_ar`)
- **Helper:** `t(key: string)` — fallback ke EN jika AR tidak ada, fallback ke key jika tidak ada di keduanya
- **Country labels:** Helper `getCountryLabel(code, lang)` untuk tampil nama negara bilingual

---

## 7. Navigasi & Layout

### Sidebar (desktop) + Sheet (mobile)
- Logo "H" + judul aplikasi
- Nav items berdasarkan role:
  - **All:** Dashboard, Complaints, Documents, Forms, Permissions, Announcements, Profile
  - **Staff & Admin:** Students
  - **Admin only:** Staff Management
- Badge merah untuk unread: Forms, Announcements, Permissions
- Topbar: Avatar + nama user, Language switcher, Sign out

### Notification Badges
| Resource | Student | Staff/Admin |
|----------|---------|-------------|
| Forms | Jumlah form aktif belum direspons | — |
| Announcements | Jumlah baru sejak terakhir baca | — |
| Permissions | Update (approved/rejected) belum dibaca | Jumlah pending |

---

## 8. Database Schema (Prisma v5 — PostgreSQL/Neon DB)

### 8.1 Better Auth Core Tables

Tabel-tabel berikut **dikelola oleh Better Auth** dan TIDAK boleh dimodifikasi strukturnya secara manual:

```prisma
model User {
  id            String    @id @default(uuid())
  name          String
  email         String    @unique
  emailVerified Boolean   @map("email_verified")
  image         String?
  createdAt     DateTime  @map("created_at")
  updatedAt     DateTime  @map("updated_at")

  // Custom fields (ekstensi untuk domain aplikasi)
  role                    String    @default("STUDENT")
  announcementsLastReadAt DateTime? @map("announcements_last_read_at")
  permissionsLastReadAt   DateTime? @map("permissions_last_read_at")

  // Relasi Better Auth
  sessions      Session[]
  accounts      Account[]

  // Relasi Domain
  student                Student?
  formResponses          FormResponse[]
  complaintsSubmitted    Complaint[]       @relation("StudentComplaints")
  complaintsAssigned     Complaint[]       @relation("AssignedComplaints")
  complaintMessages      ComplaintMessage[]

  @@map("user")
}

model Session {
  id        String   @id @default(uuid())
  expiresAt DateTime @map("expires_at")
  token     String   @unique
  createdAt DateTime @map("created_at")
  updatedAt DateTime @map("updated_at")
  ipAddress String?  @map("ip_address")
  userAgent String?  @map("user_agent")
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("session")
}

model Account {
  id                    String    @id @default(uuid())
  accountId             String    @map("account_id")
  providerId            String    @map("provider_id")
  userId                String    @map("user_id")
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?   @map("access_token")
  refreshToken          String?   @map("refresh_token")
  idToken               String?   @map("id_token")
  accessTokenExpiresAt  DateTime? @map("access_token_expires_at")
  refreshTokenExpiresAt DateTime? @map("refresh_token_expires_at")
  scope                 String?
  password              String?
  createdAt             DateTime  @map("created_at")
  updatedAt             DateTime  @map("updated_at")

  @@map("account")
}

model Verification {
  id         String    @id @default(uuid())
  identifier String
  value      String
  expiresAt  DateTime  @map("expires_at")
  createdAt  DateTime? @map("created_at")
  updatedAt  DateTime? @map("updated_at")

  @@map("verification")
}
```

### 8.2 Domain Models

```prisma
enum ResidencyType {
  IQOMAH
  STUDENT_VISA
}

model Student {
  id, user_id (unique), universityId (unique), arabicName, englishName,
  nationality, phone, arrivalDate?, programStudy, academicYear,
  residenceStatus (enum: INSIDE_SAKAN/OUTSIDE_SAKAN),
  roomNumber?, address?,
  academicStatus (enum: ACTIVE/ON_LEAVE),
  passportNumber, passportExpiry, passportIssueDate?, passportIssuingOffice?,
  residencyNumber, residencyExpiry, residencyType (enum: ResidencyType, default: IQOMAH),
  adminNotes?, photoUrl?, passportFileId?, residencyFileId?,
  createdAt, updatedAt?
}

model StudyProgram       { id, name_ar, name_en, createdAt, updatedAt? }
model ComplaintCategory  { id, name, description?, is_active, createdAt, updatedAt?, complaints[] }

model Complaint {
  id, ticket_number (unique), title, description, location_details?,
  attachments (Json?), status (enum: PENDING/ASSIGNED/IN_PROGRESS/RESOLVED/REJECTED),
  priority (enum: LOW/MEDIUM/HIGH/URGENT),
  categoryId, studentId, assignedToId?,
  createdAt, updatedAt?, messages[]
}

model ComplaintMessage   { id, complaintId, senderId, message, attachments (Json?), is_internal_note, createdAt }
model DocumentRequest    { id, user_id, user_name, request_type, notes?, attachment_file_ids (Json?), dynamic_data (Json?), result_file_id?, status, admin_note?, createdAt, updatedAt? }
model SystemSetting      { id, is_ticket_window_open, print_letterhead_url?, print_logo_url?, print_header_title_ar?, print_header_subtitle_ar?, print_header_title_en?, print_header_subtitle_en?, print_layout_style, print_signature_name?, print_footer_text?, updatedAt }
model FileRecord         { id, storage_path, original_filename, content_type, size, kind, uploaded_by, is_deleted?, createdAt }
model Announcement       { id, title_en, title_ar, body_en, body_ar, pinned?, author_name, form_id?, createdAt }
model Permission         { id, user_id, user_name, permission_type, destination, start_date, end_date, reason, status, admin_note?, createdAt, updatedAt? }

model Form {
  id, title, description?, closes_at?, is_active, is_closed?,
  created_by, author_name, response_count?,
  createdAt, questions[], form_responses[]
}

model Question {
  id, form_id, label, type (enum: TEXT/TEXTAREA/SINGLE_CHOICE/MULTI_CHOICE/NUMBER/DATE/TIME/DROPDOWN/FILE),
  is_required, options (Json?), order?
}

model FormResponse       { id, form_id, user_id, user_name, answers (Json), submittedAt, updatedAt? }
```

---

## 9. API Endpoints

### 9.1 Authentication (Better Auth — Native)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/auth/sign-in/email` | Login via Better Auth |
| POST | `/api/auth/sign-up/email` | Register via Better Auth |
| POST | `/api/auth/sign-out` | Logout |
| GET | `/api/auth/get-session` | Ambil session saat ini |

> [!NOTE]
> Semua endpoint `/api/auth/*` ditangani langsung oleh `auth.handler()` di Better Auth. Jangan membuat handler manual untuk route ini.

### 9.2 Data Endpoints (Demo JSON Handler — via Hybrid Bridge)

| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| GET | `/api/dashboard/admin` | Staff/Admin | Data dashboard admin |
| GET | `/api/dashboard/student` | Student | Data dashboard student |
| GET | `/api/notifications/counts` | Auth | Jumlah unread badges |
| POST | `/api/notifications/mark-read` | Auth | Tandai resource sudah dibaca |
| GET/POST | `/api/students` | Staff/Admin | List & create mahasiswa |
| GET/PATCH | `/api/students/me` | Student | Profil student sendiri |
| GET/PATCH/DELETE | `/api/students/{id}` | Staff/Admin | CRUD per mahasiswa |
| GET/POST | `/api/staff` | Admin | List & create staf |
| GET/PATCH/DELETE | `/api/staff/{id}` | Admin | CRUD per staf |
| GET/POST | `/api/complaints` | Auth | List & buat komplain |
| PATCH | `/api/complaints/{id}` | Staff/Admin | Update komplain (status, priority, assignment, attachments) |
| GET/POST | `/api/complaint-categories` | Auth/Admin | List & buat kategori komplain |
| PATCH/DELETE | `/api/complaint-categories/{id}` | Admin | Update & hapus kategori |
| GET/POST | `/api/documents` | Auth | List & ajukan dokumen (Student: hanya miliknya; Staff/Admin: semua) |
| GET/PATCH/DELETE | `/api/documents/{id}` | Auth | Detail, update & batalkan dokumen (Dilindungi IDOR; Student hanya miliknya yang pending) |
| GET/PATCH | `/api/settings/system` | Staff/Admin | Konfigurasi sistem global (Ticket window & preferensi cetak dossier) |
| GET/POST | `/api/announcements` | Auth/Staff | List & buat pengumuman |
| DELETE | `/api/announcements/{id}` | Staff/Admin | Hapus pengumuman |
| GET/POST | `/api/permissions` | Auth | List & ajukan izin |
| PATCH | `/api/permissions/{id}` | Staff/Admin | Update izin |
| GET/POST | `/api/forms` | Auth | List & buat form |
| POST | `/api/forms/{id}/clone` | Staff/Admin | Clone existing form |
| PATCH/DELETE | `/api/forms/{id}` | Staff/Admin | Update & hapus form |
| GET | `/api/forms/{id}/responses` | Staff/Admin | Lihat respons |
| GET | `/api/forms/{id}/responses/export` | Staff/Admin | Export CSV |
| POST | `/api/forms/{id}/responses` | Student | Submit/update respons |
| GET | `/api/forms/{id}/my-response` | Student | Respons sendiri |
| POST | `/api/files/upload` | Auth | Upload file |
| GET | `/api/files/{id}` | Auth | Metadata file |
| GET | `/api/files/{id}/download` | Auth | Download/view file |
| GET/POST | `/api/programs` | Auth/Admin | List & buat program studi |
| PATCH/DELETE | `/api/programs/{id}` | Admin | Update & hapus program |
| GET/PATCH | `/api/settings/profile-permissions` | Auth/Admin | Konfigurasi profile edit |

---

## 10. Konvensi Kode

### Komponen
- Semua screen ada di `src/screens/`
- UI primitives di `src/components/ui/` (shadcn/ui pattern)
- Komponen shared custom di `src/components/`
- Gunakan `"use client"` di atas setiap file yang pakai hooks

### State Management
- **Server state:** TanStack React Query (staleTime: 60s, no refetchOnWindowFocus)
- **Local UI state:** `useState`
- **Global state:** Context (Auth, I18n, Notifications)

### API Calls
- Selalu gunakan `api` instance dari `src/lib/api.ts` (Axios dengan baseURL `/api`, credentials: true, timeout: 15s)
- Error handling: `formatApiError(error.response?.data?.detail)`

### Styling
- Gunakan Tailwind utility classes
- Color palette: `primary` (biru UoH), `slate`, `amber`, `emerald`, `sky`, `red`
- Komponen hover: `hover:-translate-y-0.5`, `hover:border-primary/30`
- Badge status colors: amber=pending, sky=in_progress, emerald=resolved/approved/completed, red=rejected

### i18n
- Selalu gunakan `t("key")` dari `useI18n()` untuk text yang tampil ke user
- Jangan hardcode string UI dalam bahasa apapun
- Konten bilingual (announcements) stored sebagai field `_en` dan `_ar` terpisah

### Test IDs
- Gunakan `data-testid` untuk elemen interaktif penting
- Konstan ada di `src/constants/testIds/`

---

## 11. File-File Terkunci (LOCKED)

> [!CAUTION]
> File-file berikut telah stabil dan **TIDAK BOLEH di-refactor atau dimodifikasi** tanpa justifikasi eksplisit dari lead developer:

| File | Alasan |
|------|--------|
| `src/lib/auth.ts` | Konfigurasi Better Auth + Prisma adapter + custom bcryptjs verifier. Stabil dan teruji. |
| `src/lib/auth-client.ts` | Better Auth client config. Digunakan oleh seluruh frontend (AuthContext, screen.tsx, Layout.tsx). |
| `src/lib/prisma.ts` | Prisma client singleton dengan global cache untuk dev mode HMR. |
| `prisma/schema.prisma` | Schema sudah sinkron dengan Neon DB. Perubahan harus melalui Prisma migration. |

---

## 12. Halaman & URL Map

| URL | Screen Component | Role |
|-----|-----------------|------|
| `/` | `AdminDashboard` atau `StudentDashboard` | All |
| `/login` | `Login` | Public |
| `/students` | `Students` | Staff, Admin |
| `/staff` | `Staff` | Admin |
| `/complaints` | `Complaints` | All |
| `/documents` | `Documents` | All |
| `/announcements` | `Announcements` | All |
| `/permissions` | `Permissions` | All |
| `/forms` | `Forms` | All |
| `/profile` | `Profile` | All |

---

## 13. Status Pengembangan

### ✅ Selesai (DONE)
- ✅ Demo backend lengkap (semua endpoint fungsional)
- ✅ Semua screen UI selesai (11 screen components)
- ✅ File upload + preview
- ✅ Bilingual AR/EN
- ✅ Role‑based access control
- ✅ Notification badges
- ✅ Chart dashboard (bar + pie)
- ✅ Form builder + response viewer + CSV export
- ✅ Prisma v5 schema (sinkron dengan Neon DB)
- ✅ **Prisma & Neon DB Integration** — database terkoneksi, schema deployed, seed berjalan
- ✅ **Better Auth Implementation** — login/logout/session via Better Auth + custom bcryptjs verifier
- ✅ **Hybrid-Bridge System** — `route.ts` catch-all + `AuthContext.tsx` cookie bridge beroperasi
- ✅ **Documents / Watsa'iq Module v2** — Form dinamis berdasarkan residency type, integrasi bandara IATA & date range picker tiket pulang, buka-tutup ticket window, workflow surat keterangan softcopy (upload admin & download mahasiswa), validasi visa exit/re-entry berbasis kedaluwarsa Iqomah, otomatisasi sinkronisasi data paspor baru ke profil mahasiswa, pencegahan spam duplikasi request, A4 printable dossier, modal print settings editor & live preview, serta proteksi keamanan IDOR server-side dan client-side.
- ✅ **Temporary Dual-Write Account Sync** — Sinkronisasi otomatis kredensial akun mahasiswa dan staf baru dari `POST /api/students` dan `POST /api/staff` ke Neon DB (`user` dan `account`) via interceptor di `src/app/api/[[...path]]/route.ts`, sehingga user yang baru dibuat dapat langsung login via Better Auth (`/api/auth/sign-in/email`).

### 🔲 Berikutnya (NEXT / PENDING)
- 🔲 **Migrasi Endpoint API Data** — secara bertahap memindahkan handler JSON demo ke Prisma queries langsung (target: satu endpoint per iterasi)
- 🔲 Deployment config (Vercel / platform lain)
- 🔲 Penghapusan demo JSON fallback setelah semua endpoint dimigrasi

---

## 14. Constraint & Batasan Kritis

> [!CAUTION]
> ### 🚫 STRICT CONSTRAINTS — JANGAN DILANGGAR
>
> Pelanggaran terhadap aturan di bawah ini **AKAN MERUSAK APLIKASI**. Setiap AI agent yang bekerja pada codebase ini WAJIB mematuhi semua poin berikut:
>
> ---
>
> **1. Hybrid Bridge Architecture HARUS TETAP UTUH**
>
> JANGAN menghapus atau mengubah:
> - `demoHandler` di `src/app/api/[[...path]]/route.ts`
> - Cookie injector `demo_user` di `src/context/AuthContext.tsx`
>
> Kedua komponen ini adalah **jembatan kritis** antara Better Auth (autentikasi production) dan legacy JSON data store (data endpoint). Menghapus salah satunya akan memutus seluruh data API dan membuat aplikasi tidak berfungsi.
>
> ---
>
> **2. Auth Config TERKUNCI (LOCKED)**
>
> File `src/lib/auth.ts` dan `src/lib/auth-client.ts` sudah **stabil sempurna** menggunakan Better Auth + custom bcryptjs verifier. File-file ini **TIDAK BOLEH di-refactor** dalam kondisi apapun. Jika ada masalah autentikasi, periksa `.env`, `seed.js`, atau konfigurasi Neon DB — BUKAN file auth.
>
> ---
>
> **3. Seed Script Rule**
>
> `seed.js` **WAJIB** menjalankan `deleteMany()` pada tabel `account` dan `user` **SEBELUM** membuat akun baru. Ini mencegah error `Unique constraint` saat seed dijalankan ulang:
> ```js
> await prisma.account.deleteMany();
> await prisma.user.deleteMany();
> ```
>
> ---
>
> **4. Database Connection Rule**
>
> Untuk **local development**, `.env` HARUS menggunakan **Direct Connection URL** dari Neon DB (host TANPA `-pooler`). Menggunakan pooler URL akan menyebabkan **Prisma P1001 timeout errors** karena Neon DB sleep mode pada free tier.
>
> ✅ Benar: `postgresql://user:pass@ep-xxx.region.neon.tech/dbname`
> ❌ Salah: `postgresql://user:pass@ep-xxx-pooler.region.neon.tech/dbname`

> [!IMPORTANT]
> ### Aturan Umum yang TIDAK BOLEH Diubah Tanpa Diskusi:
>
> 1. **Demo mode** harus tetap berfungsi — jangan rusak handler di `src/lib/demo/`
> 2. **Bilingual (AR/EN)** wajib untuk semua teks UI baru — tambahkan ke `translations.ts` untuk kedua bahasa
> 3. **Role‑based access** harus tetap konsisten — student tidak bisa mengakses data student lain
> 4. **Prisma schema** adalah sumber kebenaran struktur data — jangan ubah nama field tanpa Prisma migration
> 5. **File size limit** 10MB dan format JPEG/PNG/GIF/WebP/PDF tidak boleh diubah tanpa justifikasi jelas
> 6. **RTL default** — layout HTML default `dir="rtl"`, komponen baru harus RTL‑compatible

> [!WARNING]
> Jangan menambahkan fitur yang tidak ada dalam scope ini tanpa konfirmasi. Setiap penambahan modul baru harus mempertimbangkan:
> - Apakah perlu role‑gating?
> - Apakah perlu badge notifikasi?
> - Apakah perlu bilingual?
> - Apakah perlu API endpoint baru di demo service?

---

*Terakhir diperbarui: 2026-11-15 oleh Senior Next.js Developer (pengembangan fitur Dokumen v2, Print Settings Live Preview, dan Penguatan Keamanan IDOR)*
