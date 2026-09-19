#!/usr/bin/env bash
set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/script_logging.sh"

# 프론트엔드 로컬 개발 환경 준비 스크립트
# - 의존성 설치

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR"

log() { echo "[$(date '+%H:%M:%S')][프론트준비] $1"; }
step() { echo "[$(date '+%H:%M:%S')][프론트준비][단계 $1] $2"; }

log "프론트엔드 로컬 환경 준비를 시작합니다."
step "1/2" "필수 명령 존재 여부를 확인합니다."

if ! command -v npm >/dev/null 2>&1; then
  log "오류: npm을 찾을 수 없습니다. Node.js 설치를 확인해 주세요."
  exit 1
fi

cd "$FRONTEND_DIR"

step "2/2" "npm 의존성을 설치합니다."
npm ci

log "프론트엔드 로컬 환경 준비가 완료되었습니다."
