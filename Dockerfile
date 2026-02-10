FROM node:20-slim AS dashboard-builder

WORKDIR /app/dashboard
COPY dashboard/package.json dashboard/package-lock.json* ./
RUN npm ci
COPY dashboard/ .
RUN npm run build

FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ src/

RUN npm run build:server

FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist/ dist/
COPY --from=dashboard-builder /app/dashboard/dist/ dashboard/dist/
COPY services.yaml ./
# Optional: include agents.yaml if it exists (glob trick — no error if missing)
COPY agents.yam[l] ./

USER node

EXPOSE 8080

CMD ["node", "dist/index.js"]
