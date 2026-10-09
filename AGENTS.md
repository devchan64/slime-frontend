# AGENTS.md
## Scope
- Web game project
- WebGL frontend
- AWS infrastructure
## Architecture
### Frontend
- Deliver static assets via **S3 + CloudFront**.
- Cache policy:
  - Use hashed filenames for immutable assets.
  - Use short TTL or invalidation for entry files (for example, `index.html`).
### Backend
- Provide API and database per service.
- Keep API versioning paths (for example, `/v1`, `/v2`).
### Deployment
- Default deployment is **Lambda + API Gateway (HTTP API)**.
- Ensure zero-downtime rollout and rollback path for both frontend and backend.
## Zero-Downtime
- DB migration order: **Expand → rollout → Contract**
- Preserve compatibility with at least one previous API version.
- Use release gates based on health checks, error rate, and latency.
## Cost (Minimum-Cost Operations)
- Target minimum cost without breaking required reliability/performance.
- Use serverless-first in early stages.
- Avoid fixed-cost resources unless clearly required.
- Maximize CDN cache hit ratio.
- Keep log/monitoring retention to the minimum required period.
- Remove idle resources regularly.
## Local Development Rules
- Local backend stack: `FastAPI + uvicorn`, `DynamoDB Local (Docker)`, optional `SAM local`.
- Separate environments by stage: `local/dev/prod`.
- Local default config must never point to production resources.
## Language Rules (Current default in this repository)
- Runtime output/comments/docstrings/markdown should be Korean-first.
- Keep identifiers (variables/functions/files), standard keywords, and AWS resource names in English.
- User/operation guidance should be Korean-first.
## Source Code Naming and Declaration Rules
- 프로젝트에서 정의하는 함수명·변수명은 의미 있는 영어 단어 **3개 이상**으로 구성한다. 파라미터와 주요 상수의 이름에도 같은 원칙을 적용한다.
- 언어 관례에 따라 `snake_case`, `camelCase`, `UPPER_SNAKE_CASE`를 사용한다. 예: `calculate_party_reward`, `currentPlayerHealth`, `FIELD_RECOVERY_PER_MINUTE`.
- 단어 수를 맞추기 위한 무의미한 접두사·접미사를 붙이지 않고 역할·대상·의미가 드러나도록 이름을 정한다.
- 주요 상수·설정값·파라미터 기본값은 사용하는 처리 로직보다 앞에 선언한다. 공통 상수는 모듈 상단 또는 전용 constants/config 모듈에 모으고 함수 안의 주요 파라미터 준비도 사용 전에 배치한다.
- 새로 작성하거나 수정하는 코드에 적용하며, 기존 전체 코드의 일괄 이름 변경은 별도 리팩터링으로 진행한다. 외부 API·DB 필드·프레임워크가 요구하는 식별자는 계약 변경 없이 임의로 바꾸지 않는다.
## Frontend Layout Rules
- Do not hard-code layout constants inside frequently called functions.
- Manage layout values as top-level constants or in a dedicated `constants` module.
- Layout functions should only combine constants and compute derived values.
## Commit Message Rules
- All commit messages must follow **Conventional Commits**.
- Default format: `type(scope): description` or `type: description`.
- `type`과 선택적 `scope`는 영어로 작성하고, 설명(description)과 본문(body)은 한국어로 작성한다. 코드 식별자·표준 용어·고유명은 원문 표기를 유지한다.
- 예: `feat(party): 파티원 보상 분배 규칙 추가`.
- AGENTS.md-related commits follow the same rule.
## Image Commit Rules
- For image commits, verify only:
  - File exists
  - Filename matches
  - Destination path matches
