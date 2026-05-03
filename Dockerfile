# syntax=docker/dockerfile:1

# 1. 의존성 설치 스테이지
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# 2. 빌드 스테이지
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN yarn build

# 3. 프로덕션 실행 스테이지 (standalone — node_modules 불필요)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN apk add --no-cache curl
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# standalone 번들 (server.js + 필요한 node_modules만 포함)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# 정적 파일
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# public 디렉터리
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# 엔트리포인트
COPY --chown=nextjs:nodejs scripts/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

LABEL org.opencontainers.image.source="https://github.com/jung-geun/monolog"
LABEL org.opencontainers.image.description="monolog — Notion-powered blog"
LABEL org.opencontainers.image.licenses="MIT"

USER nextjs

VOLUME ["/app/logs"]
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
