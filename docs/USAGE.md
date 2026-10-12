# USAGE

monolog 셋업·운영 가이드. 프로젝트 개요와 차별점은 [`README.md`](../README.md)를 참고하세요.

---

## 빠른 시작

Node.js 22 또는 24 LTS와 Yarn 1.22.22를 사용합니다. Yarn이 없으면 `corepack enable`을 실행하고 clone한 저장소에서 `corepack install`로 활성화합니다. Corepack이 없는 Node 배포판은 Yarn 1.22.22를 별도 설치하세요. Notion 템플릿 복제와 Integration 연결은 아래 **Notion 셋업**을 먼저 완료하세요.

```bash
git clone https://github.com/jung-geun/monolog.git
cd monolog
yarn install --frozen-lockfile
cp -n .env.example .env
chmod 600 .env
# .env의 NOTION_TOKEN과 NOTION_DATASOURCE_ID만 직접 입력
# NOTION_DATASOURCE_ID에는 원본 blog-table DB 주소 전체 또는 data-source UUID
yarn setup
yarn dev
```

`http://localhost:3000`에서 확인합니다. `yarn setup`은 저장소 루트 `.env`만 읽어 DB 주소를 data-source UUID로 변환하고, 비어 있는 재검증 비밀키를 생성합니다. 선택 기능의 DB ID가 설정된 경우에만 해당 salt도 독립 생성합니다. 기존 키·주석·기타 설정은 유지하며 파일 권한을 `0600`으로 제한합니다. 여러 data source가 있는 DB는 자동 선택하지 않으므로 안내된 UUID 중 사용할 값을 지정하고 다시 실행하세요. API 실패 시 파일은 변경하지 않습니다.

네이티브 개발은 `.content-state`를 쓰며 임베딩/Qdrant 없이 글을 볼 수 있습니다. 전체 의미 검색은 아래 Compose 스택을 사용하세요. Node.js 26의 fetch/dispatcher 계약은 현재 Qdrant SDK의 Undici 6과 호환되지 않으므로 LTS 실행 파일과 PATH를 맞춥니다.

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

기본 블로그에는 `blog-table`만 필요합니다. 원본 DB를 열어 우상단 `... → Add connections`에서 Integration을 추가하고, 읽기 권한을 허용합니다. 원본 `blog-table`의 주소 전체를 `.env`의 `NOTION_DATASOURCE_ID`에 넣은 뒤 `yarn setup`을 실행하면 실제 data-source UUID를 찾아 저장합니다. DB URL의 UUID나 `?v=`의 view ID를 data-source ID로 직접 사용하지 마세요.