## Test and Script Maintenance
- 로컬 반복 검증은 `node scripts/run-regression.mjs tests/<대상>.test.mjs`로 관련 검사만 실행한다. 번역·전체 타입 검사까지 필요하면 `--with-checks`를 명시한다. 배포 빌드의 필수 검사는 유지하며 선택 검사 결과를 전체 검증 완료로 보고하지 않는다.
- 테스트·스크립트는 실제 회귀 위험과 반복 운영 필요를 해결할 때만 추가한다. 작업 완료 증빙이나 검사 수 증가만을 위한 영구 파일은 만들지 않는다.
- 추가 전에 기존 테스트·fixture·실행 명령·CI·스크립트를 검색하고 재사용 또는 확장을 우선한다. 같은 목적의 파일·실행기·명령 래퍼를 작업별·날짜별로 복제하지 않는다.
- 새 테스트는 보호할 사용자 동작·API 계약·실제 장애 재현 조건과 기존 검사로 잡지 못하는 실패를 명확히 한다. 구현 로직을 그대로 복제하거나 소스 문자열·함수명·내부 호출 순서의 존재만 확인하는 테스트는 추가하지 않는다. 정적 구조 자체가 명시적인 계약인 경우에만 그 근거를 설명한다.
- 문구·문서·단순 스타일·에셋 경로 등 영향이 작고 되돌리기 쉬운 변경은 기존 검사와 필요한 수동 확인으로 검증한다. 전용 테스트·스냅샷·검증 스크립트를 자동으로 추가하지 않는다. 동작·계약 위험이 있으면 해당 위험에 필요한 최소 검사를 보강한다.
- 같은 실패를 여러 계층에서 중복 검사하지 않는다. 가장 작고 안정적인 테스트 계층을 우선하고, 통합·브라우저 검사는 계층 간 연결이나 핵심 사용자 흐름을 검증할 필요가 있을 때만 추가한다. 유사 사례는 기존 테스트의 파라미터·fixture를 확장한다.
- 영구 스크립트는 반복 실행할 개발·배포·운영 절차와 호출 위치가 명확할 때만 추가한다. 기존 도구의 옵션이나 표준 명령으로 충분하면 별도 실행기·래퍼·병렬 실행 체계를 만들지 않는다. 목적·사용 명령·유지 필요성은 기존 사용 문서에 간단히 기록한다.
- 일회성 조사·디버깅·마이그레이션 보조·스크린샷 수집 코드는 Git에서 제외된 `.tmp/`에 두고 정식 테스트·스크립트 경로에 남기지 않는다. 실행 로그·스크린샷·임시 fixture도 자동으로 Git에 추가하지 않는다. 재사용이 필요해지면 위 기준을 충족할 때 정식 코드로 옮긴다.
- 관련 기능을 교체·삭제할 때는 그 변경으로 불필요해진 테스트·fixture·스크립트와 CI·패키지 명령·문서 참조를 함께 정리한다. 삭제 전 호출처와 보호하던 동작을 확인하고 필요한 회귀 검증은 유지한다. 현재 작업과 무관한 파일이나 사용자의 진행 중 변경은 임의로 정리하지 않는다.
- 검증은 변경 영향에 맞는 기존 명령으로 실행한다. 필수 CI·배포 검사는 유지하되, 통과 후 새 변경·실패·미해결 위험이 없으면 같은 검사나 전체 검사를 반복하지 않는다. 자동화·로그 규칙은 기존 실행기를 재사용하는 기준이며 작업마다 새 실행기를 만들라는 의미가 아니다.
- 변경 보고에는 추가·확장한 테스트와 영구 스크립트의 필요성, 기존 것으로 충족하지 못한 이유, 실행한 검증을 간단히 설명한다. 문서만 수정한 경우에는 문서 차이·형식 확인으로 마치며 새 테스트나 검사 스크립트를 만들지 않는다.

