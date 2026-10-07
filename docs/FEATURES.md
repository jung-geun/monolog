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
| **TabBar** | 라우트별 탭 (`README.md`, `categories/<name>.md`, `series/<name>.md`, `graph.md`, …). 프리뷰 탭, `⌘+Shift+W` 닫기 |
| **StatusBar** | `ssh pieroot@log` + branch · 동기화 · entries · encoding · syntax (22px) |
| **LineNumberGutter** | 본문 좌측 라인 넘버 — **콘텐츠 길이에 맞춰 자동 확장/축소** (`ResizeObserver` + `position:absolute` 라인 컨테이너로 자기 측정 루프 회피) |
| **CommandPalette** | `⌘K` / `Ctrl+K` — Actions · Posts · Tags · Categories 검색 이동 |

각 라우트는 `useRegisterChrome(filename, statusItems)`로 자기 chrome 메타를 동적 등록합니다.

### 독서를 방해하지 않는 모션
- **글 열기·페이지 전환** — 기존 화면을 숨기거나 전환 완료를 지연하지 않음. 새 문서는 320ms 동안 최대 8px 올라오고, 탭 아래 2px 신호선이 이동 중에만 흐른 뒤 420ms에 사라짐. 빠른 연속 이동은 이전 진입 모션을 취소하고 마지막 요청의 완료·취소 상태를 따름.
- **직접 진입·새로고침** — SSR 본문을 처음부터 표시한 채 360ms의 옅은 등장(불투명도 0.84→1), 타이틀바 표시등·탭의 짧은 등장만 사용. 스크롤 위치를 조작하지 않으며, 뒤로/앞으로 이동·목차 앵커·shallow 라우팅에는 문서 이동 모션을 넣지 않음.
- **상호작용** — 메뉴 섹션·명령 팔레트·비활성 글 hover 프리뷰가 짧게 등장. 활성 탭의 강조선, 버튼 누름, 테마 아이콘 회전, 홈 글·시리즈 카드의 화살표 이동으로 피드백. 현재 읽는 글의 hover 프리뷰는 본문을 가리지 않음.
- **독서 중 안정성** — 본문 단어별 애니메이션·스크롤 패럴랙스는 없음. 상태 표시등도 무한 pulse 대신 한 번의 등장으로 마침.
- **동작 줄이기** — `prefers-reduced-motion: reduce`에서는 등장·전환·아이콘 이동·이미지 shimmer·댓글 skeleton pulse를 끄고, 이동 중 신호선은 정적으로 표시. 목차·맨 위로 이동·읽기 진행선도 즉시 반응하며 설정을 실행 중에 바꾸면 진행 중인 문서 진입 모션을 취소.


---

## 글 목록 카드 (썸네일 통합)
`RecentPostsCompact`(홈 latest)와 `Archive`(카테고리)의 카드가 6px 카테고리 컬러 레일 + 본문 + **카드 전체 높이를 채우는 우측 썸네일**(`object-cover`)로 구성됩니다. 썸네일이 없는 글은 자연스럽게 2단 그리드로 떨어집니다.

## 본문 상단 히어로 썸네일
`PostDetail`(non-about) 분기에서 Frontmatter 위에 16:9 히어로 썸네일이 `priority` 로딩으로 깔립니다. About 페이지는 위젯 영역으로 대체.

