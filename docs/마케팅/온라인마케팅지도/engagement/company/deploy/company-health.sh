#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/cloud-common.sh"
check_runtime_configuration
check_storage
lock_operations
state="$SYNK_OPS_STATE_DIR/health.state"
now="$(date +%s)"; failures=0; window="$now"; restarts=0
if [[ -f "$state" ]]; then
  read -r failures window restarts < "$state" || fail HEALTH_STATE_INVALID
  [[ "$failures" =~ ^[0-9]+$ && "$window" =~ ^[0-9]+$ && "$restarts" =~ ^[0-9]+$ ]] || fail HEALTH_STATE_INVALID
fi
if (( now - window >= 3600 )); then window="$now"; restarts=0; fi
save_state() { printf '%s %s %s\n' "$failures" "$window" "$restarts" > "$state.tmp"; mv -- "$state.tmp" "$state"; }
if compose exec -T company node "$COMPANY_PATH/deploy/healthcheck.mjs" >/dev/null 2>&1; then
  failures=0; save_state; event HEALTH_READY; exit 0
fi
failures=$((failures + 1)); save_state; event HEALTH_FAILED
if (( failures < 3 )); then exit 1; fi
if (( restarts >= 2 )); then fail RESTART_LIMIT_REACHED; fi
# Count an attempt before dispatch; an uncertain Docker result cannot retry free.
restarts=$((restarts + 1)); failures=0; save_state
compose restart --timeout 60 company >/dev/null 2>&1 || fail RECOVERY_RESTART_FAILED
event RECOVERY_RESTART
# The next timer verifies recovery. A dispatched restart is not a healthy result.
exit 1
