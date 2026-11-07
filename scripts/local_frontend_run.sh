#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/script_logging.sh"
cd "$SCRIPT_LOG_ROOT"
if [[ ! -x node_modules/.bin/vite ]]; then
  printf '%s/run/error 먼저 bash scripts/local_frontend_setup.sh 를 실행하세요.\n' "$(date -Iseconds)" >&2
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
