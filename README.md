# Bizapp Analyzer

Dashboard admin untuk analisis return & delivery — upload export Bizapp (.xlsx/.csv), terus dapat root-cause return, perbandingan produk/kurier, dan unjuran jualan. Semua processing jalan dalam browser (client-side) — tiada data dihantar ke server mana-mana pun.

## Deploy ke Netlify (paling senang)

Fail ini adalah **Next.js**, jadi ia tidak boleh diseret terus ke Netlify Drop
dalam bentuk folder sumber — Netlify hanya akan nampak fail kod dan memaparkan
"Page not found". Ia mesti dibina dahulu.

Aplikasi ini berjalan 100% dalam browser (tiada server, tiada API), jadi ia
sudah dikonfigurasikan untuk **static export**.

**Cara A — Netlify Drop (tanpa GitHub):**

```bash
npm install
npm run build
```

Selepas siap, satu folder bernama `out/` akan wujud. **Seret folder `out/` itu**
ke https://app.netlify.com/drop — bukan folder projek.

**Cara B — Netlify + GitHub (auto-deploy setiap kali push):**

1. Push projek ke GitHub.
2. Netlify → Add new site → Import an existing project → pilih repo.
3. Tetapkan:
   - Build command: `npm run build`
   - Publish directory: `out`
4. Deploy. Setiap `git push` selepas ini akan auto-deploy.

**Cara C — Vercel:** import repo, tiada tetapan perlu diubah.

## Run tempatan (local dev)

```bash
npm install
npm run dev
```

Buka http://localhost:3000

## Deploy ke Vercel (free)

**Cara paling senang — guna GitHub:**

1. Buat repo baru di GitHub (contoh: `bizapp-analyzer`), push semua fail dalam folder ni:
   ```bash
   git init
   git add .
   git commit -m "Initial commit — Bizapp Analyzer"
   git branch -M main
   git remote add origin https://github.com/USERNAME/bizapp-analyzer.git
   git push -u origin main
   ```
2. Pergi ke [vercel.com](https://vercel.com), sign in guna akaun GitHub kau.
3. Klik **Add New → Project**, pilih repo `bizapp-analyzer` tadi.
4. Vercel auto-detect Next.js — settings default dah cukup. Klik **Deploy**.
5. Lepas ~1 minit, kau dapat link `https://bizapp-analyzer.vercel.app` (atau nama repo kau).

**Cara alternatif — Vercel CLI (tanpa GitHub):**

```bash
npm install -g vercel
vercel login
vercel --prod
```

Ikut je arahan dalam terminal (ia akan tanya nama project, folder, dsb — default settings okay je).

## Cara guna app

1. Buka app, upload fail export Bizapp (.xlsx / .xls / .csv).
2. Dashboard akan generate automatik:
   - KPI: jumlah order, revenue collected, return rate, purata/order
   - Sebab return (RTO) & sebab pending — pecahan sebenar dari status parcel kurier
   - Perbandingan produk & kurier (status mix)
   - Produk & kawasan risiko tinggi (return rate paling tinggi)
   - Trend jualan harian + unjuran 7 & 30 hari akan datang
   - Prestasi ejen/marketer
3. Klik "Muat Naik Baru" untuk analisis fail lain — data lama automatik clear (tiada simpanan/database).

## Struktur data yang disokong

Parser direka untuk export Bizapp yang biasa kau guna (kolum: DIMASUKKAN OLEH, NAMA PELANGGAN, NO H/P, PRODUK, KUANTITI, harga, tarikh tempahan, cara penghantaran, no. tracking, status KURIER, status parcel). Parser guna heuristic content-matching (bukan index kolum tetap) supaya tahan dengan variasi/shift kolum yang kadang berlaku dalam export Bizapp.

Jika format fail kau berubah drastik dan dashboard "tiada order dikesan", hantar balik sample fail untuk aku adjust parser.

## Tech stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS (custom design tokens — tema "Manifest / Control Tower")
- Recharts untuk visualization
- SheetJS (xlsx) untuk parse Excel/CSV
- 100% client-side — sesuai untuk data sensitif (return, no. telefon customer)
