# MoreThanLog 프로젝트 구조 문서

## 프로젝트 개요

**MoreThanLog**는 Next.js 13을 기반으로 한 정적 블로그 플랫폼으로, Notion을 CMS(콘텐츠 관리 시스템)로 사용합다. 포스트, 페이지, 논문(Paper) 형식의 콘텐츠를 지원하며 Vercel 배포에 최적화되어 있습니다.

### 주요 기술 스택
- **프레임워크**: Next.js 13 (App Router 이전 버전)
- **언어**: TypeScript
- **스타일링**: Emotion
- **상태 관리**: React Query (@tanstack/react-query)
- **데이터 소스**: Notion API (@notionhq/client)
- **코드 하이라이팅**: Prism.js
- **다이어그램**: Mermaid
- **댓글 시스템**: Utterances, Cusdis

## 전체 디렉토리 구조

```
morethan-log/
├── .env.example                 # 환경변수 예시 파일
├── .eslintrc.json              # ESLint 설정
├── .gitignore                  # Git 무시 파일 목록
├── .prettierrc.json            # Prettier 설정
├── Dockerfile                  # Docker 컨테이너 설정
├── index.d.ts                  # 전역 타입 선언
├── jest.config.js              # Jest 테스트 설정
├── LICENSE                     # MIT 라이선스
├── Makefile                    # 빌드 스크립트
├── next-env.d.ts              # Next.js 타입 선언
├── next-sitemap.config.js     # 사이트맵 생성 설정
├── next.config.js             # Next.js 설정
├── package.json               # 프로젝트 의존성 및 스크립트
├── package-lock.json          # 의존성 잠금 파일
├── README.md                  # 프로젝트 설명서
├── site.config.js             # 사이트 전체 설정
├── todo.md                    # TODO 목록
├── tsconfig.json              # TypeScript 설정
├── tsconfig.tsbuildinfo       # TypeScript 빌드 정보
├── yarn.lock                  # Yarn 잠금 파일
├── .github/                   # GitHub Actions 워크플로우
│   └── workflows/             # CI/CD 워크플로우 설정
│       ├── revalidate.yml     # ISR 리밸리데이션
│       └── test.yml           # 테스트 자동화
├── logs/                      # 로그 파일 디렉토리
│   └── image-proxy-errors.jsonl
├── public/                    # 정적 에셋
│   ├── ads.txt               # 광고 설정
│   ├── apple-touch-icon.png  # 애플 터치 아이콘
│   ├── avatar.svg            # 프로필 아바타
│   └── favicon.ico           # 파비콘
├── scripts/                   # 빌드 및 유틸리티 스크립트
│   ├── inspect-slug.ts
│   ├── test-unpack-cases.js
│   └── test-unpack.js
├── tests/                     # 테스트 파일 디렉토리
│   ├── notion-image.test.ts   # Notion 이미지 처리 테스트
│   └── setup.ts              # Jest 테스트 설정
└── src/                      # 소스 코드
    ├── apis/                 # API 관련 코드
    ├── assets/               # 정적 에셋 관리
    ├── components/           # 재사용 가능한 컴포넌트
    ├── constants/            # 상수 정의
    ├── hooks/                # 커스텀 React 훅
    ├── layouts/              # 레이아웃 컴포넌트
    ├── libs/                 # 라이브러리 및 유틸리티
    ├── pages/                # Next.js 페이지 라우팅
    ├── routes/               # 페이지별 컴포넌트
    ├── styles/               # 스타일 정의
    └── types/                # TypeScript 타입 정의
```

## 주요 디렉토리 및 파일 상세 설명

### 설정 파일

#### `package.json`
- 프로젝트 의존성 및 스크립트 정의
- 주요 의존성: Next.js, React, Notion 클라이언트, React Query, Emotion
- 개발 스크립트: `dev`, `build`, `start`, `lint`, `test`

#### `site.config.js`
- 사이트 전체 설정 관리
- 프로필 정보, 블로그 설정, Notion 연동 설정
- 플러그인 설정 (Google Analytics, 댓글 시스템 등)
- 환경별 설정 (개발/프로덕션)

#### `next.config.js`
- Next.js 프레임워크 설정

#### `jest.config.js`
- Jest 테스트 프레임워크 설정
- 테스트 환경 구성 (JSDOM)
- 커버리지 리포트 설정
- 모의(mock) 설정

### `/tests/` - 테스트 파일 디렉토리

```
tests/
├── notion-image.test.ts    # Notion 이미지 처리 테스트
└── setup.ts               # Jest 테스트 설정
```