선택 기능의 DB는 별도로 연결합니다. `comments`에는 댓글 삽입 권한도 필요합니다. `NOTION_COMMENTS_DATASOURCE_ID`와 `NOTION_VISIT_STATS_DATASOURCE_ID`에는 명시적인 data-source UUID를 넣습니다. 직접 조회할 때는 [Retrieve database API](https://developers.notion.com/reference/retrieve-database)에 `Authorization: Bearer <token>`과 `Notion-Version: 2026-03-11` 헤더를 보내고 `data_sources`의 이름과 ID로 대상 소스를 선택합니다.

> Notion 댓글은 기본 비활성입니다. 댓글 DB ID를 설정하고 `yarn setup`으로 salt를 생성한 뒤 `.env`에 `NEXT_PUBLIC_NOTION_COMMENTS_ENABLE=true`를 추가하고 다시 빌드하세요. 방문자 통계는 해당 DB ID와 독립적인 `VISITOR_HASH_SALT`가 설정된 경우에만 동작합니다. 두 기능 모두 기본 블로그 배포에는 필요하지 않습니다.

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
| `NOTION_DATASOURCE_ID` | `blog-table`의 **data-source UUID**. 최초 `yarn setup`에서는 원본 Notion DB 주소 전체를 넣어 자동 변환 가능 |
| `CONTENT_REDIS_URL` 또는 `CONTENT_STATE_DIR` | 공개 게시물·본문·slug 이력·대기 중인 경로/그래프 작업을 보관하는 내구성 콘텐츠 저장소. 운영·컨테이너는 AOF가 켜진 Redis 7.2+(`CONTENT_REDIS_URL`, Compose의 `content-redis`), 로컬 단일 호스트 개발은 디렉터리(`CONTENT_STATE_DIR=.content-state`). 둘 다 없으면 페이지 렌더와 동기화가 실패합니다 |
| `REVALIDATE_SECRET` | 관리 API의 Bearer 토큰. `.env.example`은 빈 값이고 `yarn setup`이 생성하므로 직접 만들 필요 없음. 기존 값은 유지하며 Compose에서는 필수 |

### 댓글 활성 시 필수 (`NEXT_PUBLIC_NOTION_COMMENTS_ENABLE=true`)

| 변수명 | 설명 |
|---|---|
| `NOTION_COMMENTS_DATASOURCE_ID` | `comments` DB의 **data_source ID** (UUID with hyphens) |
| `NEXT_PUBLIC_NOTION_COMMENTS_ENABLE` | 기본 `false`. `true`로 설정한 뒤 빌드하면 댓글 UI 활성화 |
| `COMMENT_HASH_SALT` | IP/닉네임 해싱용 salt. 댓글 DB ID를 설정한 뒤 `yarn setup`을 실행하면 빈 값만 생성 |

### 방문자 통계 활성 시 필수

| 변수명 | 설명 |
|---|---|
| `NOTION_VISIT_STATS_DATASOURCE_ID` | `visit-stats` DB의 **data_source ID** (UUID with hyphens) |
| `VISITOR_HASH_SALT` | 방문자 쿠키 해싱용 salt. 방문자 DB ID를 설정한 뒤 `yarn setup`이 독립 생성. `COMMENT_HASH_SALT`와 재사용하지 마세요 |

### 선택

| 변수명 | 기본값 | 설명 |
|---|---|---|
| `REDIS_URL` | — | Redis 연결 URL. 설정 시 L2 캐시 활성 (cold start 성능 향상). 예: `redis://localhost:6379`, `rediss://user:pass@host:6380` |
| `ANTHROPIC_API_KEY` | — | `/ontology`와 Graph Logical overlay의 엔티티·논리 관계 추출용. 임베딩·Meaning 검색·유사 글에는 필요 없음 |
| `EMBEDDING_SERVICE_URL` | — | 고정된 `google/embeddinggemma-2`를 실행하는 private HTTP 서비스. 네이티브 개발은 `http://localhost:8000`; Compose는 `http://embedding:8000`을 직접 설정. OpenAI/Hugging Face 키 불필요 |
| `QDRANT_URL` | `http://localhost:6333` | 로컬 개발 또는 외부 Qdrant REST endpoint. Docker Compose 기본 스택은 `docker-compose.yml`에서 컨테이너용 `http://qdrant:6333`을 직접 설정 |
| `QDRANT_API_KEY` | — | 인증이 걸린 외부 Qdrant용 API key. 로컬/self-hosted Qdrant는 빈 값 |
| `CACHE_NAMESPACE` | `monolog` | Redis 키 prefix. 동일 Redis를 staging·preview 등 여러 배포가 공유할 때 충돌 방지 |
| `GRAPH_BUILD_TIMEOUT_MS` | `120000` | Notion graph complete-build 시간 제한(ms). 제한을 넘긴 partial graph는 Qdrant snapshot으로 저장하지 않음. 최대 `300000` |
| `REVALIDATE_HOURS` | `6` | ISR 재생성 주기 (시간) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | 사이트 canonical·sitemap·RSS·IndexNow와 요청 origin 검증에 사용. 공개 배포에는 본인의 실제 주소를 **빌드 전에** 설정 |
| `TRUSTED_PROXY_HOPS` | `0` | 기본값은 전달된 IP 헤더를 무시. 프록시 인증키 검증을 통과한 요청에서만 지정한 홉 수를 신뢰 |
| `TRUSTED_PROXY_SECRET` | — | 프록시 신뢰를 켤 때만 필요. 프록시가 `X-Monolog-Proxy-Secret`을 강한 공유키로 덮어써야 하며 기본 배포에는 필요 없음 |
| `NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID` | — | Google Analytics |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | — | Google Search Console |
| `NEXT_PUBLIC_NAVER_SITE_VERIFICATION` | — | Naver Search Advisor |
| `NEXT_PUBLIC_BING_SITE_VERIFICATION` | — | Bing Webmaster Tools (`msvalidate.01`) |
| `NEXT_PUBLIC_UTTERANCES_REPO` | — | Utterances 댓글 (`user/repo`) |
| `SLACK_WEBHOOK` | — | image-proxy 실패 Slack 알림 |
| `NOTION_WEBHOOK_VERIFICATION_TOKEN` | — | Notion webhook 서명 검증 secret. 비워 둔 채 구독을 만들면 서버 로그에 `verification_token`이 출력되고, 그 값을 Notion에서 검증한 뒤 이 변수에 설정 |
| `INDEXNOW_KEY` | — | IndexNow 키(16진수 8–128자, 예: `openssl rand -hex 16`). `/<key>.txt`로 제공되고 변경된 공개 URL을 발행 직후 제출 |
| `INDEXNOW_KEY_LOCATION` | `<CONFIG.link>/<key>.txt` | 같은 origin의 다른 키 파일 위치를 쓸 때만 설정 |
| `DISCORD_WEBHOOK` | — | 공개 조건(Status·Type·Slug·발행일)을 통과하지 못한 Notion 페이지 경고 (`https://discord.com/api/webhooks/...`) |
| `CONTENT_NAMESPACE` | `monolog` | `CONTENT_REDIS_URL` 안의 콘텐츠 키 namespace |
| `CONTENT_LOCK_MS` | `900000` | Redis 콘텐츠 작업 lease(ms). 갱신 중 lease를 잃으면 저장하지 않고 실패 |

`NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, `NEXT_PUBLIC_NAVER_SITE_VERIFICATION`, `NEXT_PUBLIC_BING_SITE_VERIFICATION`는 이미지 빌드 시점이 아니라 컨테이너 시작 시 주입됩니다. 공개 값만 넣고, `docker run --env-file .env …` 또는 Compose의 `env_file`로 설정한 뒤 컨테이너를 재시작하세요. 값이 없으면 Analytics와 검증 메타 태그는 비활성화되며 앱은 정상 실행됩니다.

상세 글의 날짜 레이블과 같은 날 수정일 생략은 `site.config.js`의 `timeZone`(기본 `Asia/Seoul`)을 따릅니다. `<time dateTime>`과 JSON-LD에는 UTC ISO 시각을 유지합니다. IndexNow·Discord의 실패는 콘텐츠 발행을 막지 않고 `notificationsPending`으로 별도 집계하며, 일시 장애는 최대 8회 시도 후 제거합니다. 영구 오류·제거된 설정은 즉시 제거합니다.

### GitHub Actions Secrets (워크플로우 전용)

[`revalidate.yml`](../.github/workflows/revalidate.yml) 워크플로우가 사용하는 GitHub Repository Secrets.
등록: 저장소 → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | 필수 | 설명 |
|---|---|---|
| `REVALIDATE_URL` | 필수 | 운영 사이트 base URL (예: `https://your-site.com`, 끝 `/` 없음) |
| `REVALIDATE_SECRET` | 필수 | 컨테이너의 `REVALIDATE_SECRET` 환경변수와 동일 값 |

워크플로우는 15분마다 `POST /api/cron/content` 실행을 **예약**합니다. GitHub Actions의 schedule은 지연·누락될 수 있으므로 운영 동기화의 유일한 트리거로 사용하지 않습니다. 응답이 `200`이 아니면 실패하거나 남은 작업(`pending`)이 있다는 뜻이며, 남은 작업은 저장소에 보존되어 다음 실행에서 이어서 처리됩니다.

### 운영 호스트 cron (Linux, 기본 트리거)

운영 호스트에는 15분 cron을 등록하고 GitHub Actions는 보조 트리거로 유지합니다. `scripts/reconcile-content-host.sh`는 실행 위치와 무관하게 **스크립트가 속한 저장소 루트의 `.env`**를 읽고 로컬 `POST http://127.0.0.1:3000/api/cron/content`를 호출합니다. 호스트에 Bash·curl·`flock`(util-linux)이 필요하고 `.env`는 신뢰할 수 있는 shell-compatible 설정이어야 합니다. 토큰은 curl의 표준 입력으로 전달해 명령행에 노출하지 않습니다. 기존 캐시를 지우거나 실제 Notion 글을 수정하지 않습니다.

최초 backfill은 저장소에서 `bash scripts/reconcile-content-host.sh`로 실행합니다. 기존 작업을 보존하며 배포 계정의 `crontab -e`에 다음 줄을 추가하고 `/absolute/path/monolog`는 본인의 저장소 절대 경로로 교체합니다. 호스트의 `cron` 서비스가 실행 중이어야 합니다.

```cron
*/15 * * * * /bin/bash "/absolute/path/monolog/scripts/reconcile-content-host.sh" 2>&1 | /usr/bin/logger -t monolog-content-sync
```

스크립트는 사용자 캐시 디렉터리의 `flock`으로 호스트 작업 중첩을 막고 요청을 최대 900초로 제한합니다. GitHub 호출과의 중첩은 콘텐츠 저장소의 lease가 제어합니다. 실패한 콘텐츠 작업은 저장소에 남아 다음 실행에서 이어서 처리됩니다.

```bash
# 등록 상태와 실제 자동 호출 응답 확인 (토큰 출력 없음)
crontab -l
journalctl -t monolog-content-sync --since today --no-pager
```

등록만으로 자동 갱신이 검증된 것은 아닙니다. 실제 quarter-hour 실행 로그의 `status=completed`, `pending=0`, `failed=0`을 확인하고, 수동 호출 성공과 자동 실행 성공을 구분해 보고합니다.

---

## API 엔드포인트

| Path | 인증 | 용도 |
|---|---|---|
| `GET\|POST /api/revalidate` | `Authorization: Bearer $REVALIDATE_SECRET` | 수동 증분 동기화. 캐시를 지우지 않고 바뀐 글과 영향받는 경로만 갱신. `path=/slug`는 해당 글 본문을 다시 확인, `path=/categories/x`·`/series/x`·컬렉션 경로는 그 경로만 재생성, `full=true`는 삭제·이동 감지용 전체 메타데이터 대조. 모든 작업이 끝나면 `200`, 남은 작업이 있으면 `503` |
| `GET\|POST /api/init` | `Authorization: Bearer $REVALIDATE_SECRET` | 컨테이너 시작 워밍. 저장소가 비어 있으면 최초 동기화 후 모든 공개 경로를 재생성. AI 그래프 유지보수는 기다리지 않음(`maintenancePending`) |
| `GET\|POST /api/cron/content` | `Authorization: Bearer $REVALIDATE_SECRET` | 정기 증분 동기화 + 24시간 전체 대조, 최초·변경 포스트 임베딩, 대기 그래프·ontology 작업과 IndexNow 제출 처리 |
| `POST /api/notion-webhook` | `X-Notion-Signature` (HMAC-SHA256) | Notion 이벤트를 힌트로 받아 해당 페이지를 실시간 메타데이터로 다시 확인하고 발행. 같은 이벤트 ID는 한 번만 처리 |
| `POST /api/cron/ontology` | `REVALIDATE_SECRET` Bearer | 누락·변경 문서 임베딩을 먼저 보충하고 LLM ontology를 갱신. `?force=1`은 LLM 캐시 우회이며 같은 문서를 다시 임베딩하지 않음 |
| `GET /robots.txt` · `GET /llms.txt` | — | 크롤러 정책·사이트맵 위치, AI용 공개 글 색인 (공개 글 목록과 동기) |
| `GET /{slug}.md` | — | 글의 Markdown 대체 표현 (`<link rel="alternate" type="text/markdown">`) |
| `GET /{INDEXNOW_KEY}.txt` | — | IndexNow 키 검증 파일 |
| `GET /api/similar?postId=<id-or-slug>&limit=5` | 없음 | 현재 문서 버전의 영속 EmbeddingGemma 벡터로 유사 글 반환. 벡터가 아직 없으면 `202` |
| `GET /api/graph/search?q=<query>` | 없음 | 공식 SearchQuery prompt로 현재 문서 버전의 공개 글 검색. IP당 분당 6회·웹 프로세스당 동시 1개, 초과는 `429`와 `Retry-After`. 미설정·유지보수 중·서비스 장애는 `503`, 빈 검색어·8000자 초과는 `400` |
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
# 수동 전체 대조 (삭제·이동 감지 포함, 캐시 wipe 없음)
curl -X POST -H "Authorization: Bearer $REVALIDATE_SECRET" "https://your-site.com/api/revalidate?full=true"
```

---

## Docker

최소 설정과 `yarn setup`을 마친 뒤, 외부 공개 시 `.env`의 `NEXT_PUBLIC_SITE_URL`을 실제 HTTPS 주소로 설정합니다. 웹·임베딩을 소스 빌드하는 기본 경로는 프로젝트의 비공개 GHCR 이미지 인증이 필요하지 않습니다.

```bash
# blog + redis(캐시) + content-redis(내구성 콘텐츠 저장소) + qdrant + embedding
docker compose config --quiet
docker compose up -d --build --wait --wait-timeout 2400
docker compose ps
docker compose logs -f blog embedding
```

첫 기동은 모델 다운로드·CPU 추론과 Notion 콘텐츠 초기화를 포함합니다. Compose는 임베딩 readiness를 기다리고, blog entrypoint는 `/api/init`으로 공개 경로를 준비합니다. 로그의 초기화 결과까지 확인한 뒤 `/api/cron/content`로 backfill을 진행하세요. 포트 3000 외의 서비스는 호스트에 공개하지 않습니다. DNS·HTTPS 리버스 프록시는 호스트에서 별도 구성합니다. 데이터 볼륨을 지우는 `docker compose down -v`는 운영 갱신 명령이 아닙니다.

### 기존 운영 GHCR 이미지 사용 (선택)

웹 이미지: `ghcr.io/jung-geun/monolog`. 비공개 패키지 접근 권한이 있는 기존 운영 경로입니다. 처음 설치하는 일반 사용자는 위 소스 빌드를 사용하세요.

| 태그 | 트리거 |
|---|---|
| `latest` | `main` 브랜치 push 또는 git 태그 `v*` push |
| `X.Y.Z` | git 태그 `vX.Y.Z` push |

- 아키텍처: `linux/amd64`
- SLSA build provenance attestation 자동 첨부

GHCR CI 빌드에는 GitHub repository variables로 `NEXT_PUBLIC_SITE_URL`과 사용 중인 선택 기능의 공개 값을 설정합니다: `NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT`·`NEXT_PUBLIC_GOOGLE_ADSENSE_DISABLE`·`NEXT_PUBLIC_UTTERANCES_REPO`·`NEXT_PUBLIC_NOTION_COMMENTS_ENABLE`·`REVALIDATE_HOURS`. 이 값은 이미지 빌드 때 고정됩니다. `.env`만 바꿔서는 이미 게시된 이미지의 canonical·광고·댓글 UI가 바뀌지 않습니다. Notion 토큰·DB ID·salt·관리 키는 repository variables나 Docker build args에 넣지 말고 운영 `.env`에만 보관하세요.

이 프로젝트의 운영 기본 도메인은 `https://pieroot.xyz`입니다. 도메인을 변경할 때는 **이미지를 다시 빌드하기 전에** GitHub repository variable `NEXT_PUBLIC_SITE_URL=https://pieroot.xyz`를 설정하고, 원격 배포 서버의 프로젝트 `.env`에도 동일한 값을 설정합니다. CI 빌드 값은 canonical·sitemap·RSS 등의 공개 URL에 사용되고, 운영 `.env`는 런타임 origin 설정과 일치해야 합니다. `.env` 수정이나 컨테이너 재시작만으로 이전 이미지에 포함된 공개 URL을 변경할 수 없으므로 새 이미지를 빌드·배포해야 합니다. HAProxy는 `https://blog.pieroot.xyz`와 `https://www.pieroot.xyz` 요청을 기본 도메인 `https://pieroot.xyz`로 리다이렉트합니다. 다른 설치는 자신의 공개 도메인을 사용하고, 로컬 개발의 `http://localhost:3000` 기본값은 그대로 둡니다.

운영 GHCR 이미지는 테스트·빌드가 성공한 뒤 `docker compose pull blog embedding`으로 가져오고 OCI revision을 확인합니다. 기존 이미지 rollback 태그와 `.env`·Compose override·Redis RDB·Qdrant snapshot을 백업하고 `embedding`이 모델 다운로드·실제 추론 warmup까지 healthy가 된 후 `docker compose up -d --no-build --wait --wait-timeout 2400`으로 교체합니다. 볼륨을 삭제하지 않습니다.

서버 전용 `docker-compose.override.yml`이 `blog`·`redis`·`qdrant`를 외부 네트워크에 연결한다면 `content-redis`와 `embedding`도 blog가 도달 가능한 네트워크에 지정해야 합니다. 첫 배포는 새 서비스를 먼저 준비하고 기존 안내대로 후보 blog에서 `/api/init`과 실제 페이지를 확인한 뒤 교체합니다. `/api/init`은 임베딩을 기다리지 않으므로 교체 후 `/api/cron/content`로 첫 backfill을 진행하고 `pending`·`failed`·`maintenancePending`이 0인지 확인합니다.

### EmbeddingGemma · Qdrant · ontology

Compose의 `embedding`은 내부 네트워크의 `linux/amd64` CPU 서비스입니다. 기본 소스 빌드는 `docker compose build embedding`이고, 기존 운영에서는 `ghcr.io/jung-geun/monolog-embedding:latest` 이미지를 사용할 수 있습니다. 웹·임베딩 이미지는 같은 Docker Build and Push 워크플로에서 각각 발행합니다. 호스트 포트를 공개하지 않으며 `embedding-model-cache` 볼륨에 공개 체크포인트를 보관합니다. 이 볼륨과 Qdrant 저장소도 백업 대상입니다.

모델은 [공식 EmbeddingGemma 2](https://huggingface.co/google/embeddinggemma-2)의 고정 revision `914f7f89142e33e77833254d9c9b90c3cef7303b`, CPU float32, 768차원입니다. 첫 실행은 약 1.49GB의 결합 safetensors를 내려받지만 vision/audio encoder는 생성하지 않습니다. `/health`는 다운로드와 실제 추론 성공 뒤에만 ready를 반환하며, 초기 health grace는 30분입니다. 긴 글은 8192-token 창마다 처리하므로 메모리·CPU 여유가 필요합니다. ARM 호스트에서는 선언된 amd64 서비스의 에뮬레이션이 필요합니다.

readiness의 짧은 query 추론과 긴 문서 backfill의 메모리 사용량은 다릅니다. 공유 8GiB Docker Desktop VM에서 실제 긴 글 8개 요청 중 OOM kill과 모델 재시작을 관찰했습니다. 충분한 Docker/서버 메모리를 확보해야 하며, 재시작은 `docker compose logs embedding`과 Docker 호스트의 OOM 로그로 확인합니다. 이미지를 반복 재시작하거나 키를 추가해도 메모리 부족은 해결되지 않습니다. 환경을 보완한 뒤 유지보수를 다시 실행해 `/api/cron/content`의 `pending=0`, `failed=0`, `maintenancePending=0`과 그래프의 임베딩 진행 수를 함께 확인하세요. `/api/init`은 임베딩을 실행하지 않으므로 그 응답만으로 전체 backfill 완료를 판단하면 안 됩니다.

공개 의미 검색은 IP당 분당 6회·웹 프로세스당 동시 1개로 제한하며 초과 시 `429`와 `Retry-After`를 반환합니다. 모델 서비스는 문서 유지보수에 우선권과 최대 1개 대기 예약을 부여하고 추가 요청을 `503`으로 거절합니다. health 요청은 추론 대기열과 분리하며, 웹의 query 추론은 30초·document 추론은 10분 뒤 중단합니다.

`QDRANT_URL`은 Compose의 `http://qdrant:6333`, 네이티브 개발의 `http://localhost:6333`을 사용합니다. 새 768d 컬렉션은 예전 OpenAI 1536d `posts` 컬렉션을 읽거나 덮어쓰지 않습니다. 동일 제목·본문·모델 revision은 정기 재검증이나 LLM 강제 갱신에서도 재임베딩하지 않습니다. 최초 backfill·제목·본문 수정만 계산하고 slug·태그 수정은 payload만 갱신합니다.

호스트 cron `/api/cron/content`가 임베딩과 증분 작업을 처리합니다. 초기화·webhook·수동 revalidate는 경로 발행을 먼저 마치며 다음 유지보수가 임베딩을 채웁니다. 수동 ontology 갱신도 같은 콘텐츠 잠금을 사용해 동시 발행·벡터 쓰기를 직렬화합니다. Meaning 검색과 RightRail 유사 글은 Anthropic 키 없이 동작하고, 논리 온톨로지 추출만 `ANTHROPIC_API_KEY`가 필요합니다. 수동 온톨로지 갱신:

```bash
curl -X POST "https://your-site.com/api/cron/ontology" \
  -H "Authorization: Bearer $REVALIDATE_SECRET"
```

Compose의 `build.args`는 사이트 주소·Utterances 저장소·AdSense client/disable·재검증 주기를 웹 이미지에 전달합니다. 이 값과 `site.config.js`를 변경하면 `docker compose up -d --build --wait --wait-timeout 2400`으로 다시 빌드합니다. Analytics 및 Google/Naver/Bing 인증 값만 컨테이너 시작 시 runtime-config로 주입되므로 이미지 재빌드 없이 재생성할 수 있습니다. 모든 `NEXT_PUBLIC_*`가 런타임 값인 것은 아닙니다.

단독 `docker run`은 내구성 콘텐츠 Redis와 그래프 서비스 연결을 자동 구성하지 않습니다. 기본 설치·운영에는 위 Compose 경로를 사용합니다.


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

`content-redis`는 TTL 캐시와 분리된 내구성 콘텐츠 저장소입니다. 첫 기동부터 AOF(`--appendonly yes`)가 켜져 있고, 저장은 `WAITAOF`로 로컬 fsync를 확인한 뒤에만 성공합니다. 기존 캐시 `redis`의 설정을 재시작으로 AOF로 바꾸면 기존 RDB 데이터셋을 읽지 않으므로, 두 저장소를 합치지 마세요. 백업 대상에 `content-redis-data` 볼륨을 포함하세요.

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
yarn setup            # 최소 .env 입력 검증 · DB 주소 변환 · 비밀키/salt 생성
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

### 수동 CI runner 선택

`Test Suite`의 일반 push·PR 검사와 수동 실행 기본값은 GitHub hosted `ubuntu-latest`를 사용합니다. Hosted runner를 확보할 수 없을 때는 수동 실행에서만 기존 `self-hosted`·`Linux`·`X64` runner를 선택할 수 있습니다.

```bash
gh workflow run test.yml --ref main -f runner=self-hosted
```

`--ref`에는 검증할 저장소 브랜치·태그를 지정합니다. Self-hosted 경로는 Node.js 설치 후 Corepack으로 `package.json`의 `packageManager`에 선언된 Yarn을 활성화하고 동일한 테스트·빌드를 실행합니다. 해당 호스트에서 프로젝트 코드가 실행되므로 신뢰하는 브랜치만 수동으로 선택하세요.

운영 호스트가 비공개 GHCR 이미지를 직접 pull할 인증이 없으면, 같은 Docker 데몬을 공유하는 신뢰된 self-hosted runner에서 기존 `GHCR_TOKEN`으로 게시 이미지만 적재합니다. 토큰을 호스트나 로그에 내보내지 않으며 패키지를 공개로 바꾸지 않습니다. 아래 수동 경로는 재빌드 없이 두 이미지의 지정 태그를 pull하고 로컬 `latest`로 지정합니다. 이후 Compose에서 `--no-build --pull never --no-deps`로 필요한 서비스만 시작합니다.

```bash
gh workflow run docker-build.yml --ref main -f image-tag=1.20.0
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
│   ├── content/             — 내구성 콘텐츠 레지스트리 (증분 대조 · slug 이력 · 영향 경로 outbox · webhook · IndexNow)
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
│   ├── Graph/               — Three.js 3D 포스트 그래프 (GraphScene · layout3d · 관계 상세)
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
    ├── revalidate.ts        — 수동 증분 동기화
    ├── init.ts              — 컨테이너 워밍
    ├── cron/content.ts      — 정기 증분 동기화
    ├── notion-webhook.ts    — Notion webhook 수신
    ├── robots.ts · llms.ts · indexnow-key.ts · markdown/[slug].ts
    └── refresh-image.ts     — 단일 이미지 URL 재발급

tests/                       — Jest (jsdom · node · @swc/jest)
.github/workflows/           — docker-build · revalidate · test
```

