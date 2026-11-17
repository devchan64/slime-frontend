#!/usr/bin/env bash
# 개발·서비스 빌드 관리의 공통 진입점.
set -Eeuo pipefail
frontend_script_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
print_frontend_command_help() {
  cat <<'HELP'
사용: bash scripts/frontend.sh <dev|service> <명령> [옵션]

dev: setup (의존성 설치), start (개발 서버), stop (종료 안내), test (회귀 검사)
service: build (검증 빌드), preview (빌드 미리보기), browser-check (배포 빌드 브라우저 검사), docker-check (Docker 빌드 검증)
도움말: bash scripts/frontend.sh help [dev|service [명령]]
명령별: bash scripts/frontend.sh <그룹> <명령> --help
service는 로컬 빌드·검증이며 운영 배포를 수행하지 않습니다.
HELP
}
print_frontend_group_help() {
  case "$1" in
    dev) printf '%s\n' '사용: bash scripts/frontend.sh dev <setup|start|stop|test> [옵션]' ;;
    service) printf '%s\n' '사용: bash scripts/frontend.sh service <build|preview|browser-check|docker-check>' ;;
    *) printf '알 수 없는 그룹: %s\n' "$1" >&2; return 2 ;;
  esac
}
print_frontend_action_help() {
  case "$1:$2" in
    dev:setup) printf '%s\n' '사용: bash scripts/frontend.sh dev setup' 'npm ci로 잠금 파일 기준 의존성을 설치합니다.' ;;
    dev:start) printf '%s\n' '사용: bash scripts/frontend.sh dev start' '포트 충돌 확인 후 Vite 개발 서버를 실행합니다. Ctrl+C로 종료합니다.' ;;
    dev:stop) printf '%s\n' '사용: bash scripts/frontend.sh dev stop' '개발 서버의 Ctrl+C 종료 방법을 안내합니다.' ;;
    dev:test) cat <<'HELP'
사용: bash scripts/frontend.sh dev test [--with-checks] tests/<대상>.test.mjs [추가 대상...]
--with-checks는 맨 앞에 지정하며 번역·TypeScript 검사도 수행합니다.
tests/ 아래의 존재하는 .test.mjs 파일만 허용하며 여러 파일을 지정할 수 있습니다.
예: bash scripts/frontend.sh dev test --with-checks tests/field-navigation.test.mjs
결과와 로그: .tmp/test/frontend-regression/<한국 시각>/
HELP
      ;;
    service:build) printf '%s\n' '사용: bash scripts/frontend.sh service build' '에셋·번역·타입 검사와 배포 빌드를 실행하고 로그를 저장합니다.' ;;
    service:preview) printf '%s\n' '사용: bash scripts/frontend.sh service preview' '기존 배포 빌드를 Vite로 로컬 미리보기합니다.' ;;
    service:browser-check) printf '%s\n' '사용: bash scripts/frontend.sh service browser-check' '기존 dist를 실제 Chrome으로 검사합니다. 먼저 빌드가 필요합니다.' ;;
    service:docker-check) printf '%s\n' '사용: bash scripts/frontend.sh service docker-check' '검증 이미지를 빌드하고 Docker 설정과 이미지를 검사합니다. 이미지는 보존합니다.' ;;
    *) printf '알 수 없는 명령: %s %s\n' "$1" "$2" >&2; return 2 ;;
  esac
}
setup_frontend_local_environment() (
set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/script_logging.sh"

# 프론트엔드 로컬 개발 환경 준비 스크립트
# - 의존성 설치

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR"

write_frontend_setup_log() { echo "[$(date '+%H:%M:%S')][프론트준비] $1"; }
write_frontend_setup_step() { echo "[$(date '+%H:%M:%S')][프론트준비][단계 $1] $2"; }

write_frontend_setup_log "프론트엔드 로컬 환경 준비를 시작합니다."
write_frontend_setup_step "1/2" "필수 명령 존재 여부를 확인합니다."

if ! command -v npm >/dev/null 2>&1; then
  write_frontend_setup_log "오류: npm을 찾을 수 없습니다. Node.js 설치를 확인해 주세요."
  exit 1
fi

cd "$FRONTEND_DIR"

write_frontend_setup_step "2/2" "npm 의존성을 설치합니다."
npm ci

write_frontend_setup_log "프론트엔드 로컬 환경 준비가 완료되었습니다."

)