**기능**: 프로젝트의 테스트 코드를 포함합니다. Jest와 Testing Library를 사용하여 단위 테스트 및 통합 테스트를 작성합니다. 현재는 Notion 이미지 처리 로직에 대한 포괄적인 테스트가 포함되어 있습니다.

### `/.github/workflows/` - GitHub Actions 워크플로우

```
.github/workflows/
├── revalidate.yml          # ISR 리밸리데이션 자동화
└── test.yml                # 테스트 자동화
```

**기능**: CI/CD 파이프라인을 구성합니다. 코드 푸시 시 자동 테스트 실행, 린트 체크, 빌드 검증 등을 수행하며, 정기적인 ISR 캐시 무효화 작업을 자동화합니다.

### `/src/apis/` - API 연동 계층

```
src/apis/
├── index.ts                  # API 모듈 진입점
└── notion-client/           # Notion API 클라이언트
    ├── getPostBySlug.ts     # 슬러그로 포스트 조회
    ├── getPosts.ts          # 전체 포스트 목록 조회
    ├── getRecordMap.ts      # Notion 레코드 맵 조회
    ├── index.ts             # 모듈 진입점
    └── notionClient.ts      # Notion 클라이언트 설정
```

**기능**: Notion API와의 통신을 담당하는 계층입니다. 포스트 목록 조회, 개별 포스트 데이터 가져오기, Notion 페이지 레코드 맵 변환 등의 기능을 제공합니다.

### `/src/components/` - 재사용 가능한 컴포넌트

```
src/components/
├── DatabasePlaceholder.tsx  # 데이터베이스 플레이스홀더
├── Emoji.tsx               # 이모지 렌더링 컴포넌트
├── Tag.tsx                 # 태그 컴포넌트
├── Category/               # 카테고리 관련 컴포넌트
│   ├── constants.ts        # 카테고리 상수
│   └── index.tsx          # 카테고리 컴포넌트
├── GoogleAnalytics/       # Google Analytics 연동
│   └── index.tsx
└── MetaConfig/            # 메타 태그 설정
    └── index.tsx
```

**기능**: 애플리케이션 전반에서 재사용되는 UI 컴포넌트들을 포함합니다. 태그, 카테고리, 이모지 등의 기본 컴포넌트와 SEO를 위한 MetaConfig 컴포넌트가 포함됩니다.

### `/src/hooks/` - 커스텀 React 훅

```
src/hooks/
├── useCategoriesQuery.ts   # 카테고리 데이터 조회 훅
├── useDropdown.ts          # 드롭다운 상태 관리 훅
├── usePostQuery.ts         # 개별 포스트 데이터 조회 훅
├── usePostsQuery.ts        # 포스트 목록 조회 훅
├── useScheme.ts            # 테마 스킴 관리 훅
└── useTagsQuery.ts         # 태그 데이터 조회 훅
```

**기능**: React Query를 기반으로 한 데이터 fetching 훅과 UI 상태 관리 훅들을 제공합니다. Notion 데이터 조회, 캐싱, 상태 관리를 담당합니다.

### `/src/layouts/` - 레이아웃 구조

```
src/layouts/
├── index.ts
└── RootLayout/             # 루트 레이아웃
    ├── index.tsx          # 메인 레이아웃 컴포넌트
    ├── Scripts.tsx        # 스크립트 로드
    ├── useGtagEffect.ts   # Google Analytics 효과
    ├── Header/            # 헤더 컴포넌트
    │   ├── index.tsx
    │   ├── Logo.tsx
    │   ├── NavBar.tsx
    │   └── ThemeToggle.tsx
    └── ThemeProvider/      # 테마 프로바이더
        ├── index.tsx
        └── Global/        # 전역 스타일
            └── index.tsx
```

**기능**: 애플리케이션의 전체적인 레이아웃 구조를 정의합니다. 헤더, 테마, 전역 스타일, 스크립트 로드 등 공통적인 UI 구조를 관리합니다.

### `/src/libs/` - 라이브러리 및 유틸리티

```
src/libs/
├── fallbackData.ts         # 폴백 데이터
├── gtag.ts                # Google Analytics 유틸리티
├── notionCache.js         # Notion 캐시 관리
├── react-query/           # React Query 설정
│   └── index.ts
├── utils/                 # 유틸리티 함수들
│   ├── index.ts
│   └── logger.ts
└── utils/notion/          # Notion 데이터 처리 유틸리티
    ├── customMapImageUrl.ts
    ├── filterPosts.ts
    ├── getAllPageIds.ts
    ├── getAllSelectItemsFromPosts.ts
    ├── getMetadata.ts
    ├── getPageProperties.ts
    ├── index.ts
    └── optimizeRecordMap.ts
```

