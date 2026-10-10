# USAGE

monolog 셋업·운영 가이드. 프로젝트 개요와 차별점은 [`README.md`](../README.md)를 참고하세요.

---

## 빠른 시작

```bash
git clone https://github.com/jung-geun/monolog.git
cd monolog
yarn install

cp .env.example .env
# 필수:
#   NOTION_TOKEN=ntn_xxxxx
#   NOTION_DATASOURCE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# 댓글 활성 시 추가 필수:
#   NOTION_COMMENTS_DATASOURCE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
#   COMMENT_HASH_SALT=$(openssl rand -hex 32)
# 방문자 통계 활성 시 추가 필수:
#   NOTION_VISIT_STATS_DATASOURCE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
#   VISITOR_HASH_SALT=$(openssl rand -hex 32)

yarn dev
```

`http://localhost:3000`에서 확인합니다.

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

복제한 DB를 각각 열어:
1. 우상단 `...` → `Add connections` → 1단계에서 만든 Integration 추가
2. **data_source ID 확인**: Notion DB 페이지 URL의 32자 hex ID를 `8-4-4-4-12` UUID 포맷으로 변환 후 `curl -H "Authorization: Bearer $NOTION_TOKEN" https://api.notion.com/v1/databases/{database_id}`를 호출해 `data_sources[0].id` 값을 복사합니다. 이 값을 환경변수에 입력합니다.
   - 예: `curl` 응답의 `"data_sources":[{"id":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}]` 에서 id 복사

> 댓글 기능을 끄려면 `site.config.js`의 `notionComments.enable: false`로 두면 됩니다 — `comments` DB는 무시됩니다. 방문자 통계 기능은 `NOTION_VISIT_STATS_DATASOURCE_ID`와 `VISITOR_HASH_SALT`가 설정된 경우에만 동작합니다.

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
| `NOTION_DATASOURCE_ID` | `blog-table` DB의 ID (UUID with hyphens) |
| `CONTENT_REDIS_URL` 또는 `CONTENT_STATE_DIR` | 공개 게시물·본문·slug 이력·대기 중인 경로/그래프 작업을 보관하는 내구성 콘텐츠 저장소. 운영·컨테이너는 AOF가 켜진 Redis 7.2+(`CONTENT_REDIS_URL`, Compose의 `content-redis`), 로컬 단일 호스트 개발은 디렉터리(`CONTENT_STATE_DIR=.content-state`). 둘 다 없으면 페이지 렌더와 동기화가 실패합니다 |

### 댓글 활성 시 필수 (`site.config.js: notionComments.enable: true`)

| 변수명 | 설명 |
|---|---|
| `NOTION_COMMENTS_DATASOURCE_ID` | `comments` DB의 **data_source ID** (UUID with hyphens) |
| `COMMENT_HASH_SALT` | IP/닉네임 해싱용 salt — 생성: `openssl rand -hex 32` |

### 방문자 통계 활성 시 필수

| 변수명 | 설명 |
|---|---|
| `NOTION_VISIT_STATS_DATASOURCE_ID` | `visit-stats` DB의 **data_source ID** (UUID with hyphens) |
| `VISITOR_HASH_SALT` | 방문자 쿠키 해싱용 salt — 생성: `openssl rand -hex 32`. `COMMENT_HASH_SALT`와 재사용하지 마세요 |

### 선택

| 변수명 | 기본값 | 설명 |
|---|---|---|
| `REDIS_URL` | — | Redis 연결 URL. 설정 시 L2 캐시 활성 (cold start 성능 향상). 예: `redis://localhost:6379`, `rediss://user:pass@host:6380` |
| `ANTHROPIC_API_KEY` | — | `/ontology`, Graph semantic overlay, RightRail `ai · similar`의 엔티티/관계 추출용 Anthropic API key |
| `OPENAI_API_KEY` | — | Qdrant 벡터 검색에 저장할 `text-embedding-3-small` 임베딩 생성용 OpenAI API key |
| `QDRANT_URL` | `http://localhost:6333` | 로컬 개발 또는 외부 Qdrant REST endpoint. Docker Compose 기본 스택은 `docker-compose.yml`에서 컨테이너용 `http://qdrant:6333`을 직접 설정 |
| `QDRANT_API_KEY` | — | 인증이 걸린 외부 Qdrant용 API key. 로컬/self-hosted Qdrant는 빈 값 |
| `CACHE_NAMESPACE` | `monolog` | Redis 키 prefix. 동일 Redis를 staging·preview 등 여러 배포가 공유할 때 충돌 방지 |
| `GRAPH_BUILD_TIMEOUT_MS` | `120000` | Notion graph complete-build 시간 제한(ms). 제한을 넘긴 partial graph는 Qdrant snapshot으로 저장하지 않음. 최대 `300000` |
| `REVALIDATE_SECRET` | — | `/api/revalidate` · `/api/init` · `/api/cron/content` · `/api/cron/graph` · `/api/cron/ontology` 보호용 Bearer 토큰. GitHub Actions의 `REVALIDATE_SECRET` secret과 **동일 이름·동일 값**. |
| `REVALIDATE_HOURS` | `6` | ISR 재생성 주기 (시간) |
| `NEXT_PUBLIC_SITE_URL` | — | 요청 origin 검증의 추가 허용 주소(선택). canonical·sitemap·RSS·IndexNow는 `site.config.js`의 `link`를 사용하고 이미지 프록시는 상대 URL로 저장 |
| `TRUSTED_PROXY_HOPS` | `0` | 앞단 프록시 hop 수 — `0`이면 XFF 무시, `1`이면 Nginx·LB 1단 신뢰 |
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