start_frontend_local_server() (
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/script_logging.sh"
cd "$SCRIPT_LOG_ROOT"
if [[ ! -x node_modules/.bin/vite ]]; then
  printf '%s/run/error 먼저 bash scripts/frontend.sh dev setup 를 실행하세요.\n' "$(date -Iseconds)" >&2
  exit 1
fi
# 확인한 포트 점유 프로세스에만 정상 종료 신호를 보낸다.
readonly FRONTEND_SERVER_PORT=8080
readonly SERVER_STOP_TIMEOUT_SECONDS=10
read_port_listener_pids() {
  local current_lookup_status=0
  lsof -nP -t -iTCP:"$FRONTEND_SERVER_PORT" -sTCP:LISTEN || current_lookup_status=$?
  if (( current_lookup_status > 1 )); then
    printf '%s/run/error 포트 점유 프로세스 조회 실패\n' "$(date -Iseconds)" >&2
    return "$current_lookup_status"
  fi
}
confirm_existing_server_stop() {
  local current_listener_pids current_process_identity current_restart_answer current_wait_deadline current_verified_listeners
  local current_listener_pid
  local -A confirmed_process_identities=()
  command -v lsof >/dev/null || { printf '%s/run/error lsof 설치가 필요합니다.\n' "$(date -Iseconds)" >&2; return 1; }
  current_listener_pids="$(read_port_listener_pids)"
  [[ -n "$current_listener_pids" ]] || return 0
  printf '%s/run/port-conflict %s 포트를 사용 중입니다. 종료 대상:\n' "$(date -Iseconds)" "$FRONTEND_SERVER_PORT"
  for current_listener_pid in $current_listener_pids; do
    current_process_identity="$(ps -p "$current_listener_pid" -o uid=,lstart=,args=)"
    [[ -n "$current_process_identity" ]] || { printf '프로세스가 변경되었습니다. 다시 실행하세요.\n' >&2; return 1; }
    confirmed_process_identities[$current_listener_pid]="$current_process_identity"
    printf 'PID %s · %s\n' "$current_listener_pid" "$current_process_identity"
  done
  printf '위 서버를 종료하고 프론트엔드를 다시 시작할까요? [y/N] '
  if ! read -r current_restart_answer || [[ ! "$current_restart_answer" =~ ^([yY]|[yY][eE][sS])$ ]]; then
    printf '%s/run/cancel 기존 서버를 유지하고 실행을 취소했습니다.\n' "$(date -Iseconds)"
    exit 0
  fi
  # 확인 대기 중 프로세스나 포트 소유자가 바뀌면 새 대상을 종료하지 않는다.
  current_verified_listeners="$(read_port_listener_pids)"
  [[ "$current_verified_listeners" == "$current_listener_pids" ]] || { printf '포트 점유 대상이 변경되었습니다. 다시 실행하세요.\n' >&2; return 1; }
  for current_listener_pid in $current_listener_pids; do
    [[ "$(ps -p "$current_listener_pid" -o uid=,lstart=,args=)" == "${confirmed_process_identities[$current_listener_pid]}" ]] || { printf '프로세스가 변경되었습니다. 다시 실행하세요.\n' >&2; return 1; }
  done
  for current_listener_pid in $current_listener_pids; do
    printf '%s/run/stop PID %s 정상 종료 요청\n' "$(date -Iseconds)" "$current_listener_pid"
    kill -TERM "$current_listener_pid"
  done
  current_wait_deadline=$((SECONDS + SERVER_STOP_TIMEOUT_SECONDS))
  while true; do
    current_verified_listeners="$(read_port_listener_pids)"
    [[ -n "$current_verified_listeners" ]] || break
    if (( SECONDS >= current_wait_deadline )); then
      printf '%s/run/error %s초 내 포트가 해제되지 않았습니다. 강제 종료하지 않습니다.\n' "$(date -Iseconds)" "$SERVER_STOP_TIMEOUT_SECONDS" >&2
      return 1
    fi
    sleep 0.2
  done
  printf '%s/run/restart 포트 해제 확인, 프론트엔드 재시작\n' "$(date -Iseconds)"
}
confirm_existing_server_stop
printf '%s/run/start Vite HMR: http://localhost:8080 (빌드 없음, Ctrl+C 종료)\n' "$(date -Iseconds)"
npm run dev

)

stop_frontend_local_server() (
set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/script_logging.sh"

# 프론트엔드 로컬 종료 안내 스크립트

write_frontend_setup_log() { echo "[$(date '+%H:%M:%S')][프론트정리] $1"; }

write_frontend_setup_log "프론트엔드 개발 서버는 실행 중인 터미널에서 Ctrl+C로 종료합니다."
write_frontend_setup_log "추가 정리 작업은 없습니다."

)

if (( $# == 0 )); then print_frontend_command_help; exit 0; fi
frontend_command_group="$1"
shift
case "$frontend_command_group" in
  help|--help|-h)
    if (( $# == 0 )); then print_frontend_command_help; exit 0; fi
    if (( $# == 1 )); then print_frontend_group_help "$1"; exit $?; fi
    if (( $# == 2 )); then print_frontend_action_help "$1" "$2"; exit $?; fi
    printf '%s\n' '사용: bash scripts/frontend.sh help [dev|service [명령]]' >&2; exit 2 ;;
  dev|service) ;;
  *) printf '알 수 없는 그룹: %s\n' "$frontend_command_group" >&2; exit 2 ;;
esac
if (( $# == 0 )); then print_frontend_group_help "$frontend_command_group"; exit 0; fi
if (( $# == 1 )) && [[ "$1" == --help || "$1" == -h ]]; then print_frontend_group_help "$frontend_command_group"; exit 0; fi
frontend_command_action="$1"
shift
case "$frontend_command_group:$frontend_command_action" in
  dev:setup|dev:start|dev:stop|dev:test|service:build|service:preview|service:browser-check|service:docker-check) ;;
  *) printf '알 수 없는 명령: %s %s\n' "$frontend_command_group" "$frontend_command_action" >&2; exit 2 ;;
esac
if (( $# == 1 )) && [[ "$1" == --help || "$1" == -h ]]; then print_frontend_action_help "$frontend_command_group" "$frontend_command_action"; exit 0; fi
cd "$frontend_script_root"
if [[ "$frontend_command_group:$frontend_command_action" == dev:test ]]; then
  if (( $# == 0 )); then print_frontend_action_help "$frontend_command_group" "$frontend_command_action" >&2; exit 2; fi
  exec node scripts/run-regression.mjs "$@"
fi
if (( $# != 0 )); then printf '%s\n' '지원하지 않는 옵션입니다. 명령별 --help를 확인하세요.' >&2; exit 2; fi
case "$frontend_command_group:$frontend_command_action" in
  dev:setup) setup_frontend_local_environment ;;
  dev:start) start_frontend_local_server ;;
  dev:stop) stop_frontend_local_server ;;
  service:build) exec npm run build:verified ;;
  service:preview) exec npm run preview ;;
  service:browser-check) exec npm run check:production-browser ;;
  service:docker-check) exec npm run build:docker:verified ;;
esac