**기능**: 데이터 처리, 캐싱, 유틸리티 함수들을 포함합니다. 특히 Notion 데이터 변환, 필터링, 최적화 관련 로직이 중심입니다.

### `/src/pages/` - Next.js 페이지 라우팅

```
src/pages/
├── _app.tsx               # Next.js App 컴포넌트
├── _document.tsx         # HTML 문서 구조
├── [slug].tsx            # 동적 라우팅 (포스트/페이지 상세)
├── 404.tsx               # 404 에러 페이지
├── index.tsx             # 메인 페이지 (Feed)
├── sitemap.xml.tsx       # 동적 사이트맵 생성
├── api/                  # API 라우트
│   ├── image-proxy.ts    # 이미지 프록시 API
│   ├── revalidate.ts     # ISR 리밸리데이션 API
│   └── debug/            # 디버그 API
│       └── inspect-slug.ts
```

**기능**: Next.js의 페이지 라우팅 시스템을 구성합니다. 메인 피지 페이지, 개별 포스트 페이지, API 라우트 등이 포함됩니다.

### `/src/routes/` - 페이지별 컴포넌트

```
src/routes/
├── Error/                 # 에러 페이지
│   └── index.tsx
├── Feed/                  # 메인 피드 페이지
│   ├── index.tsx
│   ├── ContactCard.tsx
│   ├── Footer.tsx
│   ├── MobileProfileCard.tsx
│   ├── ProfileCard.tsx
│   ├── SearchInput.tsx
│   ├── ServiceCard.tsx
│   ├── TagList.tsx
│   ├── FeedHeader/        # 피드 헤더
│   │   ├── CategorySelect.tsx
│   │   ├── FeedHeader.tsx
│   │   ├── OrderButtons.tsx
│   │   └── index.ts
│   └── PostList/          # 포스트 리스트
│       ├── PinnedPosts.tsx
│       ├── PostCard.tsx
│       ├── filterPosts.tsx
│       └── index.tsx
└── Detail/                # 상세 페이지
    ├── index.tsx
    ├── hooks/             # 상세 페이지 훅
    │   └── useMermaidEffect.ts
    ├── components/        # 상세 페이지 컴포넌트
    │   └── NotionRenderer/
    │       ├── index.tsx
    │       └── useDatabasePlaceholderEffect.ts
    ├── PageDetail/        # 페이지 타입 상세
    │   └── index.tsx
    └── PostDetail/        # 포스트 타입 상세
        ├── index.tsx
        ├── PostFooter.tsx
        ├── PostHeader.tsx
        └── CommentBox/     # 댓글 박스
            ├── Cusdis.tsx
            ├── Utterances.tsx
            └── index.tsx
```

**기능**: 각 페이지별로 특화된 컴포넌트들을 포함합니다. 메인 피지, 상세 페이지, 검색, 필터링 등의 기능이 구현되어 있습니다.

### `/src/styles/` - 스타일 정의

```
src/styles/
├── colors.ts              # 색상 테마 정의
├── index.ts              # 스타일 진입점
├── media.ts              # 미디어 쿼리 정의
├── theme.ts              # 전체 테마 설정
├── variables.ts           # CSS 변수 정의
└── zIndexes.ts           # z-index 관리
```

**기능**: Emotion을 사용한 스타일 시스템을 정의합니다. 색상, 테마, 반응형 미디어 쿼리 등을 중앙에서 관리합니다.

### `/src/types/` - TypeScript 타입 정의

```
src/types/
└── index.ts               # 전역 타입 정의
```

**기능**: 프로젝트 전반에서 사용되는 TypeScript 타입들을 정의합니다.

## 데이터 흐름 및 아키텍처

### 1. 데이터 가져오기 흐름
```
Notion Database → API Layer (/src/apis/) → React Query Cache → React Components
```

### 2. 페이지 렌더링 흐름
```
Next.js Pages → Layout → Routes → Components → Styled Components
```

### 3. 주요 기능 아키텍처

#### ISR (Incremental Static Regeneration)
- `getStaticProps`를 사용한 정적 페이지 생성
- `revalidateTime` 설정으로 주기적인 업데이트
- React Query를 통한 클라이언트 측 캐싱

#### 포스트 타입 지원
- **Post**: 일반 블로그 포스트
- **Page**: 정적 페이지 (Resume, About 등)
- **Paper**: 학술 논문 형식

#### 검색 및 필터링
- 클라이언트 측에서 실시간 검색
- 카테고리, 태그, 타입별 필터링
- 고정된 포스트(Pinned Posts) 지원

