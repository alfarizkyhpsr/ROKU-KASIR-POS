# ============================================================
# SERVICE 1: kasir-frontend-gateway
# Build context: . (root project)
# Perintah: docker build -f Dockerfile -t kasir-frontend-gateway .
# ============================================================

# --- Stage 1: Build React frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build
# Output: /app/frontend/dist

# --- Stage 2: Node.js API Gateway ---
FROM node:20-alpine
WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy seluruh backend
COPY backend/ ./

# Salin hasil build frontend ke folder 'public'
# jalankan_semua.js serve dari path.join(__dirname, 'public')
COPY --from=frontend-builder /app/frontend/dist ./public

ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "jalankan_semua.js"]
