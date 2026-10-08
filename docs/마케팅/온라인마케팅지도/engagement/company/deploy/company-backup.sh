#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/cloud-common.sh"
check_runtime_configuration
check_storage
lock_operations backup
archive_directory="$(private_archive_directory)" || fail BACKUP_ARCHIVE_DIRECTORY_INVALID
set -o noclobber
[[ "${SYNK_BACKUP_UPLOAD_ENABLED:-0}" = 1 ]] || fail OFFSITE_BACKUP_NOT_CONFIGURED
destination="${SYNK_BACKUP_GCS_DESTINATION:-}"
[[ "$destination" =~ ^gs://[A-Za-z0-9._/-]+$ ]] || fail BACKUP_DESTINATION_INVALID
location="${destination#gs://}"; bucket="${location%%/*}"; prefix=''
[[ "$bucket" =~ ^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$ && "$bucket" != *..* && "$bucket" != *.-* && "$bucket" != *-.* ]] || fail BACKUP_DESTINATION_INVALID
[[ ! "$bucket" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail BACKUP_DESTINATION_INVALID
if [[ "$location" = */* ]]; then
  prefix="${location#*/}"; prefix="${prefix%/}"
  [[ "$prefix" =~ ^([A-Za-z0-9_-][A-Za-z0-9._-]*/)*[A-Za-z0-9_-][A-Za-z0-9._-]*$ ]] || fail BACKUP_DESTINATION_INVALID
fi
command -v gcloud >/dev/null || fail GCLOUD_REQUIRED
command -v curl >/dev/null || fail CURL_REQUIRED
# Online backups are sequential read-only SQLite snapshots, not a coordinated
# cross-database instant. Final migration still requires all writers stopped.
snapshot="$(compose exec -T company node "$COMPANY_PATH/workspace-backup.mjs" /backups 2>/dev/null)" || fail BACKUP_FAILED
snapshot="${snapshot%$'\r'}"
[[ "$snapshot" =~ ^/backups/synk-workspace-[0-9TZ-]+$ ]] || fail BACKUP_RESULT_INVALID
name="${snapshot##*/}"; directory="$COMPANY_BACKUP_DIR/$name"
[[ -d "$directory" && ! -L "$directory" && -f "$directory/COMPLETE" && ! -L "$directory/COMPLETE" ]] || fail BACKUP_INCOMPLETE
[[ "$(cat -- "$directory/COMPLETE")" = ok ]] || fail BACKUP_INCOMPLETE
archive="$archive_directory/$name.tar.gz"
for target in "$archive" "$archive.partial" "$archive.sha256" "$archive.uploaded"; do
  [[ ! -e "$target" && ! -L "$target" ]] || fail BACKUP_ARCHIVE_EXISTS
done
tar -C "$COMPANY_BACKUP_DIR" -czf - -- "$name" > "$archive.partial" 2>/dev/null || fail BACKUP_ARCHIVE_FAILED
mv -- "$archive.partial" "$archive"
sha256sum -- "$archive" > "$archive.sha256"
object_name="${prefix:+$prefix/}$name.tar.gz"
(( ${#object_name} <= 1024 )) || fail BACKUP_DESTINATION_INVALID
object="gs://$bucket/$object_name"
# IAM, private bucket policy and retention are provisioned separately. No ACL
# or permission changes, destination overwrite, deletion or retry happen here.
# objects.insert needs only storage.objects.create; gcloud storage cp can also
# preflight-read the target, which the create-only backup identity cannot do.
# Disable tracing before credentials enter shell memory. Never export the token
# or pass it through argv, a temporary file, or a response/error log.
set +x
# Clear any inherited export attribute before assigning the credential.
unset access_token
access_token="$(gcloud auth print-access-token --quiet 2>/dev/null)" || fail OFFSITE_BACKUP_FAILED
[[ ${#access_token} -ge 20 && ${#access_token} -le 16384 && "$access_token" =~ ^[A-Za-z0-9._~+/-]+={0,2}$ ]] || fail OFFSITE_BACKUP_FAILED
encoded_name="${object_name//\//%2F}"
upload_url="https://storage.googleapis.com/upload/storage/v1/b/$bucket/o?uploadType=media&name=$encoded_name&ifGenerationMatch=0"
http_status=''
if ! http_status="$(printf 'header = "Authorization: Bearer %s"\n' "$access_token" | curl --disable --config - \
    --fail --silent --show-error --proto '=https' --retry 0 --connect-timeout 30 --max-time 2400 \
    --request POST --header 'Content-Type: application/gzip' --upload-file "$archive" \
    --output /dev/null --write-out '%{http_code}' "$upload_url" 2>/dev/null)"; then
  unset access_token
  fail OFFSITE_BACKUP_FAILED
fi
unset access_token
[[ "$http_status" = 200 || "$http_status" = 201 ]] || fail OFFSITE_BACKUP_FAILED
printf '%s\n' "$object" > "$archive.uploaded"
event OFFSITE_BACKUP_COMPLETE
# Keep local archives on success and failure. Retention requires a reviewed
# storage policy; disk usage and missing daily success are monitored externally.
