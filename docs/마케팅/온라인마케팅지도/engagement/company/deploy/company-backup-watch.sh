#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/cloud-common.sh"

# This is a read-only local success watchdog, not a remote object/restore check.
# All failures deliberately share a fixed, non-sensitive alert event.
stale() { fail BACKUP_STALE; }
canonical_directory() {
  local value="$1" actual lexical
  [[ "$value" = /* && -d "$value" && ! -L "$value" ]] || return 1
  actual="$(realpath -e -- "$value" 2>/dev/null)" || return 1
  lexical="$(realpath -ms -- "$value" 2>/dev/null)" || return 1
  # Reject symlinks in ancestors as well as in the directory itself.
  [[ "$actual" = "$lexical" ]] || return 1
  printf '%s\n' "$actual"
}

root="$(canonical_directory "$SYNK_PERSISTENT_ROOT")" || stale
mountpoint --quiet "$root" 2>/dev/null || stale
backups="$(private_archive_directory)" || stale
[[ "$backups" = "$root/"* ]] || stale
[[ "${SYNK_BACKUP_UPLOAD_ENABLED:-0}" = 1 ]] || stale
[[ "${SYNK_BACKUP_GCS_DESTINATION:-}" =~ ^gs://[a-z0-9][a-z0-9._-]+(/[A-Za-z0-9._/-]+)?$ ]] || stale
now="$(date +%s 2>/dev/null)" || stale
[[ "$now" =~ ^[0-9]{1,12}$ ]] || stale
max_age=$((27 * 60 * 60))

shopt -s nullglob
for marker in "$backups"/synk-workspace-*.tar.gz.uploaded; do
  name="${marker##*/}"
  [[ "$name" =~ ^synk-workspace-[0-9TZ-]+\.tar\.gz\.uploaded$ ]] || continue
  archive="${marker%.uploaded}"
  [[ -f "$marker" && ! -L "$marker" && -f "$archive" && ! -L "$archive" && -s "$archive" ]] || continue
  marker_size="$(stat -c '%s' -- "$marker" 2>/dev/null)" || continue
  [[ "$marker_size" =~ ^[0-9]{1,4}$ ]] && (( marker_size > 0 && marker_size <= 1024 )) || continue
  destination="$(cat -- "$marker" 2>/dev/null)" || continue
  [[ "$destination" = "${SYNK_BACKUP_GCS_DESTINATION%/}/${archive##*/}" ]] || continue
  marker_time="$(stat -c '%Y' -- "$marker" 2>/dev/null)" || continue
  archive_time="$(stat -c '%Y' -- "$archive" 2>/dev/null)" || continue
  [[ "$marker_time" =~ ^[0-9]{1,12}$ && "$archive_time" =~ ^[0-9]{1,12}$ ]] || continue
  # A touched marker cannot make an old archive fresh. Future timestamps and
  # archives modified after their successful upload are not accepted either.
  (( archive_time <= marker_time && marker_time <= now && now - archive_time <= max_age && now - marker_time <= max_age )) || continue
  event BACKUP_FRESH
  exit 0
done
stale
