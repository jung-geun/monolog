# CHANGELOG

monolog의 버전별 변경 이력. 프로젝트 개요는 [`../README.md`](../README.md), 셋업 가이드는 [`USAGE.md`](USAGE.md), 기능 상세는 [`FEATURES.md`](FEATURES.md)를 참고하세요.

---

## v1.20.0 — 2026-10-11

### 부드러운 임베딩 기반 3D 그래프
- **에디터 테마 통합** — matte 반투명 노드·옅은 조명과 격자·frosted 라벨 배경 및 문자 색. 선택·hover·키보드 강조와 기존 카메라 상호작용 유지.
- **EmbeddingGemma 2** — 정확한 `google/embeddinggemma-2` 고정 revision의 CPU 전용 private 서비스, 768d 정규화 벡터, 전체 본문 토큰 창 처리. 웹·임베딩 이미지를 함께 발행하고 모델 캐시를 영속 보관.
- **증분 유지보수** — 최초 공개·제목·본문 변경만 임베딩하고 Qdrant에 체크포인트. slug·태그·변경 없는 재검증은 벡터 유지. 실패한 버전은 검색·좌표에서 제외하며 다음 콘텐츠 유지보수에서 복구. 비공개·삭제 글은 검색 제외와 벡터 정리.
- **위치·검색·관계** — 포스트 위치를 3D PCA로 투영하고 실제 참조·태그·시리즈 관계선 유지. Meaning 검색과 가장 가까운 3개 후보 기반 Similar content 레이어에 코사인 점수 표시. 검색은 전체 768차원을 사용하며 PCA 근접·유사도를 명시적 참조나 확률로 표시하지 않음. 기존 OpenAI 경로·TTL 임베딩 캐시 제거.
- **추론 과부하 보호** — 의미 검색은 신뢰할 수 있는 클라이언트 IP당 분당 6회·웹 프로세스당 동시 1개만 허용하고 초과 요청을 `429`로 반환. 모델은 문서 유지보수 우선권·최대 1개 대기 예약을 제공하고 여분 요청을 `503`으로 거절하며 health를 추론 대기와 분리. 클라이언트 추론 요청에 query 30초·document 10분 제한 적용.

---

## v1.19.1 — 2026-10-11

### 에디터 탭·타이틀바
- **탭 드래그 정렬** — `README.md`와 일반 탭 모두 삽입 위치 표시와 가로 자동 스크롤을 제공. 순서 변경 시 현재 문서·활성 탭을 유지하고, 저장 동의 후에는 README 위치를 포함한 순서를 새로고침 후 복원. 탭 닫기는 변경된 인접 순서를 따르며 기존 다시 열기 기록을 유지.
- **드래그 없는 탭 이동** — 탭바의 좌우 버튼을 클릭·터치·키보드로 실행하고 변경된 위치를 안내. 양 끝에서 키보드 포커스를 유지하며, `Cmd/Ctrl+클릭`으로 새 창을 열어도 원래 문서의 활성 탭·닫기 대상은 유지. 탭 이동 링크와 닫기 버튼을 별도 요소로 분리.
- **macOS 표시등** — 빨강·노랑·초록을 12px 지름·8px 간격으로 정렬. 빨간 닫기 버튼의 사각 hover 배경을 제거하고 × 표시·누름 피드백·키보드 포커스를 제공. 기존 사이트 나가기와 노랑·초록의 장식용 동작을 유지.

---

## v1.19.0 — 2026-10-10

### Three.js 3D 지식 그래프
- **실제 입체 배치** — SVG 화면을 Three.js 원근 카메라·조명·안개와 d3-force-3d의 XYZ 시뮬레이션으로 전환. 포스트·태그·시리즈의 실제 topology와 연결 수를 유지하며 캐시된 서버 좌표는 변경하지 않음.
- **마우스·터치 카메라** — 왼쪽 드래그 회전, 오른쪽/Shift+드래그 이동, 휠 줌. 한 손가락 회전·두 손가락 이동/핀치 줌과 Alt/Option+노드 이동 제공. 포커스 후에도 전체 그래프 범위까지 줌아웃할 수 있으며, 탭 전환이나 포인터 캡처 해제 시 진행 중 제스처를 취소해 복귀 후 의도하지 않은 회전을 방지.
- **관계 방향·근거** — 관계별 색상·굵기·화살표, 선택한 명시적 관계의 방향 입자, 실제 한 단계 이웃 보기·검색·포커스 추가. 상세 패널에 입출력 방향·참조 횟수·제공된 본문 인용문을 표시하며, 선택한 이웃은 헤더·상세 패널에 가리지 않는 영역에 맞춤.
- **의미 관계 구분** — 기존 온톨로지 관계는 점선과 신뢰도·rationale로 표시. 데이터가 없으면 레이어를 비활성화하고 임의 포스트 간 관계를 추가하지 않음.
- **기존 조절 유지** — 레이아웃 슬라이더·시간순 재생·필터·테마를 유지. 선택을 해제한 뒤 노드·관계 수를 실제 표시 범위에 맞추고, 태블릿 폭에서도 상세 패널과 컨트롤을 동시에 이용할 수 있음. 카메라와 renderer 재생성 없이 상태를 갱신하고, 비가시/정지 상태·라우트 종료·동작 줄이기 설정에 맞춰 GPU 작업과 자원을 관리.

