# ============================================================
#  ROKU KASIR POS - Update Deploy (hanya rebuild & redeploy image)
#  Gunakan ini setelah infrastruktur sudah ada (SQL, Firestore, dll.)
#  Jalankan: powershell -ExecutionPolicy Bypass -File .\deploy-update.ps1
# ============================================================

$ErrorActionPreference = "Stop"

# ─── KONFIGURASI ──────────────────────────────────────────────
$PROJECT_ID = "praktcc-488914"
$REGION     = "asia-southeast2"
# ──────────────────────────────────────────────────────────────

gcloud config set project $PROJECT_ID
gcloud auth configure-docker --quiet

Write-Host ">> Rebuilding & pushing images..." -ForegroundColor Cyan

docker build -f backend/layanan-auth/Dockerfile -t "gcr.io/$PROJECT_ID/kasir-auth" backend/
docker push "gcr.io/$PROJECT_ID/kasir-auth"

docker build -f backend/layanan-transaksi/Dockerfile -t "gcr.io/$PROJECT_ID/kasir-transaksi" backend/
docker push "gcr.io/$PROJECT_ID/kasir-transaksi"

docker build -f Dockerfile -t "gcr.io/$PROJECT_ID/kasir-frontend-gateway" .
docker push "gcr.io/$PROJECT_ID/kasir-frontend-gateway"

Write-Host ">> Deploy ulang ke Cloud Run..." -ForegroundColor Cyan

gcloud run deploy kasir-auth `
  --image="gcr.io/$PROJECT_ID/kasir-auth" `
  --region=$REGION --platform=managed

gcloud run deploy kasir-transaksi `
  --image="gcr.io/$PROJECT_ID/kasir-transaksi" `
  --region=$REGION --platform=managed

gcloud run deploy kasir-frontend-gateway `
  --image="gcr.io/$PROJECT_ID/kasir-frontend-gateway" `
  --region=$REGION --platform=managed

Write-Host ">> Update selesai!" -ForegroundColor Green