운영 호스트에는 15분 cron을 등록하고 GitHub Actions는 보조 트리거로 유지합니다. `scripts/reconcile-content-host.sh`는 신뢰할 수 있는 shell-compatible `/app/monolog/.env`에서 토큰을 읽고 로컬 `POST http://127.0.0.1:3000/api/cron/content`를 호출합니다. 토큰은 curl의 표준 입력으로 전달해 명령행에 노출하지 않습니다. 기존 캐시를 지우거나 실제 Notion 글을 수정하지 않습니다.

기존 작업을 보존하며 배포 계정의 `crontab -e`에 다음 줄을 추가합니다. 호스트의 `cron` 서비스가 실행 중이어야 합니다.

```cron
*/15 * * * * /bin/bash /app/monolog/scripts/reconcile-content-host.sh 2>&1 | /usr/bin/logger -t monolog-content-sync
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
| `GET\|POST /api/cron/content` | `Authorization: Bearer $REVALIDATE_SECRET` | 정기 증분 동기화 + 24시간마다 자동 전체 대조, 대기 중인 그래프·ontology 유지보수와 IndexNow 제출 처리 |
| `POST /api/notion-webhook` | `X-Notion-Signature` (HMAC-SHA256) | Notion 이벤트를 힌트로 받아 해당 페이지를 실시간 메타데이터로 다시 확인하고 발행. 같은 이벤트 ID는 한 번만 처리 |
| `POST /api/cron/ontology` | `REVALIDATE_SECRET` Bearer | LLM ontology, Qdrant embeddings, semantic graph edges, RightRail `ai · similar` 데이터를 생성/갱신. `?force=1`이면 캐시 우회 |
| `GET /robots.txt` · `GET /llms.txt` | — | 크롤러 정책·사이트맵 위치, AI용 공개 글 색인 (공개 글 목록과 동기) |
| `GET /{slug}.md` | — | 글의 Markdown 대체 표현 (`<link rel="alternate" type="text/markdown">`) |
| `GET /{INDEXNOW_KEY}.txt` | — | IndexNow 키 검증 파일 |
| `GET /api/similar?postId=<id-or-slug>&limit=5` | 없음 | Qdrant 기반 `ai · similar` 글 목록 반환. ontology embedding이 아직 없으면 `202` |
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

```bash
# 기본 스택: blog + redis(캐시) + content-redis(내구성 콘텐츠 저장소) + qdrant
docker compose up -d

# 로컬 변경사항까지 다시 빌드해서 재시작
docker compose up -d --build

docker compose logs -f
```

이미지: `ghcr.io/jung-geun/monolog`

| 태그 | 트리거 |
|---|---|
| `latest` | `main` 브랜치 push 또는 git 태그 `v*` push |
| `X.Y.Z` | git 태그 `vX.Y.Z` push |

- 아키텍처: `linux/amd64`
- SLSA build provenance attestation 자동 첨부

운영에서 GHCR 이미지를 사용하면 GitHub의 테스트·빌드가 성공한 뒤 `docker compose pull blog`로 가져오고, OCI revision이 배포할 커밋과 일치하는지 확인합니다. 기존 이미지에 rollback 태그를 남기고 `.env`·Compose override·Redis RDB·Qdrant snapshot을 백업한 뒤 `docker compose up -d --no-build --wait`로 교체합니다. 볼륨을 삭제하지 않습니다.

서버 전용 `docker-compose.override.yml`이 `blog`·`redis`·`qdrant`를 외부 네트워크에 연결한다면 새 `content-redis`에도 같은 네트워크를 지정해야 합니다. 첫 배포는 `content-redis`를 먼저 시작하고 `docker compose run -d --name blog-candidate --no-deps -p 127.0.0.1:13000:3000 blog`로 후보 이미지를 실행해 `/api/init` 완료와 실제 페이지를 확인한 뒤 운영 컨테이너를 교체하면 최초 본문 동기화 동안 기존 사이트를 유지할 수 있습니다. 후보 컨테이너 확인이 끝나면 제거합니다.

### Qdrant ontology/vector search (선택)

Qdrant 컨테이너는 기본 `docker compose up -d`에 포함됩니다. `/ontology`, Graph semantic overlay, RightRail `ai · similar`는 이 Qdrant 인스턴스를 사용합니다. Compose 안의 `blog` 컨테이너는 `QDRANT_URL=http://qdrant:6333`을 사용하고, 호스트에서 직접 개발할 때만 `.env`의 `QDRANT_URL=http://localhost:6333`을 사용합니다.

온톨로지 빌드/갱신:

```bash
curl -X POST "https://your-site.com/api/cron/ontology" \
  -H "Authorization: Bearer $REVALIDATE_SECRET"
```

```bash
docker run -d -p 3000:3000 --env-file .env ghcr.io/jung-geun/monolog:latest
```

예시 (`NEXT_PUBLIC_*` 값은 공개 값이며 이미지에 다시 빌드할 필요가 없습니다):

```bash
docker run -d -p 3000:3000 \
  --env-file .env \
  -e NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID=G-XXXXXXXXXX \
  -e NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=verification-token \
  ghcr.io/jung-geun/monolog:latest
```

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

