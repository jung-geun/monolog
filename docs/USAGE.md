# USAGE

monolog 셋업·운영 가이드. 프로젝트 개요와 차별점은 [`README.md`](../README.md)를 참고하세요.

---

## 빠른 시작

```bash
git clone https://github.com/jung-geun/monolog.git
cd monolog
yarn install

cp .env.example .env
# 필수:
#   NOTION_TOKEN=ntn_xxxxx
#   NOTION_DATASOURCE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# 댓글 활성 시 추가 필수:
#   NOTION_COMMENTS_DATASOURCE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
#   COMMENT_HASH_SALT=$(openssl rand -hex 32)
# 방문자 통계 활성 시 추가 필수:
#   NOTION_VISIT_STATS_DATASOURCE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
#   VISITOR_HASH_SALT=$(openssl rand -hex 32)

yarn dev
```

`http://localhost:3000`에서 확인합니다.

---

## Notion 셋업

### 1. Integration 만들기
[Notion Integrations](https://www.notion.so/my-integrations)에서 Internal Integration을 만들고 토큰(`ntn_...`)을 복사합니다.

### 2. DB 템플릿 복제 (권장)
[**monolog blog assets**](https://www.notion.so/pieroot/blog-assets-35a067c015d080a0bf17d3a0dffb3784) 페이지를 본인 워크스페이스로 **Duplicate** 합니다. 페이지 안에는 monolog가 사용하는 DB가 미리 구성되어 있습니다.

| DB | 용도 | 환경변수 |
|---|---|---|
| `blog-table` | 글 본문 (Posts · Pages · Papers) | `NOTION_DATASOURCE_ID` |
| `comments` | 방문자 익명 댓글 (선택) | `NOTION_COMMENTS_DATASOURCE_ID` |
| `visit-stats` | 페이지별 고유 방문자 통계 (선택) | `NOTION_VISIT_STATS_DATASOURCE_ID` |

복제한 DB를 각각 열어:
1. 우상단 `...` → `Add connections` → 1단계에서 만든 Integration 추가
2. **data_source ID 확인**: Notion DB 페이지 URL의 32자 hex ID를 `8-4-4-4-12` UUID 포맷으로 변환 후 `curl -H "Authorization: Bearer $NOTION_TOKEN" https://api.notion.com/v1/databases/{database_id}`를 호출해 `data_sources[0].id` 값을 복사합니다. 이 값을 환경변수에 입력합니다.
   - 예: `curl` 응답의 `"data_sources":[{"id":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}]` 에서 id 복사

> 댓글 기능을 끄려면 `site.config.js`의 `notionComments.enable: false`로 두면 됩니다 — `comments` DB는 무시됩니다. 방문자 통계 기능은 `NOTION_VISIT_STATS_DATASOURCE_ID`와 `VISITOR_HASH_SALT`가 설정된 경우에만 동작합니다.

### 3. 직접 만들고 싶다면

템플릿 없이 새로 만들 때 권장 스키마.

#### `blog-table` (글)
| 프로퍼티명 | 타입 | 설명 |
|---|---|---|
| `Title` | title | 글 제목 |
| `Status` | select | `Public` · `PublicOnDetail` · `Private` |
| `Type` | select | `Post` · `Paper` · `Page` |
| `Slug` | url | URL 경로 (예: `my-first-post`) |
| `Date` | date | 발행일 |
| `Category` | select | 카테고리 (단일) |
| `Series` | select | 시리즈 (단일, 선택) |
| `Tags` | multi_select | 태그 (복수) |
| `Summary` | rich_text | 요약 (피드 카드에 표시) |
| `Thumbnail` | files 또는 url | 썸네일 이미지 (글 목록 우측 + 본문 상단 히어로) |
| `접속자수` | number | 서버가 계산해 Notion에 동기화하는 페이지별 고유 방문자 수 |

#### `comments` (댓글)
| 프로퍼티명 | 타입 | 설명 |
|---|---|---|
| `Title` | title | 자동 요약 — `[slug] 익명#xxxx: 본문 30자` |
| `Slug` | rich_text | 글 slug (조회 키) |
| `PostId` | rich_text | Notion 글 page_id |
| `Nickname` | rich_text | `익명#xxxx` (서버에서 자동 생성) |
| `Body` | rich_text | 본문 (≤ 1000자) |
| `Status` | select | `approved`(default) / `hidden` / `spam` |
| `IpHash` | rich_text | `SHA-256(ip + COMMENT_HASH_SALT)` 앞 16자 |

`Status`를 `hidden` 또는 `spam`으로 바꾸면 페이지에서 자동 제외됩니다 (캐시 TTL 45s 만료 후).

#### `visit-stats` (방문자 통계)
| 프로퍼티명 | 타입 | 설명 |
|---|---|---|
| `Title` | title | 자동 요약 — `slug:visitKeyPrefix` |
| `Slug` | rich_text | 글 slug (조회 키) |
| `PostId` | rich_text | Notion 글 page_id |
| `VisitKey` | rich_text | `SHA-256(postId + salted visitor cookie)` 앞 32자. 원본 쿠키·IP·User-Agent는 저장하지 않음 |
| `FirstVisitedAt` | date | 최초 방문 시각 |

사이트 메타(제목, 설명, 프로필, 프로젝트 카드, About 페이지의 stack 등)는 루트의 `site.config.js`에서 관리합니다.

---

## 환경 변수

### 필수

| 변수명 | 설명 |
|---|---|
| `NOTION_TOKEN` | Notion Internal Integration Token (`ntn_...`) |
| `NOTION_DATASOURCE_ID` | `blog-table` DB의 ID (UUID with hyphens) |

### 댓글 활성 시 필수 (`site.config.js: notionComments.enable: true`)

| 변수명 | 설명 |
|---|---|
| `NOTION_COMMENTS_DATASOURCE_ID` | `comments` DB의 **data_source ID** (UUID with hyphens) |
| `COMMENT_HASH_SALT` | IP/닉네임 해싱용 salt — 생성: `openssl rand -hex 32` |

### 방문자 통계 활성 시 필수

| 변수명 | 설명 |
|---|---|
| `NOTION_VISIT_STATS_DATASOURCE_ID` | `visit-stats` DB의 **data_source ID** (UUID with hyphens) |
| `VISITOR_HASH_SALT` | 방문자 쿠키 해싱용 salt — 생성: `openssl rand -hex 32`. `COMMENT_HASH_SALT`와 재사용하지 마세요 |

### 선택

| 변수명 | 기본값 | 설명 |
|---|---|---|
| `REDIS_URL` | — | Redis 연결 URL. 설정 시 L2 캐시 활성 (cold start 성능 향상). 예: `redis://localhost:6379`, `rediss://user:pass@host:6380` |
| `ANTHROPIC_API_KEY` | — | `/ontology`, Graph semantic overlay, RightRail `ai · similar`의 엔티티/관계 추출용 Anthropic API key |
| `OPENAI_API_KEY` | — | Qdrant 벡터 검색에 저장할 `text-embedding-3-small` 임베딩 생성용 OpenAI API key |
| `QDRANT_URL` | `http://localhost:6333` | 로컬 개발 또는 외부 Qdrant REST endpoint. Docker Compose `ontology` profile은 `docker-compose.yml`에서 컨테이너용 `http://qdrant:6333`을 직접 설정 |
| `QDRANT_API_KEY` | — | 인증이 걸린 외부 Qdrant용 API key. 로컬/self-hosted Qdrant는 빈 값 |
| `CACHE_NAMESPACE` | `monolog` | Redis 키 prefix. 동일 Redis를 staging·preview 등 여러 배포가 공유할 때 충돌 방지 |
| `GRAPH_BUILD_TIMEOUT_MS` | `120000` | Notion graph complete-build 시간 제한(ms). 제한을 넘긴 partial graph는 Qdrant snapshot으로 저장하지 않음. 최대 `300000` |
| `REVALIDATE_SECRET` | — | `/api/revalidate` · `/api/init` · `/api/cron/graph` 보호용 Bearer 토큰. GitHub Actions의 `REVALIDATE_SECRET` secret과 **동일 이름·동일 값**. |
| `REVALIDATE_HOURS` | `6` | ISR 재생성 주기 (시간) |
| `NEXT_PUBLIC_SITE_URL` | — | 절대 이미지 프록시 URL prefix |
| `TRUSTED_PROXY_HOPS` | `0` | 앞단 프록시 hop 수 — `0`이면 XFF 무시, `1`이면 Nginx·LB 1단 신뢰 |
| `NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID` | — | Google Analytics |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | — | Google Search Console |
| `NEXT_PUBLIC_NAVER_SITE_VERIFICATION` | — | Naver Search Advisor |
| `NEXT_PUBLIC_UTTERANCES_REPO` | — | Utterances 댓글 (`user/repo`) |
| `SLACK_WEBHOOK` | — | image-proxy 실패 Slack 알림 |

`NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, `NEXT_PUBLIC_NAVER_SITE_VERIFICATION`는 이미지 빌드 시점이 아니라 컨테이너 시작 시 주입됩니다. 공개 값만 넣고, `docker run --env-file .env …` 또는 Compose의 `env_file`로 설정한 뒤 컨테이너를 재시작하세요. 값이 없으면 Analytics와 검증 메타 태그는 비활성화되며 앱은 정상 실행됩니다.

### GitHub Actions Secrets (워크플로우 전용)

[`revalidate.yml`](../.github/workflows/revalidate.yml) 워크플로우가 사용하는 GitHub Repository Secrets.
등록: 저장소 → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | 필수 | 설명 |
|---|---|---|
| `REVALIDATE_URL` | 필수 | 운영 사이트 base URL (예: `https://your-site.com`, 끝 `/` 없음) |
| `REVALIDATE_SECRET` | 필수 | 컨테이너의 `REVALIDATE_SECRET` 환경변수와 동일 값 |
| `DISCORD_WEBHOOK` | 선택 | 성공/실패 Discord 알림 webhook URL |

---

## API 엔드포인트

| Path | 인증 | 용도 |
|---|---|---|
| `GET /api/revalidate?path=...` | `Authorization: Bearer $REVALIDATE_SECRET` | ISR 재검증 + 캐시 wipe. `path` 생략 시 전체 페이지를 background 처리하고 즉시 `{"revalidated":true,"status":"processing"}` 반환 |
| `GET /api/init` | `Authorization: Bearer $REVALIDATE_SECRET` | 컨테이너 시작 시 ISR 워밍 |
| `POST /api/cron/ontology` | `REVALIDATE_SECRET` Bearer | LLM ontology, Qdrant embeddings, semantic graph edges, RightRail `ai · similar` 데이터를 생성/갱신. `?force=1`이면 캐시 우회 |
| `GET /api/similar?postId=<id-or-slug>&limit=5` | 없음 | Qdrant 기반 `ai · similar` 글 목록 반환. ontology embedding이 아직 없으면 `202` |
| `GET /api/image-proxy?id=<uuid>&kind=s3` | 없음 (allow-list) | Notion S3 이미지 프록시 (안정 URL) |
| `GET /api/image-proxy?url=<url>` | 없음 | 레거시 image-proxy (구 ISR 캐시 호환) |
| `GET /api/refresh-image?blockId=...` | 없음 | 단일 블록 이미지 URL 재발급 |
| `GET /api/comments?slug=...` | 없음 | slug별 댓글 목록 (45s 서버 캐시) |
| `POST /api/comments` | 없음 | 익명 댓글 작성 (honeypot + IP rate limit) |
| `POST /api/visits` | 없음 | 글 상세 페이지 방문 시 서버가 first-party `HttpOnly` 쿠키로 페이지별 고유 방문을 dedupe하고 Notion `접속자수`를 갱신 |
| `GET /sitemap.xml` | — | SSR 사이트맵 |
| `GET /rss.xml` | — | SSR RSS 2.0 피드 |

방문자 통계는 1년짜리 first-party `HttpOnly` 쿠키(`monolog_visitor_id`)를 사용합니다. Notion에는 salted per-page `VisitKey`만 저장하며 원본 쿠키 값, 원본 IP, User-Agent, cross-page visitor ID는 저장하지 않습니다. 방문자가 쿠키를 삭제하거나 다른 브라우저/기기를 쓰면 새 방문자로 계산됩니다.

```bash
# 수동 전체 ISR 갱신
curl -H "Authorization: Bearer $REVALIDATE_SECRET" "https://your-site.com/api/revalidate"
```

---

## Docker

```bash
# 기본 스택: blog + redis + qdrant
docker compose up -d

# 로컬 변경사항까지 다시 빌드해서 재시작
docker compose up -d --build

docker compose logs -f
```

이미지: `ghcr.io/jung-geun/monolog`

| 태그 | 트리거 |
|---|---|
| `latest` | `main` 브랜치 push 또는 git 태그 `v*` push |
| `X.Y.Z` | git 태그 `vX.Y.Z` push |

- 아키텍처: `linux/amd64`
- SLSA build provenance attestation 자동 첨부

### Qdrant ontology/vector search (선택)

Qdrant 컨테이너는 기본 `docker compose up -d`에 포함됩니다. `/ontology`, Graph semantic overlay, RightRail `ai · similar`는 이 Qdrant 인스턴스를 사용합니다. Compose 안의 `blog` 컨테이너는 `QDRANT_URL=http://qdrant:6333`을 사용하고, 호스트에서 직접 개발할 때만 `.env`의 `QDRANT_URL=http://localhost:6333`을 사용합니다.

온톨로지 빌드/갱신:

```bash
curl -X POST "https://your-site.com/api/cron/ontology" \
  -H "Authorization: Bearer $REVALIDATE_SECRET"
```

```bash
docker run -d -p 3000:3000 --env-file .env ghcr.io/jung-geun/monolog:latest
```

예시 (`NEXT_PUBLIC_*` 값은 공개 값이며 이미지에 다시 빌드할 필요가 없습니다):

```bash
docker run -d -p 3000:3000 \
  --env-file .env \
  -e NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID=G-XXXXXXXXXX \
  -e NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=verification-token \
  ghcr.io/jung-geun/monolog:latest
```

### Redis 캐시 (선택)

Notion API cold-start 성능 향상을 위해 외부 Redis를 연결할 수 있습니다.

```yaml
# docker-compose.yml 예시 — Redis 서비스 함께 실행
services:
  blog:
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis-data:/data

volumes:
  redis-data:
  image-cache:
```

Redis 미설정 시 in-process 메모리 캐시(L1)만 사용합니다 — 서버 재시작마다 초기화됩니다.

### 볼륨 (`docker-compose.yml`)

```yaml
services:
  blog:
    volumes:
      - image-cache:/app/.image-cache     # 이미지 BLOB 캐시
volumes:
  image-cache:
```

---

## 스크립트

```bash
yarn dev              # 개발 서버 (next dev --webpack)
yarn build            # 프로덕션 빌드 (next build --webpack)
yarn start            # 빌드 결과 실행
yarn type-check       # TypeScript strict 검사
yarn lint             # ESLint
yarn test             # Jest 단위 테스트
yarn test:integration # 통합 테스트
yarn test:all         # Jest 전체 (unit + integration)
yarn test:watch
yarn test:coverage
```

---

## 디렉터리 구조
```bash
src/
├── apis/notion-client/      — Notion v5 + 캐시 (getPosts · getRecordMap · getDatabase)
├── components/
│   ├── ActivityGrid/        — GitHub-style 활동 히트맵
│   ├── CommandPalette/      — ⌘K 명령 팔레트
│   ├── Frontmatter/         — YAML 메타데이터 블록
│   ├── ImageWithLoading/    — next/Image + skeleton overlay
│   ├── NotionDatabase/      — Board · Gallery · List · Table
│   └── MetaConfig/          — OG · Twitter · AdSense
├── hooks/                   — usePostsQuery · usePostQuery · useSeriesQuery · useCategoriesQuery · ...
├── layouts/RootLayout/
│   └── EditorChrome/        — TitleBar · ... · LineNumberGutter
├── libs/
│   ├── cache/               — L1 Memory + L2 Redis 포스트 캐시 / BlobFsBackend 이미지 캐시
│   ├── react-query/         — 싱글톤 QueryClient
│   └── utils/
│       ├── graph.ts         — 결정론적 노드 레이아웃
│       ├── stats.ts         — 활동 그리드 집계
│       ├── notion/          — filterPosts · customMapImageUrl · getAllSelectItemsFromPosts · ...
│       └── image/           — proxyUtils · proxyServer · hashUtils
├── routes/
│   ├── Feed/                — Hero · FeaturedSeriesGrid · RecentPostsCompact (썸네일 카드)
│   ├── Detail/              — PostDetail (히어로 썸네일) · RightRail · SeriesNav · ReadingProgress · CommentBox
│   ├── Archive/             — 카테고리 타임라인 (썸네일 카드)
│   ├── SeriesList/          — 시리즈 인덱스 카드 그리드
│   ├── SeriesArchive/       — 시리즈 상세 타임라인
│   ├── Graph/               — 포스트 그래프 (CONNECTED 클릭 → 노드 선택)
│   └── Search/              — 전문 검색
├── styles/                  — theme · colors · variables · zIndexes
└── types/                   — TPost · TNotionDatabase · TDbRow · ...

src/pages/
├── index.tsx                — / (Feed)
├── [slug].tsx               — /{slug} (PostDetail · PageDetail)
├── categories/[name].tsx    — /categories/{name} (Archive)
├── series/index.tsx         — /series (SeriesList)
├── series/[name].tsx        — /series/{name} (SeriesArchive)
├── graph.tsx · search.tsx · 404.tsx
├── sitemap.xml.tsx · rss.xml.tsx
└── api/
    ├── image-proxy.ts       — Notion S3 프록시 + BLOB 캐시 + 만료 복구
    ├── revalidate.ts        — ISR 재검증
    ├── init.ts              — 컨테이너 ISR 워밍
    └── refresh-image.ts     — 단일 이미지 URL 재발급

tests/                       — Jest (jsdom · node · @swc/jest)
.github/workflows/           — docker-build · revalidate · test
```

