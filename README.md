# slime-frontend

Preact + TypeScript + Phaser(WebGL) 기반 SLIME 클라이언트다.

## 현재 상태
- 로그인·캐릭터 저장 API 연동과 준비 중 화면을 제공한다.
- 게임 플레이는 준비 중 상태다.
- 게임 설계는 [비공개 백엔드 문서](https://github.com/devchan64/slime-backend/tree/main/docs/design)에서 관리한다. 접근 권한이 필요하다.
- 이 공개 저장소에는 설계 문서나 복제본을 작성하지 않는다.

## 독립 실행
Node.js 22와 npm을 사용한다. 이 저장소 루트에서 실행한다.

```bash
npm ci
npm run dev
npm run build
```

- 프론트엔드: `http://127.0.0.1:8080`
- 기본 API: `http://127.0.0.1:18080`
- API 주소 변경: `VITE_API_BASE_URL=http://127.0.0.1:18080 npm run dev`
- Vite 변수는 브라우저에 공개되므로 비밀값을 넣지 않는다.
- 실행 스크립트: `scripts/local_frontend_setup.sh`, `scripts/local_frontend_run.sh`, `scripts/local_frontend_down.sh`

## 저장소 경계와 배포
- [백엔드](https://github.com/devchan64/slime-backend)와 `/v1` HTTP API로 연결한다. 백엔드 소스가 로컬에 없어도 빌드할 수 있다.
- [워크플로우](https://github.com/devchan64/slime-workflow)의 검수된 자산만 전달받는다. 제작 모델은 클라이언트 의존성이 아니다.
- `dist/`를 S3 + CloudFront로 배포한다. 해시 자산은 immutable, 진입 파일은 짧은 TTL 또는 무효화를 사용한다.
- 배포 시 이전 자산과 버전을 보존해 롤백할 수 있게 한다. 저장소 분리 자체로 AWS 리소스를 추가하지 않는다.

## 라이선스와 사용자 수정

- 프론트엔드 코드는 [MIT](LICENSE)로 수정·재배포할 수 있다.
- 프로젝트 에셋은 [CC BY 4.0](ASSET_LICENSE.md)을 적용한다. 현재 새 에셋 팩은 준비 중이다.
- 저장소를 fork하고 UI·입력·시각 자산을 수정하여 `npm ci`, `npm run dev`, `npm run build`로 실행·빌드할 수 있다.
- API 주소는 `VITE_API_BASE_URL`로 설정한다. 수정한 클라이언트에도 서버의 인증·권한·명령 검증이 적용된다.
- 새 게임 프로토콜과 에셋 팩은 미구현이며, 공개 라이선스 적용이 게임 기능 완료를 의미하지 않는다.
