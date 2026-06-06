======================================================
  DEPLOY SELESAI & MEMENUHI SYARAT TUGAS!
======================================================
  Aplikasi Utama (Service 1) : https://kasir-frontend-gateway-nedszltmrq-et.a.run.app
  Layanan Auth   (Service 2) : https://kasir-auth-nedszltmrq-et.a.run.app
  Layanan Trans. (Service 3) : https://kasir-transaksi-nedszltmrq-et.a.run.app
======================================================
  Login default:
  Admin    -> username: admin     | pin: 123456
  Manajer  -> username: manajer01 | pin: 222222
  Kasir    -> username: kasir01   | pin: 111111
======================================================



$PROJECT_ID = "praktcc-488914"
$REGION = "asia-southeast2"
$SQL_CONN = "praktcc-488914:asia-southeast2:kasir-roku-db"
$DB_USER = "kasir_user"
$DB_PASSWORD = "13012005"
$DB_NAME = "kasir_roku"
$JWT_SECRET = "13012005"

$ENV_DB = "NODE_ENV=production,DB_USER=$DB_USER,DB_PASSWORD=$DB_PASSWORD,DB_NAME=$DB_NAME,CLOUD_SQL_CONNECTION_NAME=$SQL_CONN,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,FIRESTORE_PROJECT_ID=$PROJECT_ID,JWT_SECRET=$JWT_SECRET,FIRESTORE_DATABASE_ID=(default)"

# Update env vars kasir-auth
gcloud run services update kasir-auth --region=$REGION --set-env-vars=$ENV_DB

# Update env vars kasir-transaksi
gcloud run services update kasir-transaksi --region=$REGION --set-env-vars=$ENV_DB
