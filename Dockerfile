# syntax=docker/dockerfile:1
#
# Chito in ONE container: the API server also serves
#   /          customer web app
#   /admin     store dashboard
#   /rider     rider web app
#   /api/v1    the API (+ live updates over Socket.io)
#
# Build:  docker build -t chito .
# Run:    docker run -p 4000:4000 --env-file chito.env chito      (see DOCKER.md for the variables)
#
# Secrets are never baked in: they are passed as environment variables when the container starts.

ARG NODE_VERSION=22.12.0

# ── Shared base for the build stages ──
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV CI=1 NEXT_TELEMETRY_DISABLED=1 EXPO_NO_TELEMETRY=1
WORKDIR /build

# ── Customer web app (Expo export) ──
FROM base AS web
# Public values only: they end up in the browser code anyway. "/api/v1" = the API on this same site.
ARG IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/denzongwater
ARG SUPPORT_PHONE=+917908195961
ENV EXPO_PUBLIC_API_URL=/api/v1 \
    EXPO_PUBLIC_IMAGEKIT_URL_ENDPOINT=${IMAGEKIT_URL_ENDPOINT} \
    EXPO_PUBLIC_SUPPORT_PHONE=${SUPPORT_PHONE}
COPY apps/mobile/package.json apps/mobile/package-lock.json ./
RUN npm ci
COPY apps/mobile/ ./
RUN npx expo export -p web --output-dir /out

# ── Rider web app (Expo export under /rider) ──
FROM base AS rider
ARG SUPPORT_PHONE=+917908195961
ENV EXPO_PUBLIC_API_URL=/api/v1 \
    EXPO_PUBLIC_SUPPORT_PHONE=${SUPPORT_PHONE} \
    CHITO_BASE_URL=/rider
COPY apps/rider/package.json apps/rider/package-lock.json ./
RUN npm ci
COPY apps/rider/ ./
RUN npx expo export -p web --output-dir /out

# ── Store dashboard (Next.js static export under /admin) ──
FROM base AS admin
ARG IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/denzongwater
# Empty socket address = the same site as the dashboard
ENV NEXT_PUBLIC_API_URL=/api/v1 \
    NEXT_PUBLIC_SOCKET_URL= \
    NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=${IMAGEKIT_URL_ENDPOINT} \
    ADMIN_STATIC_EXPORT=1 \
    ADMIN_BASE_PATH=/admin
COPY apps/admin/package.json apps/admin/package-lock.json ./
RUN npm ci
COPY apps/admin/ ./
RUN npm run build && cp -r out /out

# ── API (TypeScript → JavaScript, then production dependencies only) ──
FROM base AS api
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci --include=dev
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json ./
COPY apps/api/src ./src
RUN npm run build && npm prune --omit=dev

# ── Final image: Node + the API + the three built web apps ──
FROM node:${NODE_VERSION}-bookworm-slim
WORKDIR /app
# Demo defaults (same as the Render setup): OTP is always 1234 and store hours are ignored.
# For real use set NODE_ENV=production and OTP_DEV_MODE=false (and real SMS keys) when running the container.
ENV NODE_ENV=development \
    PORT=4000 \
    TZ=Asia/Kolkata \
    WEB_DIR=/app/web \
    OTP_DEV_MODE=true \
    DEV_IGNORE_STORE_HOURS=true
COPY --from=api --chown=node:node /build/package.json ./
COPY --from=api --chown=node:node /build/node_modules ./node_modules
COPY --from=api --chown=node:node /build/dist ./dist
COPY --from=web --chown=node:node /out ./web/web
COPY --from=admin --chown=node:node /out ./web/admin
COPY --from=rider --chown=node:node /out ./web/rider
USER node
EXPOSE 4000
# Healthy once the server answers and the database is connected
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>r.json()).then(j=>process.exit(j.ok&&j.db?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