## Script Logging Rules
- Workflow scripts must emit stepwise trace logs.
- Keep a consistent log format including `timestamp/area/stage`.
- On failure, print failing line/command via `trap` or equivalent.
- Long-running jobs must emit heartbeat logs at least every **5 seconds**.
- Heartbeat should include progress summary; during stalls include recent logs/line count/warnings and resource/artifact changes.
- Persist execution logs to file and print tail on failure.
## Security/Ops Baseline
- Never commit secrets.
- Enforce least-privilege IAM.
- Maintain alerts, dashboards, and runbooks.
- Never store secrets/tokens/sensitive keys in `env` files including `.env.local`.
- Keep repository/workflows/tests free from `OPENAI_API_KEY` dependency.
## Change Management
- Explain architecture/deployment/cost-impacting changes against this document.
- For exceptions, document reason, duration, and mitigation.
- Default image commit review is filename/path check only.
## Workflow Model Policy
- Nodes must not select models from user input.
- Model selection must be fixed by code/pipeline configuration.
- Use `.model` only as model download/cache directory.
- Validate model input/output schemas strictly; fail fast on violations.
- Accept only allowed output formats; disallow permissive recovery parsing.
- If rules conflict, model card I/O policy takes precedence.
- For Musician-Llama nodes, prioritize natural-language input + pipe/comma MIDI tuple contract.
- CPU inference is not allowed; fail immediately when GPU (CUDA/MPS) is unavailable.
- GPU 상태 확인·모델 준비·GPU 추론은 샌드박스 밖에서 실행한다. 샌드박스 내부 접근 실패를 GPU 부재로 판단하지 않으며, 외부 실행에서도 GPU를 사용할 수 없을 때 명확한 원인으로 즉시 실패한다.
- All music pipelines must prepare model artifacts before execution.
- If prepare fails, fail immediately (no fallback) and print `model_id/model_root(or download_tmp_dir)/model_path(or bundle)/binary path` to stdout.
- On successful prepare, log resolved output path and reuse it in runtime.
- MIDI node defaults:
  - `MUSIC_MIDI_COMPOSER_MODEL_ID=Ghanibhuti/Musician-Llama-3.2-1B-Instruct`
  - `TEXT2MIDI_MODEL_ROOT=.model/music_midi_composer`
- Recommended model prepare entrypoints:
  - Ollama: `workflow.nodes.music_structure_plan.runtime.prepare`
  - Magenta: `workflow.nodes.music_midi_generate.runtime.prepare`
