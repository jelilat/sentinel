# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install root dependencies and build server
COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/

# Install dashboard dependencies and build dashboard
COPY dashboard/package.json dashboard/package-lock.json* ./dashboard/
RUN cd dashboard && npm install

COPY dashboard/ ./dashboard/

# Build everything (server + dashboard)
RUN npm run build

# ── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Only copy what's needed to run
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/dashboard/dist/ ./dashboard/dist/

# services.yaml is required — users mount or copy their own
# agents.yaml is optional — can be created via CLI or dashboard

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "dist/index.js"]
