# --- Build aşaması ---
FROM node:20-alpine AS builder

WORKDIR /app

# Backend bağımlılıkları
COPY package*.json ./
RUN npm ci

# Frontend bağımlılıkları + build
COPY client/package*.json ./client/
RUN cd client && npm ci

COPY . .
RUN cd client && npm run build
RUN npm run build

# --- Runtime aşaması ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Sadece production bağımlılıkları
COPY package*.json ./
RUN npm ci --omit=dev

# Build çıktıları
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/db/schema.sql ./dist/db/schema.sql
COPY --from=builder /app/client/dist ./client/dist

# Static dosyaları serve et
RUN npm install serve -g

EXPOSE 3000

CMD ["node", "dist/index.js"]
