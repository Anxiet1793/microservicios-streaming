FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm install -g npm@12.2.0 && npm ci --no-audit --no-fund --fetch-timeout=60000 --fetch-retries=2
FROM dependencies AS builder
COPY . .
ARG MEDIA_ORIGIN=http://localhost:9000
ENV MEDIA_ORIGIN=$MEDIA_ORIGIN
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3003 HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/docs/licenses ./licenses
USER node
EXPOSE 3003
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:3003/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","server.js"]
