<div align="center">
  <img src="https://raw.githubusercontent.com/Mingkhemx/SWAPPY-TUKAR-PANEN/main/frontend/public/logo/logo.png" alt="SWAPPY Logo" style="border-radius: 24px;"/>
  <h1 align="center" style="font-size: 3rem; background: linear-gradient(135deg, #2d6a4f, #52b788); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">SWAPPY</h1>
  <p align="center" style="font-size: 1.2rem; color: #555; max-width: 600px;">Platform digital barter hasil panen untuk petani Indonesia — saling bertukar hasil panen dengan aman dan mudah!</p>
  <p align="center">
    <img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/Mingkhemx/SWAPPY-TUKAR-PANEN">
    <img alt="GitHub stars" src="https://img.shields.io/github/stars/Mingkhemx/SWAPPY-TUKAR-PANEN?style=social">
  </p>
</div>

---

## 📋 Daftar Isi
1. [Tentang Proyek](#-tentang-proyek)
2. [Fitur Unggulan](#-fitur-unggulan)
3. [Teknologi yang Dipakai](#-teknologi-yang-dipakai)
4. [Memulai](#-memulai)
5. [Struktur Proyek](#-struktur-proyek)
6. [Cara Deploy ke Vercel](#-cara-deploy-ke-vercel)
7. [Kontribusi](#-kontribusi)
8. [Lisensi](#-lisensi)

---

## 🌾 Tentang Proyek

**SWAPPY** dibuat untuk membantu komunitas petani Indonesia bertukar hasil panen tanpa perantara! Dengan antarmuka yang ramah pengguna dan Bahasa Indonesia, SWAPPY memudahkan petani untuk:
- Mencari penawaran barter
- Berkomunikasi langsung
- Bernegosiasi harga

---

## ✨ Fitur Unggulan

| Fitur | Deskripsi |
|-------|-----------|
| 🛒 **Forum Barter** | Lihat dan buat penawaran barter dengan filter kategori & lokasi |
| 💬 **Chat & Negosiasi** | Komunikasi realtime dengan fitur penawaran harga |
| 👤 **Profil Pengguna** | Kelola data diri dan lihat riwayat barter |
| 🔐 **Autentikasi Aman** | Login dan daftar dengan keamanan terjamin |
| 📱 **Responsive Design** | Bisa dipakai di hp, tablet, dan PC! |

---

## 🛠️ Teknologi yang Dipakai

- **Monorepo**: `pnpm workspaces`
- **Frontend**: React 19, Vite 7, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express 5
- **Database**: PostgreSQL + Supabase + Drizzle ORM
- **API Client**: React Query (TanStack), Orval
- **Validasi**: Zod

---

## 🚀 Memulai

### Syarat Prasyarat
- Node.js v24+
- pnpm 10+
- PostgreSQL atau Supabase

### Instalasi
1. Clone repo
   ```bash
   git clone https://github.com/Mingkhemx/SWAPPY-TUKAR-PANEN.git
   cd SWAPPY-TUKAR-PANEN
   ```
2. Install dependencies
   ```bash
   pnpm install
   ```
3. Setup environment
   - Copy `.env.example` ke `.env` di root dan `backend/`
   - Isi variabel seperti `DATABASE_URL`, `SUPABASE_*`
4. Jalankan backend:
   ```bash
   cd backend && npm run dev
   ```
5. Jalankan frontend:
   ```bash
   cd frontend && npm run dev
   ```
   Buka browser di [http://localhost:8081](http://localhost:8081)

---

## 📁 Struktur Proyek

```
SWAPPY-TUKAR-PANEN/
├── backend/          # API Server (Express)
├── frontend/         # Frontend (React + Vite)
│   └── src/
│       ├── components/
│       ├── pages/
│       └── lib/
├── lib/
│   ├── api-client-react/ # Generated React Query hooks
│   ├── api-spec/         # OpenAPI spec
│   ├── api-zod/          # Generated Zod schemas
│   └── db/               # Drizzle ORM schema
└── vercel.json       # Konfigurasi deploy Vercel
```

---

## 🔗 Cara Deploy ke Vercel & Backend ke Render

### 🎨 Deploy Frontend ke Vercel
1. **Hubungkan Repo ke Vercel**
   - Buka [vercel.com/new](https://vercel.com/new)
   - Pilih repo `Mingkhemx/SWAPPY-TUKAR-PANEN`
2. **Konfigurasi Project**:
   - **Root Directory**: `frontend`
   - **Build Command**: `cd .. && pnpm build`
   - **Output Directory**: `dist/public`
   - **Framework**: `Vite`
3. **Environment Variables**: Tambahkan:
   - `VITE_API_URL`: URL backend production kamu (misal `https://swappy-backend.onrender.com`)
4. Klik **Deploy** 🎉

### 🌾 Deploy Backend ke Render (Free!)
1. **Daftar/Login ke Render**: [render.com](https://render.com/)
2. **Import Repo**: Pilih `Mingkhemx/SWAPPY-TUKAR-PANEN`
3. **Konfigurasi Service**:
   - **Name**: `swappy-backend`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
4. **Environment Variables**: Tambahkan:
   - `NODE_ENV`: `production`
   - `PORT`: `3002`
   - `SUPABASE_URL`: URL Supabase kamu
   - `SUPABASE_ANON_KEY`: Anon key Supabase kamu
5. Klik **Create Web Service** 🚀

---

## 🤝 Kontribusi

Kontribusi selalu diterima! Langkahnya:
1. Fork repo ini
2. Buat branch fitur: `git checkout -b feature/bagus`
3. Commit: `git commit -m "Add feature bagus"`
4. Push ke branch: `git push origin feature/bagus`
5. Buka Pull Request!

---

## 📜 Lisensi

Dilisensikan di bawah Lisensi MIT. Lihat `LICENSE` untuk informasi lebih lanjut.

---

<div align="center">
  <p style="font-size: 0.9rem; color: #777;">Dibuat dengan ❤️ untuk petani Indonesia</p>
  <p style="font-size: 0.8rem; color: #aaa;">© 2026 SWAPPY. Semua hak cipta dilindungi.</p>
</div>
