# monolog

> Notion-backed technical notebook with a VS Code–style editor chrome.

**[blog.pieroot.xyz](https://blog.pieroot.xyz)** · `v1.1.0`

`monolog`은 Notion을 CMS로 쓰는 개인 기술 노트북입니다. 화면 전체가 코드 에디터처럼 동작합니다 — TitleBar · ActivityBar · FileTree · TabBar · StatusBar · LineNumberGutter가 자리잡고, 본문은 `.md` 탭으로, 카테고리와 시리즈는 파일처럼, 그래프는 `graph.json`으로 표시됩니다. 모든 페이지 이동은 `⌘K` 커맨드 팔레트로 가능합니다.

[morethan-log](https://github.com/morethanmin/morethan-log)에서 출발했지만 UI · 라우트 · 데이터 계층을 거의 새로 짠 별개의 작업입니다.

---

## 주요 기능

### Editor chrome UI
모든 라우트가 VS Code 에디터 윈도우처럼 보입니다.

| 컴포넌트 | 설명 |
|---|---|
| **TitleBar** | macOS traffic-light + `pieroot.log — {filename}` + git 브랜치 |
| **ActivityBar** | explorer / search / graph / commands / theme toggle (44px) |
| **FileTree** | `posts/` · `categories/` · `series/` · `projects/` · `drafts/` 트리 (240px) |
| **TabBar** | 라우트별 탭 (`README.md`, `categories/<name>.md`, `series/<name>.md` …) |
| **StatusBar** | `ssh pieroot@log` + branch · 동기화 · entries · encoding · syntax (22px) |
| **LineNumberGutter** | 본문 좌측 라인 넘버 (56px) |
| **CommandPalette** | `⌘K` / `Ctrl+K` — Actions · Posts · Tags · Categories 검색 이동 |

각 라우트는 `useRegisterChrome(filename, statusItems)`로 자기 chrome 메타를 동적 등록합니다.

### 시리즈 (Series)
Notion DB의 `Series` select 프로퍼티로 연재글을 묶어 관리합니다.

- **`/series`** — 전체 시리즈 인덱스. 카드 그리드(시리즈명 · 글 수 · 최신 글 제목).
- **`/series/[name]`** — 시리즈 상세. 연도별 타임라인, 다른 시리즈 chip 네비.
- **FileTree** — `▾ series/` 섹션 자동 노출 (시리즈 0개면 숨김).
- **RightRail** — 현재 글이 속한 시리즈 글 목록. 현재 글 강조(`▸`).
- **본문 하단 Prev/Next** — 시리즈 내 이전/다음 글 카드. 시간 순(오래된→최신), 위치(N/M) 표시.

### 이미지 프록시 + BLOB 캐시
Notion S3 presigned URL 만료를 자동 복구하고 디스크에 캐싱합니다.

- **안정 프록시 URL** — S3 UUID를 키로 `?id=<uuid>&kind=s3` 형태 emit. presigned URL이 ISR마다 바뀌어도 프록시 URL은 고정 → 브라우저 disk cache · next/Image 옵티마이저 캐시 정상 동작.
- **서버 BLOB 디스크 캐시** — `/app/.image-cache/`에 이미지 바이너리 영속 저장. S3 UUID 키 30일 TTL, blockId 폴백 7일 TTL. 1 GB / 500 entry cap + LRU eviction.
- **In-flight dedup** — 동일 이미지 concurrent cold-miss가 Notion API를 중복 호출하지 않도록 Promise 공유.
- **자동 URL 재발급** — 401 / 403 / 404 / 410 응답 시 `notion.blocks.retrieve` → `notion.pages.retrieve` 순으로 재시도.
- **next/Image 옵티마이저 활성** — `unoptimized` 제거. `next.config.js` `localPatterns`로 프록시 경로 허용. WebP/AVIF + 디바이스별 해상도 자동 생성.
- **응답 헤더** — `Cache-Control: public, max-age=31536000, immutable` (1년). 실패 시 inline SVG placeholder + Slack webhook 알림(옵션).

### Archive timeline (`/categories/[name]`)
연도 헤더 + 수직 타임라인 + 점 마커로 카테고리별 글을 최신순 정렬.
다른 카테고리 chip으로 직접 점프 가능.

### Graph view (`/graph`)
포스트가 카테고리별 클러스터로 군집된 노드 그래프.
- 결정론적 polar 레이아웃 (seed 기반, 새로고침해도 같은 위치)
- 공유 태그가 있는 글끼리 엣지 연결
- 같은 카테고리 엣지 진하게(opacity 0.55), 교차 카테고리 엣지 옅게(0.18)
- 우측 detail panel — selected 노드 + connected 5개

### Inline Notion databases
페이지 본문 안의 `child_database` 블록을 4개 뷰로 직접 렌더합니다.

| View | 용도 |
|---|---|
| Table | 행/열 표 (기본) |
| Board | `groupBy` 기반 칸반 (status / select / multi_select 자동 감지) |
| Gallery | 커버 이미지 카드 그리드 (220px+ auto-fill) |
| List | 한 줄 요약 리스트 |

지원 컬럼 타입: `title` · `rich_text` · `select` · `multi_select` · `status` · `date` · `url` · `checkbox` · `files` · `number` · `people`.

DB 블록 주입은 **createPortal** 기반 — react-notion-x가 그린 자리에 portal target 노드를 끼워 넣어 페이지 전환 시 reconciler 충돌(`removeChild NotFoundError`)을 원천 차단합니다.

### Dual-layer post cache (Memory + Filesystem)
- **L1**: 프로세스 내 `Map` 캐시 (FIFO eviction, 200 entries)
- **L2**: `.notion-cache/*.json` 파일시스템 캐시 (Docker 볼륨 영속)
- Vercel · Netlify · Lambda 자동 감지 시 L2 비활성, L1-only 모드
- L2 → L1 백필은 60초 hot TTL
- 캐시 키에 Notion `last_edited_time` 포함 → 수정 시 자동 무효화

| 키 | TTL (기본 6h 기준) |
|---|---|
| `posts:<dsId>` | `revalidateTime / 2` (3시간) |
| `recordMap:<pageId>:<lastEdited>` | `revalidateTime` (6시간) |
| `database:v3:<dbId>:<lastEdited>` | 30분 |
| image BLOB (S3 UUID 키) | 30일 |
| image BLOB (blockId 폴백 키) | 7일 |

### Reading aids
- **ReadingProgress** — `.scroll-area` 진행률 2px accent 바
- **RightRail (240px)** — TOC + 시리즈 글 목록 + 동일 카테고리 related 3개 + 공유 태그 mini-graph SVG
- **Frontmatter** — YAML 형식 메타데이터 블록 (모노스페이스, key가 accent3 컬러)
- **SeriesNav** — 본문 하단 시리즈 Prev/Next 박스

### Container ISR warmup
Docker 컨테이너 entrypoint가 `next start` 후 자동으로 `/api/init`을 호출해 모든 포스트 ISR 캐시를 미리 채웁니다 (3회 retry). Cold start가 사라집니다.

### 기타
- 자동 ISR 갱신 (`REVALIDATE_HOURS`, `/api/revalidate`)
- 사이트맵 SSR 라우트 (`pages/sitemap.xml.tsx`) — 동적 생성 + CDN s-maxage 캐싱
- 정기 revalidate GitHub Action (`revalidate.yml`) — 3일마다 자동 호출 + Discord webhook 알림
- Mermaid 다이어그램, KaTeX 수식, Prism 코드 하이라이팅
- YouTube · Vimeo · Loom · GoogleDrive · audio 임베드
- Light / Dark scheme 쿠키 영속 (`prefers-color-scheme` fallback)
- ActivityGrid GitHub-style 활동 히트맵 (26 × 7)

---

## 스택

| 분류 | 기술 |
|---|---|
| Framework | Next.js 16 (Pages Router, `output: standalone`) |
| Language | TypeScript strict (`allowJs` + `checkJs`) |
| Styling | Emotion (CSS-in-JS, `jsxImportSource: @emotion/react`) |
| Data fetching | TanStack Query v4 (서버 prefetch + dehydrate) |
| Notion | `@notionhq/client` v5 Data Sources API + `react-notion-x` 7.x |
| Test | Jest 30 + @swc/jest (jsdom + node) |
| Container | Docker multi-arch (`linux/amd64`, `linux/arm64`), GHCR |

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

### Notion 셋업

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
| `Thumbnail` | files 또는 url | 썸네일 이미지 |

사이트 메타(제목, 설명, 프로필, 프로젝트 카드 등)는 루트의 `site.config.js`에서 관리합니다.

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
npm run dev           # 개발 서버
npm run build         # 프로덕션 빌드
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
│   ├── Feed/                — Hero · StatsGrid · ActivityGrid · EditorialPostList
│   ├── Detail/              — PostDetail · RightRail · SeriesNav · ReadingProgress · CommentBox
│   ├── Archive/             — 카테고리 타임라인
│   ├── SeriesList/          — 시리즈 인덱스 카드 그리드
│   ├── SeriesArchive/       — 시리즈 상세 타임라인
│   ├── Graph/               — 포스트 그래프
│   └── Search/              — 전문 검색
├── styles/                  — theme · colors · variables · zIndexes
└── types/                   — TPost · TNotionDatabase · TDbRow · ...

src/pages/
├── index.tsx                — / (Feed)
├── [slug].tsx               — /{slug} (PostDetail · PageDetail)
├── categories/[name].tsx    — /categories/{name} (Archive)
├── series/index.tsx         — /series (SeriesList)
├── series/[name].tsx        — /series/{name} (SeriesArchive)
├── graph.tsx · search.tsx · 404.tsx · sitemap.xml.tsx
└── api/
    ├── image-proxy.ts       — Notion S3 프록시 + BLOB 캐시 + 만료 복구
    ├── revalidate.ts        — ISR 재검증
    ├── init.ts              — 컨테이너 ISR 워밍
    ├── refresh-image.ts     — 단일 이미지 URL 재발급
    └── debug/inspect-slug.ts

tests/                       — Jest (jsdom · node · @swc/jest)
.github/workflows/           — docker-build · revalidate · test
```

---

## 변경 이력

### v1.1.0
- **시리즈 기능**: Notion `Series` select → `/series` 인덱스 + `/series/[name]` 상세 + RightRail series 섹션 + 본문 하단 Prev/Next + FileTree `▾ series/`
- **이미지 캐시 전면 개선**: 안정 프록시 URL(`?id=<uuid>&kind=s3`) + 서버 BLOB 디스크 캐시 (1GB LRU) + in-flight dedup + `next/Image` 옵티마이저 복원 (WebP/AVIF)
- 클라이언트 IndexedDB 이미지 캐시 레이어 제거 (이중 fetch 제거)

### v1.0.0
- 초기 릴리스

---

## License

[MIT](LICENSE) — 원본 [morethan-log](https://github.com/morethanmin/morethan-log)의 라이선스를 따릅니다.
