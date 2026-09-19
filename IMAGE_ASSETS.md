# 이미지 에셋 관리

`image-assets.yaml`에서 모든 저장소 이미지의 `managementId`와 `path`를 관리합니다. `src/`와 `public/`의 PNG·WebP·JPEG·SVG·ICO 등 이미지가 대상이며 현재 미사용인 이전 버전도 등록합니다. 의존성, 빌드 산출물은 대상이 아닙니다.

```yaml
managementId: registry.images.frontend
data:
  version: 1
  images:
    - managementId: image.frontend.src.assets.characters.default-v1.png
      path: src/assets/characters/default-v1.png
```

- 새 이미지는 고유한 관리 ID와 저장소 상대 경로를 등록합니다. ID 형식은 소문자·숫자를 점·하이픈으로 연결합니다.
- 파일 이동·이름 변경 시 ID는 그대로 두고 `path`만 수정합니다. ID는 빌드 해시나 런타임 URL이 아닙니다.
- 별도로 보관하는 새 버전·해상도·포맷은 별개 파일이므로 새 ID를 부여합니다. 삭제 시 목록에서도 제거합니다.
- 생성 이력 파일의 경로·프롬프트는 이력을 위한 정보입니다. 관리 ID의 원본은 이 목록 하나입니다.
- `npm run check:images`로 누락·중복 ID, 중복 경로, 파일 부재, 잘못된 경로, 미등록 이미지를 검사합니다. `npm run build`에도 포함됩니다.
- 검사 로그는 `node_modules/.cache/image-assets.log`에 누적됩니다. 이미지를 해석하거나 픽셀 품질을 검사하지 않습니다.

이미지 파일·화면·기존 URL은 변경하지 않습니다. Vite의 해시 파일명과 기존 정적 배포를 유지합니다.