---

## v1.18.5 — 2026-10-09

### Markdown 버튼 배치 수정
- **버튼만 우측 상단에 유지** — 전체 너비 48px 고정 바를 제거하고 Markdown으로 보기 버튼만 본문 영역 오른쪽 상단에 배치. 스크롤 중에도 탭바 아래를 따라오며 기존 새 창 열기·원본 주소와 스크롤 위치 보존을 유지.
- **태블릿·데스크톱 표시** — 768px 이상에서 버튼을 표시하고 767px 이하에서는 숨김. 태블릿 첫 화면에서는 버튼과 썸네일이 겹치지 않도록 여백을 확보하며 모바일에는 빈 도구 영역을 남기지 않음.
- **사이드바 시작 위치 복원** — 고정 바의 높이 오프셋을 제거해 오른쪽 사이드바가 다시 탭바 아래에서 시작. 본문 760px 제한과 사이트 오른쪽 끝의 240px 사이드바 배치를 유지.

---

## v1.18.4 — 2026-10-08

### 에디터 탭 세션
- **현재 화면 기준 Explorer 강조** — Search·Graph 화면에서는 explorer 패널이 열려 있어도 Explorer 아이콘과 파일 트리 현재 글 강조를 제거.
- **글 탭 단축키** — 일반 브라우저에서 확실히 동작하는 `Alt/Option+W`·`Alt/Option+Shift+T`와 다시 열기 버튼 추가. `Cmd/Ctrl+W`·`Cmd/Ctrl+Shift+T`는 페이지로 전달된 경우에만 처리하며, About·Page·Search·Graph 문서는 닫지 않음.
- **동의 기반 탭 복원** — 저장 동의 전에는 브라우저 저장소를 쓰지 않음. 동의하면 열린 탭과 최근 닫은 글의 제목·주소만 저장해 새로고침 후 복원하고, 저장 해제 시 두 저장 항목을 삭제.
- **글 내 앵커 탭 중복 방지** — 해시 이동·뒤로/앞으로 이동·앵커 주소 새로고침을 같은 문서 탭으로 처리하고, 다시 열 때 사용할 전체 주소는 유지. 쿼리가 다른 문서는 별도 탭으로 구분.
- **저장 실패 후 동의 해제 유지** — 저장 공간 부족으로 새 탭을 저장하지 못해도 저장 해제 버튼을 제공해 이전 동의와 남은 세션을 삭제할 수 있도록 수정.
- **모바일 Explorer 겹침 수정** — 파일 패널과 배경을 탭바·읽기 진행률보다 앞에 배치해 열린 패널 위로 탭이 표시되거나 클릭되지 않도록 수정.
- **사이트 닫기 버튼** — 좌측 상단 주황색 traffic-light를 활성화해 허용된 창은 닫고, 브라우저가 막는 탭은 사이트에서 나가도록 처리.

### 글 상세 레이아웃 및 Markdown 보기
- **오른쪽 사이드바 위치 복원** — 글·사이드바를 함께 제한하던 1000px 최대 폭을 제거하고 본문만 최대 760px로 유지. 240px 사이드바는 Explorer 열림·닫힘과 화면 폭에 관계없이 사이트 오른쪽 끝에 붙으며, 모바일에서는 기존 단일 열·사이드바 숨김을 유지.
- **코드 복사 포커스 보존** — 복사 중 네이티브 `disabled` 대신 `aria-disabled`와 동기적인 진행 상태 가드를 사용해 Enter·Space로 복사해도 키보드 포커스를 유지하고 중복 복사를 차단.
- **Markdown으로 보기 버튼** — 글 화면 최상단에서 기존 `/{slug}.md` 전문을 새 창으로 열고 원래 글 화면은 유지. 스크롤 중에도 탭바 바로 아래에 고정하며 사이드바는 버튼 아래에서 시작하고 목차 제목을 가리지 않도록 유지. 기존 Markdown 주소 생성과 엔드포인트를 재사용.

---

## v1.18.3 — 2026-10-07

### 코드 헤더·사이드 여백·탐색 상태
- **작은 코드 헤더** — 언어명과 24px 복사 버튼을 표시하고 코드 상단 패딩을 4px로 축소. 내부 스크롤 중 버튼 위치와 원문 공백·줄바꿈을 보존.
- **오른쪽 Auto ads 여백** — 본문 최대 760px과 목차 240px을 최대 1000px 영역에 붙여 배치하고 남는 폭은 바깥 오른쪽 여백으로 유지. 모바일 단일 열·기존 하단 앵커 정책은 유지하며 빈 광고 박스나 슬롯 ID를 추가하지 않음. 사이드 레일 활성화·Right only 위치·실제 게재는 AdSense 계정 설정을 따름.
- **Search·Graph 활성 강조** — explorer 패널 열림 여부 대신 현재 경로로 아이콘과 `aria-current`를 결정.
- **열린 이전 글 표시** — 최신 15개 밖의 열린 글을 파일 트리에 중복 없이 추가하고 현재 글을 강조. 탭 전환 동안 유지하고 닫으면 제거. 피드에 없는 상세 공개 글은 로드된 상세 메타데이터를 사용하며 Graph·About·Page 문서는 글 목록에서 제외.

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