## Fail-Fast Rules
- Do not add/keep fallback logic by default.
- Unsupported input/missing dependency/invalid state must fail fast with explicit root-cause exception.
- Prefer explicit exceptions over implicit failure return values.
- Quality threshold misses (for example MIDI diversity) are not hard failures; record as `WARN` + `quality_warnings` and continue.
- Final quality approval is the user’s responsibility.
## Repository Boundary
- 이 저장소의 책임은 WebGL 프론트엔드 구현이다.
- 다른 저장소의 소스 또는 상대 경로를 런타임 의존성으로 사용하지 않는다.
- 프론트엔드와 백엔드는 버전이 있는 HTTP API로 연결한다.
- 워크플로우 산출물은 검수 후 명시적으로 전달하며 프론트엔드에 직접 쓰지 않는다.
## Integrated Review Tool
- 사용자 검수는 `slime-workflow/tools/review/serve.py`가 제공하는 단일 관리도구 진입점에서 수행한다.
- 애니메이션, 타일 후보, 게임 UI, 기존 웹 검수 페이지는 같은 관리도구의 검색·분류·이동 화면에 통합한다.
- 개별 검수 HTML과 템플릿은 관리도구가 표시하는 내부 페이지 또는 생성 산출물이며, 사용자에게 독립 실행 경로로 제공하지 않는다.
- 관리도구는 검수 대상의 명시적 사본과 해시 기록만 사용하며, 프론트엔드 소스를 런타임 의존성으로 직접 로드하지 않는다.
## Design Document Ownership
- SLIME의 기획·설계 문서는 비공개 `slime-backend/docs/design/`에서만 작성·관리한다.
- 공개 `slime-frontend`와 `slime-workflow`에는 설계 문서 원본·복제본·요약본을 커밋하지 않는다.
- 공개 저장소는 구현·실행·검증에 필요한 기술 사용 설명만 관리하며 비공개 문서를 런타임 의존성으로 삼지 않는다.
## Base Data Format
- 프로젝트의 기본 데이터·콘텐츠 테이블·설정 파일은 JSON보다 YAML(`.yaml`)을 우선 사용한다.
- 동일 데이터의 YAML·JSON 원본을 중복 관리하지 않는다.
- 데이터 로딩 시 필수 필드·자료형·허용 값·알 수 없는 필드·중복 키를 엄격히 검증하고, 오류는 명확한 원인과 함께 즉시 실패시킨다.
- API 요청·응답, DB 저장 표현, 도구·표준이 요구하는 JSON 파일과 생성 산출물은 해당 계약을 유지한다. 예: `package.json`, `tsconfig.json`, glTF 및 에셋 sidecar.
- 기존 파일은 관련 작업에서 소비 코드·검증·배포 구성을 함께 변경할 때 전환하며, 확장자만 일괄 변경하지 않는다.
## Map Tile Asset Ownership
- 맵 타일 에셋(지면·벽·지붕·문 등)의 유일한 관리 원본은 `slime-assets/assets/tiles/`이며, 관리 ID·버전·경로·출처·SHA-256은 `slime-assets/asset-registry.yaml`에서 관리한다. 일반 이미지 소유권·후보 등록 규칙보다 이 규칙을 우선한다.
- 사용자가 채택한 맵 타일은 `slime-assets`에 먼저 등록한다. 생성·크롭·후보·로그는 `slime-workflow`에서 관리하고, 승인된 원본 또는 크롭 중 사용자가 선택한 결과만 전달한다.
- 프론트엔드와 관리도구는 모두 맵 타일 원본을 `slime-assets/assets/tiles/`와 `asset-registry.yaml`에서 직접 참조한다. 에셋 준비·빌드·검수 게시 단계에서 에셋 저장소의 등록 경로·버전·SHA-256으로 원본을 확인하고 가져온다. 관리도구가 프론트엔드 사본을 원본으로 읽거나, 프론트엔드가 관리도구 산출물을 원본으로 읽는 우회 참조를 금지한다.
- `slime-frontend/assets/terrain/`과 `assets/world/`는 게임 빌드용 전달 사본이다. `map-assets.lock.yaml`에 에셋 저장소의 원본 경로·SHA-256을 기록하고 사본을 직접 편집하지 않는다. 사본은 배포 수단이며 원본 선택·등록·갱신의 기준이 될 수 없다.
- 관리도구의 맵 타일 카탈로그와 검수 게시기는 `slime-assets`의 등록 에셋을 원본으로 연결하며 게시 사본에 출처·버전·해시를 보존한다. 게임 브라우저와 검수 화면에는 각자 준비한 정적 파일을 제공하고 다른 저장소의 로컬 경로를 런타임 의존성으로 노출하지 않는다. 이 배포 분리는 두 소비자가 에셋 저장소의 원본을 직접 참조해야 한다는 규칙의 예외가 아니다.
- 특정 마을·건물에 타일 적용을 지시받으면 게임의 타일 선택과 관리도구 검수의 카탈로그·건물별 매핑·게시 산출물을 함께 갱신하고, 양쪽에서 동일한 에셋 버전·해시를 사용하는지 확인한다. 게임에만 적용한 상태를 검수 화면까지 반영한 것으로 보고하지 않는다.
- 맵 타일 이미지와 맵 배치·통행·건물 데이터를 구분한다. 백엔드의 맵 데이터 소유권은 유지하며, 캐릭터 스프라이트 등 다른 에셋의 이관은 별도 지시 없이 확대하지 않는다.

