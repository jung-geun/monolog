# FEATURES

monolog의 주요 기능 상세. 프로젝트 개요와 핵심 차별점은 [`../README.md`](../README.md)를, 셋업 가이드는 [`USAGE.md`](USAGE.md)를 참고하세요.

---

## Editor chrome UI
모든 라우트가 VS Code 에디터 윈도우처럼 보입니다.

| 컴포넌트 | 설명 |
|---|---|
| **TitleBar** | macOS traffic-light + `pieroot.log — {filename}` + git 브랜치 |
| **ActivityBar** | explorer / search / graph / commands / theme toggle (44px) |
| **FileTree** | `posts/` · `categories/` · `series/` · `projects/` · `drafts/` · `public/` 트리 (240px, 토글 슬라이드). 항목 hover 시 글 메타(제목 · 카테고리 · 날짜 · summary) 프리뷰 카드 |
| **TabBar** | 라우트별 탭 (`README.md`, `categories/<name>.md`, `series/<name>.md`, `graph.json`, …). 프리뷰 탭, `⌘+Shift+W` 닫기 |
| **StatusBar** | `ssh pieroot@log` + branch · 동기화 · entries · encoding · syntax (22px) |
| **LineNumberGutter** | 본문 좌측 라인 넘버 — **콘텐츠 길이에 맞춰 자동 확장/축소** (`ResizeObserver` + `position:absolute` 라인 컨테이너로 자기 측정 루프 회피) |
| **CommandPalette** | `⌘K` / `Ctrl+K` — Actions · Posts · Tags · Categories 검색 이동 |

각 라우트는 `useRegisterChrome(filename, statusItems)`로 자기 chrome 메타를 동적 등록합니다.

---

## 글 목록 카드 (썸네일 통합)
`RecentPostsCompact`(홈 latest)와 `Archive`(카테고리)의 카드가 6px 카테고리 컬러 레일 + 본문 + **카드 전체 높이를 채우는 우측 썸네일**(`object-cover`)로 구성됩니다. 썸네일이 없는 글은 자연스럽게 2단 그리드로 떨어집니다.

## 본문 상단 히어로 썸네일
`PostDetail`(non-about) 분기에서 Frontmatter 위에 16:9 히어로 썸네일이 `priority` 로딩으로 깔립니다. About 페이지는 위젯 영역으로 대체.

---

## 시리즈 (Series)
Notion DB의 `Series` select 프로퍼티로 연재글을 묶어 관리합니다.

- **`/series`** — 전체 시리즈 인덱스. 카드 그리드(시리즈명 · 글 수 · 최신 글 제목).
- **`/series/[name]`** — 시리즈 상세. 연도별 타임라인, 다른 시리즈 chip 네비, 시리즈 글 카드 썸네일.
- **FileTree** — `▾ series/` 섹션 자동 노출 (시리즈 0개면 숨김).
- **RightRail** — 현재 글이 속한 시리즈 글 목록. 현재 글 강조(`▸`).
- **본문 하단 Prev/Next** — 시리즈 내 이전/다음 글 카드. 시간 순(오래된→최신), 위치(N/M) 표시.

---

## 이미지 프록시 + BLOB 캐시
Notion S3 presigned URL 만료를 자동 복구하고 디스크에 캐싱합니다.

- **안정 프록시 URL** — S3 UUID를 키로 `?id=<uuid>&kind=s3` 형태 emit. presigned URL이 ISR마다 바뀌어도 프록시 URL은 고정 → 브라우저 disk cache · `next/Image` 옵티마이저 캐시 정상 동작.
- **서버 BLOB 디스크 캐시** — `/app/.image-cache/`에 이미지 바이너리 영속 저장. S3 UUID 키 30일 TTL, blockId 폴백 7일 TTL. 1 GB / 500 entry cap + LRU eviction.
- **In-flight dedup** — 동일 이미지 concurrent cold-miss가 Notion API를 중복 호출하지 않도록 Promise 공유.
- **자동 URL 재발급** — 401 / 403 / 404 / 410 응답 시 `notion.blocks.retrieve` → `notion.pages.retrieve` 순으로 재시도.
- **`next/Image` 옵티마이저 활성** — `next.config.js` `localPatterns`로 프록시 경로 허용. WebP/AVIF + 디바이스별 해상도 자동 생성.
- **응답 헤더** — `Cache-Control: public, max-age=31536000, immutable` (1년). 실패 시 inline SVG placeholder + Slack webhook 알림(옵션).

---

