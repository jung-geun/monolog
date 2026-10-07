# CHANGELOG

monolog의 버전별 변경 이력. 프로젝트 개요는 [`../README.md`](../README.md), 셋업 가이드는 [`USAGE.md`](USAGE.md), 기능 상세는 [`FEATURES.md`](FEATURES.md)를 참고하세요.

---

## v1.18.2 — 2026-10-07

### 자동 광고와 코드 블록
- **자연스러운 Auto ads 경계** — 홈 그룹·포스트 목록 항목에 section/article 의미를 부여하고, 본문에 Google이 삽입한 광고가 전체 너비를 사용하도록 처리. 인페이지 광고 형식은 AdSense 계정 설정을 따르며 가짜 슬롯·고정 위치·빈 광고 박스는 만들지 않음. 실제 게재 여부는 Google이 결정.
- **스크롤과 복사 버튼 분리** — 코드 영역만 가로·세로로 스크롤하고 복사 버튼은 바깥 도구 영역에 유지. Clipboard API 실패 시 기존 레거시 복사 경로를 유지하며 실제 성공 후 `복사되었습니다.` toast, 두 경로 모두 실패 시 권한 확인 안내를 표시. 긴 Mermaid 도표에는 코드 높이 제한을 적용하지 않음.
- **첫 줄 정렬 복원** — 인라인 코드의 `2px 6px` 패딩이 블록 코드 첫 줄에만 적용되던 문제 수정. 실제 코드 들여쓰기·줄바꿈과 문법 강조·캡션·Mermaid 동작은 유지.
- **기존 표시 정책 유지** — 넓은 표가 문서 전체를 가로로 밀지 않도록 clip 가드를 유지하고, 하단 전용 앵커 광고 설정도 유지.

