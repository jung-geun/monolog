# monolog

> A Notion-backed technical notebook with a VS Code–style editor chrome.

[Live demo — blog.pieroot.xyz](https://blog.pieroot.xyz)

`monolog` 은 Notion 을 CMS 로 쓰는 개인 기술 노트북입니다.
화면 전체가 코드 에디터처럼 보입니다 — TitleBar · ActivityBar · FileTree · TabBar · StatusBar · LineNumberGutter 가 그대로 자리잡고,
본문은 `.md` 탭으로, 카테고리는 `.md` 파일처럼, 그래프는 `graph.json` 으로 표시됩니다.
모든 페이지 이동은 `⌘K` 커맨드 팔레트로도 가능합니다.

이 프로젝트는 [morethan-log](https://github.com/morethanmin/morethan-log) 에서 출발했지만,
UI · 라우트 · 데이터 계층을 거의 새로 짠 별개의 작업입니다.

---

## Highlights

### Editor chrome UI
모든 라우트가 VS Code 의 에디터 윈도우처럼 보입니다.

- **TitleBar** — macOS traffic-light + `pieroot.log — {filename}` + git 브랜치
- **ActivityBar** — explorer / search / graph / commands / theme toggle (44px)
- **FileTree** — `posts/`, `categories/`, `projects/`, `drafts/` 가 실제 트리로 펼쳐짐 (240px)
- **TabBar** — 라우트별 탭 (`README.md`, `about.md`, `graph.json`, `categories/<name>.md`)
- **StatusBar** — `ssh pieroot@log` + branch · 동기화 · entries · encoding · syntax (22px)
- **LineNumberGutter** — 본문 좌측 라인 넘버 (56px)
- **CommandPalette** — `⌘K` / `Ctrl+K` 로 Actions · Posts · Tags · Categories 검색 이동

각 라우트는 `useRegisterChrome(filename, statusItems)` 로 자기 chrome 메타를 동적 등록합니다.

### Graph view (`/graph`)
포스트가 카테고리별 클러스터로 군집된 노드 그래프.
- 결정론적 polar 레이아웃 (seed 기반, 새로고침해도 같은 위치)
- 공유 태그가 있는 글끼리 엣지로 연결
- 같은 카테고리 엣지는 진하게(opacity 0.55), 교차 카테고리 엣지는 옅게(0.18)
- 우측 detail panel — selected 노드 + connected 5개 + 카테고리 chip hover 시 dim

### Archive timeline (`/categories/[name]`)
연도 헤더 + 수직 타임라인 + 점 마커로 카테고리별 글을 시간순 정렬.

### Inline Notion databases
페이지 본문 안의 `child_database` 블록을 4개 뷰로 직접 렌더합니다.

| View | 용도 |
|------|------|
| Table | 행/열 표 (기본) |
| Board | `groupBy` 기반 칸반 (status/select/multi_select 자동 감지) |
| Gallery | 커버 이미지 카드 그리드 (220px+ auto-fill) |
| List | 한 줄 요약 리스트 |

지원 컬럼 타입: `title`, `rich_text`, `select`, `multi_select`, `status`, `date`, `url`, `checkbox`, `files`, `number`, `people`.

DB 블록 주입은 **`createPortal`** 기반입니다. react-notion-x 가 그린 자리 옆에 우리가 만든 portal target 노드를 끼워 넣고 React 가 그쪽으로만 콘텐츠를 그립니다 — DOM 노드 소유권을 React 와 분리해, 페이지 전환 시 발생하던 reconciler 충돌(`removeChild` `NotFoundError`)을 원천 차단합니다.

### Notion v5 Data Source API
`@notionhq/client` v5 공식 클라이언트의 `dataSources.query` 사용 (deprecated `databases.query` 아님).
`NOTION_DATASOURCE_ID` 환경 변수 하나로 시작합니다.

### Dual-layer cache (Memory + Filesystem)
- **L1**: 프로세스 내 `Map` 캐시 (FIFO eviction, 200 entries)
- **L2**: `.notion-cache/*.json` 파일시스템 캐시 (Docker 볼륨에 영속)
- **Vercel · Netlify · Lambda 자동 감지** 시 L2 비활성, L1 only 모드로 fallback
- L2 → L1 백필은 60초 hot TTL
- `posts` / `recordMap` / `database` 세 종류 캐시를 각각 다른 TTL 로 관리
- 캐시 키에 Notion `last_edited_time` 포함 → Notion 측 수정 시 자동 무효화

| 키 | TTL (기본 6h 기준) |
|----|--------------------|
| `posts:<dsId>` | `revalidateTime / 2` (3 시간) |
| `recordMap:<pageId>:<lastEdited>` | `revalidateTime` (6 시간) |
| `database:v3:<dbId>:<lastEdited>` | 30 분 |

### Hardened image proxy (`/api/image-proxy`)
Notion S3 presigned URL 만료를 자동으로 복구합니다.

- 프록시는 `amazonaws.com` / `notion` 호스트만 허용 (allow-list, 그 외 403)
- 401 / 403 / 404 / 410 응답 시 `notion.blocks.retrieve` 또는 `notion.pages.retrieve` 로 새 URL 재발급
- 성공 시 1년 immutable 캐싱 (CDN-Cache-Control 포함)
- 실패 시 5xx 대신 inline SVG `Image unavailable` placeholder + JSON 로그 + (옵션) Slack webhook
- 만료 ID 단위 강제 갱신용 `/api/refresh-image?blockId=...` 엔드포인트 별도 제공

### Reading aids
- **ReadingProgress** — `.scroll-area` 진행률 2px accent 바
- **RightRail (240px)** — 본문에서 추출한 TOC + 동일 카테고리 related 3개 + 공유 태그 mini-graph SVG
- **Frontmatter** — YAML 형식의 메타데이터 블록 (모노스페이스, key 가 accent3 컬러)

### Container ISR warmup
Docker 컨테이너 entrypoint 가 `next start` 후 자동으로 `/api/init?secret=...` 을 호출해 모든 포스트 ISR 캐시를 미리 채웁니다 (3회 retry). Cold start 가 사라집니다.

### 기타
- 자동 ISR 갱신 (`REVALIDATE_HOURS`, `/api/revalidate`)
- 사이트맵은 SSR 라우트 (`pages/sitemap.xml.tsx`) 로 동적 생성 + CDN s-maxage 캐싱
- 정기 revalidate GitHub Action (`revalidate.yml`) — 3 일마다 자동 호출 + Discord webhook 알림
- Mermaid 다이어그램, KaTeX 수식 (auto-render), Prism 코드 하이라이팅
- YouTube · Vimeo · Loom · GoogleDrive · audio 임베드
- Light / Dark scheme 쿠키 영속 (`prefers-color-scheme` fallback)
- ActivityGrid GitHub-style 활동 히트맵 (26 × 7)

---

## Stack

- Next.js 13 (Pages Router)
- TypeScript strict (`allowJs` + `checkJs` 까지 활성)
- Emotion (CSS-in-JS, `jsxImportSource: @emotion/react`)
- TanStack Query v4 (서버 prefetch + dehydrate · client `enabled: false`)
- `@notionhq/client` v5 + `react-notion-x` 7.x
- Jest 30 + ts-jest (jsdom)

---

## Quick start

```bash
git clone https://github.com/jung-geun/monolog.git
cd monolog
npm install

cp .env.example .env
# 최소 두 개:
#   NOTION_TOKEN=ntn_xxxxx
#   NOTION_DATASOURCE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

npm run dev
```

`http://localhost:3000` 에서 확인합니다.

### Notion 셋업
1. [Notion Integrations](https://www.notion.so/my-integrations) 에서 Internal Integration 을 만들고 토큰(`ntn_...`) 을 복사합니다.
2. CMS 로 쓸 데이터베이스 페이지를 열고 `...` → `Add connections` 로 위 Integration 을 연결합니다.
3. 데이터베이스 URL 의 UUID(하이픈 포함, 32+4 자리) 가 `NOTION_DATASOURCE_ID` 입니다.

사이트 메타(제목, 설명, 프로필, 프로젝트 카드 등)는 루트의 `site.config.js` 에서 관리합니다.

---

## 환경 변수

### 필수
| 변수명 | 설명 |
|--------|------|
| `NOTION_TOKEN` | Notion Internal Integration Token (`ntn_...`) |
| `NOTION_DATASOURCE_ID` | Notion 데이터 소스 ID (UUID with hyphens) |

### 선택
| 변수명 | 기본값 | 설명 |
|--------|--------|------|
| `TOKEN_FOR_REVALIDATE` | — | `/api/revalidate` · `/api/init` 보호 토큰 |
| `REVALIDATE_HOURS` | `6` | ISR 재생성 주기 (시간 단위, 캐시 TTL 도 따라감) |
| `NEXT_PUBLIC_SITE_URL` | — | 절대 이미지 프록시 URL 빌드 시 prefix |
| `NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID` | — | Google Analytics |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | — | Google Search Console |
| `NEXT_PUBLIC_NAVER_SITE_VERIFICATION` | — | Naver Search Advisor |
| `NEXT_PUBLIC_UTTERANCES_REPO` | — | Utterances 댓글 (예: `user/repo`) |
| `SLACK_WEBHOOK` | — | image-proxy 실패 알림 |
| `VERCEL` / `NETLIFY` / `AWS_LAMBDA_FUNCTION_NAME` | — | (자동) 감지 시 L2 캐시 비활성 |

---

## API 엔드포인트

| Path | 인증 | 용도 |
|------|------|------|
| `GET /api/revalidate?secret=...&path=...` | `TOKEN_FOR_REVALIDATE` | 특정 경로 또는 전체 ISR 재검증 + 캐시 wipe |
| `GET /api/init?secret=...` | `TOKEN_FOR_REVALIDATE` | 컨테이너 시작 시 모든 포스트 ISR 워밍 (entrypoint 가 자동 호출) |
| `GET /api/image-proxy?url=...` | 없음 (allow-list) | Notion S3 이미지 프록시 + 만료 자동 복구 |
| `GET /api/refresh-image?blockId=...` | 없음 | 단일 블록 이미지 URL 재발급 |
| `GET /api/debug/inspect-slug?slug=...` | 없음 | 진단용 — slug 의 cached / fresh / recordMap 비교 |
| `GET /sitemap.xml` | — | SSR 사이트맵 (`getServerSideSitemap`) |

수동 무효화:
```bash
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
|------|--------|
| `latest` + `vX.Y.Z` + `vX.Y` + `vX` | git 태그 `v*` push |
| `nightly` | `main` / `master` 브랜치 push |
| `dev` | `dev` 브랜치 push |
| `pr-<n>` | PR (build only, no push) |

- **멀티 아키**: `linux/amd64`, `linux/arm64`
- **SLSA build provenance attestation** 자동 첨부
- GitHub Actions 캐시 (`type=gha`, `mode=max`)

```bash
docker run -d -p 3000:3000 --env-file .env ghcr.io/jung-geun/monolog:latest
```

### `.notion-cache` 영속화 (`docker-compose.yml`)
```yaml
services:
  blog:
    volumes:
      - notion-cache:/app/.notion-cache
volumes:
  notion-cache:
```

---

## Scripts

```bash
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드 (prebuild 가 stale sitemap 정리)
npm run start        # 빌드 결과 실행
npm run type-check   # TypeScript strict 검사
npm run lint         # ESLint
npm run test         # Jest 전체
npm run test:watch
npm run test:coverage
```

---

## 디렉터리 구조

```
src/
├── apis/notion-client/      — Notion v5 + 캐시 통합 (getPosts / getRecordMap / getDatabase)
├── components/
│   ├── ActivityGrid/        — GitHub-style 활동 히트맵
│   ├── CommandPalette/      — ⌘K 명령 팔레트
│   ├── Frontmatter/         — YAML 메타데이터 블록
│   ├── NotionDatabase/      — Board · Gallery · List · Table · Placeholder
│   ├── ImageWithLoading/    — IndexedDB + Cache API 하이브리드 이미지 캐시
│   └── MetaConfig/          — OG · Twitter · AdSense
├── hooks/                   — usePostsQuery · usePostQuery · useScheme · useCommandPalette · ...
├── layouts/RootLayout/
│   └── EditorChrome/        — TitleBar · ActivityBar · FileTree · TabBar · StatusBar · LineNumberGutter · RouteChromeContext
├── libs/
│   ├── cache/               — L1 Memory + L2 FS (Vercel 자동 fallback)
│   ├── react-query/         — 싱글톤 QueryClient
│   └── utils/
│       ├── graph.ts         — 결정론적 노드 레이아웃 (8색 PALETTE)
│       ├── stats.ts         — 활동 그리드 + 카운트 집계
│       ├── notion/          — filterPosts · optimizeRecordMap · customMapImageUrl · ...
│       └── image/           — proxyUtils · proxyServer · 클라이언트 캐시
├── routes/
│   ├── Feed/                — Hero · StatsGrid · ActivityGrid · EditorialPostList
│   ├── Detail/              — PostDetail · PageDetail · NotionRenderer · ReadingProgress · RightRail · CommentBox
│   ├── Archive/             — 카테고리 타임라인
│   ├── Graph/               — 포스트 그래프
│   ├── Search/              — 전문 검색
│   └── Error/
├── styles/                  — theme · colors · variables · zIndexes (Radix Colors 합성)
└── types/                   — TPost · TNotionDatabase · TDbRow · TDbPropertySchema · ...

src/pages/
├── index.tsx                — / (Feed)
├── [slug].tsx               — /{slug} (PostDetail · PageDetail)
├── categories/[name].tsx    — /categories/{name} (Archive)
├── graph.tsx · search.tsx · 404.tsx · sitemap.xml.tsx
└── api/
    ├── revalidate.ts        — ISR 재검증
    ├── init.ts              — 컨테이너 ISR 워밍
    ├── image-proxy.ts       — Notion S3 프록시 + 만료 복구
    ├── refresh-image.ts     — 단일 이미지 URL 재발급
    └── debug/inspect-slug.ts

tests/                       — Jest (jsdom · ts-jest · next/jest)
.github/workflows/           — docker-build · revalidate · test
```

---

## License

[MIT](LICENSE) — 원본 [morethan-log](https://github.com/morethanmin/morethan-log) 의 라이선스를 그대로 따릅니다.
