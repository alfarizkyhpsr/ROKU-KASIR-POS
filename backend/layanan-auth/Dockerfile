# ============================================================
# SERVICE 2: kasir-auth
# Build context: backend/
# Perintah: docker build -f backend/layanan-auth/Dockerfile -t kasir-auth backend/
# ============================================================

FROM node:20-alpine
WORKDIR /app

# Install dependencies dari root backend (satu package.json untuk semua service)
COPY package*.json ./
RUN npm install --omit=dev

# Copy shared modules (dibutuhkan oleh layanan-auth via ../shared/...)
COPY shared/ ./shared/

# Copy source layanan-auth
COPY layanan-auth/ ./layanan-auth/

ENV PORT=8080
EXPOSE 8080

CMD ["node", "layanan-auth/layanan_auth.js"]
