#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/cloud-common.sh"
case "${1:-}" in
  start)
    check_runtime_configuration
    check_storage
    lock_operations
    # Build and image pulls belong to the reviewed release step, never boot.
    compose up --detach --no-build --pull never || fail STACK_START_FAILED
    event STACK_STARTED
    ;;
  stop)
    compose stop --timeout 60 || fail STACK_STOP_FAILED
    event STACK_STOPPED
    ;;
  *) fail INVALID_OPERATION ;;
esac
