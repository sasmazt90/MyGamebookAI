# MyGamebookAI

Bu repo artık **Manus'a bağlı olmadan** çalışacak şekilde düzenlendi.

## Mimari (önerilen)
- **Frontend (React + Vite):** Vercel
- **Backend (Express + tRPC):** Railway / Render / Fly.io (Node çalışan herhangi bir servis)
- **Database (MySQL):** Neon/MySQL, PlanetScale, Railway MySQL vb.

## 1) Lokal geliştirme

```bash
pnpm install
pnpm dev
```

Uygulama backend ile birlikte `http://localhost:3000` üzerinde çalışır.

## 2) Zorunlu ortam değişkenleri

### Backend (.env)

- `DATABASE_URL` → MySQL bağlantı URL'si
- `JWT_SECRET` → güçlü bir gizli anahtar
- `CORS_ORIGIN` → frontend domain(ler)i (virgülle ayır)
  - Örnek: `https://mygamebookai.vercel.app,https://www.senin-domainin.com`

### AI/LLM (backend)

Metin üretimi (OpenAI):
- `TEXT_LLM_API_KEY`
- `TEXT_LLM_API_URL` (default: `https://api.openai.com`)
- `TEXT_LLM_MODEL` (default: `gpt-4o-mini`)

Görsel üretimi (Google Gemini):
- `IMAGE_PROVIDER=google`
- `GOOGLE_API_KEY`
- `GOOGLE_IMAGE_MODEL` (default: `gemini-2.0-flash-preview-image-generation`)

> Not: Eski `BUILT_IN_FORGE_*` ve `OPENAI_*` isimleri geriye dönük uyumluluk için halen tanınır.

### Storage (backend)

Önerilen: **Cloudflare R2**
- `STORAGE_PROVIDER=r2`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME` (ör: `mygamebookai-assets`)
- `R2_ENDPOINT` (opsiyonel; boşsa `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`)
- `R2_PUBLIC_BASE_URL` (opsiyonel; custom domain veya `*.r2.dev` URL. Boşsa sistem imzalı geçici URL üretir)

Geriye dönük opsiyon: `BUILT_IN_FORGE_API_URL` + `BUILT_IN_FORGE_API_KEY`

### Frontend (Vercel Environment Variables)

- `VITE_API_BASE_URL` → backend base URL
  - Örnek: `https://mygamebookai-api.up.railway.app`
- `VITE_PUBLIC_APP_URL` → frontend public URL
  - Örnek: `https://mygamebookai.vercel.app`
- (Opsiyonel) `VITE_ANALYTICS_ENDPOINT`, `VITE_ANALYTICS_WEBSITE_ID`

## 3) Backend deploy (Railway örneği)

1. Railway'de yeni proje aç, bu repo'yu bağla.
2. Build command:
   ```bash
   pnpm install --frozen-lockfile && pnpm build
   ```
3. Start command:
   ```bash
   pnpm start
   ```
4. Environment variables gir (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `TEXT_LLM_API_KEY`, `GOOGLE_API_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, ...).
5. Domain al (ör. `https://mygamebookai-api.up.railway.app`).
6. Uygulama açılışta otomatik migration dener (drizzle klasöründeki SQL'leri uygular).
   - Yine de istersen manuel tetiklemek için:
   ```bash
   pnpm db:push
   ```

## 4) Frontend deploy (Vercel)

1. Vercel'de `New Project` → bu repo'yu seç.
2. Framework: **Vite** (Vercel otomatik algılar).
3. Build command:
   ```bash
   pnpm build
   ```
4. Output directory:
   ```bash
   dist/public
   ```
5. Environment Variables ekle:
   - `VITE_API_BASE_URL=https://<backend-domain>`
   - `VITE_PUBLIC_APP_URL=https://<vercel-domain>`
6. Deploy et.

## 5) DNS / Custom domain (opsiyonel)

- Frontend domainini Vercel'e bağla (örn. `app.senin-domainin.com`).
- `VITE_PUBLIC_APP_URL` değerini bu domaine güncelle.
- Backend domain değişirse `VITE_API_BASE_URL`'yi güncelle.
- Backend'de `CORS_ORIGIN` içine frontend domainini ekle.

## 6) Kontrol listesi

- [ ] Frontend açılıyor
- [ ] Giriş/kayıt çalışıyor (cookie set ediliyor)
- [ ] Kitap oluşturma endpoint'leri çalışıyor
- [ ] Stripe (kullanıyorsan) webhook URL backend'e işaret ediyor
- [ ] DB migration tamamlandı (otomatik ya da manuel)

---

Sorunsuz ayrışmış yapı için kritik nokta: **Frontend backend'e `VITE_API_BASE_URL` ile gider, backend de sadece bu frontend origin'lerine CORS izni verir.**


## 7) Eski Manus DB çıktısını taşıma

Eğer GitHub'a `old_database/` klasörü yüklediysen:
- Önce backend'i deploy et ve loglarda `[Database] Connected database: ...` ile `[Database] Schema check after migration ...` mesajlarını kontrol et.
- Bu proje artık açılışta tablo/kolon migration'ını otomatik dener; yani Railway tarafında tabloları tek tek elle açman gerekmez.
- `old_database/` içindeki veri dump dosyalarını (INSERT/CSV) ayrıca import etmen gerekir; şema (table/column) ile veri taşıma iki ayrı adımdır.