## Asset Generation and Output Ownership
- `slime-workflow`는 에셋 생성 방식·모델 준비·제작 노드·파이프라인·검증·export를 관리한다.
- 맵 타일과 아래 Sprite Asset Ownership 대상 스프라이트를 제외한 최종 전달 이미지·프레임·시트 등 에셋의 관리 원본은 `slime-frontend`에 둔다. 에셋 보관과 게임 런타임 채택은 구분한다.
- 생성 과정의 중간 결과물(관절 모션·SMPL 피팅 결과·Depth·마스크·보정 전 프레임 등)은 `slime-workflow`에 보관한다. 실행별 경로와 출처를 유지하고 최종 전달 에셋과 구분한다.
- MoMask 모션과 SMPL 피팅 산출물은 `slime-workflow`의 재사용 가능한 제작 자산이다. 실행별 임시 파일로 취급하지 않고 식별자·불변 버전·출처·호환 정보를 관리하며 캐시 정리로 삭제하지 않는다.
- 동일 모션·피팅 산출물을 방향별 렌더와 호환되는 외형 생성에 재사용한다. 리그·관절·체형·좌표계·단위·프레임률 등의 호환 조건이 달라지면 재검증하고 필요 시 새 버전으로 피팅한다.
- 실행 기록은 재사용 자산의 식별자·버전·해시를 참조한다. 모델 다운로드·캐시만 `.model`에 두고 재사용 자산·실행 산출물·임시 캐시의 보관 경로와 정리 정책을 구분한다.
- 비공개 기획·설계·내부 프롬프트는 `slime-backend/docs/design/`에서 관리하고 공개 에셋과 함께 복제하지 않는다.
## Unregistered Asset Experiments
- 정식 등록 전 후보·실험 에셋은 해당 저장소의 `.tmp/YYYY-MM-DD_HH-mm-ss/`에 생성한다. 폴더명은 실험 시작 시각의 한국 시간(Asia/Seoul)을 사용하며 기존 실험 결과를 덮어쓰지 않는다.
- 날짜시간 폴더 안에 실험 프롬프트, 참조 이미지, 생성 결과, 실행 로그와 모델·파라미터·출처 기록을 함께 보관한다. 실험 프롬프트는 `.tmp`에서 작성·수정하고 커밋하지 않는다. 정식 채택된 제작 프롬프트·설계 문서는 `slime-backend/docs/design/`에서 관리한다.
- 후보 이미지는 정식 에셋 폴더·에셋 레지스트리·게임 런타임에 자동 등록하지 않는다. 사용자가 채택 또는 정식 등록을 지시하면 맵 타일은 위 Map Tile Asset Ownership 규칙에 따라 `slime-assets`에 등록하고, 그 밖의 선택한 산출물은 `slime-frontend`의 정식 경로로 옮기거나 복사하고 등록한다.
- `.tmp/`는 각 저장소의 `.gitignore`에 등록하며 후보·실험 산출물은 커밋하지 않는다.
- 이 규칙은 정식 등록되지 않은 후보·실험 에셋에 적용한다. 재사용 가능한 MoMask 모션·피팅·승인된 리그 및 버전이 고정된 제작 자산은 기존 보관 정책을 유지하며 `.tmp` 정리 대상에 포함하지 않는다.
- 재사용 근거가 없고 폐기된 실험 프롬프트는 삭제한다. 현재 실행·재사용 근거가 확인된 제작 방식·정식 채택 에셋의 출처 기록만 유지하며 동일 프롬프트의 불필요한 복사본을 남기지 않는다.

