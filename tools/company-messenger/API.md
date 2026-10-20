# Local messenger contract

This document describes the standalone development server and explicitly marked integrated-company contracts. The production workspace runs on the company server; local PC storage and standalone cookie settings below do not describe every deployment. Current deployment evidence is in [CLOUD-OPERATIONS](../../docs/마케팅/온라인마케팅지도/engagement/company/CLOUD-OPERATIONS.md). Dated release checks are historical evidence, not mandatory model-review gates for new work.

Node 24+ built-in HTTP + SQLite, no external runtime package dependency. Google Drive is the active attachment provider in this installation; local storage remains available. Default 127.0.0.1:4197. `createMessenger({dataDir, port:0, host:'127.0.0.1', driveStorage?})` exported from `server.mjs` returns `{server, db, listen(): Promise<{url,port}>, close(): Promise<void>}`. Optional `driveStorage` supplies the interface in [DRIVE.md](DRIVE.md); tests inject a fake. Direct `node server.mjs` starts app using MESSENGER_PORT / MESSENGER_DATA_DIR. Data default `data/` beside server, ignored by Git. HTTP JSON errors `{error: Korean human-readable message}`; success JSON unless noted. Auth via HttpOnly SameSite=Strict cookie; scrypt passwords; one-time invitation code stored hashed. No default account. Origin/Host checked, no cross-origin mutations, no CORS. Standalone mode defaults to loopback. The integrated production workspace is served by the company HTTPS server; its deployment and backup contracts are documented in company/CLOUD-OPERATIONS.md. Chat/account data stays in the local SQLite DB even when attachments use Drive.

## Send and upload recovery · 2026-10-09

Bootstrap advertises `sendRecovery: {messages:true, uploads:true}`. Current UI requires this capability before sending and never promises duplicate prevention against an older server. Legacy callers may omit request IDs and retain their original POST behavior. IDs are UUIDs scoped to the authenticated user and channel. All recovery/cancel routes recheck current company session, posting/channel access, Origin and CSRF for mutations; recovered workspace cards also recheck sharing rights.

- POST `/api/channels/:channel/messages` accepts optional `clientMessageId`. The message and a payload-hash receipt commit together. First send returns201; the same normalized request returns200 `{message,replayed:true}` without another message, attachment binding or notification. A different payload under the same ID returns409 `MESSAGE_REQUEST_CONFLICT`.
- GET `/api/channels/:channel/messages/requests/:id` returns200 `{status:"sent",message}` or404 when there is no receipt. Absence does not prove that a previous request cannot still arrive. Deleted originals remain tombstones:409 `MESSAGE_DELETED`; they are never recreated. If the requester owns the completed receipt and still has channel/posting access but a linked workspace card now denies sharing or is no longer available (403/404), status lookup, replay and cancellation return only `{status:"sent",unavailable:true}`. No message ID, body, card or attachment is returned; the client may release the pending-send lock. Other authorization failures remain errors.
- DELETE the same request path returns `{status:"cancelled"}` if not committed and persists a tombstone that blocks even a late POST (`MESSAGE_CANCELLED`). If already committed, it returns the original message and does not delete it. The client preserves any newer edited draft.
- File POST accepts optional `X-Upload-Id`. The server compares normalized name, length and actual content SHA256. A retry with the same payload reuses the original completed file; changed content returns409 `UPLOAD_REQUEST_CONFLICT`. GET `/api/channels/:channel/files/requests/:id` returns200 `{status:"uploaded",file}` for an unconsumed completed upload. Deleted or consumed files return409 and are not re-created.
- DELETE that file-request path cancels a pending/failed request, prevents a late commit, or removes only its completed unconsumed file through the existing local/Drive deletion path. A file already attached to a message cannot be deleted by upload cancellation. Both receipt cancellation and known-file deletion return409 `UPLOAD_CONSUMED` only for the authenticated owner with current access; the client removes its stale pending attachment without deleting the sent file. Failed cleanup retains the existing deletion outbox.
- When an uploaded file ID is already known, the client uses existing DELETE `/api/files/:id`, including uploads from older clients without upload receipts. An owner-scoped `file_deletion_receipts` row commits with removal; only a repeated delete by that owner with current channel access returns404 `UPLOAD_DELETED`. Ordinary inaccessible or unknown files retain indistinguishable404 responses. This allows response-loss recovery without treating any404 as successful cleanup.

Messenger SQLite adds `message_send_requests`, `file_upload_requests` and `file_deletion_receipts`. Receipts store hashes, IDs and minimal status, not duplicate message text. Original message/file deletion sets the result reference to NULL while retaining its tombstone. A naturally completed failed upload can reuse the same request ID. An active write returns409 `UPLOAD_IN_PROGRESS`; a pending write surviving process interruption returns409 `UPLOAD_UNCERTAIN` with `retryable:false` because the remote result is unknown. It must not start a second remote write. Explicit DELETE may still set a cancellation tombstone, because a pending receipt has no committed file record; this stops late commits and preserves any Drive cleanup outbox. Cancellation confirms that the request cannot commit, not that every remote object has already been trashed. The original Drive verification, staging cleanup and deletion outbox remain in force.

Client recovery is manual: check, retry, or cancel; reconnect/refresh never sends automatically. The pending message ID and original payload survive refresh and are isolated by user/channel. The client locks a new send until the earlier result is resolved or safely cancelled, while retaining text/mentions/replies/cards edited in the meantime. Raw File bytes stay in memory only. Completed attachment references and uncertain upload metadata can survive refresh; if the original File is gone and no completed upload exists, the UI asks for reselection. Old-account or stale-attempt callbacks cannot revive queues or clear another draft.

## Shapes

### Company device notifications

Integrated HTTPS company mode only; standalone messenger does not register devices. The default `SYNK_COMPANY_WEB_PUSH_ENABLED=0` keeps delivery off. Setting only this flag to 1 explicitly enables the push worker even when `SYNK_COMPANY_BACKGROUND_JOBS_ENABLED=0`. The latter pauses collection and Drive deletion; reminders/due digests inherit that setting unless `SYNK_COMPANY_WORK_NOTIFICATIONS_ENABLED` explicitly overrides it. Direct message/customer notifications can be pushed without draining historical work queues. A top-level user gesture requests browser permission; GET never subscribes or sends.

- GET `/api/device-notifications` → `{configured,publicKey,defaultEnabled:false,subscriptions:[{id,label,endpointHash,createdAt,lastAcceptedAt,enabled,currentSession,callAlerts}]}`. Company session required. No raw endpoint, subscription key, private key or session hash is returned. `callAlerts` says whether the server holds this device's subscription keys for the call marker below.
- POST same path `{subscription:{endpoint,keys:{p256dh,auth}},label?}` → 201 `{subscription}`. Requires the same Origin and company CSRF, including a session recheck after body reception. Viewers may manage their own device. Maximum 10 active devices per account. The RFC 8291 keys are kept only to encrypt the call marker; keys that cannot encrypt (wrong length, not on P-256) are dropped without failing the opt-in. Sending the same subscription again from the same session replaces its keys. With `keysOnly:true` the request only adds keys to this login's switched-on row for that endpoint and otherwise answers 404 without creating, re-enabling or taking over a device. The signed-in company page sends such a top-up whenever it receives a new identity (opening or reloading while signed in, signing in, a CSRF change) and the server lists this browser's subscription as switched on for the current login with `callAlerts:false`; keys the server cannot use are offered again at the next such moment.
- DELETE `/api/device-notifications/:id` → `{ok:true}`. Same Origin/CSRF and current owner required; cancels pending work. Logout revokes every subscription bound to that company session.

Company SQLite adds `web_push_subscriptions` and `web_push_queue`; encrypted VAPID identity uses `Store.secret('device-web-push-vapid')`. Keep the original database and encryption key together when backing up/restoring. Old unread items are excluded at opt-in. Current unread message, due and customer notifications are reconciled every 30 seconds; PULSE changes and new call invitations start a pass at once, and a pass requested while one runs follows it. Current active session, source visibility and room mute settings are rechecked before dispatch and after DNS resolution. Outbox deduplicates per subscription/source ID; transient failures retry within one hour, expired endpoints are disabled. A crash after provider acceptance but before SQLite acknowledgement can still redeliver; the fixed tag collapses the displayed notification. Call invitations always go out as their own wake-up — `Urgency: high`, `Topic: synk-company-calls`, a TTL that ends with the invitation — and everything else due in the same pass follows as a second `normal` wake-up on the usual topic. A provider replaces a pending push of the same topic, so a 45-second call push never replaces, and is never replaced or downgraded by, a pending one-hour wake-up. Each wake-up claims, authorizes, retries and records its own rows. If the call wake-up meets a gone endpoint (404/410) or a sign-out, the device is switched off and its other rows are skipped; an identity outage holds that device's other wake-up back until a later pass. Other devices continue either way. Provider acceptance is not device receipt.

Session verification distinguishes valid, definitively invalid, and temporarily unverifiable. A temporary identity-service failure or server shutdown pauses delivery without deleting consent or the endpoint; recovery resumes with the same subscription within the original notification TTL. State/registration return 503 while verification is unavailable. Verification failures before provider transmission do not exhaust the provider retry allowance. Logout, expired/invalid sessions, deactivated accounts, explicit opt-out and expired provider endpoints still disable delivery. SYNK ID credentials are AES-256-GCM encrypted with the existing Store key in `synk_identity_sessions`, bound to the company session, employee, identity link revision and identity configuration. Restart keeps the same unexpired company cookie, CSRF and opted-in device, but requires fresh central verification before access or delivery. Rotated refresh tokens and pending access candidates are persisted before central verification; graceful shutdown drains in-flight verification before closing SQLite. Deleting a company token cascades to its encrypted credential; logout/unlink/revocation still end access. The seven-day company session is not extended and no device is automatically registered. Existing sessions from the former memory-only version need one login when this change is first deployed. Keep the original encryption key with database backups.

Every push request carries a VAPID ES256 signature and an empty body, with one exception: a call wake-up to a device whose keys are stored carries the RFC 8291 (`aes128gcm`) encrypted marker `{"kind":"call"}` and nothing else, with a fresh salt and sender key each time. The sender can encrypt only that fixed marker. No chat/customer text leaves the server. Only supported push-vendor HTTPS endpoints resolving to public addresses are accepted; redirects are not followed. The root service worker shows a fixed generic notice for every push, caches no requests, and opens the existing authorized notification inbox without marking an item read. A push with the call marker uses its own tag with `renotify` and a vibration pattern, so it sounds even while an earlier work notice is still on screen (ordinary work keeps the fixed tag without `renotify`); the lock-screen text stays the same. Opening the app after logout requires login again; receiving a push that a provider already accepted cannot be retroactively undone.

### Messenger records
- User `{id,username,name,role:'owner'|'member',createdAt,teamId:null|string,teamName:null|string,companyRole:null|'admin'|'manager'|'member'|'viewer'}`. IDs are messenger IDs, including DM targets. Company team and role metadata comes from active company records; no email or credentials are exposed. Standalone users have null company metadata.
- Team `{id,name,memberIds:string[],memberCount:number,canOpen:boolean,channelId:null|string}`. Only active company teams are listed, and memberIds include active employees only. canOpen means the current user belongs to the team; channelId reveals its existing team room only to that team member. With no company teams, teams is an empty array.
- Channel `{id,name,description,kind:'channel'|'self'|'dm',scope:'public'|'team'|'private',teamId:null|string,category:'generic'|'team'|'project'|null,canManage:boolean,canInvite:boolean,memberIds:string[],unread:number,lastMessageAt}`. Public channels are joined automatically by all active users. Existing category=team/project public rooms remain public; changing category on a public room never changes access. New projects default to selected private membership. Actual team rooms have scope=team, kind=channel, category=team and a company teamId. Self/dm have scope=private and null category/teamId. Self display name '나에게'; dm display name other member's name. canManage means a participating public/selected-project room creator or owner with writing rights; canInvite is limited to selected projects. Team room name/membership comes from company team management and is not editable through messenger.
- File `{id,name,size,mime,type,url,createdAt,uploaderId,channelId,messageId:null|string,storageProvider:'local'|'google-drive'}`. type is image/video/audio/document/archive/other, determined from MIME and extension for browsing only. URL authenticated download; files always attachment (avoid uploaded HTML/script execution). Connection credentials, account email and remote file identifiers are not included in this shape.
- Message `{id,channelId,body,user:User,files:File[],createdAt,editedAt:null|string,reactions:[{emoji,count,mine}],replyToId:null|string,replyTo:null|{id,body,user:User|null,files:File[],deleted:boolean},replyCount:number,pinned:boolean,pinnedAt:null|string,pinnedBy:User|null}`. Plain text only. Max 8000 chars, 5 files. replyCount counts direct replies. Parent previews reflect current edits. After parent deletion, replies keep only its identifier and return `{id,body:'',user:null,files:[],deleted:true}`; deleted content is not retained. Pin state is shared by the room.
- Bootstrap authenticated `{needsSetup:false,user,workspace:{name},channels:Channel[],members:User[],teams:Team[],limits:{fileBytes:104857600},storage:{provider:'local'|'google-drive'}}`; unauthenticated `{needsSetup:boolean,workspace:{name},storage:{provider:'local'|'google-drive'}}`. Integrated members lists the active employee directory. No employee/team list, account email or quota is exposed before login.