## About 페이지 (IDE 위젯)
About 라우트는 다음 위젯들을 한 화면에 묶어 보여줍니다.

- **YAML frontmatter** — `site.config.js`의 `profile.name` / `role` / `bio`
- **StatsGrid** — posts · categories · series · tags · words 집계
- **ActivityHeatmap** — GitHub-style 26 × 7 활동 히트맵
- **StackGrid** — `site.config.js`의 `stack` 객체를 카테고리별 chip으로 자동 렌더 (정의 없으면 위젯 자체 숨김)
- **ContactBlock** — email · GitHub · LinkedIn · Instagram (config-driven)

---

## Archive timeline (`/categories/[name]`)
연도 헤더 + 수직 타임라인 + 점 마커로 카테고리별 글을 최신순 정렬. 카드 우측 썸네일, 다른 카테고리 chip으로 점프.

---

## Graph view (`/graph`)
포스트가 카테고리별 군집으로 자연스럽게 응집되는 옵시디언 스타일 노드 그래프.

### 데이터 — 페이지별 해시 기반 캐시
- 페이지 변경 자동 감지 — `notionGraph:v2:{sha1(sorted pageId:lastEditedTime)}` 키
- 어떤 페이지든 `last_edited_time`이 바뀌면 새 키 → 자동 재빌드. 페이지 추가/삭제도 시그니처 변경으로 감지.
- 빌드 시 storm 회피 — `getStaticProps`에서 그래프 prefetch 제거, `/graph` 페이지는 빈 SSR로 빠르게 prerender, 클라이언트가 `/graphs/notion-graph.json`에서 fetch
- `next start` 후 백그라운드 워밍 — `instrumentation.ts`가 부팅 500ms 뒤 `getNotionGraph()`를 1회 호출해 L1/L2 캐시 채움 (`NEXT_GRAPH_WARM=0`으로 opt-out)

### 엣지 종류
한 페어가 여러 타입으로 연결될 수 있고, CONNECTED 패널에서는 자동 머지되어 1줄로 표시됩니다.

| 종류 | 의미 |
|---|---|
| `mention` | Notion `@mention`으로 다른 글을 인용 |
| `link` | rich-text 안의 Notion 페이지 링크 |
| `link_to_page` | `link_to_page` 블록 (페이지 전체 링크) |
| `shared-tag` | 같은 태그를 가진 페이지 쌍 (>8개 페이지 공유 태그는 spam 방지로 스킵) |
| `shared-series` | 같은 시리즈 내 모든 페어 |
| `series-next` | 시리즈 내 날짜 순 인접 페어 (방향성 있음) |

### 시각화 — d3-force 시뮬레이션
- `forceSimulation` + `forceLink`(엣지 weight 기반 distance/strength) + `forceManyBody`(척력) + `forceX/Y`(중심 응집) + `forceCollide`(겹침 방지)
- React state 없이 ref + `setAttribute`로 좌표 직접 업데이트 (100+ 노드 60fps 유지)
- 카테고리 라벨이 매 tick centroid 위치로 자연 추종

### 인터랙션
- **노드 드래그** — d3-drag, 잡으면 따라오고 놓으면 시뮬레이션이 풀어줌. `clickDistance(4)`로 클릭 vs 드래그 자동 분리
- **줌/팬** — d3-zoom, 휠로 0.3x~4x 줌, 빈 영역 드래그로 팬. 모바일 핀치 줌 자동
- **실시간 force 슬라이더** — `repulsion` (charge 강도) · `centering` (중심 인력 강도). 시뮬레이션 재생성 없이 force 파라미터만 mutation + `sim.alpha(0.5).restart()`로 부드러운 재배치
- **reset view / reset force** — 줌과 force를 독립적으로 초기화
- **CONNECTED 클릭** — 우측 detail panel의 연결 글을 누르면 해당 노드로 selectedIdx 전환

---

## Inline Notion databases
페이지 본문 안의 `child_database` 블록을 4개 뷰로 직접 렌더합니다.

| View | 용도 |
|---|---|
| Table | 행/열 표 (기본) |
| Board | `groupBy` 기반 칸반 (status / select / multi_select 자동 감지) |
| Gallery | 커버 이미지 카드 그리드 (220px+ auto-fill) |
| List | 한 줄 요약 리스트 |

지원 컬럼 타입: `title` · `rich_text` · `select` · `multi_select` · `status` · `date` · `url` · `checkbox` · `files` · `number` · `people`.

