#!/usr/bin/env bash
# 운영 컨테이너를 변경하지 않고 격리된 검증 이미지 빌드와 nginx 설정을 검사한다.
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/script_logging.sh"
cd "$SCRIPT_LOG_ROOT"
CURRENT_BUILD_TIMESTAMP="$(TZ=Asia/Seoul date '+%Y-%m-%d_%H-%M-%S')"
CURRENT_OUTPUT_DIRECTORY="$SCRIPT_LOG_ROOT/.tmp/test/frontend-docker-build/$CURRENT_BUILD_TIMESTAMP"
CURRENT_VALIDATION_IMAGE="slime-frontend-validation:$CURRENT_BUILD_TIMESTAMP"
mkdir -p "$CURRENT_OUTPUT_DIRECTORY"
docker compose -f docker-compose.local.yml config --quiet
docker build --build-context slime-assets=../slime-assets \
  --build-arg "VITE_API_BASE_URL=${VITE_API_BASE_URL:-}" \
  --build-arg "VITE_IDENTITY_API_BASE_URL=${VITE_IDENTITY_API_BASE_URL:-}" \
  --iidfile "$CURRENT_OUTPUT_DIRECTORY/image-id.txt" -t "$CURRENT_VALIDATION_IMAGE" .
docker run --rm --network none "$CURRENT_VALIDATION_IMAGE" nginx -t
docker run --rm --network none --entrypoint sh "$CURRENT_VALIDATION_IMAGE" -c '
  set -eu
  test ! -e /slime-assets
  test -f /usr/share/nginx/html/index.html
  if [ -n "$1" ]; then grep -Fl -- "$1" /usr/share/nginx/html/assets/*.js >/dev/null; fi
  if [ -n "$2" ]; then grep -Fl -- "$2" /usr/share/nginx/html/assets/*.js >/dev/null; fi
' verify-built-addresses "${VITE_API_BASE_URL:-}" "${VITE_IDENTITY_API_BASE_URL:-}"
printf '%s\n' "$CURRENT_VALIDATION_IMAGE" > "$CURRENT_OUTPUT_DIRECTORY/passed-image.txt"