## 환경 변수 설정

필수 환경 변수:
- `NOTION_PAGE_ID`: Notion 데이터베이스 페이지 ID
- `NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID`: Google Analytics ID
- `NEXT_PUBLIC_UTTERANCES_REPO`: Utterances 레포지토리

선택적 환경 변수:
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`: Google Search Console 인증
- `NEXT_PUBLIC_NAVER_SITE_VERIFICATION`: Naver Search Advisor 인증
- `REVALIDATE_HOURS`: ISR 재생성 시간 (시간 단위)

## 배포 및 최적화

### Vercel 배포 최적화
- 자동 사이트맵 생성 (`next-sitemap`)
- ISR을 통한 성능 최적화
- OG 이미지 동적 생성
- CDN을 통한 정적 에셋 전송

### SEO 최적화
- 동적 메타 태그 생성
- 구조화된 데이터 지원
- 사이트맵 자동 생성
- Open Graph 및 Twitter Card 지원

이 프로젝트는 Notion을 백엔드로 사용하는 현대적인 블로그 플랫폼으로, 개발자 친화적인 구조와 확장성을 갖추고 있습니다.

## 개발 환경 설정

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

## 테스트 및 CI/CD

### 테스트 환경 구성
- **테스트 프레임워크**: Jest + Testing Library
- **테스트 환경**: JSDOM (브라우저 환경 시뮬레이션)
- **테스트 설정**: `jest.config.js`, `tests/setup.ts`

### 주요 테스트 명령어
```bash
# 전체 테스트 실행
npm run test

# 테스트 watchers 모드로 실행
npm run test:watch

# 커버리지 리포트 생성
npm run test:coverage

# 타입 체크
npm run type-check

# 린트 체크
npm run lint
```

### GitHub Actions 워크플로우

#### `.github/workflows/test.yml` - 테스트 자동화
- **트리거**: main/develop 브랜치 푸시, Pull Request
- **동작**: 
  - Node.js 18.x, 20.x 버전에서 테스트 실행
  - ESLint, TypeScript 타입 체크, Jest 테스트 실행
  - 빌드 테스트 및 커버리지 리포트 업로드

#### `.github/workflows/revalidate.yml` - ISR 리밸리데이션
- **트리거**: 12시간 주기 스케줄, 수동 실행
- **동작**: 
  - ISR 캐시 무효화 및 사이트맵 워밍
  - Discord 알림 통합 (성공/실패 여부에 따라 이모지 포함)

### 테스트 케이스 예시
프로젝트에는 Notion 이미지 처리 로직에 대한 포괄적인 테스트가 포함되어 있습니다:

- **customMapImageUrl 함수 테스트**: AWS S3 서명된 URL 프록시 처리
- **이미지 블록 식별 테스트**: 다양한 Notion 이미지 블록 타입 지원
- **프록시 API 동작 테스트**: 환경 변수별 URL 생성 확인
- **에러 핸들링 테스트**: 잘못된 URL 형식 및 예외 상황 처리

테스트는 `tests/` 디렉토리에 위치하며, 실제 프로덕션 코드와 동일한 로직을 검증하여 안정성을 보장합니다.

## 의존성 관리 및 문제 해결

### React 18 호환성 문제 해결
프로젝트가 React 18.2.0을 사용하면서 발생한 의존성 충돌 문제를 해결했습니다:

#### 문제 상황
- `react-cusdis@2.1.3`가 React 17.0.0을 요구하는 peer dependency 충돌
- npm install 시 "Could not resolve dependency: peer react@"^17.0.0" from react-cusdis@2.1.3" 에러 발생

#### 해결 방안
1. **react-cusdis 의존성 제거**: `package.json`에서 react-cusdis 제거
2. **커스텀 Cusdis 컴포넌트 구현**: 
   - 네이티브 Cusdis 스크립트 직접 로드
   - React 18과 완전 호환되는 커스텀 구현
   - 기존 기능(테마 스위칭, 재렌더링) 모두 유지

#### 변경된 파일
- `package.json`: react-cusdis 의존성 제거
- `src/routes/Detail/PostDetail/CommentBox/Cusdis.tsx`: 네이티브 스크립트 사용하는 커스텀 구현으로 교체

#### 결과
- ✅ npm install 성공
- ✅ 모든 테스트 통과 (13/13)
- ✅ 프로덕션 빌드 성공
- ✅ 기존 Cusdis 댓글 기능 완전 유지

이 해결을 통해 프로젝트는 React 18의 최신 기능을 활용하면서 안정적인 의존성 관리가 가능해졌습니다.
