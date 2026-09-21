#!/usr/bin/env bash
# 검수 전용 빌드의 로그와 진행 상태를 기록한다.
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/script_logging.sh"
cd "$SCRIPT_LOG_ROOT"
export UI_REVIEW_SOURCE_COMMIT="$(git rev-parse HEAD)"
if [[ -n "$(git status --porcelain)" ]]; then
  export UI_REVIEW_SOURCE_DIRTY=true
else
  export UI_REVIEW_SOURCE_DIRTY=false
fi
node scripts/build-ui-review.mjs
