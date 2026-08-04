# ---------- Build stage ----------
FROM node:22-alpine AS builder
RUN npm i -g pnpm@11
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ---------- Runtime stage ----------
FROM node:22-alpine
ENV NODE_ENV=production \
    SPECABLE_PORT=8787 \
    SPECABLE_DATA_DIR=/app/data \
    SPECABLE_DIST_DIR=/app/dist
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/package.json ./package.json
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 8787
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.mjs"]
