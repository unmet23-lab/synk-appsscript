#!/usr/bin/env bash
set -euo pipefail
umask 077

DEPLOY_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
COMPANY_PATH='docs/마케팅/온라인마케팅지도/engagement/company'
SYNK_COMPANY_RUNTIME_ENV_FILE="${SYNK_COMPANY_RUNTIME_ENV_FILE:-/etc/synk/company.env}"
SYNK_PERSISTENT_ROOT="${SYNK_PERSISTENT_ROOT:-/srv/synk}"
SYNK_OPS_STATE_DIR="${SYNK_OPS_STATE_DIR:-/var/lib/synk-company-ops}"
COMPANY_BACKUP_DIR="${COMPANY_BACKUP_DIR:-/srv/synk/backups}"
COMPANY_ARCHIVE_DIR="${COMPANY_ARCHIVE_DIR:-/srv/synk/backup-archives}"
CADDY_DATA_DIR="${CADDY_DATA_DIR:-/srv/synk/caddy-data}"
CADDY_CONFIG_DIR="${CADDY_CONFIG_DIR:-/srv/synk/caddy-config}"
export SYNK_COMPANY_RUNTIME_ENV_FILE COMPANY_BACKUP_DIR COMPANY_ARCHIVE_DIR CADDY_DATA_DIR CADDY_CONFIG_DIR

event() { printf 'SYNK_COMPANY_OPS %s\n' "$1"; }
fail() { event "$1" >&2; exit 1; }
compose() { docker compose --project-name synk-company --file "$DEPLOY_DIR/compose.yaml" "$@"; }
existing_absolute_directory() { [[ "$1" = /* && -d "$1" ]] || fail CONFIG_DIRECTORY_REQUIRED; }

# Archives and success records belong to the host, outside every writable
# container mount. Validate before creating anything as root.
private_archive_directory() {
  local root actual lexical parent path mode metadata
  [[ "$COMPANY_ARCHIVE_DIR" = /* && -d "$COMPANY_ARCHIVE_DIR" && ! -L "$COMPANY_ARCHIVE_DIR" ]] || return 1
  root="$(realpath -e -- "$SYNK_PERSISTENT_ROOT" 2>/dev/null)" || return 1
  actual="$(realpath -e -- "$COMPANY_ARCHIVE_DIR" 2>/dev/null)" || return 1
  lexical="$(realpath -ms -- "$COMPANY_ARCHIVE_DIR" 2>/dev/null)" || return 1
  [[ "$actual" = "$lexical" && "$actual" = "$root/"* ]] || return 1
  [[ "$(stat -c '%u:%a' -- "$actual" 2>/dev/null)" = 0:700 ]] || return 1
  for path in "${COMPANY_VOLUME_DIR:-$root/company}" "$COMPANY_BACKUP_DIR" "$CADDY_DATA_DIR" "$CADDY_CONFIG_DIR"; do
    path="$(realpath -m -- "$path" 2>/dev/null)" || return 1
    [[ "$actual" != "$path" && "$actual" != "$path/"* && "$path" != "$actual/"* ]] || return 1
  done
  parent="${actual%/*}"
  while [[ "$parent" = "$root" || "$parent" = "$root/"* ]]; do
    metadata="$(stat -c '%u:%a' -- "$parent" 2>/dev/null)" || return 1
    [[ "$metadata" =~ ^0:([0-7]{3,4})$ ]] || return 1
    mode="${BASH_REMATCH[1]}"
    (( (8#$mode & 0022) == 0 )) || return 1
    [[ "$parent" = "$root" ]] && break
    parent="${parent%/*}"
  done
  printf '%s\n' "$actual"
}

check_storage() {
  : "${COMPANY_VOLUME_DIR:?Set COMPANY_VOLUME_DIR to the restored absolute directory}"
  existing_absolute_directory "$SYNK_PERSISTENT_ROOT"
  mountpoint --quiet "$SYNK_PERSISTENT_ROOT" || fail PERSISTENT_DISK_NOT_MOUNTED
  local root path actual
  root="$(realpath -- "$SYNK_PERSISTENT_ROOT")"
  for path in "$COMPANY_VOLUME_DIR" "$COMPANY_BACKUP_DIR" "$CADDY_DATA_DIR" "$CADDY_CONFIG_DIR"; do
    existing_absolute_directory "$path"
    actual="$(realpath -- "$path")"
    [[ "$actual" = "$root/"* ]] || fail VOLUME_OUTSIDE_PERSISTENT_DISK
  done
  local company backups
  company="$(realpath -- "$COMPANY_VOLUME_DIR")"; backups="$(realpath -- "$COMPANY_BACKUP_DIR")"
  [[ "$backups" != "$company" && "$backups" != "$company/"* && "$company" != "$backups/"* ]] || fail BACKUP_INSIDE_LIVE_DATA
  [[ ! -e "$COMPANY_VOLUME_DIR/PREPARATION_INCOMPLETE" ]] || fail RESTORE_ACCEPTANCE_REQUIRED
  for path in company.sqlite encryption.key workspace-integration.json messenger/messenger.sqlite; do
    [[ -f "$COMPANY_VOLUME_DIR/$path" ]] || fail EXISTING_WORKSPACE_REQUIRED
  done
}

lock_operations() {
  existing_absolute_directory "$SYNK_OPS_STATE_DIR"
  exec 9>"$SYNK_OPS_STATE_DIR/operations.lock"
  if [[ "${1:-}" = backup ]]; then
    # A daily backup must wait for a short health/recovery operation or fail visibly.
    flock --wait 120 9 || fail BACKUP_FAILED
  else
    flock --nonblock 9 || { event OPERATION_ALREADY_RUNNING; exit 0; }
  fi
}

check_runtime_configuration() {
  [[ "$SYNK_COMPANY_RUNTIME_ENV_FILE" = /* && -f "$SYNK_COMPANY_RUNTIME_ENV_FILE" ]] || fail RUNTIME_ENV_REQUIRED
  [[ "$(stat -c '%a' -- "$SYNK_COMPANY_RUNTIME_ENV_FILE")" = 600 ]] || fail RUNTIME_ENV_PERMISSIONS
  : "${SYNK_COMPANY_DOMAIN:?Set the approved DNS hostname}"
  : "${SYNK_COMPANY_IMAGE:?Set the prebuilt reviewed release image tag}"
  : "${SYNK_TLS_EMAIL:?Set the certificate operations email}"
  [[ "$SYNK_COMPANY_DOMAIN" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z0-9-]+$ && "$SYNK_COMPANY_DOMAIN" != *..* ]] || fail DOMAIN_INVALID
}
