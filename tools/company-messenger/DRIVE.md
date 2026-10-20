# Google Drive integration contract

The 2026-09-27 connection and PC-storage observations below describe the standalone environment. The integrated company workspace stores its database on the company server; use [CLOUD-OPERATIONS](../../docs/마케팅/온라인마케팅지도/engagement/company/CLOUD-OPERATIONS.md) for that deployment and its backup scope. Neither the historical quota nor this contract confirms a current live connection. The per-file original-provider, ownership and deletion-queue contracts remain applicable.

As of 2026-09-27, `unmet23@gmail.com` is connected and its live quota limit is **5497558138880 bytes (5TB in the UI)**. Dedicated private folder: [SYNK 팀 메신저](https://drive.google.com/drive/folders/1t9EzZO-JJLTDkOamtKhd0xUbvHqUEraL). Existing authorized OAuth credentials were used without modifying their source. No new subscriptions or public sharing were created. Additional messenger service fees are zero; the existing Google subscription is separate.

New uploads use the active connection. Previous files retain their original provider, connection and remote ID; switching does not migrate them. Existing local attachments remain usable. Chat/account records stay in SQLite on the PC. File limits remain 100MiB per file and five attachments per message. Files never auto-expire. Explicit deletion moves only app-owned files to Drive trash; trash still consumes Google storage. The app never empties the account trash or permanently deletes remote files.

## Implementation
`drive-storage.mjs` implements guarded Google access; `connect-drive.mjs` registers authorized credential files through the CLI. `server.mjs` owns per-file storage metadata, migration and the durable deletion queue. `public/` displays connection status, real quota and account selection. `tests/drive*.test.mjs` uses fakes; the separate `qa/live-drive.mjs` is an explicit live browser verification.

## Drive storage module interface
`createDriveStorage({dataDir, fetchImpl=fetch})` returns:
- `active()` async => `{id,email,folderId}` or null, reads registry.
- `status({fresh=false}={})` async => `{provider:'local'|'google-drive',activeConnectionId:null|string,connections:[{id,email,folderUrl,active}],status:'local'|'connected'|'error',account:null|{email,name,limitBytes,usedBytes,driveBytes,trashBytes},error:null|string,verifiedAt:null|string}`. Status includes sanitized data only; reports network/auth failures, never falls back silently. API about verifies identity each refresh. Cache quota at most60s.
- `upload({connectionId,localPath,name,size,md5,fileId})` => `{remoteId,connectionId,md5}`. Local staged file is caller-owned; resumable upload; dedicated folder + appProperties marker (`synkMessengerFileId=fileId`, `synkMessengerSpaceId=installationId`), verify metadata size+MD5. Throws safe `DriveStorageError` with `status` and `publicMessage`.
- `download({connectionId,remoteId,fileId,expectedSize?,expectedMd5?})` => Node readable stream after checking folder+appProperties+not trashed. The server passes its stored size and MD5; manual remote content changes return 409 before streaming. No public URLs.
- `trash({connectionId,remoteId,fileId})` => void; same guards, already missing/trashed is idempotent. Never permanently deletes. Called only for explicit app cancellation/deletion/failed-upload cleanup.
- `setActive(connectionId|null)` => status; verify target health before saving; retains every old connection and credentials. Switching affects only later uploads.
- `connectFromFile({sourcePath,expectedEmail})` => status. CLI only, accepts clasp tokens.default or authorized_user JSON (client_id/client_secret/refresh_token); verifies account before Drive mutations, then creates/reuses a dedicated folder and activates the connection. Copies minimal credentials into ignored data registry. Existing connections match email plus OAuth client ID; a different client ID creates another connection while retaining old credentials for earlier files. Never writes original auth source. Do NOT call from HTTP. No browser-exposed credential import.

Registry `data/drive-storage.json` contains private OAuth credentials. Never expose it via API, console or Git. Stop the server before privately backing up the full `data/` directory; that backup includes SQLite, credentials and local attachments, **not remote Drive file bodies**. Retain remote files and access to their original Google accounts separately. Unit/integration tests use temp directories and injected fetch only; they never connect real credentials.

## Backend additions
- createMessenger accepts optional `driveStorage` injectable fake with methods above, defaults createDriveStorage({dataDir}).
- Add files columns via guarded ALTER TABLE: `storage_provider TEXT NOT NULL DEFAULT 'local'`, `storage_connection_id TEXT`, `storage_remote_id TEXT`, `md5 TEXT`. Existing files remain local.
- Capture active connection when upload starts. Stream local staging and MD5; Drive upload/verify completes before DB file row/success. On remote failure clean staging, return explicit error; never claim Drive success for local-only data. On DB failure or a disconnected upload, trash the created remote file where possible. Failed cleanup remains in the durable queue. Remove staging after committed Drive upload. Provider errors may carry `remoteCleanup:{connectionId,remoteId,fileId}` for the server to preserve a failed-upload cleanup intent.
- File responses add `storageProvider:'local'|'google-drive'` (no private account info for members).
- Authenticated downloads first check membership, then Drive stream according to each file's stored connection. Keep attachment/nosniff headers, no direct public share.
- Explicit deletion/cancel uses durable outbox `drive_delete_outbox`: enqueue original file/connection/remote ID in the same transaction as DB deletion, then attempt trash. Retry unfinished deletion on startup and every 60 seconds, and expose the pending count. On successful cleanup remove the outbox item. Authentication failures survive restarts for later retry. Local cleanup is unchanged. No user file scans or outside-folder deletion.
- `/api/bootstrap` adds `storage:{provider:'local'|'google-drive'}` (even pre-login) so first-run copy accurate. Do not expose email/quota pre-login.
- GET `/api/storage` existing counts preserved + `provider` + `drive` object for owner only (shape status above + pendingDeletions:number). Members only provider.
- GET `/api/storage/drive` owner only => status above + pendingDeletions.
- POST `/api/storage/drive/active` owner only `{connectionId:string|null}` => status. New targets must be registered by CLI; preserve old metadata/credentials. null switches future uploads to local. Guard origin/auth same as existing.

## UI additions
Settings: Drive account email, real quota used/limit (shared account storage, not reserved messenger quota), dedicated folder link, connection status/error/retry, pending deletion if any; registered account selector for future switching, labels clarify only new uploads change and existing files preserved. Local fallback only if no active connection by explicit choice. Cloud file badge in file cards. First-run/footer/sidebar/composer copy derive active storage; chat database stays on PC even when files in Drive. Keep existing functions/tests and expose accessible ids for QA. Format quota as TB using1024, no fake hardcoded quota.

## Additional accounts and verification

Register a newly authorized credential JSON with `node connect-drive.mjs --credentials <path> --email <expected-email>`. This verifies and activates the new connection. Afterwards, the owner can select registered accounts in settings. `node connect-drive.mjs --status` reports sanitized live status; `--use <connection-id>` or `--use local` switches explicitly. Registering another account does not move earlier files.

Verified: 23/23 Node tests and the existing 16 browser flows passed. `node qa/live-drive.mjs --confirm-live --email unmet23@gmail.com --large` uploaded and downloaded a real 6MiB file, matched bytes/SHA-256 and Drive MD5, verified account/quota display, and moved only that test file to trash with no pending deletion and no browser console errors. The test account/database was temporary; no test account was created in the real `data/`. See [QA.md](QA.md) for evidence scope and output paths.
