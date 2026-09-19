#!/usr/bin/env bash
set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/script_logging.sh"

# 프론트엔드 로컬 종료 안내 스크립트

log() { echo "[$(date '+%H:%M:%S')][프론트정리] $1"; }

log "프론트엔드 개발 서버는 실행 중인 터미널에서 Ctrl+C로 종료합니다."
log "추가 정리 작업은 없습니다."
