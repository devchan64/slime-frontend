# 기본 캐릭터 에셋

- 외형 제작 기준 원본: `slime-workflow/assets/animation-references/character-default/baseline-source-v2/`.
- `idle-v6/`: 현재 맵 대기·설정 초상화 시트와 재생 메타데이터.
- `rest-v2/`: 휴식 시트와 재생 메타데이터.
- `cutins/`: 기본 펀치 Action Cut-in.

파일명·버전·이미지 관리 ID는 유지한다. 생성 실험은 이 경로에 저장하지 않는다. 신규 미채택 후보만 워크플로우 `.tmp`에 보관한다.

- `walk-v2/`: 현재 앵커 보정 버전 `2026-09-29_23-57-11-7cd2df31`의 걷기 전달 사본. 4방향×6프레임, 384px 셀, 4FPS.

게임에는 현재 채택 버전만 둔다. `sprite-assets.lock.yaml`이 지정한 `slime-assets` 원본에서 준비하며, 폐기한 걷기 시트·개별 보정 프레임은 게임에 보관하지 않는다.
