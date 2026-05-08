# monolog

> Notion-backed technical notebook with a VS Code–style editor chrome.

**[blog.pieroot.xyz](https://blog.pieroot.xyz)** · `v1.4.0` · 셋업 가이드 → [`docs/USAGE.md`](docs/USAGE.md)

`monolog`은 Notion을 CMS로 쓰는 개인 기술 노트북입니다. 화면 전체가 코드 에디터처럼 동작합니다 — TitleBar · ActivityBar · FileTree · TabBar · StatusBar · LineNumberGutter가 자리잡고, 본문은 `.md` 탭으로, 카테고리와 시리즈는 파일처럼, 그래프는 `graph.json`으로 표시됩니다. 모든 페이지 이동은 `⌘K` 커맨드 팔레트로 가능합니다.

[morethan-log](https://github.com/morethanmin/morethan-log)에서 출발했지만 UI · 라우트 · 데이터 계층을 거의 새로 짠 별개의 작업입니다.

---

## 차별점

다른 Notion 기반 블로그와 결정적으로 다른 점들.

- **에디터 chrome 전체** — 사이드바 · 탭바 · 상태표시줄 · 라인 게이지가 모든 라우트에 일관되게 깔립니다. 글 하나를 읽는 것이 IDE에서 파일을 여는 경험과 같습니다.
- **다중 탭 시스템** — 글마다 탭으로 열리고 `⌘+Shift+W`로 닫습니다. 여러 글을 동시에 열어두고 라우트 간을 즉시 전환합니다.
- **본문 길이를 따라가는 라인 게이지** — `ResizeObserver`로 콘텐츠 높이를 추적해 라인 번호가 양방향으로 늘고 줄어듭니다 (자기 측정 루프 회피를 위해 라인 div를 `position:absolute`로 분리).
- **`⌘K` 커맨드 팔레트** — Actions · Posts · Tags · Categories를 검색해 어디든 점프합니다.
- **안정 Notion 이미지 프록시** — S3 presigned URL이 ISR마다 만료돼도 프록시 URL은 고정. 1GB LRU 디스크 BLOB 캐시 + in-flight dedup + 401/403/410 자동 재발급 + WebP/AVIF 옵티마이저.
- **연재(Series) 시스템** — Notion select 한 번으로 `/series` 인덱스, 상세 페이지, RightRail 시리즈 섹션, 본문 하단 Prev/Next가 자동 연결됩니다.
- **결정론적 그래프 뷰** — 카테고리별 polar 클러스터 레이아웃. 새로고침해도 같은 위치. 공유 태그로 엣지가 그려지고, 우측 CONNECTED 목록은 클릭하면 해당 노드가 선택됩니다.
- **About 페이지가 곧 IDE 위젯** — 활동 히트맵 + 스택 그리드 + Contact YAML이 한 화면에 통합. `site.config.js`의 `stack`/`profile`이 위젯에 그대로 반영됩니다.
- **인라인 Notion DB 4-뷰 렌더** — `child_database` 블록이 Table · Board · Gallery · List로 렌더되며, `createPortal`로 react-notion-x reconciler 충돌을 원천 차단합니다.
- **컨테이너 ISR 워밍** — `next start` 후 entrypoint가 자동으로 `/api/init`을 호출해 모든 포스트 캐시를 미리 채웁니다. Cold start 없음.
- **자기 데이터 익명 댓글** — 외부 SaaS 없이 방문자 댓글을 본인 Notion DB에 적재. 서버 캐시(45s) + honeypot + IP rate limit + IP 해시 16자만 저장. Notion `Status` 한 번에 모더레이션.

---

## 주요 기능

### Editor chrome UI
모든 라우트가 VS Code 에디터 윈도우처럼 보입니다.

| 컴포넌트 | 설명 |
|---|---|
| **TitleBar** | macOS traffic-light + `pieroot.log — {filename}` + git 브랜치 |
| **ActivityBar** | explorer / search / graph / commands / theme toggle (44px) |
| **FileTree** | `posts/` · `categories/` · `series/` · `projects/` · `drafts/` · `public/` 트리 (240px, 토글 슬라이드) |
| **TabBar** | 라우트별 탭 (`README.md`, `categories/<name>.md`, `series/<name>.md`, `graph.json`, …). 프리뷰 탭, `⌘+Shift+W` 닫기 |
| **StatusBar** | `ssh pieroot@log` + branch · 동기화 · entries · encoding · syntax (22px) |
| **LineNumberGutter** | 본문 좌측 라인 넘버 — **콘텐츠 길이에 맞춰 자동 확장/축소** |
| **CommandPalette** | `⌘K` / `Ctrl+K` — Actions · Posts · Tags · Categories 검색 이동 |

각 라우트는 `useRegisterChrome(filename, statusItems)`로 자기 chrome 메타를 동적 등록합니다.

### 글 목록 카드 (썸네일 통합)
`RecentPostsCompact`(홈 latest)와 `Archive`(카테고리)의 카드가 6px 카테고리 컬러 레일 + 본문 + **카드 전체 높이를 채우는 우측 썸네일**(`object-cover`)로 구성됩니다. 썸네일이 없는 글은 자연스럽게 2단 그리드로 떨어집니다.

### 본문 상단 히어로 썸네일
`PostDetail`(non-about) 분기에서 Frontmatter 위에 16:9 히어로 썸네일이 `priority` 로딩으로 깔립니다. About 페이지는 위젯 영역으로 대체.

### 시리즈 (Series)
Notion DB의 `Series` select 프로퍼티로 연재글을 묶어 관리합니다.

- **`/series`** — 전체 시리즈 인덱스. 카드 그리드(시리즈명 · 글 수 · 최신 글 제목).
- **`/series/[name]`** — 시리즈 상세. 연도별 타임라인, 다른 시리즈 chip 네비, 시리즈 글 카드 썸네일.
- **FileTree** — `▾ series/` 섹션 자동 노출 (시리즈 0개면 숨김).
- **RightRail** — 현재 글이 속한 시리즈 글 목록. 현재 글 강조(`▸`).
- **본문 하단 Prev/Next** — 시리즈 내 이전/다음 글 카드. 시간 순(오래된→최신), 위치(N/M) 표시.

### 이미지 프록시 + BLOB 캐시
Notion S3 presigned URL 만료를 자동 복구하고 디스크에 캐싱합니다.

- **안정 프록시 URL** — S3 UUID를 키로 `?id=<uuid>&kind=s3` 형태 emit. presigned URL이 ISR마다 바뀌어도 프록시 URL은 고정 → 브라우저 disk cache · `next/Image` 옵티마이저 캐시 정상 동작.
- **서버 BLOB 디스크 캐시** — `/app/.image-cache/`에 이미지 바이너리 영속 저장. S3 UUID 키 30일 TTL, blockId 폴백 7일 TTL. 1 GB / 500 entry cap + LRU eviction.
- **In-flight dedup** — 동일 이미지 concurrent cold-miss가 Notion API를 중복 호출하지 않도록 Promise 공유.
- **자동 URL 재발급** — 401 / 403 / 404 / 410 응답 시 `notion.blocks.retrieve` → `notion.pages.retrieve` 순으로 재시도.
- **`next/Image` 옵티마이저 활성** — `next.config.js` `localPatterns`로 프록시 경로 허용. WebP/AVIF + 디바이스별 해상도 자동 생성.
- **응답 헤더** — `Cache-Control: public, max-age=31536000, immutable` (1년). 실패 시 inline SVG placeholder + Slack webhook 알림(옵션).

### About 페이지 (IDE 위젯)
About 라우트는 다음 위젯들을 한 화면에 묶어 보여줍니다.

- **YAML frontmatter** — `site.config.js`의 `profile.name` / `role` / `bio`
- **StatsGrid** — posts · categories · series · tags · words 집계
- **ActivityHeatmap** — GitHub-style 26 × 7 활동 히트맵
- **StackGrid** — `site.config.js`의 `stack` 객체를 카테고리별 chip으로 자동 렌더 (정의 없으면 위젯 자체 숨김)
- **ContactBlock** — email · GitHub · LinkedIn · Instagram (config-driven)

### Archive timeline (`/categories/[name]`)
연도 헤더 + 수직 타임라인 + 점 마커로 카테고리별 글을 최신순 정렬. 카드 우측 썸네일, 다른 카테고리 chip으로 점프.

### Graph view (`/graph`)
포스트가 카테고리별 클러스터로 군집된 노드 그래프.

- 결정론적 polar 레이아웃 (seed 기반, 새로고침해도 같은 위치)
- 공유 태그가 있는 글끼리 엣지 연결
- 같은 카테고리 엣지 진하게(opacity 0.55), 교차 카테고리 엣지 옅게(0.18)
- 우측 detail panel — selected 노드 + **CONNECTED 목록 클릭 시 해당 노드 선택**

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
- 읽기 전용 파일시스템(serverless) 자동 감지 시 L2 비활성, L1-only 모드
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

### 익명 댓글 (Notion DB 적재)
방문자가 닉네임/이메일 없이 댓글을 달면, 본인 Notion `comments` DB에 자동 적재됩니다. 외부 SaaS(Disqus·Giscus·Cusdis) 의존 없이 자기 데이터로 모더레이션·확인.

- **자동 닉네임** — `익명#a3f2`. `SHA-256(slug + ipHash + salt)` 앞 4자 → 글 단위 일관성 + 글 간 추적 차단
- **서버 캐시** — slug별 45s TTL. POST 성공 시 해당 slug 캐시 invalidate → 새 댓글 즉시 반영
- **스팸 방어** — honeypot 필드 + 폼 mount time 검사(<3s reject) + IP rate limit (60s 쿨다운 / 1분 3건 / 1시간 20건)
- **PII 최소화** — IP는 `SHA-256(ip + COMMENT_HASH_SALT)` 앞 16자만 저장. 이메일·실명 수집 안 함
- **Notion 모더레이션** — `Status`를 `hidden`/`spam`으로 변경하면 페이지에서 자동 제외 (캐시 만료 시점부터)
- **Optimistic UI** — POST 즉시 목록에 표시, 실패 시 롤백 + 백그라운드 재fetch

### SEO / 발행
- **`/sitemap.xml`** — SSR 동적 생성 + CDN s-maxage 캐싱
- **`/rss.xml`** — RSS 2.0 SSR 피드 (`<channel>` + 글마다 `<item>`, FileTree·`_document` `<link rel="alternate">` 정렬)
- 정기 revalidate GitHub Action (`revalidate.yml`) — 3일마다 자동 호출 + Discord webhook 알림

### 컨테이너 ISR warmup
Docker 컨테이너 entrypoint가 `next start` 후 자동으로 `/api/init`을 호출해 모든 포스트 ISR 캐시를 미리 채웁니다 (3회 retry). Cold start가 사라집니다.

### 기타
- 자동 ISR 갱신 (`REVALIDATE_HOURS`, `/api/revalidate`)
- Mermaid 다이어그램, KaTeX 수식, Prism 코드 하이라이팅
- YouTube · Vimeo · Loom · GoogleDrive · audio 임베드
- Light / Dark scheme 쿠키 영속 (`prefers-color-scheme` fallback)

---

## 스택

| 분류 | 기술 |
|---|---|
| Framework | Next.js 16 (Pages Router, `output: standalone`) |
| Language | TypeScript 6 strict (`allowJs` + `checkJs`) |
| UI | React 19 · Emotion (CSS-in-JS, `jsxImportSource: @emotion/react`) · Tailwind 3 |
| Data fetching | TanStack Query v5 (서버 prefetch + dehydrate) |
| Notion | `@notionhq/client` v5 Data Sources API + `react-notion-x` 7.x |
| Color tokens | Radix Colors 2 (custom `signal/cs/paper/research/ink/chrome/...` palette) |
| Test | Jest 30 + @swc/jest (jsdom + node) |
| Container | Docker multi-arch (`linux/amd64`, `linux/arm64`), GHCR |

---

## 시작하기

```bash
git clone https://github.com/jung-geun/monolog.git
cd monolog
yarn install                 # or: npm install
cp .env.example .env         # NOTION_TOKEN · NOTION_DATASOURCE_ID (+ 댓글 사용 시 NOTION_COMMENTS_DB_ID · COMMENT_HASH_SALT)
yarn dev                     # or: npm run dev
```

Notion DB는 [**monolog blog assets**](https://www.notion.so/pieroot/blog-assets-35a067c015d080a0bf17d3a0dffb3784) 페이지를 본인 워크스페이스로 **Duplicate** 해서 사용합니다 — `blog-table`(글)과 `comments`(댓글) 두 DB가 한 페이지에 묶여 있습니다. 복제한 DB 각각에 Integration을 connection으로 추가하면 끝.

전체 셋업 가이드 — Notion 권장 프로퍼티, 환경 변수, API 엔드포인트, Docker, 스크립트, 디렉터리 구조는 [`docs/USAGE.md`](docs/USAGE.md)를 참고하세요.

---

## 변경 이력

### v1.4.0
- **글 목록 썸네일** — `RecentPostsCompact`·`Archive` 카드 우측에 카드 전체 높이를 채우는 썸네일 컬럼(110/130px, `object-cover`)
- **홈 글 목록 6 → 15개** 노출
- **본문 상단 히어로 썸네일** — `PostDetail` non-about 분기에 16:9 priority 이미지
- **라인 게이지 자동 확장/축소** — `ResizeObserver` + `position:absolute` 라인 컨테이너로 양방향 추적, 자기 측정 루프 회피
- **그래프 CONNECTED 클릭** — 우측 detail panel의 connected 항목을 button으로 변환, 클릭 시 해당 노드 선택

### v1.3.0
- **IDE 리디자인** — Tailwind 도입, 다중 탭 시스템(`⌘+Shift+W`), FileTree collapsible + 슬라이드 토글
- **메인/시리즈/카테고리 페이지** IDE 디자인 리뉴얼 (`HomeHero`, `FeaturedSeriesGrid`, `RecentPostsCompact`, 카테고리 타임라인)
- **About 페이지 IDE 위젯** — 활동 히트맵 / 스택 그리드 / Contact YAML 통합
- **RSS 2.0 피드** `/rss.xml` 추가, FileTree·`_document` 링크 정렬
- README 라우트 복귀 시 active 탭 동기화 수정

### v1.2.x
- **React 19 / TypeScript 6 / Prettier 3 / Radix Colors 2** 일괄 업그레이드 (`v1.2.1-fixed.1`)
- 이미지 포맷 AVIF / WebP + `deviceSizes` 좁힘, `ProfileCard` `sizes` 추가 (`v1.2.0`)
- Turbopack idle CPU·로그 폭주·hydration 불일치 완화 (dev only)
- VS Code 스타일 프리뷰 탭 + ActivityBar 강조 충돌 수정
- FileTree 토글 slide-in 애니메이션
- Lighthouse 최적화 — SSR 하이드레이션 / 접근성 / 성능 / 폰트 weight 9→4 축소 + `display:swap`
- 라인 넘버 CSS counter 전환, StatusBar accent 텍스트 대비 수정, `notion-page-link` aria-label 주입

### v1.1.0
- **시리즈 기능**: Notion `Series` select → `/series` 인덱스 + `/series/[name]` 상세 + RightRail series 섹션 + 본문 하단 Prev/Next + FileTree `▾ series/`
- **이미지 캐시 전면 개선**: 안정 프록시 URL(`?id=<uuid>&kind=s3`) + 서버 BLOB 디스크 캐시 (1GB LRU) + in-flight dedup + `next/Image` 옵티마이저 복원 (WebP/AVIF)
- 클라이언트 IndexedDB 이미지 캐시 레이어 제거 (이중 fetch 제거)

### v1.0.0
- 초기 릴리스

---

## License

[MIT](LICENSE) — 원본 [morethan-log](https://github.com/morethanmin/morethan-log)의 라이선스를 따릅니다.
