# 1. 의존성 설치 스테이지
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# 2. 빌드 스테이지
FROM node:18-alpine AS builder
WORKDIR /app

# deps 스테이지에서 node_modules 복사
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js telemetry 비활성화
ENV NEXT_TELEMETRY_DISABLED=1

# Yarn build 실행
RUN yarn build

# 3. 프로덕션 실행 스테이지
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Install curl for health checks and init calls
RUN apk add --no-cache curl

# 비루트 사용자 생성 (보안)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 빌드 결과물 복사
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy and setup entrypoint script
COPY --chown=nextjs:nodejs scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Switch to non-root user
USER nextjs

VOLUME ["/app/logs"]

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]