## Auth and members
- GET `/api/health` => `{ok:true,service:'synk-company-messenger',version:1}`
- GET `/api/bootstrap`
- POST `/api/setup` `{workspaceName,name,username,password}` => bootstrap; owner + '공지', '정보방', '수다방', self channel; no demo messages/users. Username `[a-zA-Z0-9_.-]{3,32}`, password 10–128 chars, name 1–40. Only once even concurrent calls.
- POST `/api/login` `{username,password}` => bootstrap
- POST `/api/logout` `{}` => `{ok:true}`
- POST `/api/join` `{code,name,username,password}` => bootstrap; invite required
- GET `/api/members` => `{members:User[]}`
- GET `/api/directory` => `{members:User[],teams:Team[]}` active company employee/team directory, authenticated only; standalone teams is empty. Names and team/role metadata are available across the company to find coworkers and open DMs.
- POST `/api/invites` `{}` owner only => `{code,expiresAt}` (7 days, one use)
- GET `/api/invites` owner only => `{invites:[{id,createdAt,expiresAt,usedAt,revokedAt}]}` (never reveals code again)
- DELETE `/api/invites/:id` owner only => `{ok:true}`

## Chat
- GET `/api/channels` => `{channels:Channel[]}`
- POST `/api/channels` `{name,description,category?,scope?,memberIds?}` => `{channel:Channel}` (1–40 name, max 200 description). Generic/team categories remain public. New project category defaults to private selected membership; see project participation below. Explicit project scope=public retains all-crew participation.
- POST `/api/teams/:teamId/channel` `{}` => `{channel:Channel}`, 201 for creation or 200 for the existing room. Requires current membership in an active company team and integrated write permission; idempotent, one room per team. Only active employees currently assigned to that team join. An unrelated admin has no bypass. Viewers may read an existing room through bootstrap/channels but may not create it. Standalone requests and unrelated/inactive teams return 404.
- PATCH `/api/channels/:id` `{name?,description?,category?}` => `{channel:Channel}` participating creator or owner with write rights, public or selected project rooms only. Selected projects accept name/description edits and cannot change category. Existing rooms without a recorded creator can be edited by a participating owner. This never changes scope, membership, company team or private DM/self kinds.
- POST `/api/dms` `{userId}` => `{channel:Channel}` existing or new private DM
- GET `/api/channels/:id/messages?before=messageId&limit=50` => `{messages:Message[],hasMore:boolean}` chronological ascending per page
- POST `/api/channels/:id/read` `{messageId?:string}` => `{ok:true}`. Supply the last actually displayed message to avoid marking arrivals after the rendered snapshot as read. ID must belong to this room; the stored marker only advances, so an older tab cannot restore unread counts. Legacy `{}` marks through the current latest message. Integrated viewers may also update their own read marker.
- POST `/api/channels/:id/messages` `{body,fileIds:[],replyToId?:string|null}` => `{message:Message}` body or attachments required; only own unattached uploads from same channel. Replies require a still-existing parent in the same room after request-body/auth revalidation; inaccessible, missing or other-room parents return 404. Replies also remain in the normal timeline and unread counts.
- GET `/api/messages/:id` => `{message:Message}` room members only.
- GET `/api/messages/:id/replies?before=messageId&limit=50` => `{parent:Message,messages:Message[],hasMore:boolean}` latest direct replies in chronological order, limit 1–100, before must identify a reply to this parent. Deleted parent returns 404; its surviving replies remain in the room timeline.
- GET `/api/channels/:id/pins` => `{messages:Message[]}` newest pinned first, room members only.
- POST `/api/messages/:id/pin` `{}` => `{message:Message}` pin existing message in own room, at most 50 per room. Repeating the request preserves the original pin author/time.
- DELETE `/api/messages/:id/pin` => `{message:Message}` unpin, idempotent. Any room member with write permission may pin/unpin; integrated viewers may read pins but cannot change them. Deleting a message removes its pin automatically. Pins/replies publish the existing membership-filtered message SSE event.
- PATCH `/api/messages/:id` `{body}` => `{message:Message}` author only; no blank text unless files
- DELETE `/api/messages/:id` => `{ok:true}` author only or owner in public channels; attached local files removed, Drive files queued durably for trash. A Drive cleanup failure does not restore the deleted message; pending cleanup remains visible to the owner.
- POST `/api/messages/:id/reactions` `{emoji}` => `{message:Message}` toggle allowed emoji ['👍','❤️','✅','👀','🎉']
- GET `/api/search?q=...&channelId=...&authorId=...&from=YYYY-MM-DD&to=YYYY-MM-DD&fileType=all&offset=0&limit=50` => `{messages:Message[],hasMore,nextOffset}`. All filters are optional; q may be empty. from/to include the entire Korean calendar day (UTC+09:00), and reversed/invalid dates return 400. fileType is all (no attachment restriction), any (has an attachment), image/video/audio/document/archive/other. Author/date/attachment/access filters apply before pagination. limit 1–100, literal substring search, newest messages first.
- GET `/api/events` => SSE `event: update`, `data: {type:'message'|'channel'|'read'|'member'|'storage',channelId?:string}`; clients refresh relevant state. Membership-filtered; retry/reconnect supported. On client reconnect refresh channels + messages to reconcile. Storage changes notify clients without including credentials or account details. No message data leakage.

Team membership is synchronized from company records on requests, company mutations and SSE validation. Team transfers, departure, inactive employees or inactive teams remove membership without deleting messages, pins or file metadata. Other/new active teammates may access the team's existing history. Team or role changes close affected SSE subscriptions and invalidate requests still receiving bodies or awaiting file storage/download. Member events tell unaffected clients to refresh the directory. Clients must refresh directory/channels after reconnect and clear a previously selected room if access disappeared. A migrated team room is inaccessible from standalone authentication. Existing public rooms and private DMs/self notes retain their original access model.

### 프로젝트 참여와 초대

- New `category:'project'` rooms default to `scope:'private'`. `memberIds:string[]` selects existing active messenger crew IDs, with the creator automatically included. Omission creates a room containing only the creator. Duplicates are ignored; a request accepts at most 500 IDs and rejects inactive/unknown IDs. Viewers may be invited to read, but may not create rooms or add participants.
- An explicit `scope:'public'` creates an all-crew project. Public rooms reject memberIds instead of silently ignoring the selection. Previously stored public project IDs, scope, memberships, messages and files are unchanged. Existing public rooms cannot be converted automatically or through PATCH.
- `Channel.canInvite:boolean` is true for a selected project participant who has writing rights and is its creator/current successor or an owner/company admin. Public projects also expose canInvite when crew have explicitly left, so the same invitation interface can invite them again. Unrelated admins cannot inspect a room, invite themselves, edit its settings or bypass membership. Non-project public rooms, team rooms, DMs and personal notes return canInvite=false.
- GET `/api/channels/:id/members` => `{channel:Channel,members:User[]}` returns current active participants only, after normal room authorization.
- POST `/api/channels/:id/members` `{memberIds:string[]}` => `{channel:Channel,members:User[],addedIds:string[]}` adds participants atomically. Selected-room additions are idempotent. Public projects accept only active crew with an outstanding explicit departure; inviting clears their autojoin exclusion. Public requests with no absent departed crew return 409 explaining that all crew already participate. Other non-invitable rooms return 403; outsiders receive 404. No remove-other-person/conversion endpoint is provided.
- New participants can read the room's entire existing history and published attachments. Before adding anyone, every stored workspace card is validated through the same synchronous company source/audience resolver with the inviter and expanded active audience. If the source is no longer readable or any participant lacks access, no membership changes are committed; a safe 403/404 asks users to check source permissions or use a new room. Inviting never expands source-document permissions.
- Newly registered company or standalone crew join public rooms only. Company deactivation/departure removes selected-project memberships during synchronization; reactivation does not restore them without a fresh invitation. Team transfers alone do not remove a cross-team project's explicit invitation. Company role/session and membership validation still apply after slow request bodies and file storage/download awaits. Files, search, personal indexes and SSE retain their existing membership checks.
- A successful invitation publishes the existing membership-filtered `channel` SSE event so current and newly added participants refresh their room list. The event contains no history or member names.

### 프로젝트 대화방 나가기

- Channel adds `canLeave:boolean`, `activeMemberCount:number` and `archivedByLeave:boolean`. canLeave is true for any current participant in an active public/private project, including its creator, admins and company viewers. Protected room kinds and deleted rooms return false. activeMemberCount excludes inactive company identities when deciding whether only one participant remains.
- POST `/api/channels/:id/leave` `{}` => `{ok:true,newManagerId:string|null,archived:boolean}` removes only the caller's membership. Ordinary CSRF/origin/session checks still apply; leaving is a personal action permitted to viewers. Other room kinds return 403; outsiders/deleted rooms return 404. Repeating an already completed personal departure is safe. Clients cannot specify another user to remove.
- Messages, attachments, other memberships and room IDs are retained. The caller immediately loses history, file, search, sharing-target and personal-index access. Their other connected tabs receive a private `channel` event without channelId to reload lists, while remaining participants receive the room-specific event. Later room events are membership-filtered. Pending transfers recheck membership, and a departure revision also rejects a transfer started before leave-and-reinvite; currently streaming downloads for the departing user are cancelled without interrupting other crew.
- `channel_departures` persists `(channel_id,user_id,left_at,rejoined_at,revision)`. Outstanding departures have rejoined_at=null and are excluded from public autojoin during company roster sync, login/restart and room restoration. Only an explicit successful invitation or the narrow empty-room self-restoration below sets rejoined_at; a revision is retained to detect requests spanning departure/reentry. Public scope does not mean a departed person silently rejoins.
- When the creator leaves or no active writable creator remains, management passes to the earliest registered active participant with writing rights (createdAt, then ID). Current participants with owner/admin roles keep management rights. A read-only participant cannot acquire writing rights through succession. If there are only viewers, the first eligible writer later receives management; no unrelated admin bypass is created.
- The last active participant may also leave. The empty room is stored as a reversible archive using deleted_at/deleted_by plus `archived_by_leave` identifying that last person. Only this active last leaver, with their outstanding departure record, sees it in the existing deleted-room list and may restore their own participation. This narrow personal restoration also permits a viewer; it does not allow them to restore another person's archive or an ordinary deleted room.
- Empty-room restoration explicitly rejoins that caller and clears their departure exclusion, preserving the original history. Other departed crew remain excluded, including in public rooms. Existing workspace cards are revalidated for source and recipient **read** access for both public and private self-restoration, using the server-only purpose=restore hook. No source-document permissions are granted. Ordinary posting/inviting still uses purpose=share and requires writing rights.

UI last-person confirmation: “혼자 남은 방은 보관되며 삭제된 대화방에서 복원할 수 있어요.”

### 프로젝트 대화방 삭제·복원

Project deletion is reversible. The SQLite channel stores nullable deleted_at/deleted_by plus an internal lifecycle version through guarded migrations. No channel/message/file ID is changed, and deletion never trashes a committed Drive object or removes a local attachment. There is no permanent deletion or automatic expiry endpoint.

