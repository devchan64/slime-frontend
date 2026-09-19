#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/script_logging.sh"
cd "$SCRIPT_LOG_ROOT"
if [[ ! -x node_modules/.bin/vite ]]; then
  printf '%s/run/error 먼저 bash scripts/local_frontend_setup.sh 를 실행하세요.\n' "$(date -Iseconds)" >&2
  exit 1
fi
printf '%s/run/start Vite HMR: http://localhost:8080 (빌드 없음, Ctrl+C 종료)\n' "$(date -Iseconds)"
npm run dev
