# CHANGELOG

monolog의 버전별 변경 이력. 프로젝트 개요는 [`../README.md`](../README.md), 셋업 가이드는 [`USAGE.md`](USAGE.md), 기능 상세는 [`FEATURES.md`](FEATURES.md)를 참고하세요.

---

## Unreleased

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