- Channel adds `canDelete:boolean`, `deletedAt:null|ISO`, `deletedBy:User|null`, `canRestore:boolean`. Only project channels (kind=channel, category=project, public/private scope) may be deleted/restored by their creator/current successor or owner/company admin who is an actual current participant and has writing rights. Unrelated admins have no bypass; viewers cannot delete or restore an ordinary deleted room. The last-leaver personal restoration exception is described above. System defaults, company team rooms, generic/team categories, DMs and personal notes are protected.
- DELETE `/api/channels/:id` => `{ok:true}` records deletion without destroying history. Repeating an authorized delete is safe and keeps the first deletion metadata. Outsiders receive 404; participants lacking management permission or protected room kinds receive 403.
- GET `/api/channels/deleted` => `{channels:Channel[]}` lists only deleted projects that the caller can restore, newest deletion first. The response is currently unpaginated. It exposes room metadata, not messages or attachments. Deleted shapes have canPost/canManage/canInvite/canDelete=false, canRestore=true, unread=0 and lastMessageAt=null.
- POST `/api/channels/:id/restore` `{}` => `{channel:Channel}` clears deletion and returns the original room ID. Repeating an authorized ordinary restore is safe. Public restoration includes current active crew except outstanding explicit departures, including new crew who joined while deleted. Every existing workspace card is revalidated for the restoring user's read access and this expanded audience before any changes commit; failure keeps the room deleted and memberships unchanged. Private restoration preserves explicit invitations, including deactivation/departure revocations processed while deleted; reactivated crew need a new invitation. The last-leaver exception explicitly rejoins only that former participant and rechecks card read access in private rooms as well.
- Deleted projects are absent from bootstrap/room lists, sharing targets, search, file lists, pins, reply routes, saved items, tasks, reminders, notifications/unread summaries and content/storage counts. Ordinary direct room/message/file APIs return 404, including previously saved URLs. Neither company nor standalone new crew autojoin a deleted public project.
- Stored private indexes remain attached to live message IDs for restoration. Due reminders in deleted rooms are paused without removing them; once restored, the regular due-inbox pass delivers each once if the recipient still has access.
- Deletion/restoration publishes the ordinary membership-filtered `channel` SSE event. Connected clients should refresh their list and clear a deleted room. Reconnection always loads current lists. Downloads recheck channel access after provider awaits, and deletion interrupts active download streams. Uploads/downloads begun before a delete-and-restore cycle cannot complete using the old room state; pending cloud uploads are cleaned through the existing durable outbox while already committed files remain intact.

UI wording should explain: “대화와 파일은 삭제된 대화방에서 복원할 수 있습니다.”

## 오늘 할 일에서 직접 등록 · 2026-10-10

- GET `/api/tasks/create-options` → `{date,channels:[Channel+{taskAssignees:User[]}]}`. `date`는 서버 한국 날짜이고, 대화방과 크루는 현재 작성 권한으로 걸러 반환한다. GET은 업무를 생성하지 않는다.
- POST `/api/tasks`는 `{requestId,channelId,title,body,assigneeId,reviewerId?,dueDate?}`만 받으며 `{message,task,created}`를 반환한다(신규201, 같은 요청 재시도200). `requestId`는 UUID, 제목은1~200, 요청 원문은1~8000 UTF-16단위다. 검토자와 기한은 생략/null일 수 있으며 담당/검토는 현재 그 방에서 작성 가능한 크루여야 하고 서로 달라야 한다. 기한은 유효한 `YYYY-MM-DD`다.
- 현재 세션·Origin/CSRF·작성 권한을 유지하며 회사 연동에서는 본문 수신 뒤 다시 확인한다. creator·stage·결과물·파일 등 추가 필드는400이다. 새 업무는 `requested`로 시작하고 기존 메시지 업무 API로 수락·작업·검토·완료한다.
- 원문 메시지·업무·변경 기록·일반/업무 알림·전송 영수증을 한 트랜잭션으로 저장하고 실패 시 모두 롤백한다. SSE는 커밋 뒤에 발행한다. 기존 표와 스키마를 재사용한다.
- 영수증은 사용자 단위 `direct-task:`+UUID로 일반 채팅 전송과 구분한다. 같은ID·같은 등록 내용이면 원래 메시지와 현재 업무를 반환하며 행/알림을 추가하지 않는다. 같은ID로 내용이나 방을 바꾸면409, 원래 메시지/업무가 삭제됐으면410이다. 수정 입력이나 새 등록 창은 새 요청으로 취급한다.

### 오늘 분류 근거와 관리 버튼 · 2026-10-10 운영 반영

- `Task.workday`는 `{date:string,todayReasons:string[],remainingReasons:string[]}`다. `date`는 관측한 서버 한국 날짜 `YYYY-MM-DD`이며, 요청한 사용자의 현재 담당·검토·요청 역할로 계산한다. GET `/api/messages/:id`의 `message.task`에도 포함되므로 상세를 열 때 최신 원문·단계·권한과 함께 다시 확인한다. PC 시계로 오늘 분류를 계산하지 않는다.
- `todayReasons` 키는 `reply`(내가 담당인 새 요청·수정 요청 확인), `due`(내가 수락·진행 중이며 오늘 또는 지난 기한), `review`(현재 내 검토 차례), `recovery`(현재 권한으로 검토자를 다시 지정할 차례)다. 새 요청·수정 요청은 작업 기한이 미래여도 `reply`로 표시하며, 이것이 작업 결과를 오늘까지 제출해야 한다는 뜻은 아니다.
- `remainingReasons` 키는 `upcoming`(내 수락·진행 작업의 미래 기한), `undated`(내 수락·진행 작업의 기한 미정), `waiting`(다른 담당자의 작업 또는 지정 검토자의 답변 대기)다. `waiting`은 해당 업무에 오늘 처리 이유가 없을 때만 붙는다. 담당·검토자가 참여할 수 없는 경우 분류는 유지하되 확인·재지정이 필요한 상태로 설명한다. 완료 업무는 두 배열이 모두 비어 있다. 열람 가능한 다른 크루의 업무라도 내 역할이 없으면 두 배열이 비어 있을 수 있다.
- GET `/api/workday`는 기존 legacy `groups/counts/total`을 유지하고 `today:{groups:{reply,due,review,recovery},counts,total}`, `remaining:{groups:{upcoming,undated,waiting},counts,total}`, `openTotal`, `serverNow`, `nextDayRefreshAfterMs`를 반환한다. 이 응답의 분류와 모든 업무·중첩 `message.task.workday`는 한 번 관측한 같은 서버 날짜를 사용한다. 다른 API 응답의 별도 직렬화까지 한 번의 시간 관측으로 묶는다는 보장은 아니다.
- 상세의 관리 버튼은 기존 상태·담당·기한·결과물 입력을 펼치고 허용된 입력으로 이동한다. 검토자 재지정 권한이 있으면 활성 새 검토자 선택칸을 먼저 열어 준다. 클릭만으로 PATCH·수락·완료를 실행하지 않으며, 확인한 내용을 **변경 저장**으로 명시적으로 적용한다. 조회 전용·대기·완료 및 참여 불가 안내는 기존 현재 권한과 `allowedStages`를 따른다.
- 새 스키마·저장 규칙·작성 권한은 추가하지 않는다. 현재 원문 접근 검사를 유지하고 읽기·관리 영역 펼치기로 업무나 알림을 변경하지 않는다. Windows·Linux 각각339/339과 합성 CUA11흐름·390/320px 화면 검증을 마쳤으며 실물 휴대폰 시험과 구분한다. 공식 Claude Opus5.5/max 재검수 완료·PASS 뒤 운영 반영과 기존 계정·자료 보존을 확인했다. 인수 기록은 [보완 검증 기록](qa-output/task-action-20261010/README.md)에 정리한다.

## 검토 복구·고객 알림·마감 묶음 · 2026-10-08 후속

- Task에 `reviewerId`, `reviewerUnavailable`, `canReassignReviewer`를 추가한다. 검토자가 현재 방에서 작성할 수 없는 `review` 업무만 PATCH `/api/messages/:id/task` `{revision,reviewerId,reassignReviewer:true}`로 재배정한다. 현재 작성 권한이 있는 요청자 또는 관리자만 가능하며 업무 담당자 본인은 제외한다. 새 검토자는 현재 방의 작성 가능한 다른 크루여야 한다. 담당자·결과물·기한·제목·단계는 유지하며, 별도 `task_reviewer_reassigned` 이력과 새 검토 알림을 남긴다. 새 검토자의 명시적 승인이 필요하다.
- 기존 `/api/notifications` 목록·배지·페이지 나누기·읽음 API에 `client_workflow`와 `due_digest`가 합쳐진다. 두 종류는 `message:null`이며 `id`를 URL 경로에 넣을 때 반드시 인코딩한다. 서버는 경로 한 구간을 디코딩하고 현재 사용자의 현재 접근 가능 항목과 대조한다. GET은 읽음·업무 완료를 기록하지 않는다.
- 고객 알림은 `{id:'client:…',kind:'client_workflow',type,title,text,projectTitle,createdAt,readAt,href,projectId,messageId,versionId,seconds}`다. 고객 피드백·문의·승인과 내부 검토 변경을 현재 담당자·검토자에게 전달한다. 프로젝트 변경과 같은 저장에서 내용 없는 이벤트 식별자를 기록하고 사용자별 읽음을 따로 저장한다. 알림 내용·링크는 현재 원문과 권한으로 구성한다. 프로젝트 보관·담당 변경·역할 변경·삭제 자료는 즉시 반영한다. SSE에는 변경 신호만 보내며, 고객 응답에는 알림 이벤트·읽음 기록을 포함하지 않는다. 하나의 고객 승인으로 여러 요청이 완료되어도 승인 알림은 한 번만 생성한다.
- 마감 알림은 `{id:'due:…',kind:'due_digest',message:null,createdAt,readAt,digest:{date,taskCount,overdueCount,tasks:Task[]}}`다. 한국시간 평일 09:00 이후 시작·15초 점검·알림 조회에서 본인의 오늘 마감/기한 지난 미완료 업무를 하루 한 번 묶는다. 대상이 없으면 생성하지 않고 이후 같은 날 추가된 업무를 기다린다. 일별 유일 키로 재시작 중복을 막고, 쉬었던 날짜의 알림을 소급 생성하지 않으며 가장 최근 묶음만 표시한다. 생성 후 추가된 업무는 다음 묶음에 들어가고 오늘 업무함에서는 즉시 보인다.
- GET/PATCH `/api/workday/notifications`는 `{enabled:boolean,includeWeekends:boolean,schedulerEnabled:boolean}`이다. 개인 기본값은 `{enabled:true,includeWeekends:false}`이며 서버 실행 여부는 `schedulerEnabled`로 구분한다. 끄면 마감 알림·배지만 숨기며 직접 설정한 개인 리마인더는 유지한다. 완료·재배정·원문 삭제·방 보관·탈퇴·무음 업무는 현재 묶음에서도 제외한다. 한 원문이 삭제돼도 같은 묶음의 다른 업무는 유지한다. `workNotificationsEnabled:false`에서는 조회·재시작으로 마감 알림을 만들지 않는다.

### 예약·마감 알림의 독립 실행 · 2026-10-09

- 회사 `SYNK_COMPANY_WORK_NOTIFICATIONS_ENABLED`는 `0`/`1`만 허용한다. 생략하면 기존 `SYNK_COMPANY_BACKGROUND_JOBS_ENABLED`를 상속한다. 명시적으로 업무 알림만1, 일반 자동 작업0이면 개인 리마인더와 마감 묶음의 시작/15초 점검만 실행하며 수집·Drive 삭제 큐는 중지한다. 기존 기기 푸시 설정은 별도다.
- 인증 bootstrap은 `scheduledNotifications:{enabled:boolean}`을 돌려준다. 마감 설정의 `enabled`는 개인 선택, `schedulerEnabled`는 서버 실행 상태다. UI는 중지 또는 구버전의 상태 미확인을 구분하며 예약 가능하다고 추측하지 않는다.
- 서버 중지 상태의 리마인더 PUT 및 최종 개인 설정이 `enabled:true`인 마감 PATCH는 `503`, `code:SYNK_WORK_NOTIFICATIONS_PAUSED`로 거절하며 기존 예약·설정을 바꾸지 않는다. 기존 예약 DELETE와 마감 끄기는 허용한다. 프런트 화면뿐 아니라 API에서도 확인한다.
- 다시 활성화하면 접근 가능한 지난 예약은 기존 유일 키로 한 번 전달하고, 일별 마감 묶음도 기존 날짜 유일 키를 사용한다. 과거 날짜별 마감 알림을 소급 생성하지 않는다. 퇴사·탈퇴·삭제된 원문의 알림을 전달하지 않으며 종료 후 남은 timer callback은 DB를 만지지 않는다. 새 테이블·마이그레이션은 없다.

