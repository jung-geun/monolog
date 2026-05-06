# USAGE

monolog 셋업·운영 가이드. 프로젝트 개요와 차별점은 [`README.md`](../README.md)를 참고하세요.

---

## 빠른 시작

```bash
git clone https://github.com/jung-geun/monolog.git
cd monolog
npm install

cp .env.example .env
# 필수:
#   NOTION_TOKEN=ntn_xxxxx
#   NOTION_DATASOURCE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

npm run dev
```

`http://localhost:3000`에서 확인합니다.

---

## Notion 셋업

1. [Notion Integrations](https://www.notion.so/my-integrations)에서 Internal Integration을 만들고 토큰(`ntn_...`)을 복사합니다.
2. CMS로 쓸 데이터베이스 페이지를 열고 `...` → `Add connections`으로 Integration을 연결합니다.
3. 데이터베이스 URL의 UUID(하이픈 포함)가 `NOTION_DATASOURCE_ID`입니다.

### Notion DB 권장 프로퍼티

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

사이트 메타(제목, 설명, 프로필, 프로젝트 카드, About 페이지의 stack 등)는 루트의 `site.config.js`에서 관리합니다.

---

## 환경 변수

### 필수

| 변수명 | 설명 |
|---|---|
| `NOTION_TOKEN` | Notion Internal Integration Token (`ntn_...`) |
| `NOTION_DATASOURCE_ID` | Notion 데이터 소스 ID (UUID with hyphens) |

### 선택

| 변수명 | 기본값 | 설명 |
|---|---|---|
| `TOKEN_FOR_REVALIDATE` | — | `/api/revalidate` · `/api/init` 보호 토큰 |
| `REVALIDATE_HOURS` | `6` | ISR 재생성 주기 (시간) |
| `NEXT_PUBLIC_SITE_URL` | — | 절대 이미지 프록시 URL prefix |
| `NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID` | — | Google Analytics |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | — | Google Search Console |
| `NEXT_PUBLIC_NAVER_SITE_VERIFICATION` | — | Naver Search Advisor |
| `NEXT_PUBLIC_UTTERANCES_REPO` | — | Utterances 댓글 (`user/repo`) |
| `SLACK_WEBHOOK` | — | image-proxy 실패 Slack 알림 |

---

## API 엔드포인트

| Path | 인증 | 용도 |
|---|---|---|
| `GET /api/revalidate?secret=...&path=...` | `TOKEN_FOR_REVALIDATE` | ISR 재검증 + 캐시 wipe |
| `GET /api/init?secret=...` | `TOKEN_FOR_REVALIDATE` | 컨테이너 시작 시 ISR 워밍 |
| `GET /api/image-proxy?id=<uuid>&kind=s3` | 없음 (allow-list) | Notion S3 이미지 프록시 (안정 URL) |
| `GET /api/image-proxy?url=<url>` | 없음 | 레거시 image-proxy (구 ISR 캐시 호환) |
| `GET /api/refresh-image?blockId=...` | 없음 | 단일 블록 이미지 URL 재발급 |
| `GET /api/debug/inspect-slug?slug=...` | 없음 | 진단 — cached / fresh / recordMap 비교 |
| `GET /sitemap.xml` | — | SSR 사이트맵 |
| `GET /rss.xml` | — | SSR RSS 2.0 피드 |

```bash
# 수동 전체 ISR 갱신
curl "https://your-site.com/api/revalidate?secret=$TOKEN_FOR_REVALIDATE"
```

---

## Docker

```bash
docker compose up -d
docker compose logs -f
```

이미지: `ghcr.io/jung-geun/monolog`

| 태그 | 트리거 |
|---|---|
| `latest` + `vX.Y.Z` + `vX.Y` + `vX` | git 태그 `v*` push |
| `nightly` | `main` 브랜치 push |
| `dev` | `dev` 브랜치 push |
| `pr-<n>` | PR (build only, no push) |

- 멀티 아키: `linux/amd64`, `linux/arm64`
- SLSA build provenance attestation 자동 첨부

```bash
docker run -d -p 3000:3000 --env-file .env ghcr.io/jung-geun/monolog:latest
```

### 볼륨 (`docker-compose.yml`)

```yaml
services:
  blog:
    volumes:
      - notion-cache:/app/.notion-cache   # Notion API 응답 캐시
      - image-cache:/app/.image-cache     # 이미지 BLOB 캐시
volumes:
  notion-cache:
  image-cache:
```

---

## 스크립트

```bash
npm run dev           # 개발 서버 (next dev --webpack)
npm run build         # 프로덕션 빌드 (next build --webpack)
npm run start         # 빌드 결과 실행
npm run type-check    # TypeScript strict 검사
npm run lint          # ESLint
npm run test          # Jest 전체
npm run test:watch
npm run test:coverage
```

---

## 디렉터리 구조

```
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
│   └── EditorChrome/        — TitleBar · ActivityBar · FileTree · TabBar · StatusBar · LineNumberGutter
├── libs/
│   ├── cache/               — L1 Memory + L2 FS 포스트 캐시 / BlobFsBackend 이미지 캐시
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
    ├── refresh-image.ts     — 단일 이미지 URL 재발급
    └── debug/inspect-slug.ts

tests/                       — Jest (jsdom · node · @swc/jest)
.github/workflows/           — docker-build · revalidate · test
```
