#!/usr/bin/env bash
# 배포 빌드의 준비·검증·번들 생성과 종료 결과를 공용 로그에 보존한다.
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/script_logging.sh"
cd "$SCRIPT_LOG_ROOT"
npm run build