DB 블록 주입은 **createPortal** 기반 — react-notion-x가 그린 자리에 portal target 노드를 끼워 넣어 페이지 전환 시 reconciler 충돌(`removeChild NotFoundError`)을 원천 차단합니다.

---

## Dual-layer post cache (Memory + Filesystem)
- **L1**: 프로세스 내 `Map` 캐시 (FIFO eviction, 200 entries)
- **L2**: `.notion-cache/*.json` 파일시스템 캐시 (Docker 볼륨 영속)
- 읽기 전용 파일시스템(serverless) 자동 감지 시 L2 비활성, L1-only 모드
- L2 → L1 백필은 60초 hot TTL
- 캐시 키에 Notion `last_edited_time` 포함 → 수정 시 자동 무효화

| 키 | TTL (기본 6h 기준) |
|---|---|
| `posts:<dsId>` | `revalidateTime / 2` (3시간) |
| `recordMap:v6:<pageId>:<lastEdited>` | `revalidateTime` (6시간) |
| `database:v3:<dbId>:<lastEdited>` | 30분 |
| `notionGraph:v2:<hash>` | `GRAPH_TTL_MS` (기본 6시간) |
| image BLOB (S3 UUID 키) | 30일 |
| image BLOB (blockId 폴백 키) | 7일 |

---

## Reading aids
- **ReadingProgress** — `.scroll-area` 진행률 2px accent 바
- **RightRail (240px)** — TOC + 시리즈 글 목록 + 동일 카테고리 related 3개 + 공유 태그 mini-graph SVG
- **Frontmatter** — YAML 형식 메타데이터 블록 (모노스페이스, key가 accent3 컬러)
- **SeriesNav** — 본문 하단 시리즈 Prev/Next 박스
- **SPA 내부 링크** — 본문의 다른 글로 향하는 링크는 capture-phase 인터셉터로 `router.push`로 전환, 새로고침 없는 페이지 이동

---

## 익명 댓글 (Notion DB 적재)
방문자가 닉네임/이메일 없이 댓글을 달면, 본인 Notion `comments` DB에 자동 적재됩니다. 외부 SaaS(Disqus·Giscus·Cusdis) 의존 없이 자기 데이터로 모더레이션·확인.

- **자동 닉네임** — `익명#a3f2`. `SHA-256(slug + ipHash + salt)` 앞 4자 → 글 단위 일관성 + 글 간 추적 차단
- **서버 캐시** — slug별 45s TTL. POST 성공 시 해당 slug 캐시 invalidate → 새 댓글 즉시 반영
- **스팸 방어** — honeypot 필드 + 폼 mount time 검사(<3s reject) + IP rate limit (60s 쿨다운 / 1분 3건 / 1시간 20건)
- **PII 최소화** — IP는 `SHA-256(ip + COMMENT_HASH_SALT)` 앞 16자만 저장. 이메일·실명 수집 안 함
- **Notion 모더레이션** — `Status`를 `hidden`/`spam`으로 변경하면 페이지에서 자동 제외 (캐시 만료 시점부터)
- **Optimistic UI** — POST 즉시 목록에 표시, 실패 시 롤백 + 백그라운드 재fetch

---

## SEO / 발행
- **`/sitemap.xml`** — SSR 동적 생성 + CDN s-maxage 캐싱
- **`/rss.xml`** — RSS 2.0 SSR 피드 (`<channel>` + 글마다 `<item>`, FileTree·`_document` `<link rel="alternate">` 정렬)
- 정기 revalidate GitHub Action (`revalidate.yml`) — 3일마다 자동 호출 + Discord webhook 알림

---

## 컨테이너 ISR warmup
Docker 컨테이너 entrypoint가 `next start` 후 자동으로 `/api/init`을 호출해 모든 포스트 ISR 캐시를 미리 채웁니다 (3회 retry). Cold start가 사라집니다. 그래프는 `instrumentation.ts`가 별도로 워밍 — 두 캐시 모두 첫 사용자 요청 전에 준비.

수동 워밍:

```bash
npm run warm:graph   # /graphs/notion-graph.json 호출
curl "https://your-site.com/api/init?secret=$TOKEN_FOR_REVALIDATE"
```

---

## 기타
- 자동 ISR 갱신 (`REVALIDATE_HOURS`, `/api/revalidate`)
- Mermaid 다이어그램, KaTeX 수식, Prism 코드 하이라이팅
- YouTube · Vimeo · Loom · GoogleDrive · audio 임베드
- Light / Dark scheme 쿠키 영속 (`prefers-color-scheme` fallback)