## 자동 광고 배치
- AdSense Auto ads가 홈·목록 카드 사이와 글의 블록 사이를 판단할 수 있도록 목록 항목을 독립된 `article`, 홈 그룹을 이름 있는 `section`으로 표시. 본문은 단일 Notion 렌더러를 유지하며 Google이 삽입한 광고가 전체 콘텐츠 너비를 사용하고 잘리지 않도록 처리.
- 비어 있는 수동 광고 슬롯은 광고가 채워지지 않았을 때 공백을 남기지 않음. 가짜 슬롯 ID·고정 광고 위치·빈 광고 박스는 추가하지 않음.
- AdSense 계정에서 Auto ads와 인페이지 형식을 켜야 하며 실제 위치·빈도·게재 여부는 Google이 결정. HTML 구조 개선이 광고 게재를 보장하지 않음. [공식 Auto ads 설정](https://support.google.com/adsense/answer/9261805).

## 코드 블록
- 복사 버튼은 코드 스크롤 영역 바깥에 있어 내부 가로·세로 스크롤 중에도 같은 위치를 유지. 복사 성공 후 `복사되었습니다.`, 권한 거부 등 실패 시 오류 toast를 표시하며 알림은 스크린리더에 전달.
- 블록 코드에는 인라인 코드용 패딩을 적용하지 않음. 첫 줄에만 생기던 CSS 들여쓰기를 제거하며 원문 공백·탭·줄바꿈은 그대로 보존. 문법 강조·캡션·Mermaid 렌더링 유지.

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

### 데이터 — 페이지별 해시 기반 캐시 + Qdrant 스냅샷
- 현재 공개 글의 본문 해시(레지스트리 초기화 전에는 수정 시각)와 그래프에 영향을 주는 메타데이터로 재빌드 필요 여부를 판단
- 해시가 일치하는 Qdrant `post_graph_snapshots` 스냅샷이 있으면 그 `BuiltGraph`를 재사용하고, 바뀐 글의 엣지만 다시 추출해 raw/built graph를 갱신
- `/graphs/notion-graph.json`는 그대로 JSON fetch 엔드포인트이며, 클라이언트 `/graph` 페이지는 여기서 그래프를 가져옴
- `/api/cron/content`가 콘텐츠 outbox의 대기 작업을 처리해 캐시와 persisted snapshot을 갱신. 초기화·수동 revalidate·webhook은 AI 유지보수를 기다리지 않으며, `yarn warm:graph`로 수동 워밍 가능

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
| `similar-topic` | Qdrant cosine similarity `>= 0.85`. Semantic overlay의 `similar` 토글을 켰을 때 표시 |
| `elaborates` / `contradicts` / `supports` / `prerequisite` / `applies` | ontology 빌드가 LLM으로 분류한 의미 관계. Semantic overlay의 `logical` 토글을 켰을 때 표시 |

### 시각화 — d3-force 시뮬레이션
- `forceSimulation` + `forceLink`(엣지 weight 기반 distance/strength) + `forceManyBody`(척력) + `forceX/Y`(중심 응집) + `forceCollide`(겹침 방지)
- React state 없이 ref + `setAttribute`로 좌표 직접 업데이트 (100+ 노드 60fps 유지)
- 카테고리 라벨이 매 tick centroid 위치로 자연 추종
- SVG viewBox는 canvas `ResizeObserver`로 실제 viewport 크기를 따라가며, background grid는 d3 zoom transform을 공유해 줌·팬에 맞춰 간격과 위치가 함께 변함
- 모든 graph edge는 source→target 방향의 arrowhead를 가지며, 선 끝은 양쪽 노드 원 경계에서 멈춰 노드 내부를 침범하지 않음

### 인터랙션
- **노드 드래그** — d3-drag, 잡으면 따라오고 놓으면 시뮬레이션이 풀어줌. `clickDistance(4)`로 클릭 vs 드래그 자동 분리
- **줌/팬** — d3-zoom, 휠로 0.3x~4x 줌, 빈 영역 드래그로 팬. 모바일 핀치 줌 자동
- **실시간 force 슬라이더** — `repulsion` (charge 강도) · `centering` (중심 인력 강도). 시뮬레이션 재생성 없이 force 파라미터만 mutation + `sim.alpha(0.5).restart()`로 부드러운 재배치
- **reset view / reset force** — 줌과 force를 독립적으로 초기화
- **CONNECTED 클릭** — 우측 detail panel의 연결 글을 누르면 해당 노드로 selectedIdx 전환
- **CONNECTED hover/focus** — 우측 연결 항목에 마우스를 올리거나 키보드 focus하면 해당 graph node와 직접 연결된 edge를 좌측 canvas에서 동일하게 강조
- **Semantic overlay** — `similar` 토글은 Qdrant 기반 `similar-topic` edge를 threshold로 필터링하고, `logical` 토글은 LLM ontology 관계(`elaborates` · `supports` · `contradicts` · `prerequisite` · `applies`)를 표시
- **노드 hover/focus** — hover한 노드와 직접 연결된 edge는 밝기·굵기·ring으로 강조하고, 나머지 노드·label·edge는 감쇠

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
## 공식 Notion 블록 지원 범위
- `heading_4`, 토글 제목의 `is_toggleable`, `column.width_ratio`를 현재 렌더러가 이해하는 형태로 변환. 생략된 열 너비는 실제 열 개수에 맞춰 균등 배분.
- 변환 캐시는 `recordMap:v9`. 이미 발행된 내구성 본문은 캐시 버전 변경만으로 재작성하지 않으므로 기존 글에 적용하려면 해당 글의 정상 변경 동기화 또는 인증된 `/api/revalidate?path=/slug` 본문 재확인이 필요. `full=true`는 전체 메타데이터 대조이며 모든 본문 강제 재작성 옵션이 아님.
- 2026-10-07 기준 최신 안정판: [Notion SDK 5.27.0](https://github.com/makenotion/notion-sdk-js/releases/tag/v5.27.0), [react-notion-x / notion-types / notion-utils 8.0.8](https://github.com/NotionX/react-notion-x/releases/tag/v8.0.8). 현재 SDK 5.21.0·렌더러 7.10.0에서도 위 변환이 가능하며 이번 변경은 의존성 버전을 바꾸지 않음.
- 탭은 RNX 7.10.1 이상이 지원하지만 현재 설치판에는 렌더 분기가 없음. 회의록·레거시 template·동기화 원본 참조는 별도 변환 정책이 필요. 공식 API의 `unsupported.block_type`은 종류만 알려주며 블록 내용은 제공하지 않으므로 SDK 갱신만으로 복원할 수 없음.
- [업로드 HTML 블록](https://developers.notion.com/reference/block#html-blocks)은 별도 `html` 타입이 아닌 업로드 기반 `embed`. 읽기 응답은 만료되는 서명 `embed.url`이며 현재는 인라인 실행 대신 링크로 표시. 안전한 인터랙티브 지원에는 공개 페이지·블록 검증을 통한 URL 갱신과 전용 샌드박스 iframe이 필요하며 앱 출처의 HTML 삽입이나 일반 iframe 호스트 허용만으로 대체하지 않음.

---


## Durable content registry (`src/libs/content`)
- 공개 게시물 메타데이터·본문 recordMap·slug 이력·대기 작업 outbox를 `CONTENT_REDIS_URL`(Redis 7.2+, AOF + `WAITAOF`) 또는 `CONTENT_STATE_DIR`에 원자적으로 저장. TTL 캐시 만료·재시작·Notion 장애와 무관하게 마지막 발행본을 렌더
- 증분 대조: `last_edited_time` overlap 스캔 + 24시간마다 전체 대조(삭제·데이터소스 이동 감지). 같은 분 안의 연속 편집은 분이 지난 뒤 1회 재확인
- 바뀐 글만 본문을 다시 가져오고, 상세·카테고리·시리즈·컬렉션 등 영향 경로만 ISR 재생성. 메타데이터만 바뀌면 본문 버전(`contentHash`)과 임베딩 유지
- slug 변경 → 이전 주소 308 리다이렉트, 비공개·삭제 → 이전 alias까지 제거, slug 충돌 → 양쪽 모두 비노출, 예약 발행 → 발행 시각 이후 첫 대조에서 공개
- 입력: Notion webhook(`/api/notion-webhook`, HMAC 서명 · 이벤트 ID 중복 제거), 호스트 cron의 15분 주기 `/api/cron/content`, 수동 `/api/revalidate`. GitHub Actions schedule은 지연·누락 가능한 보조 트리거
- 실패한 경로·그래프 유지보수·IndexNow·Discord 알림은 영속 outbox에서 재시도. webhook·수동·초기화 요청은 발행만 기다리고 AI 그래프 작업은 cron에서 처리

---

## Dual-layer post cache (Memory + Filesystem)
- **L1**: 프로세스 내 `Map` 캐시 (FIFO eviction, 200 entries)
- **L2**: `.notion-cache/*.json` 파일시스템 캐시 (Docker 볼륨 영속)
- 읽기 전용 파일시스템(serverless) 자동 감지 시 L2 비활성, L1-only 모드
- L2 → L1 백필은 60초 hot TTL
- 캐시 키에 Notion `last_edited_time` 포함 → 수정 시 자동 무효화

| 키 | TTL (기본 6h 기준) |
|---|---|
| `posts:v3:<dsId>` | `revalidateTime / 2` (3시간, 레지스트리 초기화 전 cold path 전용) |
| `recordMap:v9:<pageId>:<lastEdited>` | `revalidateTime` (6시간) |
| `database:v6:<dbId>:<lastEdited>` | 30분 |
| `notionGraph:v4:<hash>` | `GRAPH_TTL_MS` (기본 6시간) |
| image BLOB (S3 UUID 키) | 30일 |
| image BLOB (blockId 폴백 키) | 7일 |

---

## Reading aids
- **ReadingProgress** — `.scroll-area` 진행률 2px accent 바
- **RightRail (240px)** — TOC + 시리즈 글 목록 + 동일 카테고리 related 3개 + Qdrant 기반 `ai · similar`(선택 기능) + 공유 태그 mini-graph SVG
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

## SEO / AEO / GEO
- **메타데이터** — 모든 라우트에 canonical, Open Graph·Twitter 절대 이미지, JSON-LD(`WebSite` · `Person` · `BlogPosting`/`WebPage` · `BreadcrumbList`). 상세 글은 작성자·발행일·의미 있는 수정일·요약을 HTML에도 표시
- **본문 SSR** — 본문·코드·KaTeX 수식을 서버에서 렌더하고, 제목 계층을 h2부터 건너뜀 없이 정규화(TOC·Markdown 공통). Summary가 없으면 본문 첫 문단 발췌를 설명으로 사용
- **`/sitemap.xml`** — 공개 글·분류·시리즈, `lastmod`는 의미 있는 본문 수정 시각
- **`/rss.xml`** — RSS 2.0 SSR 피드 (`<channel>` + 글마다 `<item>`, FileTree·`_document` `<link rel="alternate">` 정렬)
- **`/robots.txt` · `/llms.txt` · `/{slug}.md`** — 공개 글 목록과 같은 레지스트리에서 동적 생성
- **IndexNow** — 발행·수정·slug 변경·삭제된 URL을 발행 직후 제출 (`INDEXNOW_KEY`, `/<key>.txt`)
- **검색 서비스 검증** — Google·Naver·Bing 메타 태그를 컨테이너 시작 시 주입
- 정기 동기화 — 운영 Linux 호스트의 `scripts/reconcile-content-host.sh`를 15분 cron으로 실행. GitHub Action (`revalidate.yml`)은 같은 `/api/cron/content` 호출을 예약하는 보조 수단이며 자동 실행 시각을 보장하지 않음. 남은 작업이 있으면 실패로 표시

---

## 컨테이너 ISR warmup
Docker 컨테이너 entrypoint가 standalone 서버를 시작한 뒤 자동으로 `/api/init`을 호출합니다 (3회 retry). 레지스트리가 비어 있으면 최초 동기화로 구축하고 모든 공개 경로를 재생성하며, 이미 있으면 바뀐 글만 확인한 뒤 경로를 워밍합니다. 그래프·ontology의 대기 작업은 `/api/cron/content`가 처리합니다.

수동 워밍:

```bash
yarn warm:graph  # /graphs/notion-graph.json 호출
curl -H "Authorization: Bearer $REVALIDATE_SECRET" "https://your-site.com/api/init"
```

---

## 기타
- 증분 동기화 (`/api/cron/content` 15분 주기, Notion webhook, `/api/revalidate`)
- Mermaid 다이어그램, KaTeX 수식, Prism 코드 하이라이팅
- YouTube · Vimeo · Loom · GoogleDrive · audio 임베드
- Light / Dark scheme 쿠키 영속 (`prefers-color-scheme` fallback)
