#!/usr/bin/env bash
# 실행 로그 저장과 장시간 작업 진행 상태를 공통으로 관리한다.
SCRIPT_LOG_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_LOG_AREA="$(basename "$0" .sh)"
SCRIPT_LOG_DIR="${SCRIPT_LOG_ROOT}/.local/logs"
# 로컬 파일 로그는 매일 회전하고 7일 보관한다. 배포 로그는 CloudWatch에서 30일 보관한다.
SCRIPT_LOG_RETENTION_DAYS=7
SCRIPT_LOG_ROTATION_INTERVAL=3600
SCRIPT_LOG_ROTATION_CONFIG="${SCRIPT_LOG_ROOT}/.local/logrotate.conf"
SCRIPT_LOG_ROTATION_STATE="${SCRIPT_LOG_ROOT}/.local/logrotate.state"
for current_required_command in logrotate flock; do
  if ! command -v "$current_required_command" >/dev/null 2>&1; then
    printf '%s/%s/error 필수 명령 없음: %s (logrotate·util-linux 설치 필요)\n' "$(date -Iseconds)" "$SCRIPT_LOG_AREA" "$current_required_command" >&2
    exit 1
  fi
done
mkdir -p "$SCRIPT_LOG_DIR"
rotate_script_log_files() (
  flock -x 9
  cat > "$SCRIPT_LOG_ROTATION_CONFIG" <<EOF
"${SCRIPT_LOG_DIR}"/*.log {
    daily
    rotate ${SCRIPT_LOG_RETENTION_DAYS}
    maxage ${SCRIPT_LOG_RETENTION_DAYS}
    missingok
    notifempty
    copytruncate
    dateext
    dateformat -%Y%m%d
}
EOF
  logrotate --state "$SCRIPT_LOG_ROTATION_STATE" "$SCRIPT_LOG_ROTATION_CONFIG" || return "$?"
  # 종료된 실행의 원본도 정리한다. 활성 실행은 5초 heartbeat로 갱신된다.
  find "$SCRIPT_LOG_DIR" -maxdepth 1 -type f \( -name '*.log' -o -name '*.log-[0-9]*' \) \
    -mmin +"$((SCRIPT_LOG_RETENTION_DAYS * 1440))" -delete
) 9>"${SCRIPT_LOG_ROOT}/.local/logrotate.lock"
rotate_script_log_files
SCRIPT_LOG_FILE="${SCRIPT_LOG_DIR}/${SCRIPT_LOG_AREA}-$(date '+%Y%m%d-%H%M%S')-$$.log"
exec > >(trap "" INT; exec tee -a "$SCRIPT_LOG_FILE") 2>&1
# Ctrl+C는 전경 개발 서버가 처리한다. 로그 파이프는 정리 완료까지 유지한다.
trap ":" INT
printf '%s/%s/start 로그: %s\n' "$(date -Iseconds)" "$SCRIPT_LOG_AREA" "$SCRIPT_LOG_FILE"
(
  current_rotation_seconds=$SECONDS
  while sleep 5; do
    if (( SECONDS - current_rotation_seconds >= SCRIPT_LOG_ROTATION_INTERVAL )); then
      rotate_script_log_files
      current_rotation_seconds=$SECONDS
    fi
    printf '%s/%s/heartbeat 진행 중, 로그 줄 수: %s, 로그 바이트: %s\n' \
      "$(date -Iseconds)" "$SCRIPT_LOG_AREA" "$(wc -l < "$SCRIPT_LOG_FILE")" "$(wc -c < "$SCRIPT_LOG_FILE")"
  done
) &
SCRIPT_LOG_HEARTBEAT_PID=$!
script_log_exit() {
  local status=$?
  trap - EXIT
  kill "$SCRIPT_LOG_HEARTBEAT_PID" 2>/dev/null || true
  wait "$SCRIPT_LOG_HEARTBEAT_PID" 2>/dev/null || true
  printf '%s/%s/finish 종료 코드: %s\n' "$(date -Iseconds)" "$SCRIPT_LOG_AREA" "$status"
  if [[ "$status" -ne 0 ]]; then
    tail -n 30 "$SCRIPT_LOG_FILE" >&2
  fi
  exit "$status"
}
trap script_log_exit EXIT
trap 'printf "%s/%s/error line=%s command=%s\n" "$(date -Iseconds)" "$SCRIPT_LOG_AREA" "$LINENO" "$BASH_COMMAND"' ERR
