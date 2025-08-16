# 1. Basis-Image
FROM node:20-alpine AS builder

# pnpm installieren 
RUN npm install -g pnpm

# 2. Arbeitsverzeichnis
WORKDIR /app

# Nur package.json und pnpm-lock.yaml zuerst kopieren für besseren Cache
COPY package.json pnpm-lock.yaml ./

# 3. Abhängigkeiten installieren
RUN pnpm install --frozen-lockfile

# 4. Quellcode kopieren und builden
COPY . .
RUN pnpm build

# 5. Production-Image
FROM node:20-alpine

WORKDIR /app

# pnpm im Production-Image installieren
RUN npm install -g pnpm

COPY --from=builder /app ./

ENV NODE_ENV=production

# Port für Next.js
EXPOSE 3000

# Startbefehl
CMD ["pnpm", "start"]