### 공식 Notion 블록 변환
- **제목·토글 제목 복원** — 공식 `heading_4`를 기존 react-notion-x의 `header_4`로 변환하고 `heading_1`~`heading_4`의 `is_toggleable`을 전달해 제목과 중첩 본문이 누락되지 않도록 수정.
- **열 너비 보존** — 공식 `column.width_ratio`를 렌더러의 `column_ratio`로 전달. 너비가 생략된 열은 실제 열 개수로 균등 배분해 3개 이상 열이 각각 50%를 차지하던 문제를 제거(`recordMap:v9`).
- **기존 발행본 적용** — 변환 캐시 버전 변경은 내구성 본문을 자동 재작성하지 않음. 영향을 받는 기존 글은 정상 변경 동기화 또는 인증된 `/api/revalidate?path=/slug`로 본문 재확인. `full=true`만으로 모든 본문을 다시 가져오지는 않음.
- **HTML 지원 범위 확인** — [공식 HTML 블록](https://developers.notion.com/reference/block#html-blocks)은 업로드 기반 `embed`이며 읽기 응답은 만료되는 `embed.url`만 제공. SDK·렌더러 버전 갱신이나 임의 HTML 실행은 추가하지 않음. 인라인 지원에는 별도 샌드박스 렌더링과 서명 URL 갱신 경로가 필요.

### 보안 패치
- `source-map-js`를 호환 수정판 1.2.2 이상으로 고정해 indexed source map offset으로 인한 이벤트 루프 차단 취약점 `GHSA-68fv-2mgg-jv7q`를 제거.

## Unreleased

### 상세 글 메타데이터 및 문서 제목
- **Post·Paper 메타데이터 표시** — 에디터 frontmatter에 작성자(없으면 `CONFIG.profile.name`), 발행일, 발행 이후의 수정일을 SSR로 표시. 날짜는 유효한 `<time dateTime>`을 사용하고, 수정일은 `contentModifiedTime`을 우선하며 없으면 `lastEditedTime`을 사용. 날짜 레이블과 같은 날 수정일 생략은 `CONFIG.timeZone`(기본 `Asia/Seoul`)을 따르고 UTC ISO 시각은 유지.
- **전체 요약 표시** — 제목 아래 `요약` 레이블과 함께 Summary 전문을 줄바꿈을 유지하고 생략 없이 표시. 기존 에디터 레이아웃·광고·본문 렌더러는 유지.
- **문서 제목 보장** — PostDetail의 About 분기와 PageDetail에 라우트 소유 `h1`을 추가하고, 타입이 지정된 `CONFIG.aboutSlug`를 직접 사용. 본문 렌더러의 기본 `fullPage: false` 동작은 변경하지 않음.

### 증분 콘텐츠 동기화
- **내구성 콘텐츠 레지스트리** — 공개 게시물·본문 recordMap·slug 이력·대기 작업 outbox를 `CONTENT_REDIS_URL`(Redis 7.2+, AOF + `WAITAOF`) 또는 `CONTENT_STATE_DIR`에 원자적으로 저장. 상세 페이지와 Markdown은 이 발행본을 렌더해 Notion 장애 중에도 마지막 발행본을 유지.
- **전체 캐시 삭제 제거** — `/api/revalidate`는 캐시를 지우지 않고 바뀐 글과 영향 경로(상세·카테고리·시리즈·컬렉션)만 재생성. `cacheStore.clear`와 백엔드 `clear` 삭제.
- **변경 감지** — `last_edited_time` overlap 증분 스캔 + 24시간 전체 대조(삭제·데이터소스 이동), 같은 분 안의 연속 편집 1회 재확인, 예약 발행 자동 공개. 메타데이터만 바뀐 글은 본문 해시와 임베딩을 유지.
- **slug·수명주기** — 이전 slug는 308 리다이렉트, 비공개·삭제 시 이전 alias까지 제거. 기존 공개 slug 소유자는 충돌·이름 변경 본문 실패 중에도 유지하며, 새 소유자는 기존 소유자의 성공적인 변경 이후에만 발행. 최초 발행부터 중복인 slug는 양쪽 모두 비노출(+ 선택적 `DISCORD_WEBHOOK` 경고).
- **입력 경로** — Notion webhook(`/api/notion-webhook`, HMAC 서명·이벤트 ID 중복 제거·구독 검증 토큰 로그), 15분 주기 `/api/cron/content`(기존 3일 주기 전체 재검증 대체), 수동 `/api/revalidate?path=…|full=true`. 콘텐츠·경로 작업이 남으면 `503`; 선택적 알림 대기는 `notificationsPending`으로 별도 집계.
- **AI 유지보수 분리** — webhook·수동·초기화 요청은 발행만 기다리고 그래프·ontology 증분 작업은 cron에서 재시도. 기존 ontology 체크포인트는 재추출 없이 본문 해시로 이전.
- **recordMap root 정리** — 공개 HTML에 Notion 데이터베이스 원시 속성을 싣지 않도록 root 블록을 제목만 남김(`recordMap:v8`).
- **불완전 본문 보호** — 재귀 하위 블록에서도 공식 SDK의 전체 블록 검증을 적용하며, 불완전한 응답은 마지막 발행본을 덮어쓰지 않고 재시도.
- **첨부 파일 URL 갱신** — 공식 Notion file·PDF·video·audio 업로드는 페이지·블록 ID와 파일명을 담은 절대 `/api/attachment` URL로 저장. GET/HEAD는 공개 레지스트리 본문에서 도달 가능한 첨부만 확인하고 공식 SDK로 새 HTTPS 서명 URL에 `307` + `no-store` 리다이렉트. 외부 URL과 이미지 프록시 경로는 유지하며 삭제·비공개·다른 페이지 블록은 `404`, 상위 API 장애는 기존 본문을 변경하지 않고 `503`.

### SEO · AEO · GEO
- **메타데이터** — canonical, Open Graph·Twitter 절대 이미지, JSON-LD(`WebSite`·`Person`·`BlogPosting`/`WebPage`·`BreadcrumbList`)를 홈·분류·시리즈·상세에 적용.
- **본문 SSR** — 본문·코드·KaTeX 수식을 서버에서 렌더, 제목 계층을 h2부터 정규화(TOC·Markdown 공통), Summary가 없으면 본문 발췌를 설명으로 사용.
- **크롤러 출력 일치** — 동적 `robots.txt`·`llms.txt`·`sitemap.xml`·RSS·`/{slug}.md`가 같은 공개 글 목록을 사용. 가려지던 정적 `public/robots.txt` 삭제.
- **IndexNow·Bing** — 변경 URL을 `CONFIG.link`의 canonical origin으로 발행 직후 IndexNow에 제출(`INDEXNOW_KEY`만 필요), Bing 검증 메타(`NEXT_PUBLIC_BING_SITE_VERIFICATION`). 선택적 IndexNow·Discord 알림은 영구 실패를 제거하고 일시 실패를 최대 8회 시도하며 콘텐츠 건강 상태와 분리.
- **폰트** — 전체 Pretendard preload를 제거하고 `unicode-range` 동적 subset으로 전환.
- **썸네일 안정화** — 이미지 프록시는 origin 상대 URL로 저장해 `NEXT_PUBLIC_SITE_URL` 설정과 무관하게 Next.js 이미지 옵티마이저가 허용하고, 빌드 주소 변경으로 콘텐츠 수정 시각이 변하지 않도록 유지.

### 업그레이드 참고
- `CONTENT_REDIS_URL` 또는 `CONTENT_STATE_DIR`가 필수. Compose는 AOF가 켜진 `content-redis` 서비스와 `content-redis-data` 볼륨을 추가하며 기존 캐시 Redis는 그대로 둔다. 로컬 개발 `.env`에는 `CONTENT_STATE_DIR=.content-state`를 추가.
- 첫 기동의 `/api/init`은 모든 공개 글 본문을 한 번 가져와 레지스트리를 구축한다(글 수에 비례).

### Graph 인터랙션 전면 개편 (Phase 1 / 1.5 / 2)
- **페이지별 해시 그래프 캐시** — `notionGraph:v2:{sha1(sorted pageId:lastEditedTime)}` 키 도입. 어떤 페이지든 `last_edited_time`이 바뀌면 새 키 → 자동 재빌드. 페이지 추가/삭제도 시그니처 변경으로 감지.
- **엣지 종류 확장** — `link_to_page` 블록 엣지, `shared-tag` / `shared-series` / `series-next` (방향성 있음) 엣지 추가. CONNECTED 패널에서 같은 페어 자동 머지(`via mention · shared-tag` 형식).
- **빌드 storm 회피** — `getStaticProps`의 그래프 prefetch 제거, `/graph` 페이지는 빈 SSR로 빠르게 prerender, 클라이언트가 `/graphs/notion-graph.json`에서 fetch.
- **`instrumentation.ts` 자동 워밍** — `next start` 부팅 500ms 뒤 백그라운드로 `getNotionGraph()` 1회 실행해 캐시 채움. `NEXT_GRAPH_WARM=0`으로 opt-out.
- **`warm:graph` 수동 명령어** — 서버 띄운 상태에서 curl로 그래프 강제 빌드.
- **Force-directed 시뮬레이션** — `forceSimulation` + `forceLink` + `forceManyBody` + `forceX/Y` + `forceCollide`. 결정론적 polar 클러스터 배치 제거, 옵시디언 스타일 자연 응집/분산. ref + `setAttribute`로 좌표 직접 업데이트 (100+ 노드 60fps).
- **노드 드래그** — d3-drag. `clickDistance(4)`로 클릭과 드래그 자동 분리, 잡으면 따라오고 놓으면 풀림.
- **줌/팬** — d3-zoom. 휠 0.3x~4x, 빈 영역 드래그로 팬. 모바일 핀치 줌. 노드 위에서는 zoom 비활성 → 드래그와 충돌 없음.
- **실시간 force 슬라이더** — `repulsion`(charge 강도) · `centering`(중심 인력) 슬라이더로 시뮬레이션 재생성 없이 force 파라미터 mutation. `reset view` / `reset force` 버튼 분리.
- **CONNECTED 중복 제거** — `Map<idx, string[]>`로 페어별 엣지 머지.

### 기타
- **FileTree → Link 전환** — `PostTreeItem`이 `<a href>` 대신 Next `Link` 사용. 페이지 이동 시 SPA 전환, 열어둔 탭 보존.
- **본문 내부 링크 SPA 전환** — `NotionRenderer`에 capture-phase 클릭 인터셉터 추가. 같은 DB 내 다른 글 링크가 `router.push`로 처리됨. `dynamic({ ssr: false })` 컨테이너 마운트 타이밍 회피를 위해 document-level 리스너 + `.notion-page` 필터.
- **About 고정 진입점 복원** — FileTree의 `about.md`를 설정 상태와 무관한 영구 링크로 복원하고 `/about`을 고정 slug로 지정.
- **포스트 스크롤 길이 중복 수정** — Utterances 클라이언트가 소유하는 `.utterances-frame` placeholder 충돌을 제거해 직접 진입·새로고침 시 문서 높이가 두 배로 늘어나던 문제 해결.
- **AdSense 하단 앵커 공백 제거** — Google Auto ads가 `body`에 주입하는 하단 패딩을 무효화해 광고 축소·닫기 뒤 StatusBar 아래 빈 영역을 제거하고, 앵커 위치를 하단으로 고정.
- **링크 임베드 썸네일 복원** — GitHub Open Graph 이미지를 Notion 이미지 엔드포인트로 중첩하지 않고 허용된 로컬 이미지 프록시로 직접 전달해 북마크 카드의 우측 미리보기를 표시.
- **단위 테스트 격리** — `next/jest`가 로컬 `.env`를 읽더라도 단위 테스트에서는 Redis L2를 비활성화해 실제 Redis 연결이 Jest 종료를 막지 않도록 수정. 통합 테스트 설정은 유지.
- **배포 전 의존성 보안 패치** — Next.js 16.3.8, sharp 0.35.5 및 undici·DOMPurify·js-yaml을 기존 메이저 안에서 갱신. `brace-expansion` 1/2/5 계열도 상위 의존성별로 패치해 메이저 강제 교체를 피함. 런타임 Yarn 감사는 취약점 0건.
- **개발 도구의 잔여 보안 경고** — `eslint-config-next → fast-glob → micromatch → braces@3.0.3`의 [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)은 패치 버전이 없어 전체 Yarn 감사에 High 1건이 남음. 이 경로는 린트용이며 standalone 운영 이미지에는 해당 패키지를 포함하지 않음.

---

## v1.18.1 — 2026-10-06
- **히스토리 진입 모션 수정** — 뒤로/앞으로 이동 표시를 실제 진입 생략 상태에 반영하고 한 번 소비하도록 복원. 이후 일반 링크로 같은 글을 다시 열 때는 정상 진입 모션을 유지. 운영 브라우저에서 발견된 v1.18.0의 재생 문제를 수정.
- **회귀 검증 정리** — 히스토리 전환과 이후 일반 전환의 동작 경계를 검증하는 테스트를 유지하고, API 호출 전달만 확인하던 모션 테스트와 공유 테스트 환경 변경을 제거.
- **수동 CI runner 선택** — 일반 push·PR 검사는 GitHub hosted를 유지하며 수동 실행에만 기존 Linux/X64 self-hosted 선택을 추가. Self-hosted에서 선언된 Yarn을 먼저 활성화한 뒤 같은 테스트·프로덕션 빌드를 실행.

---

## v1.18.0 — 2026-10-06

### 독서 친화적 모션
- 글·페이지 진입에 320ms/8px 등장, 직접 진입·새로고침에는 본문을 숨기지 않는 360ms 등장. 이동 중 탭 아래 신호선은 요청 완료·취소에 맞춰 정리하며, 본문·SEO SSR과 스크롤 위치는 유지.
- 탭 강조선·메뉴·명령 팔레트·테마 버튼·홈 카드 화살표에 짧은 상호작용 모션. 상태 표시등의 무한 pulse 제거, 현재 글의 hover 프리뷰는 숨김.
- `prefers-reduced-motion` 적용: 문서·chrome 모션과 로딩 shimmer/pulse를 비활성화하고 목차·맨 위로 이동·읽기 진행선은 즉시 반응. 앵커·shallow 이동은 문서를 다시 움직이지 않음.
- Safari/WebKit에서도 표시되는 실제 2px 로딩 신호선과 레이아웃 공간을 늘리지 않는 음수 margin. 리다이렉트·URL 정규화 뒤의 완료 이벤트도 이동 상태를 정리.

---

## v1.4.0
- **글 목록 썸네일** — `RecentPostsCompact`·`Archive` 카드 우측에 카드 전체 높이를 채우는 썸네일 컬럼(110/130px, `object-cover`)
- **홈 글 목록 6 → 15개** 노출
- **본문 상단 히어로 썸네일** — `PostDetail` non-about 분기에 16:9 priority 이미지
- **라인 게이지 자동 확장/축소** — `ResizeObserver` + `position:absolute` 라인 컨테이너로 양방향 추적, 자기 측정 루프 회피
- **그래프 CONNECTED 클릭** — 우측 detail panel의 connected 항목을 button으로 변환, 클릭 시 해당 노드 선택

## v1.3.0
- **IDE 리디자인** — Tailwind 도입, 다중 탭 시스템(`⌘+Shift+W`), FileTree collapsible + 슬라이드 토글
- **메인/시리즈/카테고리 페이지** IDE 디자인 리뉴얼 (`HomeHero`, `FeaturedSeriesGrid`, `RecentPostsCompact`, 카테고리 타임라인)
- **About 페이지 IDE 위젯** — 활동 히트맵 / 스택 그리드 / Contact YAML 통합
- **RSS 2.0 피드** `/rss.xml` 추가, FileTree·`_document` 링크 정렬
- README 라우트 복귀 시 active 탭 동기화 수정

## v1.2.x
- **React 19 / TypeScript 6 / Prettier 3 / Radix Colors 2** 일괄 업그레이드 (`v1.2.1-fixed.1`)
- 이미지 포맷 AVIF / WebP + `deviceSizes` 좁힘, `ProfileCard` `sizes` 추가 (`v1.2.0`)
- Turbopack idle CPU·로그 폭주·hydration 불일치 완화 (dev only)
- VS Code 스타일 프리뷰 탭 + ActivityBar 강조 충돌 수정
- FileTree 토글 slide-in 애니메이션
- Lighthouse 최적화 — SSR 하이드레이션 / 접근성 / 성능 / 폰트 weight 9→4 축소 + `display:swap`
- 라인 넘버 CSS counter 전환, StatusBar accent 텍스트 대비 수정, `notion-page-link` aria-label 주입

## v1.1.0
- **시리즈 기능**: Notion `Series` select → `/series` 인덱스 + `/series/[name]` 상세 + RightRail series 섹션 + 본문 하단 Prev/Next + FileTree `▾ series/`
- **이미지 캐시 전면 개선**: 안정 프록시 URL(`?id=<uuid>&kind=s3`) + 서버 BLOB 디스크 캐시 (1GB LRU) + in-flight dedup + `next/Image` 옵티마이저 복원 (WebP/AVIF)
- 클라이언트 IndexedDB 이미지 캐시 레이어 제거 (이중 fetch 제거)

## v1.0.0
- 초기 릴리스