## Sprite Asset Ownership
- 캐릭터·몬스터 스프라이트시트와 애니메이션·앵커·재생 메타데이터의 관리 원본은 `slime-assets/assets/sprites/`이며 `asset-registry.yaml`에서 ID·불변 버전·출처·SHA-256을 관리한다.
- 프론트엔드의 등록된 `assets/characters/`·`assets/monsters/` 파일은 전달 사본이다. `sprite-assets.lock.yaml`에 원본 경로·해시를 고정하고 개발·빌드·검수 준비 시 에셋 저장소에서 검증해 가져온다. 전달 사본을 직접 편집하지 않는다.
- 관리도구도 등록된 스프라이트 원본과 재생 메타데이터를 에셋 저장소에서 검증하여 게시하며 이미지·메타데이터 출처와 해시를 보존한다. 브라우저에는 게시 사본을 제공한다.
- 신규 채택·수정은 에셋 저장소에 먼저 등록하고 잠금 목록과 소비자를 함께 갱신한다. 생성 중간 프레임·후보·로그·모델은 워크플로우의 기존 보관 정책을 유지한다.
- 이번 이관은 등록된 캐릭터 애니메이션 시트와 몬스터 스프라이트에 한정한다. 개별 승인 프레임·외형 기준 이미지·제작 프롬프트는 포함하지 않는다. 채택된 캐릭터 컷인은 `slime-assets/assets/sprites/characters/<캐릭터>/cutins/`에서 원본을 관리하며 스프라이트 잠금 목록으로 전달한다.

## Generated Asset Copies
- `map-assets.lock.yaml`·`sprite-assets.lock.yaml`에 등록된 전달 사본은 프론트 Git에 커밋하지 않는다. 원본은 `slime-assets`에서만 추적하며 `.gitignore`에 전달 경로를 등록한다. 개발·빌드·검수 준비 단계에서만 사본을 생성한다. 새 잠금 항목과 제외 경로를 함께 갱신한다.

## Structure Sprite Ownership
- 구조물 스프라이트 원본은 `slime-assets/assets/sprites/structures/`에서 관리한다.
- `assets/structures/`의 등록 파일은 `sprite-assets.lock.yaml`로 해시를 고정한 빌드용 전달 사본이며 Git에서 제외한다. 기존 스프라이트 준비·검증 명령으로 가져온다.

## Direct Asset Consumption
- 에셋 원본은 인접 `slime-assets/assets/`를 직접 참조한다. 프론트엔드의 `src/assets/`·`assets/` 전달 사본은 폐기한다. 위 전달 사본 규칙보다 이 규칙이 우선한다.
- 잠금 목록의 `path`는 논리 식별 경로이며 `source_path`와 SHA-256으로 원본을 검증한다. 준비 명령은 사본을 생성하지 않는다. UI 이미지·라벨·컷인 설정도 `assets/ui/`에서 관리하며 `ui-assets.lock.yaml`로 검증한다.
- Vite 개발 서버는 원본을 제공하고 배포 빌드는 해시 파일명으로 정적 파일을 번들링한다. 배포 후에는 로컬 저장소 경로에 의존하지 않는다.

## Building Tile Material Organization
- 문·지붕·벽 타일은 마을과 무관한 공용 에셋이며 `slime-assets/assets/tiles/buildings/<material>/`에서 관리한다. 마을별·common·door·roof·wall 하위 폴더를 만들지 않는다.
- 재질은 `wood`, `stone`, `red-stone`, `marble` 등으로 구분한다. 마을·건물별 선택은 맵 설정에서 관리하며 같은 원본을 복제하지 않는다. 기존 관리 ID·버전·출처·SHA-256은 경로 이전 시 유지한다.

## Terrain Tile Organization
- 지형 타일은 `slime-assets/assets/tiles/terrain/road/`(도로)·`slime-assets/assets/tiles/terrain/non-road/`(통행 가능한 비도로)·`slime-assets/assets/tiles/terrain/blocked/`(진입 불가)로 구분한다. 도로에는 흙길·벽돌길·석판·포장 타일을, 비도로에는 풀·노출 바위 지면 등을, 진입 불가에는 물·큰 바위·나무 밑동·절벽 벽면을 둔다. 실제 셀 통행 판정은 백엔드 맵 데이터를 따른다. 마을별 하위 경로는 만들지 않는다.
- 경로 변경 시 등록부·잠금 목록·게임과 검수 참조를 함께 갱신하고 기존 ID·버전·출처·SHA-256을 유지한다.