후속 기능의 운영 반영 상태는 [검증 기록](QA.md)을 따른다. 일반 브라우저 밖으로 보내는 모바일 푸시나 외부 메일은 포함하지 않는다.

## 업무 연결 5종 · 2026-10-08

The original `Task.status` stays `todo|doing|done` for compatibility. Tasks now additionally expose `stage:requested|accepted|doing|review|changes|done`, `reviewer:User|null`, `resultMessageId:string|null`, a brief `resultMessage` without recursive collaboration extras, `revision`, and `allowedStages`. Existing rows migrate once from their original status without changing messages or attachments.

- POST/PATCH `/api/messages/:id/task` accepts `stage`, `reviewerId`, `resultMessageId` in addition to the existing fields. PATCH with workflow fields requires the current `revision`; stale updates return 409. Only the assignee accepts/works/submits a result; only the assigned reviewer approves or requests changes when review is required. Results must be live messages in the same room. Approved results require reopening before replacement. Assignment/reviewer changes cannot bypass a review.
- GET `/api/workday` returns `{date,groups:{reply,due,review,waiting},counts,total}`. `date` and due-date comparisons use Asia/Seoul. A task can belong to several groups; `total` is unique. Each result is checked against current room membership and current task roles. Reading does not accept, complete, or acknowledge anything.
- POST `/api/decisions` accepts `{messageId,summary,effectiveDate,kind:'decision'|'final',resultMessageId?,replacesId?,requestId?}` and returns `{decision}`. Final records require a result source. Same-room/same-kind replacements require original confirmer or administrator authority. Idempotent retries return the same record, conflicting replacement requests return 409. The old record never becomes current again merely because its replacement's source is deleted.
- GET `/api/decisions?q=&channelId=&kind=&current=1&offset=0&limit=50` returns `{decisions,hasMore,nextOffset}`. `current=0` includes superseded records. A decision contains confirmedBy/confirmedAt/effectiveDate, source and result message references, replacesId/replacedById and isCurrent. Every read rechecks source access.
- GET `/api/catch-up?since=&limit=100` returns `{since,through,hasMore,events}` ordered by stable sequence. Events have kind/actor/createdAt/current authorized source and changes. Kinds are task_created/task_stage/task_due/task_assignment/task_updated/decision/decision_replaced. GET is read-only. POST `/api/catch-up/read` with `{through}` updates only the caller's monotonic confirmation cursor; it never modifies task state.
- Integrated company GET `/api/client-workflow` returns `{items}` projected from current authorized customer projects. POST accepts `{projectId,messageId,revision,action,versionId?,note?}` with same-origin CSRF checks. Actions are start/submit_review/request_changes/accept/complete/reopen under current owner/reviewer authority. Feedback cannot use direct complete; customer approval remains exclusively in the customer route. Items contain secure source hrefs with project/version/message/seconds and do not create public chat posts or duplicate project state.
- The company assistant uses `messenger.productivityOverview(req,kind,query)` for these same authorized records. It never accepts caller-supplied identities or bypasses membership.

An assignee may add the first reviewer when none is assigned. Editing/deleting a message used as a result by a task in review/done returns 409 until a change request or reopening. A current final decision also locks its result source until a new final record replaces it. These guards apply to ordinary message PATCH/DELETE as well as task edits.

## Files and storage
- POST `/api/channels/:id/files` raw request binary, headers `X-File-Name: encodeURIComponent(originalName)`, `Content-Type: application/octet-stream` => `{file:File}`. Max 100 MiB, no executable inline previews; can upload any extension. Capture active storage connection when upload starts, stream to a random local staging file and compute MD5. For Drive, remote upload and size/MD5 verification complete before success; committed Drive uploads remove staging. Failures clean staging and return an explicit error without silently keeping a local success. Attachment is private to uploader until message published; channel members may download published files. Reject empty/oversize cleanly, remove partial files.
- GET `/api/files/:id` authenticated download through the server, using the file's original provider/connection. Membership is checked before accessing Drive. Remote folder/ownership markers, trash status, size and MD5 must match; manually changed cloud content returns 409.
- DELETE `/api/files/:id` => `{ok:true}` uploader's unattached file only (cancel upload); local removal or durable Drive trash request as above.
- GET `/api/files?q=...&channelId=...&uploaderId=...&type=all&offset=0&limit=200` => `{files:File[],hasMore:boolean,nextOffset:number|null}` published files in accessible channels, newest first. q is a literal filename substring (max 200 characters, `%`/`_` are not wildcards). Optional type is all/image/video/audio/document/archive/other. Combine room, uploader, name and type filters before pagination; limit 1–200, offset a nonnegative safe integer. nextOffset is null at the end. Private rooms remain membership-restricted even for owners; unattached uploads never appear in search/list results.
- GET `/api/storage` => `{bytes,fileCount,messageCount,memberCount,provider,drive?}`. In integrated mode counts are limited to accessible content for every role, including admins outside a team. Standalone members see accessible counts and standalone owners see overall counts except company-only team rooms. `drive` is owner-only and contains the sanitized Drive status from [DRIVE.md](DRIVE.md) plus `pendingDeletions`. Members receive the active provider without account/connection details. No automatic deletion.
- GET `/api/storage/drive` owner only => sanitized Drive status plus `pendingDeletions`; refreshes connection and real account quota.
- POST `/api/storage/drive/active` owner only `{connectionId:string|null}` => sanitized status plus `pendingDeletions`. Target must already be registered by the CLI. `null` explicitly selects local storage. Health is verified before switching; changes affect only later uploads. Previous files retain their provider/connection and are not migrated.

Drive deletion moves only app-owned files in the dedicated folder to trash, never permanently deletes them, and does not immediately release account quota. Cleanup intent is committed with the DB deletion and retried after failure on startup and periodically. Existing local files remain local after the guarded schema migration. `data/` backups contain DB, connection registry and local files, but not Drive file bodies.

## UI
Korean UI, first-run setup/login/join. Real live channels, self notes, members/DM, message author/time/edit/delete/reactions, paging, searchable messages, file browser/download, multiple attach/drag-drop/progress, invitation management, connection/retry states, persisted channel drafts. Owner settings show the Drive account, shared account quota, private folder link, registered connections and pending deletion count. No fake coworkers, numbers or history. Keyboard/IME-safe send, Shift+Enter newline, responsive mobile sidebar, reduced motion. Asset paths: `/assets/logo.svg`, `/assets/logo-felt.png`, `/assets/SUIT-Variable.woff2`, `/assets/InterTight-Medium.ttf`, `/assets/InterTight-Bold.ttf`, `/assets/DMMono-Medium.ttf`.

## 기본방과 협업 기능

The three public defaults are identified by `Channel.systemKey: 'announcements'|'info'|'social'|null`, never by their display name. Their names are 공지/정보방/수다방 and `canManage:false`; PATCH settings is forbidden even for admins. A guarded migration adopts only one untouched public generic legacy room with the exact original name/description and no creator/team/pair key. Ambiguous, private, team, edited and project rooms remain untouched. IDs, messages and attachments are preserved. A unique system key prevents duplicate defaults after restart.

`Channel.canPost` includes company role permission. Announcements accept new messages, replies, uploads, message edits and pin changes only from standalone owners/company admins. Members/managers may read/react and delete their own historical messages or cancel their own unpublished files. Company viewers retain read-only shared-content access. Other rooms keep existing posting permissions.

Message adds `{mentions:User[],workspaceLink:null|{title,url,kind},task:Task|null,saved:boolean,reminder:Reminder|null,ackRequired:boolean,acknowledged:boolean,ackCount:number}`. `saved`, `reminder` and `acknowledged` are computed for the requesting user. Bootstrap adds `notificationUnread:number`. Channel adds `notificationMode:'all'|'mentions'|'mute'`.

### 멘션·개인 알림

- Message POST/PATCH accepts `mentionIds:string[]` (at most 30 unique current room member IDs). It does not infer recipients from arbitrary text. Inaccessible/inactive recipients are rejected. Omitted mentionIds on edit preserves still-accessible recipients.
- GET `/api/channels/:id/notifications` => `{mode}`. PATCH same endpoint `{mode:'all'|'mentions'|'mute'}` changes only the caller's preference. Default mentions includes DMs, explicit mentions, replies to one's messages and task assignment/status changes. all also receives ordinary room messages. mute suppresses automatic room notifications; explicitly scheduled personal reminders still fire. A message does not notify its own sender. Mention takes priority over reply/DM to avoid duplicate alerts for one new message.
- GET `/api/notifications?unread=1&offset=0&limit=50` => `{items:[{id,kind:'dm'|'mention'|'reply'|'message'|'reminder'|'task',message:Message,createdAt,readAt}],unreadCount,hasMore,nextOffset}`. Omit unread to include already read entries. GET never marks notifications read.
- POST `/api/notifications/:id/read` `{}` and POST `/api/notifications/read-all` `{}` => `{ok:true,unreadCount}`. Only the caller's currently accessible entries are affected.
- New SSE type `notification` targets only the affected user and optional room membership. Its payload contains no notification/message text. Clients refresh the personal inbox. Existing message events also refresh task, ack, save and reminder indicators.

### 공지 확인

- Announcements default `ackRequired:true` on creation; administrator message POST/PATCH can set false. Other rooms cannot set true.
- POST `/api/messages/:id/ack` `{}` => `{acknowledged:true,message}`. Idempotently records the caller's explicit confirmation time. Merely opening/reading a room or reacting does not confirm it.
- GET `/api/messages/:id/acks` => `{total,acknowledged:[{user:User,acknowledgedAt}],pending:User[]}` for current active members of that announcement room. Room members, including viewers, may inspect and confirm. The author is not automatically confirmed.
- Editing an announcement clears its confirmations so confirmation of old content is never displayed as confirmation of the revised notice. Disabling confirmation leaves no currently displayed confirmation request.

### 메시지 업무

