#!/usr/bin/env bash
set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/script_logging.sh"

# 프론트엔드 로컬 실행 스크립트

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR"
FRONTEND_PORT=8080

log() { echo "[$(date '+%H:%M:%S')][프론트실행] $1"; }
step() { echo "[$(date '+%H:%M:%S')][프론트실행][단계 $1] $2"; }

step "1/3" "사전 준비 스크립트를 실행합니다."
"$ROOT_DIR/scripts/local_frontend_setup.sh"

cd "$FRONTEND_DIR"

step "2/3" "Vite 개발 서버 실행 준비를 완료했습니다."
step "3/3" "포트 바인딩 가능 여부를 사전 확인합니다. (127.0.0.1:${FRONTEND_PORT})"
if ! python3 - "$FRONTEND_PORT" <<'PY'
import socket
import sys

port = int(sys.argv[1])
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    s.bind(("127.0.0.1", port))
except OSError:
    sys.exit(1)
finally:
    s.close()
PY
then
  log "오류: 127.0.0.1:${FRONTEND_PORT} 포트 바인딩 권한이 없습니다(EPERM)."
  log "안내: 다른 로컬 터미널에서 실행하거나, 실행 앱의 로컬 네트워크 권한/보안 설정을 확인해 주세요."
  exit 1
fi

step "4/4" "Vite 개발 서버를 시작합니다. (http://localhost:${FRONTEND_PORT})"
log "종료하려면 Ctrl+C를 입력하세요."
npm run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT"
