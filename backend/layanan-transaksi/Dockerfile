# ============================================================
# SERVICE 3: kasir-transaksi
# Build context: backend/
# Perintah: docker build -f backend/layanan-transaksi/Dockerfile -t kasir-transaksi backend/
# ============================================================

FROM node:20-alpine
WORKDIR /app

# Install dependencies dari root backend
COPY package*.json ./
RUN npm install --omit=dev

# Copy shared modules
COPY shared/ ./shared/

# Copy source layanan-transaksi
COPY layanan-transaksi/ ./layanan-transaksi/

ENV PORT=8080
EXPOSE 8080

CMD ["node", "layanan-transaksi/layanan_transaksi.js"]