The fields below are the legacy-compatible subset; workflow stages, reviewers, revisions and result-source guards follow [업무 연결 5종](#업무-연결-5종--2026-10-08).

- Task `{id,messageId,channelId,title,assignee:User|null,dueDate:null|'YYYY-MM-DD',status:'todo'|'doing'|'done',createdBy:User|null,createdAt,updatedAt,canManage}`. Due date is a Korean calendar date, not a midnight UTC deadline. Deleted/inactive directory users appear as null instead of fabricating a current assignee.
- POST `/api/messages/:id/task` `{assigneeId,title?,dueDate?,status?}` => `{task}` (201 new, 200 existing); one task per message. PATCH same endpoint changes selected fields. Creation requires room posting rights. Editing requires posting rights plus task creator, assignee or admin/owner. Assignee must be a current active non-viewer room member. No admin bypass into a private/team room.
- GET `/api/tasks?scope=mine|channel|all&channelId=...&status=all|todo|doing|done&offset=0&limit=50` => `{tasks:[Task+{message:Message}],hasMore,nextOffset}`. Default scope mine means assigned to me. channel requires channelId; all means all accessible rooms. Assignment/state changes notify current/previous assignees and the task creator, subject to each recipient's room preferences.

### 화면 카드

- Message POST/PATCH accepts `workspaceLink:{title,url,kind?}|null`. A card alone may be sent with an empty body. Omission on PATCH preserves the previous card; null removes it.
- Only same-origin company `/` URLs are accepted. Legacy `#view=...` and query `?tab=...` normalize to relative `/#view=...`; no login tokens, credentials, external hosts, unknown or repeated query keys. Allowed views: marketing/overview/analysis/history/content/channels/studio; section and teamId are validated. Structured cards contain only a title and link, never a source document or report snapshot.
- `draftId` requires an integrated company permission resolver; otherwise 403. `integration.resolveWorkspaceLink({companyUserId,recipientCompanyUserIds,workspaceLink,purpose:'share'|'restore'})` synchronously verifies source/audience access and returns canonical title/link/kind immediately before writes. purpose is supplied only by the server: share is used for posting/editing/invitations and requires writing rights; restore validates active-user source/audience reading rights without granting posting permission. Input cards cannot override it. Shared titles remain historical message content; opening the source always rechecks current company permissions. `messenger.workspaceShareTargets(req)` is a server-internal helper returning accessible postable channels with companyUserIds and the active crew directory with companyUserId for company target selection. This internal mapping is not part of the public messenger API.

### 개인 저장·리마인더

- POST `/api/messages/:id/save` `{}` / DELETE same endpoint => `{saved:boolean}`. GET `/api/saved?offset=0&limit=50` => `{messages:Message[],hasMore,nextOffset}`. Only the caller sees their saved state.
- PUT `/api/messages/:id/reminder` `{remindAt:ISO string with Z or explicit offset}` => `{reminder:Reminder}`. Future time up to five years; stored as UTC. One personal reminder per message, replaceable. DELETE => `{reminder:null}`, cancels that reminder and its pending personal notification.
- Reminder `{id,messageId,channelId,remindAt,createdAt,deliveredAt:null|string}`. GET `/api/reminders?status=all|pending|due&offset=0&limit=50` => `{reminders:[Reminder+{message:Message}],hasMore,nextOffset}`. due means delivered to the personal inbox; reading the reminder list does not mark its notification read.
- Due reminders are checked every 15 seconds while the server runs, at startup and when opening the personal inbox/reminder list. An offline server catches up after restart; a transaction plus unique delivery key prevents duplicate notifications. A user must still be active and able to access the source when delivery occurs.

All six features use the existing SQLite DB with guarded schema additions. Notifications, tasks, saves and reminders reference live message IDs with ON DELETE CASCADE instead of retaining body snapshots. Every listing/open checks current membership; team departure, inactive roles and deleted messages cannot leak old content through personal indexes. Company viewers may manage their own notification preferences/read state, saves, reminders and announcement confirmations under normal CSRF validation, but cannot create/change messages or tasks. No paid service, external notification transport or browser permission is required for the in-app inbox.

## 직원 음성 통화 백엔드 · 2026-10-17 로컬

`voice-service.mjs`는 참가·상태 대조·권한·수명을, `voice-livekit.mjs`는 LiveKit Cloud 토큰·서명 검증·서버 API를, `voice-usage.mjs`는 사용량 추정·월 한도를, `voice-invitations.mjs`는 동료 초대·수락·개인 통화 알림/방해 금지를, `voice-sharing.mjs`·`voice-encryption.mjs`는 화면 공유·암호화 준비/키 교체를 담당한다. 기본 꺼짐이다. 화면·SDK는 아래 [화면·SDK 연결](#화면sdk-연결--2026-10-17)대로 연결했고 운영에는 반영하지 않았다. 아래는 독립 환경 경로이고 회사에서는 `/messenger`를 앞에 붙인다. 기존 회사 로그인·세션·Origin/CSRF·현재 방 접근을 사용하며 읽기 응답과 SSE에 참가 토큰을 넣지 않는다.

### 요청

| 요청 | 입력과 응답 |
|---|---|
| GET `/api/voice` | 인증 필수. `{enabled,mode:'audio',capacity,maxConcurrentParticipants,heartbeatSeconds:25,leaseSeconds:75,maxSessionSeconds,connectTimeoutSeconds:45,reconnectGraceSeconds:30,mediaState:true,resume:true,roomPolicy:true,usageEstimates:true,invitations:enabled,personalCallPreferences:enabled,invitationTtlSeconds:45,screenShare:enabled,maxConcurrentScreenShares:1,screenShareAudio:"room-opt-in",camera:false,recording:false,encryption:{required,mode,applicationServerTrusted:true,mediaVerified:false,metadataEncrypted:false}}`. 꺼졌을 때 `cleanupPending`도 제공한다. |
| GET `/api/channels/:channelId/voice` | 현재 방 구성원만. 위 capability와 `policy`, 본인의 `permissions`, `call:null` 또는 아래 통화 상태. 외부 미디어 조회가 필요하면 정리 주기에 맞춰 대조한 후 반환한다. |
| POST `/api/channels/:channelId/voice/join` | `{requestId:UUID,client:{protocol:'synk-livekit-e2ee-v1',supported:true}}`만. 현재 방·역할·정책으로 참가를 허용하고 아래 `admission`을 반환한다. 같은 원래 로그인/방/UUID는 같은 참가 건에 새 토큰을 발급한다. 자리·최대 시간을 늘리지 않는다. 끝난 요청은409, 다른 창/기기의 별도 참가 요청도 이미 참가 중이면409. |
| GET `/api/voice/current` | 현재 로그인에 묶인 본인의 가장 최근 참가만 `{admission:null\|{id,channelId,state,mediaState,observedAt,reason,leaseExpiresAt,sessionEndsAt}}`. 현재 방 접근이 없으면null. 토큰을 반환하지 않는다. 새로고침 후 상태 확인용이며 자동 참가/복구 요청이 아니다. |
| POST `/api/voice/:admissionId/resume` | `{}`. 같은 로그인·본인의 활성 참가에만 새 60초 토큰과 통화 상태를 반환한다. 현재 권한·임대·최대 시간·월 한도를 다시 확인한다. 재접속 유예·임대·최대 시간을 늘리거나 새 자리를 만들지 않는다. 다른 로그인/사용자는404, 종료 건은410. |
| POST `/api/voice/:admissionId/heartbeat` | `{}`. 본인의 임대를 최대 통화 시간 안에서75초 갱신한다. `{admissionId,leaseExpiresAt,mediaState,observedAt}`. **마이크·실제 접속의 증거가 아니다.** |
| POST `/api/voice/:admissionId/leave` | `{}`. 본인의 참가를 철회한다. `{ok:true,cleanupPending}`. 방을 나간 뒤/작성 권한을 잃은 뒤에도 원래 로그인의 본인 정리는 허용한다. |
| PATCH `/api/channels/:channelId/voice/policy` | `{revision,enabled?,locked?,maxParticipants?,memberCanSpeak?,viewerCanJoin?,screenShareEnabled?,memberCanShare?,screenAudioAllowed?}`. 현재 방 통화 관리자만. Boolean은 실제boolean, 인원은1~전체 상한의 정수. 현재 자리보다 작게 줄이면409, 오래된revision은409. 정책·감사 기록을 원자적으로 저장한 뒤 현재 참가 권한을 재검사한다. 최신 상태/본인 권한을 반환한다. |
| GET `/api/channels/:channelId/voice/audit` | 현재 방 통화 관리자만 `{items:[{id,action,actorId,targetUserId,reason,createdAt}]}` 최근50개. 정책 변경·참가 종료 사유·미허가 미디어 탐지만 기록하며 본문/소리/토큰/외부 신원은 저장하지 않는다. |
| GET `/api/voice/usage` | 회사의 현재 작성 가능한admin 또는 독립owner만. `{enabled,totals,cleanupPending}`. 전체 합계이며 사용자/방별 활동 순위나 대화 목록은 없다. 새 기능이 꺼져 있고 정리할 이전 참가도 없으면 `{enabled:false,limits,totals:null}`. |
| POST `/api/voice/:admissionId/usage` | 본인 활성 참가만 `{connectionId:UUID,sequence,bytesSent,bytesReceived}`. SDK peer connection별 누적 정수 카운터이며 새 연결은 새UUID를 쓴다. 같은sequence·같은내용과 더 오래된 보고는 중복 집계하지 않는다. 같은sequence의 다른 내용, 카운터 감소, 비정상 범위는409/400. 한 참가당 연결 보고32개까지. `{accepted:true,replayed}`. 접속 상태를 바꾸거나 사용 시간을 줄이지 않는다. |
| POST `/api/voice/webhook` | **이 경로만 회사 쿠키/CSRF를 사용하지 않는다.** `Content-Type:application/webhook+json`, 최대64KiB 원본 바이트와 `Authorization`의 LiveKit 서명JWT를 검증한다. 정상 응답은 `{accepted:true}`이며 상태·신원·토큰을 반환하지 않는다. Cloud 설정 시 외부 주소는 `/messenger/api/voice/webhook`다. |

`admission`은 `{id,state,mediaState,observedAt,reason,room,identity,serverUrl,token,tokenExpiresAt,leaseExpiresAt,sessionEndsAt,canSpeak,encryption,share}`다. room/identity는 무작위 식별자이며 이름·이메일·회사 ID·자료 제목은 공급자에 보내지 않는다. 토큰은 URL·DB·로그·SSE에 넣지 않는다. 암호화 준비가 끝나기 전에는 token이null이다. 기본 참가 토큰은 수신과 허용된 microphone만 가지며 화면 공유 슬롯에 한해 아래 소스 권한을 추가한다. data/camera/관리/녹음 권한은 없다. 듣기 전용이면 `canPublish:false`와 빈 publish source를 쓴다.

### 실제 상태·끊김 복구

통화 상태는 `{id,channelId,createdAt,sync:{status:'pending'|'current'|'unavailable',observedAt},reservations,participants,cleanupPending}`다.

- `reservations:[{userId,leaseExpiresAt,mediaState}]`는 서버가 허용한 활성 자리다. 처음에는 `connecting`이고 신호 연결이나 heartbeat만으로 connected로 바꾸지 않는다.
- `participants:[{userId,state:'connected'|'disconnecting',observedAt,microphone:{published,muted}}]`는 **공급자 ListParticipants의 ACTIVE 상태를 마지막으로 관측한 목록**이다. 게시된 트랙과 mute는 제공하지만 마이크 정상·상대가 실제로 들었다는 증거는 아니다. provider의 참가자 SID·토큰·메타데이터는 응답하지 않는다.
- 5초 주기로 조회하며 관측이15초보다 오래됐거나 마지막 조회가 실패하면 `sync`를 불확실 상태로 표시하고 participants를 비운다. 이때 빈 배열을 ‘아무도 통화하지 않음’으로 표시하지 않는다. 서버 자리는 유지될 수 있다.
- 첫 미디어 연결 유예는45초, 연결이 사라지거나 상태 조회가 실패했을 때 복구 유예는30초다. heartbeat/resume은 이 유예를 늘리지 않는다. 만료 경계에는 현재 공급자 상태를 한 번 더 확인해 폴링 사이에 복구된 연결을 불필요하게 끊지 않는다. 임대·회사 권한·최대 시간·월 한도는 조회 전후 계속 검사한다. 주기와 원격 요청 지연 때문에 종료 시각이 정확히 초 단위로 보장되는 계약은 아니다.
- 웹훅은 HS256·issuer·필수exp·nbf·원본 본문 SHA256의 표준base64를 확인한다(시각 오차5초). 이벤트ID·해시·종류·시각만 저장한다. 공급자 이벤트ID는 대소문자를 보존하는1~128자의 영문·숫자·`_`·`-` 문자열이다(UUID와 실제 Cloud의 `EV_…` 형식 포함). 클라이언트 요청UUID 검사와 별개이며 `createdAt`은 protobuf JSON의 숫자 문자열도 받는다. 최대7일의 이벤트를 받아 중복을 제거하고 현재 방 세대와 대조한다. 서명 이벤트도 **현재 상태를 다시 조회하라는 신호**로 처리해, 지연된 join/leave나 순서 역전이 현재 참가를 되살리거나 종료하지 않게 한다. 같은ID의 다른 본문은409. 모르는/끝난 방이나 다른 room SID는 무시하고200을 반환한다. 서명 없는 요청은401이다.
- 미허가 participant나 허용되지 않은 트랙을 발견하면 별도 미정리 기록을 남겨 철회한다. 공급자 제어 실패는 완료로 처리하지 않는다. 이전과 같이 `RemoveParticipant`의 명시적 `revoke_token_ts`로 Cloud 갱신 토큰도 철회하며, 실패는15초 뒤 재시도한다. 미정리 참가/미허가 미디어가 있으면 새 토큰 발급은503으로 막는다.
- 프로세스 재시작은 원래 세션 검사 함수를 복원하지 않는다. 기존 참가는 `server_restarted`로 철회 후 새 참가가 필요하며, 이전 참가를 자동 재승인하지 않는다. 꺼도 이전 키가 있으면 정리만 수행하고, 키가 없으면 `cleanupPending:true`를 유지한다.

통화 상태 변경은 `type:'voice',channelId`로 기존 멤버십 필터 SSE에 발행한다. 화면은 해당 방을 다시 읽고 SDK의 연결/재접속/개인 음소거·발화 상태와 서버의 마지막 관측을 구분한다.

### 방 권한

기본 정책은 `{revision:0,enabled:true,locked:false,maxParticipants:전체상한,memberCanSpeak:true,viewerCanJoin:false,screenShareEnabled:true,memberCanShare:true,screenAudioAllowed:false}`다. 본인의 `permissions`는 `{canJoin,canSpeak,canShare,canShareAudio,canModerate}`다.

- `나에게`와 기본 공지/정보/수다방은 통화 제외다. 일반·팀·프로젝트방과 DM의 현재 구성원만 들어갈 수 있다. 통화 전용 계정이나 외부 초대 권한은 추가하지 않는다.
- 기존 회사 작성 권한이 있는 구성원은 정책에 따라 참가/발언한다. 허용된 통화에서 일반 구성원의 발언은 memberCanSpeak를 따르고 통화 관리자는 발언할 수 있다. viewer는 방 정책이 명시적으로 허용한 경우에만 듣기 전용으로 참가한다. 회사의 별도 canWrite 철회는 viewer 허용으로 우회하지 않는다. viewer는 채팅/정책/전체 사용량을 수정하지 못한다.
- 통화 관리는 기존 방 관리 권한을 사용한다. 팀방은 그 팀의 현재 구성원이면서 작성 가능한 회사admin/manager인 경우 관리한다. 다른 팀·사적 프로젝트에 대한 관리자 우회는 없다. DM에는 통화 관리자 권한을 만들지 않는다.
- `locked`는 새 참가만 막고 기존 참가와 원래 로그인에서의 네트워크 복구는 유지한다. `enabled:false` 또는 입장 권한 회수는 현재 참가를 철회한다. **현재 발언 권한이 달라지면 기존 토큰을 철회하고 새로 참가하도록 한다.** 이 단계에서는 원격 마이크 켜기·실시간 발언권 승격을 제공하지 않는다.
- 앱에서 방별 인원을 검사한다. 공급자 room ceiling은 통화 수명 동안 전체 상한으로 고정해 기존 room의 CreateRoom 재호출로 한도가 바뀐다고 가정하지 않는다. 전체 상한은 별도로 모든 방의 미정리 자리를 포함해 검사한다.
- 권한은 원래 회사 세션·역할·소속·방 삭제/복원 버전·탈퇴/재초대 버전으로 재검사한다. 참가·재접속·웹훅 조회 결과·정리 대기 중 권한이 바뀌어도 이를 건너뛰지 않는다. leave/heartbeat/resume/개인 사용량 보고의 CSRF와 본인 소유 검사도 유지한다.

### 동료 초대·수락·통화 방해 금지 · 2차 후속

`voice-invitations.mjs`가 기존 통화 세대에 묶인 동료 호출과 개인 통화 알림 설정을 관리한다. 이 기능의 **방해 금지는 통화 초대 수신**에 적용한다. 기존 메시지·업무 알림 설정이나 직원의 실제 접속 상태를 바꾸지 않으며, 본인이 직접 통화방에 참가하는 것도 막지 않는다.

| 요청 | 입력과 응답 |
|---|---|
| GET `/api/voice/preferences` | 본인의 `{preferences:{revision:0,callNotifications:true,callSounds:true,doNotDisturb:false,doNotDisturbUntil:null}}`. 다른 사람의 설정을 읽는 경로는 없다. 꺼진 기능에서는 기본 설정만 반환한다. |
| PATCH `/api/voice/preferences` | `{revision,callNotifications?,callSounds?,doNotDisturb?,doNotDisturbUntil?}` 중 하나 이상 변경. 본인만, viewer도 허용, Origin/CSRF 필수. 실제boolean과 현재revision을 확인하며 충돌409. 방해 금지 종료는 시간대가 있는 ISO 시각으로 지금부터7일 이내, `null`/생략은 직접 해제할 때까지다. `doNotDisturb:false`는 종료 시각을 비운다. 소리 설정만 바꿀 때는 기존 방해 금지 기간을 유지한다. |
| POST `/api/channels/:channelId/voice/invitations` | `{requestId:UUID,recipientId:메신저사용자UUID}`만. **현재 로그인으로 해당 방 통화에 참여한 발언자**가 현재 방의 활성 동료 한 명을 초대한다. 새 요청201/재시도200 `{created,invitation}`. 여러 동료는 각각 요청하되 아래 제한을 따른다. 초대만으로 상대의 자리나 토큰을 만들지 않는다. |
| GET `/api/voice/invitations` | 현재 방 접근이 남아 있는 본인의 발신·수신 초대 최근100개 `{items}`. 다른 직원/관리자의 호출 이력은 제공하지 않는다. |
| GET `/api/voice/invitations/:id` | 당사자이면서 현재 방 접근이 있을 때만 `{invitation}`. 오래된 푸시를 열면 이 요청부터 확인한다. 접근이 없거나 제삼자면404. |
| POST `/api/voice/invitations/:id/accept` | 수신자만 `{requestId:UUID,client:{protocol:'synk-livekit-e2ee-v1',supported:true}}`. 기존 참가 API와 같은 방 권한·전체/방 인원·월 한도·미정리 연결 검사를 통과한 뒤 `{invitation,...통화상태,admission,permissions}`. 처음 성공한 로그인/수락UUID만 같은 참가 건을 재조회하며 자리·임대를 늘리지 않는다. 다른 로그인/다른 수락UUID는409, 본인 참가도 이미 종료됐으면410. |
| POST `/api/voice/invitations/:id/reject` | 수신자만 `{}`. `{invitation}`. 같은 거절 재시도는 멱등이며 이미 수락/취소/만료됐으면409. |
| POST `/api/voice/invitations/:id/cancel` | 발신자만 `{}`. `{invitation}`. 같은 취소 재시도는 멱등이며 수락 완료 후에는409다. 이미 참가한 동료를 내보내는 API가 아니다. |

`invitation`은 `{id,callId,channelId,fromUserId,toUserId,state,createdAt,expiresAt,updatedAt}`다. 수신자의 `pending` 항목에만 `alert:{id,expiresAt,soundEnabled}`가 붙는다. **알림/목록 조회와 읽음 처리는 수락이 아니다.** 미디어 자격증명·세션 해시·상대의 방해 금지/무음 상세는 응답하지 않는다.

- 상태는 `pending → accepting → accepted` 또는 `rejected/cancelled/expired/unavailable/failed`다. 만료는 생성45초 후이며 수락 중에도 연장하지 않는다. 용량/공급자 오류로 수락이 실패한 요청은 `failed`가 되고 같은 초대를 되살리지 않는다. 수락 요청을 재전송할 때는 반드시 같은UUID를 쓰며, 이미 수락한 통화의 네트워크 복구에는 기존 `current/resume`을 쓴다.
- 호출은 방 접근 권한을 부여하지 않는다. 현재 직원·현재 방 멤버십·역할/소속·방 삭제/복원·탈퇴/재초대 버전·방 정책을 계속 대조한다. viewer는 방의 명시적 청취 허용이 있을 때 수락할 수 있지만 동료를 호출하지 못한다. 다른admin도 사적 방을 우회하지 못한다.
- 개인 통화 알림 끄기·방해 금지·방 `mute`·다른 통화/철회 대기 중·이미 다른 발신자의 초대 대기 중이면 새 초대는 일반적인 `unavailable`로 종료한다. 원인을 발신자에게 구분해 주지 않는다. `mentions`는 특정 동료의 직접 호출을 허용한다. 방해 금지를 해제하거나 기간이 끝나도 이전에 차단한 호출은 되살리지 않는다. 이미 수락한 통화는 방해 금지만으로 끊지 않는다.
- 발신자 나가기·원래 로그인 상실·방 접근/정책 변경·서버 종료/재시작·기능 끄기 때 대기 중 초대도 종료한다. 수락이 원격 서버 응답을 기다리는 동안 취소/거절/방해 금지/발신자 나가기를 처리할 수 있으며, 반환 직전 다시 검사해 취소된 요청에 상대 토큰을 반환하지 않는다. 프로세스를 다시 켜도 옛 대기를 자동 복원하지 않는다.
- 같은 두 사람은 발신 방향과 무관하게60초에 새 호출1회, 발신자별1분5회/1시간30회, 수신자별5분10회다. 차단된 새 호출도 계산하고 동일 요청 재전송은 추가 계산하지 않는다. 기록은 SQLite에 있어 재시작으로 제한을 우회하지 못한다. 제한은429 `VOICE_INVITATION_RATE_LIMIT`이며 UI에서 자동 재호출하지 않는다. 완료한 초대 영수증은30일 뒤 정리하며 원래 참가/방 기록의 참조도 먼저 정리한다.
- 기존 개인 알림함에 `kind:'voice_invitation'`, `id:'voice:<초대UUID>'`, `voiceInvitation`, `expiresAt`를 실시간 원본으로 투영한다. 본문 메시지나 별도 복제 알림을 생성하지 않는다. 수락/거절/취소/만료/차단/접근 철회 후에는 현재 알림함과 새 푸시 후보에서 빠진다. 읽음은 푸시의 읽지 않음 조건에 반영하지만 초대의 응답 상태를 바꾸지 않는다.
- SSE는 해당 사용자에게만 `type:'voice_invitation'|'voice_preferences'|'notification'` 변경 신호를 보낸다. 본문/토큰/상태 상세는 싣지 않는다. 클라이언트는 현재 초대/설정을 다시 읽고 `alert.id`당 중복 울림을 막으며, 종료 시각이 지난 항목을 울리지 않아야 한다. 새로고침/다른 화면에서 알림함을 읽었다는 이유로 참가하거나 마이크를 켜지 않는다.
- 기존 선택형 기기 푸시는 현재 상태를 전송 직전에도 확인하고 초대 만료까지로 TTL/재시도를 줄인다. `callSounds:false`는 앱 내 무음 알림을 유지하고 **빈 본문 푸시가 OS 소리를 제어할 수 없으므로 통화 푸시 후보에서는 제외**한다. 기기 등록·브라우저 알림 권한·푸시 켜기를 자동 수행하지 않는다. 새 초대는 30초 점검을 기다리지 않고 바로 한 번 보낸다. 초대는 늘 따로 한 번(`Urgency: high`·`Topic: synk-company-calls`·초대 만료까지의 TTL), 같은 차례의 나머지 알림은 그 뒤에 `normal`·원래 Topic으로 한 번 더 보낸다. 그래서 대기 중인 통화 푸시를 다음 멘션 푸시가 바꾸거나 긴급도를 낮추지 못한다(10-20). 구독 열쇠가 있는 기기에는 통화 푸시에만 암호화한 `{"kind":"call"}` 표시를 싣고, 서비스 워커는 그 표시를 받으면 따로 tag·`renotify`·진동으로 울린다. 잠금 화면 글은 그대로 「확인할 새 업무가 있어요」다. 열쇠가 없는 예전 기기는 로그인한 회사 화면이 이 브라우저의 같은 구독을 `keysOnly:true`로 한 번 더 보내 열쇠만 붙인다 — 서버는 현재 로그인의 켜진 행에만 열쇠를 더하고, 그 행이 없거나 꺼졌으면 404로 끝내 기기를 새로 등록하거나 되살리지 않는다(10-20). 이미 외부 사업자가 접수한 푸시는 회수할 수 없으며 OS 전달/백그라운드 제한 때문에 전화처럼 즉시 울림이나 모든 기기의 동시 종료를 보장하지 않는다.


### 화면 공유·E2EE · 3차 후속

`voice-sharing.mjs`는 전체 워크스페이스의 공유 슬롯1개와 소스별 권한·정리를, `voice-encryption.mjs`는 통화별 공유 키·참가자 변경·키 확인을 관리한다. 실제 미디어 암호화/복호화는 LiveKit 클라이언트 SDK가 수행한다. **10-17 화면·SDK를 연결해 한 PC의 두 브라우저 세션으로 실제 Cloud 송수신·복호화를 확인했다. 서로 다른 두 실제 기기·다른 망의 검증은 아직이다.**

#### E2EE 필수 참가와 키 교체

환경변수로 통화를 켜면 E2EE가 필수다. `join`과 초대 `accept`에 `{requestId,client:{protocol:'synk-livekit-e2ee-v1',supported:true}}`를 보낸다. 지원 여부를 확인하지 않은/옛 클라이언트는426 `VOICE_E2EE_REQUIRED`이며 평문 참가로 낮추지 않는다. 준비 중 응답의 `admission.token`/`tokenExpiresAt`은 **null**이다. 이는 실패나 자동 재시도 지시가 아니며 아래 키 준비를 해야 한다. 초대 수락은 통화 동의가 완료된 상태이고 키 준비/실제 미디어 연결과 별개다.

| 요청 | 입력과 응답 |
|---|---|
| POST `/api/voice/:admissionId/encryption/key` | `{}`. 원래 회사 로그인·본인의 활성 참가·현재 방 권한만. `{required:true,protocol,mode,callId,admissionId,epoch,keyIndex:0,key,challenge,proofContext,status,ready,...}`. **키가 나오는 유일한 경로**이며 Origin/CSRF·no-store를 적용한다. 공개 워크스페이스는 HTTPS만, 로컬 loopback HTTP는 합성 시험용으로 허용한다. 다른 사용자/다른 로그인404, 종료410, 원격 정리 중503, 키 교체 대기409. |
| POST `/api/voice/:admissionId/encryption/ack` | `{epoch,sdkEnabled:true,workerReset:true,proof}`만. `proof = base64url(HMAC-SHA256(UTF8(key),UTF8(proofContext)))`다. `key`는 반환된 base64url 문자열 **그대로** SDK 공유 암호와 HMAC 키로 사용한다. 임의의 다른 키/과거epoch/지원 끄기는409. 본인 준비를 확인하고 통화 상태/`admission`을 반환하며 모두 준비한 경우에만 미디어 JWT를 발급한다. |

클라이언트 연결 순서:

1. 브라우저의 보안 컨텍스트·인코딩 변환/E2EE worker 지원을 확인하고 사용자의 참가/수락 동작으로 위 `client` 계약을 보낸다. 지원하지 않으면 통화를 멈추고 안내한다.
2. `token:null`이면 본인 key API를 호출한다. `pausing` 중에는 로컬 발행을 중단하되 기존 신호 연결은 유지하고, 키 API가 준비될 때까지 현재 상태를 다시 확인한다. 기존 미디어가 남아 있으면 서버는 새 키를 주지 않는다.
3. 현재 키를 받으면 기존 SDK Room·로컬 트랙·E2EE worker·이전 키 참조를 폐기하고 새 `ExternalE2EEKeyProvider`, E2EE worker와 SDK Room을 만든다. 최신 공식 가이드의 `RoomOptions.encryption`에 keyProvider/worker를 넣고 `await keyProvider.setKey(key)`, `await room.setE2EEEnabled(true)`를 마친 뒤 ACK한다. 평문 SDK Room·이전 worker·이전 키로 자동 폴백하지 않는다.
4. ACK 응답이 아직 `token:null`이면 다른 참가자의 준비 또는 이전 토큰 철회 시각 경계를 기다린다. `type:'voice'` SSE와 상태를 확인하고, 모두 준비되면 같은 참가의 `resume`으로 토큰을 받아 새 SDK Room에 연결한다. `encryption.ready:true`여도 철회 시각 경계 전에는 `token:null`일 수 있으므로 잠시 뒤 같은 참가를 resume한다. 마지막 ACK도 이 경계를 지킨다. 기존25초 heartbeat·나가기·최대 수명/방 권한 계약은 계속 적용한다.
5. 참가자 추가/퇴장/권한 회수로 epoch가 달라지면 같은 절차를 다시 한다. 교체를 위해 통화가 잠시 중단될 수 있고 진행 중인 화면 공유는 종료된다. 화면 재캡처는 사용자 동작으로 다시 시작한다. 같은 로그인에서의 SDK 재접속 자체는 참가자를 추가하거나 epoch를 바꾸지 않는다.

공개 통화 상태/본인 `current`·`admission`의 `encryption`은 `{required,protocol,mode:'application-managed-shared-key',applicationServerTrusted:true,status:'pausing'|'awaiting_acks'|'ready',epoch,keyIndex:0,ready,pendingParticipants,mediaVerified:false,metadataEncrypted:false,sdkRoomResetRequired:true}`다. 키·challenge·proof는 이 상태와 bootstrap·SSE·알림·DB·로그·LiveKit 토큰/메타데이터에 넣지 않는다.

키 준비 중 본인 참가의 `mediaState`는 `securing`이다. 공급자에 이전 신호 연결이 `ACTIVE`로 남아 있어도 새 epoch가 준비되기 전에는 연결된 참가자로 표시하지 않는다. 참가 응답도 예약 당시 사본이 아닌 현재 준비 상태를 반환한다.

- 새 참가 집합마다 Node CSPRNG로 새32바이트 키를 만들며 RAM에만 보관한다. 기존 키 버퍼와 확인 상태는 즉시 폐기한다. Cloud `UpdateParticipant`로 기존 참가자의 발행/구독을 일시 중단하고, 실제 트랙이 사라졌으며 퇴장자/미허가 미디어의 철회가 끝난 뒤 새 키를 제공한다. Cloud의 권한 변경만으로는 시계 여유 때문에 최근 원본·갱신 JWT가 다시 들어올 수 있어(10-18 실측), 일시 중단할 때마다 `RemoveParticipant`의 `revoke_token_ts`로 이전 JWT를 따로 철회하고 그 시각이 지나기 전에는 새 JWT를 내주지 않는다(10-18 GPT 보안 고침 `c9c4fa7cd`).
- 원격 제어·정리 확인 실패 또는 모든 참가자의 준비가30초 안에 끝나지 않으면 새 키/토큰 발급을 멈추거나 해당 참가를 종료한다. 회수 실패를 성공으로 처리하지 않는다. key/ACK/resume을 반복해도 키 준비 기한·자리·임대·2시간 한도를 늘리지 않는다. 재시작/종료 후 이전 키나 참가를 자동 복원하지 않는다.
- 필수 방에서 관측한 트랙의 암호화 메타데이터가 `GCM`이 아니거나 확인되지 않으면 해당 참가를 철회한다. ACK는 키 소지와 클라이언트의 준비 신고이며, 공급자의 메타데이터도 실제 프레임 암호화·상대의 복호화 증거를 대신하지 않는다. 그러므로 `mediaVerified:false`를 유지하며 화면에서 ‘E2EE 검증 완료’라고 표시하지 않는다.
- 이 방식은 **SYNK 애플리케이션 서버를 신뢰하는 키 관리**다. LiveKit에는 키를 보내지 않지만 SYNK 서버와 정당한 참가자는 키를 안다. SYNK 운영자/서버 침해나 악성 참가자로부터 내용을 숨기는 MLS·단말 간 인증 키 교환을 구현한 것은 아니다. 신호·참가 메타데이터·기존 SQLite 채팅/파일도 E2EE 범위가 아니다. 녹음·전사·카메라·LiveKit data 발행은 허용하지 않는다.
- SDK 내 동일 Room의 ratchet/keyring을 직접 구현하지 않고 **epoch마다 새 SDK Room/worker와 한 개의 공유 키**를 쓴다. 끊김 없는 키 교체/지원 플랫폼 확대는 별도 SDK 실기 검증이 필요하다. 이전 동작 회귀에서만 주입하는 `e2eeRequired:false`는 평문 합성 호환 시험 옵션이며 운영 환경변수로 노출하지 않는다.

#### 화면 공유 권한과 수명

| 요청 | 입력과 응답 |
|---|---|
| POST `/api/voice/:admissionId/share/start` | `{requestId:UUID,withAudio:boolean}`만. 원래 로그인·현재 활성 미디어 참가·E2EE 준비·본인 공유 권한·전체 사용량을 확인한다. `{share,...통화상태,admission}`. 같은 참가/요청/소리 선택은 같은 공유를 반환하고 종료/정리 중 요청은409다. 전체 다른 공유/정리 슬롯이 있으면409 `VOICE_SHARE_CAPACITY`. |
| POST `/api/voice/:admissionId/share/stop` | `{}`. 본인만, CSRF 필수. `{share:null|현재공유,cleanupPending}`. SDK에서 로컬 캡처를 먼저 중단하고 서버에 알린다. 시작의 원격 응답을 기다리는 동안에도 stop을 표시해 늦은 권한 상승 응답/토큰 발급을 막는다. |

`share`는 `{id,admissionId,state:'starting'|'sharing'|'stopping',withAudio,createdAt,observedAt,expiresAt}`다. starting의 발행 유예는45초이며 실제 공유 상태는 공급자에서 관측한 `SCREEN_SHARE` 영상으로 확인한다. 화면이 사라지거나 브라우저의 공유 중지·권한 회수·퇴장·키 교체·유예 만료가 생기면 정리한다.

- 방 정책은 기존 revision 계약에 `screenShareEnabled:true`, `memberCanShare:true`, `screenAudioAllowed:false`를 추가했다. 본인 권한은 `canShare`와 `canShareAudio`로 반환한다. 현재 방의 작성 가능한 참가자만 공유하며, 듣기 전용 viewer에게 공유 권한을 주지 않는다. 관리자의 사적 방 접근 우회도 없다. 공유만 회수해 정상 정리되면 음성 참가는 유지한다.
- 공유 버튼의 사용자 동작에서 SDK `createScreenTracks`로 창/탭을 먼저 고르고 로컬 트랙만 준비한다. 서버 start가 허용한 뒤 암호화된 SDK Room에서 발행하며, 거절/취소/실패하면 로컬 트랙을 바로 중단한다. 화면 선택 전에 오래 걸리는 서버 응답을 기다리거나, 소스 권한 확인 전에 자동 발행하지 않는다.
- 음성 JWT는 기본 microphone만 허용한다. 슬롯을 확보한 본인에게만 `screen_share`를 추가하고, 방에서 명시적으로 켠 화면 소리를 사용자가 `withAudio:true`로 선택한 경우에만 `screen_share_audio`를 추가한다. microphone·화면 영상·화면 소리는 각각 최대1개이고 camera/알 수 없는 소스/다중 동일 소스는 철회한다. 화면 소리는 브라우저/캡처 종류에 따라 제공되지 않을 수 있다.
- 종료/권한 회수는 Cloud 권한을 줄인 뒤 `RemoveParticipant`의 `revoke_token_ts`로 이전의 넓은 JWT를 따로 철회하고(연결은 끊기지만 음성 참가는 남고, 철회 시각이 지난 뒤 새 JWT로 다시 붙는다 — 10-18 GPT 보안 고침 `c9c4fa7cd`), 공급자 목록에서 공유 트랙이 없어졌을 때 슬롯을 반환한다. 기존에 허용한 공유는 먼저 권한을 줄여 정리하므로 상태 조회가 겹쳐도 정상적으로 철회된 화면 때문에 음성 참가까지 종료하지 않는다. 중지 확인이 안 되면 해당 참가 전체를 철회하고 원격 확인 전까지 정리 중 자리를 유지한다. 새 공유나 토큰 갱신으로 철회를 우회하지 못한다.
- `share/stop`은 start의 최초 상태 조회 대기 중에도 해당 시점에 진행 중인 시작 요청을 취소한다. 아직 공유 행이 없더라도 늦은 슬롯 예약·화면 JWT 발급을 막으며, 취소한 요청은 종료 영수증으로 남겨 같은 `requestId` 재전송도409 `VOICE_SHARE_REQUEST_ENDED`로 막는다. 새 공유에는 새 사용자 동작과 새UUID를 쓴다. 다른 사용자/로그인의 stop은 취소 권한을 얻지 않는다. 원격 권한 상승 응답 뒤에는 현재 참가·임대·최대 수명·사용량을 다시 검사한다.
- 전체 공유 상한1명과 기존 전체4명·계정당1참가·2시간·월1000참가자분/1GB 한도를 유지한다. 수신 추정에는 공유 예약부터 정리 확인까지 다른 참가자마다 **화면1.5Mbit/s + 선택한 화면 소리128kbit/s**를 기존 음성64kbit/s에 더한다. 실제 코덱/해상도/bitrate를 백엔드에서 이 값으로 제한하거나 공급자 청구 상한을 보장한 것은 아니다. 클라이언트 누적 수신량과 추정 중 큰 값을 기존 월 한도에 적용한다.
- 브라우저 화면/창/탭 선택·운영체제 권한·720p 안팎의 캡처/낮은 프레임·실제 송수신과 소비량은 [화면·SDK 연결](#화면sdk-연결--2026-10-17)과 실제 기기 검증 범위다. 통화가 켜졌을 때만 메신저의 마이크·`display-capture`·LiveKit 연결 정책을 연다. 자동 캡처·원격 마이크 켜기는 없다.

기술 계약은 2026-10-17 사용자 Chrome에서 확인한 LiveKit [E2EE 범위와 앱의 키 관리 책임](https://docs.livekit.io/transport/encryption/), [SDK 준비 순서·외부 공유 키](https://docs.livekit.io/transport/encryption/start/), [RoomService 권한 변경·Cloud 토큰 철회](https://docs.livekit.io/reference/other/roomservice-api/), [화면 공유와 탭 소리](https://docs.livekit.io/transport/media/screenshare/)를 따른다. 실제 SDK/Cloud 호환과 미디어 보호 검증을 이 문서나 합성 시험으로 대체하지 않는다.


### 화면·SDK 연결 · 2026-10-17

메신저 [voice.js](public/voice.js)가 위 계약을 쓰는 클라이언트다. 검증 결과는 [QA](QA.md#통화화면-공유-화면과-sdk-연결--2026-10-17).

- **수명:** 통화는 메신저 iframe 문서가 소유한다. 회사 워크스페이스는 `GET /messenger/api/voice`가 `enabled:true`일 때만 iframe을 미리 불러 숨겨 두고, 메뉴를 옮겨도 지우지 않는다. 로그아웃·계정 변경은 iframe을 지워 SDK·캡처를 끝낸다(문서 `pagehide`에서도 트랙·Room·worker를 정리). 서버 쪽 철회는 기존 로그아웃 계약을 따른다.
- **참가:** 참가 전 창에서 마이크를 확인한 뒤 위 `client` 계약으로 join/accept한다. 네트워크 무응답만 같은 UUID로 두 번까지 다시 보낸다. 응답 직후부터 25초 heartbeat를 보낸다. `token:null`이면 key → 새 `ExternalE2EEKeyProvider`·worker·`Room({encryption})` → worker 초기화 확인 → `setKey(key)` → `setE2EEEnabled(true)` → WebCrypto HMAC proof → ACK. ACK 요청이 실패하면 같은 proof로 다시 보내고(키가 맞지 않다는 409면 키부터 다시), 토큰이 없으면 `type:'voice'` 신호와 현재 상태로 준비를 확인한 뒤 같은 참가의 resume으로 받는다. 서버가 `encryption.required:true`가 아니면 연결하지 않는다.
- **키 교체:** `pausing` 또는 epoch 변경을 보면 마이크 발행과 화면 공유를 멈추고, 새 키를 받은 뒤 이전 Room·트랙·worker를 버리고 다시 준비한다. 화면 재공유는 사용자 동작으로만 시작한다.
- **복구:** SDK가 스스로 재접속하지 못하면 `current`로 참가가 살아 있는지 보고 같은 참가의 resume으로 다시 연결한다. 실패는 2·4·8·15초 간격으로 다시 시도하며 끝은 서버의 연결·재접속 유예가 정한다. 새로고침 뒤에는 `current`로 끊긴 통화를 보여 주고 사용자가 '다시 연결'을 눌렀을 때만 키부터 다시 준비한다. 같은 브라우저의 다른 탭이 통화 중이면 다시 연결 단추를 숨긴다.
- **화면 공유:** 클릭에서 `createScreenTracks`(720p·15fps, 방이 허용하면 화면 소리 선택 가능) → `share/start` → 로컬 참가자 권한에 화면 소스가 반영된 뒤 발행. 선택 창 취소는 start를 보내지 않는다. 사용자 중지·브라우저 공유 중지·실패·키 교체는 트랙을 멈추고 `share/stop`을 보낸다. 다른 사람이 공유 중이면 단추를 막는다. `share/start` 응답의 토큰은 다음 연결에 쓰지 않는다(이미 연결된 Room은 Cloud 권한 변경으로 반영된다).
- **초대·설정:** 초대 알림을 열면 `GET /api/voice/invitations/:id`로 현재 상태만 다시 읽는다. 울림은 `alert.id`마다 한 번(같은 브라우저의 탭끼리도)이고 만료된 초대는 울리지 않는다. 수락 재전송은 처음 UUID를 쓴다. 개인 통화 알림·소리·방해 금지와 방 통화 설정(관리자) 창을 제공한다.
- **표시:** 내 상태는 SDK 연결, 다른 사람은 서버의 최신 관측을 따른다. 관측이 오래됐거나 조회가 실패하면 '상태 확인 중'으로 두고 '없음'으로 보이지 않는다. 암호화는 '암호화(서버 관리 키)'까지만 표시한다.
- **부모↔iframe 메시지:** iframe은 `messenger:voice` `{voice:{call,incoming}}`(상태 요약, 토큰·키 없음)을 보내고, 부모는 `workspace:voice` `{action:'mute'|'leave'|'stop-share'|'open'|'accept'|'reject',invitationId?}`를 보낸다. 두 문서 모두 같은 origin·출처 창을 확인한다.
- **저장:** 토큰·키·proof는 메모리에만 둔다. localStorage에는 고른 마이크·스피커와 울린 초대 ID만 남는다.

### 사용량과 기본 한도

기본 시험값은 **전체 동시4명·계정당 참가1건·1회 최대7200초·월1000참가자분·월1,000,000,000바이트 추정 다운스트림**이다. 마지막 두 값은 이번에 정한 낮은 앱 시험 예산이며 공급자의 무료 제공량·청구 상한을 뜻하지 않는다. 이번 작업에서 실제 서비스 설정이나 한도를 변경하지 않았다.

`totals`는 `{month,timezone:'UTC',limits,participantMinutes,observedParticipantMinutes,unverifiedParticipantMinutes,estimatedDownstreamBytes,clientReportedSentBytes,clientReportedReceivedBytes,exhausted,source:'application-estimate',providerBillingVerified:false,assumedAudioBitrateBps:64000,assumedScreenBitrateBps:1500000,assumedScreenAudioBitrateBps:128000,transferReportsComplete:false,observedAt}`다.

- `participantMinutes`는 토큰을 허용한 자리의 시간이며 종료 요청 후에도 **원격 철회 확인까지** 누적한다. 실제 통화 시간이나 공급자 청구 분과 같다고 표시하지 않는다. 활성 미디어를 최근 관측한 시간 추정과 미확인 구간을 별도로 기록하며, 재시작/조회 실패를0분으로 정산하지 않는다. UTC 월 경계로 나누고 월 합계13개월을 보존한다.
- 전송량은 같은 방의 다른 예약 자리마다64kbit/s를 수신한다는 계획 가정과, 클라이언트가 보고한 누적 수신 바이트를 각각 표시한다. 둘의 **큰 값**을 앱 전송량 한도에 적용한다. 코덱·오버헤드·누락 보고·제어 장애 때문에 실제 공급자 전송량/청구액을 보장하지 않는다. 전송 보고는 수신한 UTC 월에 집계하므로 늦은 보고를 과거 월의 확정 사용량으로 소급하지 않는다.
- 월 자리 시간/전송 추정 한도에 도달하면 다음 참가·토큰 갱신을 막고 현재 참가도 정리 주기에서 철회한다. 원격 제어가 실패하면 실제 미디어가 즉시 중지됐다고 보고하지 않는다. 공급자의 예산/결제/사용량 확인은 실제 연결 전에 별도로 필요하다.
- 완료한 참가·감사 기록은30일, 웹훅 중복 영수증은7일 뒤 정리한다. 미정리 철회·미허가 참가자는 기간만으로 버리지 않는다. 월 합계에는 직원별 순위·대화 본문·소리·기기 주소를 넣지 않는다.

### 서버 설정과 화면 연결

`SYNK_WORKSPACE_VOICE_ENABLED=0`/미설정이고 이전 정리가 없으면 새 통화 표·주기 작업·외부 호출을 만들지 않는다. 켤 때 `SYNK_WORKSPACE_VOICE_ENABLED=1`, `SYNK_VOICE_LIVEKIT_URL=wss://<project>.livekit.cloud`, `SYNK_VOICE_LIVEKIT_API_KEY`, `SYNK_VOICE_LIVEKIT_API_SECRET`(32~512자)를 서버 환경에 둔다. 현재는 갱신 토큰을 철회할 수 있는 Cloud만 지원하며 별도 포트·경로·쿼리·리디렉션을 거부한다.

선택 설정은 `SYNK_VOICE_MAX_PARTICIPANTS`(1~16, 기본4), `SYNK_VOICE_MAX_SESSION_SECONDS`(60~7200, 기본7200), `SYNK_VOICE_MONTHLY_PARTICIPANT_MINUTES`(1~1,000,000, 기본1000), `SYNK_VOICE_MONTHLY_DOWNSTREAM_BYTES`(1~1,000,000,000,000, 기본1,000,000,000)다. 양의 정수 문자열만 받는다. 이번 구현은 기본값을 올리거나 실제 환경변수를 바꾸지 않았다. 기존 단일 writer 운영을 따르며 standby에서 같은 DB/미디어를 동시에 제어하는 용도로 실행하지 않는다.

합성 시험은 `createMessenger({voice:{enabled:true,provider,limits?,automaticSweep:false,now}})`/회사 `messengerVoice` 옵션을 쓴다. provider는 `{serverUrl,createRoom(room,globalCapacity),issueToken(room,identity,globalCapacity,{canSpeak,canShare,shareAudio,paused}),removeParticipant(room,identity),listParticipants(room),verifyWebhook(rawBuffer,authorization)}`다. 추가로 `updatePermissions(room,identity,{canSpeak,canShare,shareAudio,paused})`를 구현하며 Cloud UpdateParticipant의 이전 권한 토큰 철회를 사용한다. 토큰/웹훅 검증은 동기이며 목록 조회는 `{identity,sid,state:'JOINING'|'JOINED'|'ACTIVE'|'DISCONNECTED',tracks:[{source,type,muted,encryption?,width?,height?}]}` 배열이다. 사용량·정책·이벤트는 기존 SQLite에 가드된 추가/열 마이그레이션으로 저장하며 새 런타임 패키지는 없다.

화면은 사용자가 참가를 눌렀을 때만 토큰·마이크 권한을 요청한다. SDK 연결 후25초 heartbeat, 연결 중단 때 현재 상태 확인/같은 참가의 resume, 나갈 때 SDK·마이크 종료 후 leave를 사용한다. 401/403/404/409/410이면 새 상태와 종료 이유를 확인하고 재접속 반복을 멈춘다. 과거 회사 세션의 토큰을 복원하지 않는다. `VOICE_` 오류 코드는 응답에 포함하며 용량·사용량·정리 대기·정책 충돌·종료·서명 실패를 구분한다.

`leave`는 원격 응답을 기다리는 대기열과 별도로 본인의 참가를 즉시 철회 대기로 바꿔 늦은 토큰/키 발급을 막는다. 실제 원격 정리는 응답의 `cleanupPending`과 현재 상태로 확인한다. 주기/직원 변경으로 겹친 상태 정리 요청은 대기 중 한 번으로 합치며, 실행 중 생긴 새 변경은 후속 한 번을 예약해 heartbeat 앞에 점검 요청이 계속 쌓이지 않게 한다.

부모/iframe의 마이크 `Permissions-Policy`·allow·CSP와 통화 수명은 [화면·SDK 연결](#화면sdk-연결--2026-10-17)대로 연결했다. 서로 다른 두 실제 기기·망 전환·모바일 백그라운드·음질·공급자 사용량은 미확인이다. 초대/수락/통화 방해 금지와 화면 공유/E2EE 백엔드는 위 계약대로 로컬 구현했다. 카메라·녹음·전사는 허용하지 않는다. 실제 SDK/두 기기 미디어 검증 전에는 종단간 암호화 검증 완료로 표시하지 않는다.

기능 선택 근거는 [Discord 조사](../../docs/마케팅/온라인마케팅지도/engagement/company/WORKSPACE.md#discord-backend-study-20261017)다. 기술 원문은 2026-10-17 재확인한 LiveKit [웹훅·미디어/신호 연결 구분](https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/), [RoomService·상태/트랙/철회](https://docs.livekit.io/reference/other/roomservice-api/), [공식 WebhookReceiver](https://github.com/livekit/node-sdks/blob/main/packages/livekit-server-sdk/src/WebhookReceiver.ts), [TokenVerifier](https://github.com/livekit/node-sdks/blob/main/packages/livekit-server-sdk/src/AccessToken.ts)다.