## Map Original Direct Consumption
- 맵 배치·통행·연결·시작점·이름의 관리 원본은 `slime-assets/assets/maps/`다. 기존 백엔드 `config/`의 맵 원본 및 워크플로우 검수용 맵 JSON 사본은 폐기한다. 위 맵 데이터 소유권·검수 게시 사본 규칙보다 이 규칙이 우선한다.
- 백엔드는 `map-data.lock.yaml`으로 해시를 검증하여 원본을 직접 읽고 버전이 있는 HTTP API로 게임에 제공한다. 관리도구도 에셋 등록부의 동일 원본 YAML과 타일 이미지를 직접 읽어 제공하며 맵·타일 사본을 만들지 않는다.
- 설계 문서와 생성·컴파일 결과는 기획·후보 자료다. 원본 갱신은 에셋 저장소 등록부와 소비자 잠금 목록을 함께 수정한다. 배포 시 원본 경로는 `SLIME_MAP_ASSET_ROOT`로 명시하며 누락 시 즉시 실패한다.

## Character Asset Organization
- 캐릭터 원본은 `assets/characters/<character>/animations/`, `battle-cutins/`, `emotion-cutins/`로 구분한다. 기본 캐릭터는 `default`다. 이 규칙은 기존 `assets/sprites/characters/` 경로보다 우선한다.
- 애니메이션 시트·재생·앵커·출처 메타데이터와 불변 버전은 `animations/`에서 함께 관리한다. 전투 컷인과 감정 컷인은 각각의 폴더에 두며, 아직 에셋이 없는 폴더는 `.gitkeep`으로 유지한다.
- 경로 이전 시 관리 ID·버전·이미지 해시·과거 출처를 유지하고 등록부·프론트엔드 잠금 목록·직접 참조·관리도구를 함께 갱신한다. 몬스터·구조물 경로는 유지한다.

## Shared Map Renderer Ownership
- 필드·마을 렌더러의 소스 관리 주체는 `slime-frontend`다. 게임과 관리도구는 프론트엔드가 소유한 공용 렌더러를 단일 원본으로 사용한다.
- 공용 진입점은 `packages/field-renderer/`이며, 이 패키지가 사용하는 `src/game/terrain/`의 구현도 프론트엔드 소유다. 지형·건물·타일 선택·경계선·깊이·투영·렌더링 속성의 수정은 이 원본에서 수행한다. 같은 규칙을 관리도구에 별도로 구현하지 않는다.
- 관리도구의 `ui/map/vendor/field-renderer/`는 버전이 고정된 빌드 산출물이다. 직접 편집하거나 별도 소스 원본으로 관리하지 않는다. 프론트엔드에서 버전 증가·빌드 후 manifest와 함께 전달하고 소비 버전 및 SHA-256을 검증한다.
- 관리도구는 맵·에셋 조회, 검수 UI, 카메라 조작, 선택·캡처, 렌더 객체 수명 연결을 담당한다. 독립 렌더링 규칙이나 상수를 추가하지 않는다. 기존 어댑터의 중복 타일 선택·그리기 규칙을 변경할 때에는 프론트엔드 공용 함수로 통합한다.
- 맵·타일 관리 원본은 계속 `slime-assets`다. 렌더러 소유권 변경을 이유로 원본 에셋이나 맵을 프론트엔드·관리도구에 복제하지 않는다. 검수 실행 시 다른 저장소 소스를 직접 import하거나 빌드하는 런타임 의존성을 만들지 않는다.

- 관리도구에는 최신 채택 배포본 하나만 전달하고 과거 버전은 Git 이력에 보존한다. 소비 버전은 배포 manifest에서 읽으며 별도 field-surface vendor는 유지하지 않는다.
