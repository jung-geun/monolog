# CI

GitHub Actions 워크플로우의 형태, 실측 기록, 보안 요구 사항과 남은 후속 작업. 프로젝트 개요는 [`../README.md`](../README.md), 변경 이력은 [`CHANGELOG.md`](CHANGELOG.md)를 참고하세요.

---

## 워크플로우

| 파일 | 트리거 | Runner | 역할 |
|---|---|---|---|
| [`test.yml`](../.github/workflows/test.yml) (Test Suite) | `push`·`pull_request` (`main`, `dev`), `workflow_dispatch` | `ubuntu-latest` | **Run Tests**와 **Build Project**를 병렬 실행. Run Tests의 ESLint·type-check는 `continue-on-error`라 잡을 실패시키지 않는다. 검사 중 잡을 실패시키는 것은 `yarn test`와 `yarn build`(next build의 TypeScript 검사 포함)이고, 실패하면 Test Suite 실행이 실패한다. 이 결과를 소비하는 곳은 아직 없다([게이팅](#게이팅)) |
| [`docker-build.yml`](../.github/workflows/docker-build.yml) | `push` (`main`, `v*` 태그) | `[self-hosted, Linux, X64]` | GHCR 이미지 빌드·push. Test Suite 결과를 기다리지 않는다([게이팅](#게이팅)) |
| [`revalidate.yml`](../.github/workflows/revalidate.yml) | `schedule`, `workflow_dispatch` | `ubuntu-latest` | `/api/revalidate` 호출 |

### 게이팅

규칙: 이미지·패키지 **발행(push)과 배포**는 테스트 워크플로우 전체 결과로 게이팅한다. 아무것도 발행하지 않는 PR 검증 빌드는 테스트와 병렬로 실행해도 된다.

- **Build Project**는 아무것도 발행하지 않는 검증 빌드다. 그래서 Run Tests와 병렬로 실행하는 것은 규칙에 맞다.
- Run Tests·Build Project가 실패하면 Test Suite 실행이 실패하지만, 2026-09-24 현재 그 결과를 소비하는 곳이 없다.
  - `main`에는 branch protection이 없다(`gh api repos/jung-geun/monolog/branches/main/protection` → 404).
  - 유일한 ruleset `main protected`의 규칙은 `deletion`·`non_fast_forward`뿐이고 required status check가 없다(`gh api repos/jung-geun/monolog/rules/branches/main`).
  - Test Suite 결과를 기다리는 워크플로우(`workflow_run`, 또는 reusable workflow로 호출한 뒤 `needs:`)도 없다.
  - 그래서 실패한 Test Suite는 merge도 GHCR 발행도 막지 않는다.
- **규칙 위반(미해결)**: `docker-build.yml`의 GHCR push는 Test Suite 결과를 기다리지 않는다. 이 변경의 범위 밖이라 [후속 작업](#후속-작업)으로 남긴다.
  - required status check만으로는 이 공백이 닫히지 않는다. branch ruleset은 `main` 반영만 다루고, `v*` 태그 push로 시작되는 발행은 그 대상이 아니다. 발행 잡 자체가 같은 commit의 테스트 성공을 기다려야 한다.
  - 예를 들어 `docker-build.yml`이 Test Suite 잡을 reusable workflow로 호출하고 발행 잡을 `needs:`로 건다. 이때 `test.yml`에 `workflow_call` 트리거가 추가되므로 계약 테스트의 트리거 목록도 같이 바꾼다.
  - `workflow_run`은 PR의 Test Suite 실행에서도 발생한다. 그래서 self-hosted runner에서 쓰면 계약 테스트의 runner 규칙에 걸린다.

### 계약 테스트

[`tests/ciWorkflow.test.ts`](../tests/ciWorkflow.test.ts)는 `yarn test`에 포함되며 다음을 고정한다.

- `test.yml`: 잡 이름(Run Tests / Build Project), 두 잡 사이 `needs:` 없음, 두 잡에 job-level `if:` 없음·`continue-on-error` 없음(또는 `false`), `run: yarn test`·`run: yarn build` step이 각각 정확히 하나이고 `name`·`id`·`run`·`env`·`timeout-minutes`·`continue-on-error: false` 외의 key(`if:`, `shell:` 등) 없음, workflow level과 `test`·`build` 잡에 `defaults` 없음(`defaults.run.shell`·`working-directory`도 그 step에 적용되므로), 트리거가 정확히 `push`·`pull_request`·`workflow_dispatch`, `push`·`pull_request`의 필터가 `branches: {main, dev}` 하나뿐(`!` 패턴·wildcard·`paths`·`paths-ignore`·`branches-ignore`·`types` 없음), top-level `permissions`가 정확히 `contents: read`이고 어떤 잡도 `permissions`를 다시 정하지 않음.
- `.github/workflows/`의 `*.yml`·`*.yaml` 전체: 신뢰하는 이벤트만으로 시작되는 워크플로우가 아니면 모든 잡이 GitHub-hosted runner label을 써야 한다. 호출하는 로컬 reusable workflow도 같은 규칙으로 검사한다.
  - 신뢰하는 이벤트는 `schedule`·`workflow_dispatch`·`workflow_call`, 그리고 조건을 갖춘 `push`다. 그 외 이벤트(`pull_request`, `pull_request_target`, `issue_comment`, `workflow_run` 등)는 신뢰하지 않는다.
  - `push`는 필터 key가 `branches:`·`tags:`뿐이고(하나 이상), `branches:` 항목이 모두 `dependabot/`로 시작하지 않는 정확한 branch 이름일 때만 신뢰한다. 이 저장소에서는 Dependabot이 `dependabot/**` branch를 만들어 push하므로(npm·github-actions·docker 업데이트 활성), 필터 없는 `push`, `'**'` 같은 wildcard, `branches-ignore`, `paths`만 있는 필터는 Dependabot이 올린 코드도 실행한다. 판단을 단순하게 하려고 나머지 형태(다른 wildcard, `!` 패턴, `tags-ignore`, `branches`와 함께 쓴 `paths` 등)도 신뢰하지 않는다.
  - label은 정확한 GitHub-hosted 목록(`ubuntu-latest`, `ubuntu-24.04`, `windows-2025`, `macos-15` 등)과 비교한다. `ubuntu-selfhosted`처럼 모양만 비슷한 custom label은 통과하지 못한다.
- 파서는 자신이 읽는 mapping(top level, `on`, 트리거 필터, `jobs`, 각 잡·step, `permissions`)에서 다음을 실패로 처리한다. 첫 key 앞의 내용, key 들여쓰기 이하에서 `key:` 형태가 아닌 줄(`key :`, `? key`, `key:value` 등), 중복 key, 읽을 수 없는 `on:`·`runs-on` 형태. 그 아래 중첩 mapping(`env`, `with`, `strategy` 등)은 읽지 않는다.

이 테스트와 워크플로우의 `if:` 가드는 관리자의 실수를 막는 통제이며 유지한다. 다만 PR이 워크플로우 파일을 바꿀 수 있으므로 이것만으로는 부족하고, 저장소 설정으로도 보장해야 한다. 이유와 필요한 설정은 아래 [self-hosted runner 보안](#self-hosted-runner-보안)에 있다.

---

## 측정 방법

변경 전후를 같은 방법으로 비교하기 위해 아래 정의를 고정한다.

- 대상: Test Suite 워크플로우의 **성공한 실행만**.
- 크리티컬 패스: run `created_at`부터 마지막 잡 `completed_at`까지.
- 잡 시간: 잡 `started_at`부터 `completed_at`까지(대기 시간 제외). 잡 시작 시각은 run `created_at` 기준.
- p90: nearest-rank(정렬 후 `ceil(0.9 × n)`번째 값).
- 수집:

  ```bash
  gh run list -R jung-geun/monolog --workflow test.yml --limit 60 \
    --json databaseId,conclusion,createdAt,event,headBranch
  gh api repos/jung-geun/monolog/actions/runs/<id>/jobs   # run마다
  ```

- yarn 캐시 hit/miss 판정: `actions/setup-node`는 primary key가 정확히 일치하지 않았을 때만 post step에서 캐시를 저장한다. 그래서 Run Tests의 `Post Setup Node.js 22.x` step이 3초를 넘으면 miss로 분류했다(miss 9–18초, hit 0–1초로 분포가 겹치지 않음).

## 기준 실측 (변경 전, `build`가 `needs: test`로 직렬)

최근 45회 실행(2026-08-07..2026-09-21, run `31169829094`..`35643019408`) 중 성공 36회.

| 지표 | median | p90 | 범위 |
|---|---|---|---|
| 크리티컬 패스 | **176s** | **196s** | 141–214s |
| Run Tests 잡 | 73s | 85s | 49–93s |
| Build Project 잡 | 94s | 102s | 83–113s |
| Build Project 시작 (run 생성 기준) | +83s | +99s | +56–119s |

- 캐시 hit 실행(13회)의 크리티컬 패스 median은 154s, miss 실행(23회)은 179s.
- 실패 9회 중 8회는 Run Tests가 성공한 뒤 Build Project가 실패했다(모두 dependabot PR). 나머지 1회(`34765883483`, main push)는 Run Tests가 실패해 Build Project가 skip됐다. 테스트를 기다린 덕분에 피한 빌드 실패는 없었다.

### 잡별 고정비 (step median, 초)

| 잡 · 캐시 상태 | n | Setup Node (캐시 복원) | Install (`yarn install --frozen-lockfile`) | Post Setup Node (캐시 저장) | 복원+설치 합 (run별 median) |
|---|---|---|---|---|---|
| Run Tests · hit | 13 | 17 (p90 26) | 11 (p90 17) | 0 | 27 |
| Run Tests · miss | 23 | 1 (p90 4) | 38 (p90 43) | 12 (p90 14) | 39, 저장 포함 52 |
| Build Project · hit (36회 모두) | 36 | 18 (p90 26) | 11 (p90 18) | 0 | 29 |

나머지 step: checkout·set up job 각 1s, ESLint 9s, type-check 7s, Jest 3.5s, `yarn build` 58.5s (p90 61s).

- hit는 cold install보다 run당 약 12s 빠르고(27s vs 39s), miss는 cold install에 캐시 저장(median 12s)을 더한다(run별 median 52s vs 39s).
- Run Tests는 36회 중 23회(64%) miss였다. dependabot PR(`yarn.lock` 변경)이 17회, main push가 6회다. "yarn.lock이 바뀔 때"는 드문 경우가 아니라 이 저장소 실행의 다수다.
- 변경 전 Build Project는 36회 모두 hit였다(`Post Setup Node.js` ≤ 1s). 같은 run에서 먼저 끝난 Run Tests가 캐시를 저장했기 때문이다. 병렬 실행에서는 이 효과가 사라진다.

## 변경 후 예측 (측정 아님)

`test.yml`의 `build` 잡에서 `needs: test`를 제거했다(커밋 "ci: run Build Project in parallel with Run Tests"). 아래 수치는 기준 36회의 step 시간으로 만든 **모델 예측**이며, 머지 후 실측으로 대체해야 한다.

모델 가정:

- Build Project는 같은 run의 Run Tests와 같은 시각에 시작한다.
- Run Tests가 miss인 run에서는 Build Project도 miss다. Build의 복원+설치 시간을 같은 run Run Tests의 miss 비용(설정+설치+저장)으로 바꾼다.
- 그 외 step 시간은 측정값 그대로 쓴다.

| 시나리오 | median | p90 |
|---|---|---|
| 병렬, `cache: 'yarn'` 유지 (현재 `test.yml`) | ~115.5s | ~128s |
| └ 캐시 hit run / miss run | ~97s / ~122s | |
| 병렬, 두 잡 모두 yarn 캐시 없음 (후속 실험 후보) | ~107s | ~112s |

- 그 커밋 본문의 예측은 median ~116s, p90 ~126s였다. 위 모델의 p90은 ~128s다.
- 두 잡이 동시에 miss하면 같은 key를 저장하려고 경쟁한다. `actions/cache`의 동작상 한쪽은 경고만 남기고 저장을 건너뛴다(이 저장소에서는 아직 관찰하지 않음).
- 저장소가 public이라 GitHub-hosted runner-minutes는 무료다. 그래서 목표 지표는 wall-clock이고, 테스트가 실패해도 빌드가 끝까지 도는 비용은 받아들인다.

---

## self-hosted runner 보안

규칙: public 저장소의 `pull_request` 코드를 self-hosted runner에서 실행하지 않는다. 워크플로우 YAML의 가드(`if:`, 트리거, `runs-on`, 이 계약 테스트, `docker-build.yml` 로그인 step의 `if: github.event_name != 'pull_request'`)는 유지한다. 그러나 PR이 이를 수정할 수 있으므로 runner group의 저장소 제한과 fork PR 승인 설정으로도 보장한다.

`pull_request` 이벤트는 PR merge commit의 워크플로우 파일로 실행된다. 그래서 fork PR은 `docker-build.yml`에 `pull_request` 트리거를 추가하거나 self-hosted `runs-on`을 쓰는 새 워크플로우 파일을 넣을 수 있다. 이 코드는 계약 테스트가 실패하기 **전에** 실행되므로, 계약 테스트만으로는 막을 수 없다.

### 현재 설정 (2026-09-24 `gh api`로 확인)

| 항목 | 현재 값 | 확인 명령 |
|---|---|---|
| 저장소 공개 범위 | public | `gh api repos/jung-geun/monolog --jq .visibility` |
| 소유자 계정 유형 | User (runner group 사용 불가) | `gh api users/jung-geun --jq .type` |
| self-hosted runner | 저장소 레벨 4대, label `[self-hosted, Linux, X64]` (2대 online) | `gh api repos/jung-geun/monolog/actions/runners` |
| fork PR 승인 정책 | `first_time_contributors`: 이전에 기여한 적 있는 외부 기여자의 fork PR은 승인 없이 실행됨 | `gh api repos/jung-geun/monolog/actions/permissions/fork-pr-contributor-approval` |
| 기본 `GITHUB_TOKEN` 권한 | `write` (그래서 `test.yml`의 top-level `permissions: contents: read`를 계약 테스트로 고정) | `gh api repos/jung-geun/monolog/actions/permissions/workflow` |
| `main` 규칙 | ruleset `main protected`: `deletion`·`non_fast_forward`만 있음(required status check 없음). branch protection 없음 | `gh api repos/jung-geun/monolog/rules/branches/main`, `gh api repos/jung-geun/monolog/branches/main/protection` (404) |

### 필요한 설정 (미적용)

이 저장소에는 runner group이 없다. runner group은 조직(Organization) 설정에만 있고, 이 저장소의 소유자는 User 계정이며 self-hosted runner는 저장소 레벨에 등록돼 있다. 그래서 설정 수준의 통제는 모두 저장소 소유자 작업이다. 아래 UI 경로와 문구는 GitHub 화면이 바뀌면 달라질 수 있으므로, 함께 적은 API endpoint를 확인 기준으로 삼는다.

1. **fork PR 승인**: 정책을 `all_external_contributors`(모든 외부 기여자 승인 필요)로 바꾼다. 승인자는 실행을 승인하기 전에 `.github/workflows/` 변경을 확인한다.
   - UI: 저장소 `Settings` → `Actions` → `General` → "Approval for running fork pull request workflows from contributors" → "Require approval for all external contributors".
   - API: `repos/jung-geun/monolog/actions/permissions/fork-pr-contributor-approval`의 `approval_policy`(현재 `first_time_contributors`).
2. **PR 코드가 self-hosted runner에 닿지 않게 하기**: runner group의 저장소 제한을 쓸 수 없으므로 다음 중 하나를 한다.
   - 이 public 저장소에서 self-hosted runner를 제거하고 `docker-build.yml`을 GitHub-hosted runner로 옮긴다. UI: 저장소 `Settings` → `Actions` → `Runners`. API: `repos/jung-geun/monolog/actions/runners`.
   - 저장소를 조직 계정으로 옮기고, runner group으로 이 runner를 쓸 수 있는 저장소·워크플로우를 제한한다. UI: 조직 `Settings` → `Actions` → `Runner groups`.
3. **required status check**: ruleset `main protected`에 `Run Tests (22.x)`와 `Build Project`를 required status check로 추가한다. UI: 저장소 `Settings` → `Rules` → `Rulesets` → `main protected` → "Require status checks to pass". API: `repos/jung-geun/monolog/rulesets/15859599`. 이 설정은 `main` 반영을 게이팅한다. `v*` 태그 push로 시작되는 GHCR 발행은 branch ruleset 대상이 아니므로, 이것만으로는 발행 게이팅이 되지 않는다([게이팅](#게이팅)).

적용 전까지는 위 노출이 열려 있다.

---

## 후속 작업

- [ ] **변경 후 실측**: 머지 후 Test Suite 성공 실행을 20회 이상 모아 위 [측정 방법](#측정-방법)대로 크리티컬 패스 median·p90을 이 문서에 기록하고 기준 176s / 196s, 예측 ~115.5s / ~128s와 비교한다.
- [ ] **yarn 캐시 실험**: 병렬 실행에서 Build Project(또는 두 잡 모두)의 `cache: 'yarn'`을 제거하거나 restore-only로 바꾼 뒤 20회 이상 측정한다. 모델은 캐시 제거 시 median ~107s를 예측한다. 실측이 더 빠를 때만 바꾼다.
- [ ] **self-hosted runner 설정**: 위 [필요한 설정](#필요한-설정-미적용) 1·2를 적용하고 이 문서의 현재 설정 표를 갱신한다(소유자 작업).
- [ ] **required status check**: 위 [필요한 설정](#필요한-설정-미적용) 3을 적용한다(소유자 작업).
- [ ] **발행 게이팅**: `docker-build.yml`의 GHCR push가 같은 commit의 Test Suite 성공을 기다리게 한다([게이팅](#게이팅)). 바꾸면 계약 테스트에 이 조건을 추가한다.
- 크리티컬 패스 median이 기록된 기준보다 20% 이상 나빠지거나, 테스트 수가 크게 늘거나, 새 테스트 계층을 추가하면 같은 방법으로 다시 측정하고 가장 긴 잡부터 줄인다.
