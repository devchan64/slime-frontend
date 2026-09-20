# 캐릭터 에셋 파일

이 디렉터리에서 캐릭터 이미지 산출물을 관리한다. 생성 도구와 파이프라인 구현은 `slime-workflow`에서 관리한다.

| 경로 | 내용 | 사용 상태 |
|---|---|---|
| `default-v1.png` | 기존 기본 캐릭터 | 기존 화면용 파일 보존 |
| `character-default-white-shirt-v1.png` | 기본 외형 단일 이미지 | 런타임 미연결 |
| `character-default-white-shirt-four-directions-v1/` | 방향별 정지 이미지 4개 | 이전 정지 이미지 보존 |
| `character-default-white-shirt-standing-v1/` | 4방향×4프레임 스탠딩 시트·반복 메타데이터 | 필드·전투의 4방향 스탠딩 반복 재생 |
| `character-default-white-shirt-walk-v1/` | 방향별 4열×2행 걷기 시트 초안 | 보행·정렬 보정 필요, 런타임 사용 금지 |

방향 파일명은 `down_left.png`, `down_right.png`, `up_left.png`, `up_right.png`다. 걷기 초안의 실제 해상도는 1774×887이며 정수 크기의 균등 셀로 바로 나눌 수 없다. 발 교대·팔 스윙·프레임 정렬과 연속 재생을 검수한 후 별도 버전으로 런타임에 등록한다.

파일을 보관하는 것만으로 게임에 등록되지 않는다. 채택한 파일은 프론트엔드 로더에서 명시적으로 참조한다. 비공개 설계와 내부 생성 프롬프트는 이 디렉터리에 포함하지 않는다.
