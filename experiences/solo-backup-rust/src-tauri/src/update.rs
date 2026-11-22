//! Updates (STAGE1_DESIGN.md 4.10): the Tauri updater, checked against the operating key built into the
//! app (tauri.conf.json `plugins.updater.pubkey`), or else the recovery key (`plugins.synkUpdate.recoveryPubkey`),
//! and bound to the version each package was signed for (`requireSignedVersion`). The keys are made and kept by
//! `scripts/update-keys.cjs`. The package is the NSIS installer itself; installing it asks the
//! administrator prompt once, and the installer refuses to go down a version (`allowDowngrades` off).
//!
//! The window app runs this headless (`WorkBackup.exe --update-check` · `--update-install`, and a
//! click on the 「update」 notice). Nothing here touches the backup state except `update.json` in the
//! state folder, which says what the last check found — for the run executable's notice and the window:
//! `{"v":1,"checkedAt":<ms>|null,"triedAt":<ms>,"current":"0.7.0","available":"0.7.1"|null,"error":<code>|null}`.
//! No feed text other than a checked version number is kept or shown.
use serde_json::{json, Value};
use std::{fs, path::Path, time::Duration};
use tauri::{AppHandle, Runtime};
use tauri_plugin_updater::{Error, Update, UpdaterExt};

pub const STATE_FILE: &str = "update.json";
/// The lock every `--update-check` takes first and holds until update.json is written (check_lock): a file beside
/// update.json in the state folder, so every check of this account sees it, from any sign-in session (11-20 저녁 설계 검토).
pub const CHECK_LOCK: &str = "update-check.lock";
/// The run executable checks once in this while (4.10 「업데이트 준비됨」 — daily).
pub const CHECK_EVERY_MS: u64 = 20 * 3_600_000;
/// After a try that did not reach the feed (no network yet after waking, say), the next one comes sooner.
pub const RETRY_AFTER_MS: u64 = 3 * 3_600_000;
const CHECK_TIMEOUT: Duration = Duration::from_secs(60);
const CLICK_TIMEOUT: Duration = Duration::from_secs(12);
/// The installer is about 40 MB; a slow office line gets a quarter of an hour.
const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(15 * 60);

/// A short code for the record and the exit line — never the feed's or the error's own text.
pub fn code(error: &Error) -> &'static str {
    match error {
        Error::Minisign(_) | Error::Base64(_) | Error::SignatureUtf8(_) | Error::SignedVersionMismatch { .. } | Error::MissingSignedVersion => "UPDATE_SIGNATURE",
        Error::Reqwest(_) | Error::Network(_) | Error::ReleaseNotFound | Error::TargetNotFound(_) | Error::TargetsNotFound(_) | Error::Serialization(_) | Error::Semver(_) | Error::UrlParse(_) => "UPDATE_FEED",
        // The installer could not be written or started — on Windows mostly the administrator prompt said no.
        Error::Io(_) => "UPDATE_START",
        _ => "UPDATE_FAILED",
    }
}

/// A version number from the feed as it may be kept: digits, dots, letters and hyphens, 32 at most.
pub fn version_text(value: &str) -> Option<String> {
    let ok = !value.is_empty() && value.len() <= 32 && value.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'-' || b == b'+');
    ok.then(|| value.to_string())
}

/// Whether this build carries a public key at all. Until one is made (4.10 「열쇠 보관」) nothing is fetched.
pub fn configured<R: Runtime>(app: &AppHandle<R>) -> bool {
    app.config().plugins.0.get("updater").and_then(|u| u.get("pubkey")).and_then(Value::as_str).is_some_and(|k| !k.trim().is_empty())
}

/// The recovery key's public half (tauri.conf.json `plugins.synkUpdate.recoveryPubkey`). A package signed with it is
/// accepted when the operating key's check fails — for the day the operating key is lost (4.10 「열쇠 보관」, the PC
/// app's shape). The updater itself trusts one key, so the check is made again with this one.
pub fn recovery_key(section: Option<&Value>) -> Option<String> {
    section.and_then(|u| u.get("recoveryPubkey")).and_then(Value::as_str).map(str::trim).filter(|k| !k.is_empty()).map(str::to_owned)
}

async fn find<R: Runtime>(app: &AppHandle<R>, timeout: Duration, key: Option<&str>) -> Result<Option<Update>, &'static str> {
    if !configured(app) { return Err("UPDATE_NOT_CONFIGURED"); }
    let builder = app.updater_builder().timeout(timeout);
    let updater = match key { Some(key) => builder.pubkey(key), None => builder }.build().map_err(|e| code(&e))?;
    updater.check().await.map_err(|e| code(&e))
}

/// Asks the feed whether a newer version is there. `Ok(None)`: this is the newest.
pub async fn check<R: Runtime>(app: &AppHandle<R>) -> Result<Option<Update>, &'static str> { find(app, CHECK_TIMEOUT, None).await }
/// The notice click's look at the feed: a person is waiting, so a feed that does not answer is given up sooner and told as
/// UPDATE_FEED (11-20 밤 설계 검토).
pub async fn check_for_click<R: Runtime>(app: &AppHandle<R>) -> Result<Option<Update>, &'static str> { find(app, CLICK_TIMEOUT, None).await }

/// What `update.json` says (11-20 설계 검토): `checkedAt` is the last check that reached the feed, `triedAt` the last try,
/// `error` that try's code, and `available` what the last check that reached the feed found — a failed try keeps it, so
/// a new version once known is not forgotten until a check finds otherwise.
fn shape(checked: Option<u64>, tried: u64, current: &str, available: Option<String>, error: Option<&str>) -> Value {
    json!({ "v": 1, "checkedAt": checked, "triedAt": tried, "current": version_text(current), "available": available, "error": error })
}
/// What the last check found, kept only while it is still later than this app: once it is installed, a failed try does not
/// leave it announced (GPT full GA2: SYNK 솔리오 reads any `available` unlike its own version as an update).
fn known(previous: &Value, current: &str) -> Option<String> {
    previous["available"].as_str().and_then(version_text).filter(|v| newer(v, current))
}
/// Written before the feed is asked: the try counts even if the check is ended before it is done.
pub fn tried(previous: &Value, current: &str, now_ms: u64) -> Value {
    shape(previous["checkedAt"].as_u64(), now_ms, current, known(previous, current), Some("CHECK_UNFINISHED"))
}
/// Written once the feed answered (`Ok`, with the newer version or none) or the try failed (`Err`, its code).
pub fn checked(previous: &Value, current: &str, found: Result<Option<&str>, &str>, now_ms: u64) -> Value {
    match found {
        Ok(available) => shape(Some(now_ms), now_ms, current, available.and_then(version_text), None),
        Err(code) => shape(previous["checkedAt"].as_u64(), now_ms, current, known(previous, current), Some(code)),
    }
}

/// The check lock: `Ok(Some)` held, `Ok(None)` another check holds it, `Err` it cannot be had (a folder or a link in its
/// place, a file that cannot be opened or locked). Short of `Ok(Some)` a check writes nothing and ends; the next run tries
/// again. No check goes on without it (11-20 저녁 설계 검토, in place of GPT -c GA2's 「without it rather than never」).
pub fn check_lock(root: &Path) -> Result<Option<fs::File>, ()> {
    let path = root.join(CHECK_LOCK);
    if fs::symlink_metadata(&path).is_ok_and(|m| !m.is_file() || reparse(&m)) { return Err(()); }
    let mut open = fs::OpenOptions::new();
    open.read(true).write(true).create(true).truncate(false);
    // Not shared for delete: while held it cannot be renamed or deleted, so a second check never makes a new one in its
    // place (GPT full-d GA1).
    #[cfg(windows)]
    { use std::os::windows::fs::OpenOptionsExt; open.share_mode(1 | 2); }
    let file = open.open(&path).map_err(|_| ())?;
    match file.try_lock() { Ok(()) => Ok(Some(file)), Err(fs::TryLockError::WouldBlock) => Ok(None), Err(_) => Err(()) }
}
#[cfg(windows)]
fn reparse(meta: &fs::Metadata) -> bool { use std::os::windows::fs::MetadataExt; meta.file_attributes() & 0x400 != 0 }
#[cfg(not(windows))]
fn reparse(_meta: &fs::Metadata) -> bool { false }
/// With the check lock held, temporary files a check ended mid-write left behind go.
pub fn clear_temps(root: &Path) {
    let prefix = format!("{STATE_FILE}.");
    for entry in fs::read_dir(root).into_iter().flatten().flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with(&prefix) && name.ends_with(".tmp") && entry.file_type().is_ok_and(|t| t.is_file()) { let _ = fs::remove_file(entry.path()); }
    }
}

/// Written whole and then moved into place, so a reader never sees half of it. The temporary file is this process's
/// own, so two checks at once never write into one file or rename it away from each other (GPT GA1); the last wins whole.
pub fn write(root: &Path, value: &Value) -> Result<(), String> {
    let temp = root.join(format!("{STATE_FILE}.{}.tmp", std::process::id()));
    let bytes = serde_json::to_vec(value).map_err(|_| "UPDATE_RECORD")?;
    // A failed write or move takes its temporary file away too, so none piles up (GPT -b GA3).
    let fail = |_| { let _ = fs::remove_file(&temp); "UPDATE_RECORD".to_string() };
    write_new(&temp, &bytes).map_err(fail)?;
    fs::rename(&temp, root.join(STATE_FILE)).map_err(fail)
}
/// A temporary file made new: a name already there — a link to anything, say — is taken away first, never written through
/// (GPT run-check GA1).
fn write_new(temp: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let _ = fs::remove_file(temp);
    let mut file = fs::OpenOptions::new().write(true).create_new(true).open(temp)?;
    std::io::Write::write_all(&mut file, bytes)
}

/// The last record, or `{}` when there is none or it is not ours.
pub fn read(root: &Path) -> Value {
    let path = root.join(STATE_FILE);
    match fs::metadata(&path) {
        Ok(m) if m.is_file() && m.len() <= 4096 => fs::read(&path).ok().and_then(|b| serde_json::from_slice::<Value>(&b).ok()).filter(|v| v["v"] == 1).unwrap_or_else(|| json!({})),
        _ => json!({}),
    }
}

/// What the run executable saw of the last check it started (4.10): `{"v":1,"at":<ms the run started it>,"result":
/// "exit <n>"|"CHECK_START"|"CHECK_TIMEOUT"}`. update.json says what a check found; this says whether the check ran at all.
/// One that could not start writes nothing in update.json; one ended past the run's wait may have left its try there
/// (`triedAt` with `CHECK_UNFINISHED`, which its 3 hours count from) and nothing more (GPT run-check-main GA2). The window
/// app's codes: 0 checked, 4 not due after all (another check had just tried — GPT run-check GA2), 75 another check held
/// the lock, 1 a failed check. update.json tells why only when its `triedAt` is this run's: a window app that could not
/// start ends with 1 before it writes anything (GPT run-check -c GA1). The run writes it after the check, when it no longer
/// holds the engine lock, as update.json is written (its own temporary file, moved into place) and without the check lock,
/// so it never makes a check wait or fail. Of two runs that overlap, the one that writes last stays and its `at` says which
/// check it tells of: a record of whether a check ran, read by people, which nothing acts on (GPT run-check-main -b). The
/// next run puts it in its record as `updateCheck`.
pub const RUN_CHECK_FILE: &str = "update-run.json";
/// `--update-check-due`'s exit code when it found under the lock that the check was not due after all.
pub const NOT_DUE_EXIT: i32 = 4;
/// The words a run may write as the result.
fn run_check_result(text: &str) -> bool {
    matches!(text, "CHECK_START" | "CHECK_TIMEOUT") || text.strip_prefix("exit ").is_some_and(|n| n.parse::<i32>().is_ok_and(|v| v.to_string() == n))
}
/// Temporary files of runs that ended between writing and moving them, an hour old or more, go (GPT run-check GA4).
fn clear_run_temps(root: &Path) {
    let prefix = format!("{RUN_CHECK_FILE}.");
    for entry in fs::read_dir(root).into_iter().flatten().flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        let old = entry.metadata().ok().and_then(|m| m.modified().ok()).and_then(|t| t.elapsed().ok()).is_some_and(|age| age.as_secs() >= 3600);
        // Only the shape the runs make, `update-run.json.<process number>.tmp` (GPT run-check -b GA1).
        let pid = name.strip_prefix(&prefix).and_then(|rest| rest.strip_suffix(".tmp")).is_some_and(|n| !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()));
        if pid && old && entry.file_type().is_ok_and(|t| t.is_file()) { let _ = fs::remove_file(entry.path()); }
    }
}
pub fn write_run_check(root: &Path, at: u64, result: &str) -> Result<(), String> {
    if !run_check_result(result) { return Err("UPDATE_RUN_RECORD".into()); }
    clear_run_temps(root);
    let temp = root.join(format!("{RUN_CHECK_FILE}.{}.tmp", std::process::id()));
    let fail = |_| { let _ = fs::remove_file(&temp); "UPDATE_RUN_RECORD".to_string() };
    write_new(&temp, &serde_json::to_vec(&json!({"v": 1, "at": at, "result": result})).unwrap_or_default()).map_err(fail)?;
    fs::rename(&temp, root.join(RUN_CHECK_FILE)).map_err(fail)
}
/// The last of them as `{at, result}`, or nothing when there is none or it is not that shape.
pub fn read_run_check(root: &Path) -> Option<Value> {
    // One handle for the checks and the read, opened on a link itself rather than where it points (GPT run-check GA3).
    let mut open = fs::OpenOptions::new();
    open.read(true);
    #[cfg(windows)]
    { use std::os::windows::fs::OpenOptionsExt; open.custom_flags(0x0020_0000); } // FILE_FLAG_OPEN_REPARSE_POINT
    let file = open.open(root.join(RUN_CHECK_FILE)).ok()?;
    let meta = file.metadata().ok()?;
    if !meta.is_file() || reparse(&meta) || meta.len() > 256 { return None; }
    let mut bytes = Vec::new();
    std::io::Read::read_to_end(&mut std::io::Read::take(&file, 257), &mut bytes).ok()?;
    if bytes.len() > 256 { return None; }
    let value: Value = serde_json::from_slice(&bytes).ok()?;
    let (at, result) = (value["at"].as_u64()?, value["result"].as_str()?);
    (value["v"] == 1 && run_check_result(result)).then(|| json!({"at": at, "result": result}))
}

/// Whether the run executable should check again: never tried; 20 hours after a check that reached the feed; 3 hours
/// after a try that did not (its record has an error — not told by the times, which a clock set back reorders, GPT -d
/// GA1); or the clock went back past the last try.
pub fn due(record: &Value, now_ms: u64) -> bool {
    let checked = record["checkedAt"].as_u64();
    let Some(tried) = record["triedAt"].as_u64().or(checked) else { return true };
    if tried > now_ms { return true; }
    let every = if checked.is_some() && record["error"].is_null() { CHECK_EVERY_MS } else { RETRY_AFTER_MS };
    now_ms - tried >= every
}
/// Due as above, or at once when the window app is not the version the record was written by (an update, a reinstall): so
/// a version it has passed does not stay announced to SYNK 솔리오 until the next daily check (GPT full-b GA2). While a
/// version later than the installed one is announced, every 3 hours: one taken off the feed stops being told within hours
/// by an ordinary check, the notice click only reading the feed (11-20 밤 설계 검토).
pub fn due_for(record: &Value, now_ms: u64, installed: Option<&str>) -> bool {
    if due(record, now_ms) { return true; }
    let Some(installed) = installed.and_then(version_text) else { return false };
    if record["current"].as_str() != Some(installed.as_str()) { return true; }
    let announced = record["available"].as_str().is_some_and(|v| newer(v, &installed));
    let tried = record["triedAt"].as_u64().or(record["checkedAt"].as_u64());
    announced && tried.is_some_and(|at| at <= now_ms && now_ms - at >= RETRY_AFTER_MS)
}

/// `major.minor.patch` as numbers, or none for anything else (a pre-release is not offered).
fn triple(value: &str) -> Option<(u64, u64, u64)> {
    let mut parts = value.split('.').map(|p| if !p.is_empty() && p.len() <= 9 && p.bytes().all(|b| b.is_ascii_digit()) { p.parse().ok() } else { None });
    let found = (parts.next()??, parts.next()??, parts.next()??);
    parts.next().is_none().then_some(found)
}
/// Whether `available` is a later version than `installed`. Anything that is not a plain version is not.
pub fn newer(available: &str, installed: &str) -> bool {
    matches!((triple(available), triple(installed)), (Some(a), Some(b)) if a > b)
}

/// The version the window app at `exe` was built as: its file's product version, which the build stamps from the
/// app's own version (tauri.conf.json, a build's override included). The run executable tells 「업데이트 준비됨」
/// against this, not its own crate version, and after an update it sees the new one without checking again.
#[cfg(windows)]
pub fn installed_version(exe: &Path) -> Option<String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW, VS_FIXEDFILEINFO};
    let wide: Vec<u16> = exe.as_os_str().encode_wide().chain([0]).collect();
    let root: Vec<u16> = "\\".encode_utf16().chain([0]).collect();
    unsafe {
        let size = GetFileVersionInfoSizeW(wide.as_ptr(), std::ptr::null_mut());
        if size == 0 || size > 1 << 20 { return None; }
        let mut data = vec![0u8; size as usize];
        if GetFileVersionInfoW(wide.as_ptr(), 0, size, data.as_mut_ptr().cast()) == 0 { return None; }
        let (mut info, mut len) = (std::ptr::null_mut(), 0u32);
        if VerQueryValueW(data.as_ptr().cast(), root.as_ptr(), &mut info, &mut len) == 0 || info.is_null() || (len as usize) < std::mem::size_of::<VS_FIXEDFILEINFO>() { return None; }
        let fixed = std::ptr::read_unaligned(info as *const VS_FIXEDFILEINFO);
        if fixed.dwSignature != 0xFEEF_04BD { return None; }
        Some(format!("{}.{}.{}", fixed.dwProductVersionMS >> 16, fixed.dwProductVersionMS & 0xFFFF, fixed.dwProductVersionLS >> 16))
    }
}
#[cfg(not(windows))]
pub fn installed_version(_exe: &Path) -> Option<String> { None }

/// Whether this account can approve the administrator prompt an update brings: one in Administrators — through the full
/// token linked to UAC's split one (`Limited`), or this token itself when elevated or not split. A standard account, an
/// operator group's included, is told once a week to ask the administrator instead (2.2 「업데이트 준비됨」). Unknown
/// counts as standard.
#[cfg(windows)]
pub fn can_approve() -> bool {
    use windows_sys::Win32::{Foundation::{CloseHandle, HANDLE}, Security::{CheckTokenMembership, CreateWellKnownSid, GetTokenInformation, TokenElevationType, TokenElevationTypeLimited, TokenLinkedToken, WinBuiltinAdministratorsSid, TOKEN_ELEVATION_TYPE, TOKEN_LINKED_TOKEN, TOKEN_QUERY}, System::Threading::{GetCurrentProcess, OpenProcessToken}};
    unsafe {
        let mut sid = [0u8; 68];
        let mut sid_size = sid.len() as u32;
        if CreateWellKnownSid(WinBuiltinAdministratorsSid, std::ptr::null_mut(), sid.as_mut_ptr().cast(), &mut sid_size) == 0 { return false; }
        let admins = sid.as_mut_ptr().cast::<core::ffi::c_void>();
        let holds = |token: HANDLE| { let mut member = 0; CheckTokenMembership(token, admins, &mut member) != 0 && member != 0 };
        let mut token: HANDLE = std::ptr::null_mut();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 { return false; }
        let (mut kind, mut size): (TOKEN_ELEVATION_TYPE, u32) = (0, 0);
        let read = GetTokenInformation(token, TokenElevationType, &mut kind as *mut _ as *mut _, std::mem::size_of::<TOKEN_ELEVATION_TYPE>() as u32, &mut size) != 0;
        if !read { CloseHandle(token); return false; }
        if kind == TokenElevationTypeLimited {
            // A split token: the full one linked to it holds Administrators, or this is an operator group's split account
            // (Backup Operators and the like), whom the installer's prompt does not let through (카본 끝판 A1).
            let mut linked = TOKEN_LINKED_TOKEN { LinkedToken: std::ptr::null_mut() };
            let ok = GetTokenInformation(token, TokenLinkedToken, &mut linked as *mut _ as *mut _, std::mem::size_of::<TOKEN_LINKED_TOKEN>() as u32, &mut size) != 0;
            CloseHandle(token);
            if !ok || linked.LinkedToken.is_null() { return false; }
            let admin = holds(linked.LinkedToken);
            CloseHandle(linked.LinkedToken);
            return admin;
        }
        CloseHandle(token);
        // Already elevated, or not split (UAC off, or a standard account): this process's token holds Administrators or not.
        holds(std::ptr::null_mut())
    }
}
#[cfg(not(windows))]
pub fn can_approve() -> bool { false }

/// Downloads the newer version, checks its signature against the built-in key and the version it was
/// signed for, then starts its installer (its progress window only, after the administrator prompt) and
/// returns once the installer has taken over. What returns an error is a refusal or a failure.
/// The engine lock is taken before anything is fetched and held until the installer's own marker is in the
/// install folder (`launch`), so no backup or restore of this user starts in between (GPT GA2).
/// `started` is told the version just before the installer is started — after the file is written, held and compared
/// and the install folder is checked once more, so a failure before that never follows a 「started」 (카본 끝판 A2).
pub async fn install<R: Runtime>(app: &AppHandle<R>, root: &Path, started: impl FnOnce(&str)) -> Result<(), &'static str> {
    let _engine = crate::platform::try_lock(root, crate::platform::ENGINE_LOCK).map_err(|_| "STATE_LOCK")?.ok_or("RUN_ACTIVE")?;
    let mut update = find(app, DOWNLOAD_TIMEOUT, None).await?.ok_or("UP_TO_DATE")?;
    // The plugin's download checks the signature and the signed version; its own install is not used (launch).
    // A signature the operating key does not verify is checked once more against the recovery key; any other refusal
    // (a wrong or missing signed version included) stays a refusal.
    let bytes = match update.download(|_, _| {}, || {}).await {
        Ok(bytes) => bytes,
        Err(Error::Minisign(_)) if recovery_key(app.config().plugins.0.get("synkUpdate")).is_some() => {
            let key = recovery_key(app.config().plugins.0.get("synkUpdate")).unwrap_or_default();
            update = find(app, DOWNLOAD_TIMEOUT, Some(&key)).await?.ok_or("UP_TO_DATE")?;
            update.download(|_, _| {}, || {}).await.map_err(|e| code(&e))?
        }
        Err(e) => return Err(code(&e)),
    };
    let version = version_text(&update.version).ok_or("UPDATE_FEED")?;
    let folder = std::env::current_exe().ok().and_then(|exe| exe.parent().map(Path::to_path_buf)).ok_or("EXECUTABLE")?;
    launch(&bytes, &version, &folder, || started(&version))
}

/// Starts the checked installer so that nothing can change it between the check and the start (GPT GA1): it is
/// written into a new folder of this user's temp and closed, opened again for reading with no sharing of writes
/// or deletes — from then on no program, this user's others included, can change, rename or delete it — and read
/// back through that handle and compared with the checked bytes; only then is it started. The plugin's own install
/// writes the file, closes it and starts it by name. The handle stays open until the installer has put its marker
/// in the install folder or has ended, and the caller's engine lock with it. `/P` is its progress
/// window only; `/UPDATE` skips what a first install does (the WebView2 check, the reinstall page). Never shows the
/// installer's path or output.
/// The wait has no time limit while the installer runs (GPT -b GA1); it returns `Ok` only once the installer's marker
/// has been seen, and every other end is an error (`hand_over`).
#[cfg(windows)]
fn launch(bytes: &[u8], version: &str, install_folder: &Path, started: impl FnOnce()) -> Result<(), &'static str> {
    use std::{io::{Read, Write}, os::windows::ffi::OsStrExt};
    use windows_sys::Win32::{Foundation::{CloseHandle, GetLastError, WAIT_OBJECT_0, WAIT_TIMEOUT}, System::Threading::WaitForSingleObject,
        UI::{Shell::{ShellExecuteExW, SEE_MASK_NOASYNC, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW}, WindowsAndMessaging::SW_SHOWNORMAL}};
    let temp = std::env::temp_dir();
    // What an earlier update left (the installer ran from there): its folders go first, quietly.
    if let Ok(entries) = fs::read_dir(&temp) {
        for entry in entries.flatten() {
            if entry.file_name().to_string_lossy().starts_with("SynkWorkBackup-update-") { let _ = fs::remove_dir_all(entry.path()); }
        }
    }
    let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    let folder = temp.join(format!("SynkWorkBackup-update-{}-{stamp:x}", std::process::id()));
    fs::create_dir(&folder).map_err(|_| "UPDATE_START")?;
    let path = folder.join(format!("SynkWorkBackup-{version}-setup.exe"));
    fs::OpenOptions::new().write(true).create_new(true).open(&path).and_then(|mut f| f.write_all(bytes).and_then(|()| f.sync_all())).map_err(|_| "UPDATE_START")?;
    let mut held = hold(&path).map_err(|_| "UPDATE_START")?;
    let mut again = Vec::with_capacity(bytes.len());
    held.read_to_end(&mut again).map_err(|_| "UPDATE_START")?;
    if again != bytes { return Err("UPDATE_SIGNATURE"); }
    let wide = |s: &std::ffi::OsStr| s.encode_wide().chain([0]).collect::<Vec<u16>>();
    let (verb, file, parameters) = (wide("open".as_ref()), wide(path.as_os_str()), wide("/P /UPDATE".as_ref()));
    let mut info: SHELLEXECUTEINFOW = unsafe { std::mem::zeroed() };
    info.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
    info.fMask = SEE_MASK_NOCLOSEPROCESS | SEE_MASK_NOASYNC;
    info.lpVerb = verb.as_ptr(); info.lpFile = file.as_ptr(); info.lpParameters = parameters.as_ptr(); info.nShow = SW_SHOWNORMAL;
    // Another install may have started while this one downloaded; its marker is not this installer's (Fable F3).
    if crate::platform::installing(install_folder) { return Err("INSTALLING"); }
    started();
    // Returns once the installer process exists — after the administrator prompt; a "no" there is a failure here.
    if unsafe { ShellExecuteExW(&mut info) } == 0 { let _ = unsafe { GetLastError() }; return Err("UPDATE_START"); }
    // No time limit while the installer runs (GPT -b GA1); success only when its marker has been seen (Fable F1 · F2).
    // Shell gives no process for an exe only in odd setups (DDE, `SEE_MASK_INVOKEIDLIST`), and a wait on a handle can
    // fail outright (no SYNCHRONIZE right — 카본 끝판 A1); either way the marker alone is watched for ten minutes.
    let process = info.hProcess;
    let watch = (!process.is_null()).then_some(|wait: Duration| match unsafe { WaitForSingleObject(process, wait.as_millis() as u32) } {
        WAIT_OBJECT_0 => Some(true),
        WAIT_TIMEOUT => Some(false),
        _ => None,
    });
    let outcome = hand_over(|| crate::platform::installing(install_folder), watch, Duration::from_secs(600));
    if !process.is_null() { unsafe { CloseHandle(process); } }
    drop(held);
    outcome
}
/// The end of the hand-over to a started installer (Fable design gate F1 · F2): `Ok` only once its marker has been
/// seen in the install folder. `ended` waits up to the time it is given for the installer process and says whether
/// that process has ended (`Some(true)`) — then it is `UPDATE_STOPPED` (a stop in .onInit, a refused downgrade, a
/// closed message, a crash) unless the marker is there right then — or is still running (`Some(false)`), or that the
/// wait itself failed (`None`). With no process to wait for, or once a wait has failed, only the marker is watched,
/// for `without_process` from then, and its never coming is `UPDATE_UNCONFIRMED`; a failed wait never turns into a
/// loop with no pause and no limit (카본 끝판 A1).
#[cfg_attr(not(windows), allow(dead_code))]
fn hand_over(mut marker: impl FnMut() -> bool, mut ended: Option<impl FnMut(Duration) -> Option<bool>>, without_process: Duration) -> Result<(), &'static str> {
    const POLL: Duration = Duration::from_millis(250);
    let mut until = None;
    loop {
        if marker() { return Ok(()); }
        match ended.as_mut().map(|ended| ended(POLL)) {
            Some(Some(true)) => return if marker() { Ok(()) } else { Err("UPDATE_STOPPED") },
            Some(Some(false)) => {}
            failed_or_none => {
                if failed_or_none.is_some() { ended = None; }
                let deadline = *until.get_or_insert_with(|| std::time::Instant::now() + without_process);
                if std::time::Instant::now() >= deadline { return Err("UPDATE_UNCONFIRMED"); }
                std::thread::sleep(POLL);
            }
        }
    }
}
/// The file opened for reading while nobody may write, rename or delete it (sharing reads only).
#[cfg(windows)]
fn hold(path: &Path) -> std::io::Result<fs::File> {
    use std::os::windows::fs::OpenOptionsExt;
    const FILE_SHARE_READ: u32 = 1;
    fs::OpenOptions::new().read(true).share_mode(FILE_SHARE_READ).open(path)
}
#[cfg(not(windows))]
fn launch(_bytes: &[u8], _version: &str, _install_folder: &Path, _started: impl FnOnce()) -> Result<(), &'static str> { Err("UPDATE_START") }

#[cfg(test)]
mod tests {
    #[test] fn the_run_writes_whether_its_check_ran() {
        let root = std::env::temp_dir().join(format!("swb-update-run-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root); fs::create_dir_all(&root).unwrap();
        assert_eq!(read_run_check(&root), None, "none yet");
        for result in ["exit 0", "exit 75", "exit 1", "exit -1", "exit 2147483647", "CHECK_START", "CHECK_TIMEOUT"] {
            write_run_check(&root, 7, result).unwrap();
            assert_eq!(read_run_check(&root), Some(json!({"at": 7, "result": result})));
        }
        for result in ["", "ok", "exit ", "exit -", "exit 1x", "exit 2147483648", "exit 01", "exit +1", "exit --1", "fine", "CHECK_LOCK"] {
            assert!(write_run_check(&root, 8, result).is_err(), "{result:?} is not written");
        }
        assert_eq!(read_run_check(&root), Some(json!({"at": 7, "result": "CHECK_TIMEOUT"})), "a refused one leaves the last");
        let leftovers: Vec<_> = fs::read_dir(&root).unwrap().flatten().map(|e| e.file_name().to_string_lossy().into_owned()).filter(|n| n.ends_with(".tmp")).collect();
        assert!(leftovers.is_empty(), "no temporary file is left: {leftovers:?}");
        // Not that shape, too long, or a folder in its place: nothing.
        // Each wrong in one field only, the others as written (GPT run-check-main GA4).
        for text in [r#"{"v":1,"at":"7","result":"exit 0"}"#, r#"{"v":2,"at":7,"result":"exit 0"}"#, r#"{"v":1,"at":7,"result":"done"}"#, r#"{"at":7,"result":"exit 0"}"#, "not json"] {
            fs::write(root.join(RUN_CHECK_FILE), text).unwrap();
            assert_eq!(read_run_check(&root), None, "{text}");
        }
        let padded = |n: usize| format!(r#"{{"v":1,"at":7,"result":"exit 0","pad":"{}"}}"#, "x".repeat(n));
        let fits = 256 - padded(0).len();
        fs::write(root.join(RUN_CHECK_FILE), padded(fits)).unwrap();
        assert_eq!(read_run_check(&root), Some(json!({"at": 7, "result": "exit 0"})), "256 bytes");
        fs::write(root.join(RUN_CHECK_FILE), padded(fits + 1)).unwrap();
        assert_eq!(read_run_check(&root), None, "257 bytes");
        fs::remove_file(root.join(RUN_CHECK_FILE)).unwrap(); fs::create_dir(root.join(RUN_CHECK_FILE)).unwrap();
        assert_eq!(read_run_check(&root), None, "a folder");
        let _ = fs::remove_dir_all(&root);
    }
    #[test] fn a_name_left_where_the_run_writes_is_never_written_through() {
        let root = std::env::temp_dir().join(format!("swb-update-run-link-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root); fs::create_dir_all(&root).unwrap();
        // A hard link to the run log where this process's temporary file goes: the log stays as it was.
        fs::write(root.join("runs.jsonl"), "{\"v\":1}\n").unwrap();
        fs::hard_link(root.join("runs.jsonl"), root.join(format!("{RUN_CHECK_FILE}.{}.tmp", std::process::id()))).unwrap();
        write_run_check(&root, 9, "exit 0").unwrap();
        assert_eq!(fs::read_to_string(root.join("runs.jsonl")).unwrap(), "{\"v\":1}\n");
        assert_eq!(read_run_check(&root), Some(json!({"at": 9, "result": "exit 0"})));
        fs::hard_link(root.join("runs.jsonl"), root.join(format!("{STATE_FILE}.{}.tmp", std::process::id()))).unwrap();
        write(&root, &json!({"v": 1})).unwrap();
        assert_eq!(fs::read_to_string(root.join("runs.jsonl")).unwrap(), "{\"v\":1}\n", "nor update.json's");
        // Another run's temporary file an hour old goes; a fresh one stays.
        let stale = root.join(format!("{RUN_CHECK_FILE}.1.tmp")); let fresh = root.join(format!("{RUN_CHECK_FILE}.2.tmp"));
        let copy = root.join(format!("{RUN_CHECK_FILE}.backup.tmp"));
        let hour_ago = std::time::SystemTime::now() - std::time::Duration::from_secs(7200);
        for file in [&stale, &fresh, &copy] { fs::write(file, "x").unwrap(); }
        for file in [&stale, &copy] { fs::File::options().write(true).open(file).unwrap().set_modified(hour_ago).unwrap(); }
        write_run_check(&root, 10, "CHECK_TIMEOUT").unwrap();
        assert!(!stale.exists() && fresh.exists(), "an hour-old run's temporary file goes, a fresh one stays");
        assert!(copy.exists(), "a file of another shape stays");
        let _ = fs::remove_dir_all(&root);
    }
    #[test] fn the_last_write_stays_and_a_held_check_lock_does_not_stop_it() {
        let root = std::env::temp_dir().join(format!("swb-update-run-order-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root); fs::create_dir_all(&root).unwrap();
        // The one written last stays, whatever its time (a clock set back included); `at` tells which check it is.
        write_run_check(&root, 20, "exit 4").unwrap();
        write_run_check(&root, 10, "exit 0").unwrap();
        assert_eq!(read_run_check(&root), Some(json!({"at": 10, "result": "exit 0"})));
        // A check holding its lock — a person's, say — neither waits for the run's write nor is made to wait by it.
        let held = check_lock(&root).unwrap().expect("the check lock");
        write_run_check(&root, 30, "exit 75").unwrap();
        assert_eq!(read_run_check(&root), Some(json!({"at": 30, "result": "exit 75"})));
        drop(held);
        let _ = fs::remove_dir_all(&root);
    }

    use super::*;

    #[test] fn a_later_version_is_only_a_plain_one_above_the_installed() {
        for (a, b) in [("0.7.1", "0.7.0"), ("0.8.0", "0.7.9"), ("1.0.0", "0.99.99"), ("0.7.10", "0.7.9")] { assert!(newer(a, b), "{a} > {b}"); }
        for (a, b) in [("0.7.0", "0.7.0"), ("0.6.9", "0.7.0"), ("0.7.1-beta.1", "0.7.0"), ("0.7", "0.6.0"), ("0.7.1.2", "0.7.0"), ("", "0.7.0"), ("0.7.1", ""), ("x.7.1", "0.7.0"), ("1234567890.0.0", "0.7.0")] {
            assert!(!newer(a, b), "{a} is not taken as newer than {b}");
        }
    }
    #[cfg(windows)]
    #[test] fn the_installed_version_is_read_from_the_file() {
        let system = std::env::var_os("SystemRoot").map(std::path::PathBuf::from).unwrap_or_else(|| "C:\\Windows".into());
        let kernel = installed_version(&system.join("System32").join("kernel32.dll")).expect("a system file has a version");
        assert!(triple(&kernel).is_some(), "{kernel}");
        let dir = std::env::temp_dir().join(format!("swb-version-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("plain.exe"), b"not a program").unwrap();
        assert_eq!(installed_version(&dir.join("plain.exe")), None);
        assert_eq!(installed_version(&dir.join("missing.exe")), None);
        fs::remove_dir_all(&dir).unwrap();
    }
    #[test] fn only_plain_version_numbers_are_kept() {
        assert_eq!(version_text("0.7.1").as_deref(), Some("0.7.1"));
        assert_eq!(version_text("1.0.0-beta.2").as_deref(), Some("1.0.0-beta.2"));
        for bad in ["", "0.7.1 <script>", "0.7.1\n", "../0.7.1", &"9".repeat(33)] { assert_eq!(version_text(bad), None, "{bad:?}"); }
    }
    #[test] fn the_record_keeps_versions_and_a_code_only_and_a_failed_try_keeps_what_was_known() {
        let found = checked(&json!({}), "0.7.0", Ok(Some("0.7.1")), 5);
        assert_eq!(found, json!({"v":1,"checkedAt":5,"triedAt":5,"current":"0.7.0","available":"0.7.1","error":null}));
        assert_eq!(checked(&json!({}), "0.7.0", Ok(Some("evil text")), 5)["available"], Value::Null);
        // Before the feed: the try is counted, what was known stays. A failed try keeps it too, with its code.
        assert_eq!(tried(&found, "0.7.0", 9), json!({"v":1,"checkedAt":5,"triedAt":9,"current":"0.7.0","available":"0.7.1","error":"CHECK_UNFINISHED"}));
        assert_eq!(checked(&found, "0.7.0", Err("UPDATE_FEED"), 9), json!({"v":1,"checkedAt":5,"triedAt":9,"current":"0.7.0","available":"0.7.1","error":"UPDATE_FEED"}));
        // A check that reached the feed says what it found, nothing newer included.
        assert_eq!(checked(&found, "0.7.1", Ok(None), 12)["available"], Value::Null);
        assert_eq!(checked(&json!({}), "0.7.0", Err("UPDATE_FEED"), 3), json!({"v":1,"checkedAt":null,"triedAt":3,"current":"0.7.0","available":null,"error":"UPDATE_FEED"}));
        // 0.7.1 was found, then 0.7.2 installed: a failed try does not keep 0.7.1 or anything not later (GPT full GA2).
        for current in ["0.7.1", "0.7.2"] {
            assert_eq!(tried(&found, current, 9)["available"], Value::Null, "{current}");
            assert_eq!(checked(&found, current, Err("UPDATE_FEED"), 9)["available"], Value::Null, "{current}");
        }
        assert_eq!(checked(&json!({"available": "0.7.3"}), "0.7.2", Err("UPDATE_FEED"), 9)["available"], "0.7.3");
    }
    #[test] fn a_check_is_due_at_once_when_the_app_is_not_the_version_that_wrote_the_record() {
        let now = 100 * 3_600_000;
        let fresh = json!({"checkedAt": now - 1000, "triedAt": now - 1000, "current": "0.7.0", "available": "0.7.1", "error": null});
        assert!(!due_for(&fresh, now, Some("0.7.0")));
        assert!(due_for(&fresh, now, Some("0.7.1")), "updated since");
        assert!(due_for(&fresh, now, Some("0.6.9")), "put back to another version");
        assert!(!due_for(&fresh, now, None), "its version unknown: by time alone");
        assert!(!due_for(&fresh, now, Some("not a version")));
        assert!(due_for(&json!({"checkedAt": now - 1000, "triedAt": now - 1000}), now, Some("0.7.0")), "a record without the version");
        // A newer version announced: checked again every 3 hours, not 20, so one taken off the feed is not told for long.
        let at = |ago: u64, available: Option<&str>| json!({"checkedAt": now - ago, "triedAt": now - ago, "current": "0.7.0", "available": available, "error": null});
        assert!(!due_for(&at(RETRY_AFTER_MS - 1, Some("0.7.1")), now, Some("0.7.0")));
        assert!(due_for(&at(RETRY_AFTER_MS, Some("0.7.1")), now, Some("0.7.0")), "announced: 3 hours");
        assert!(!due_for(&at(RETRY_AFTER_MS, None), now, Some("0.7.0")), "nothing announced: 20 hours");
        assert!(!due_for(&at(RETRY_AFTER_MS, Some("0.7.0")), now, Some("0.7.0")), "the installed version is not announced");
        assert!(!due_for(&at(RETRY_AFTER_MS, Some("0.7.1")), now, None), "its version unknown: by time alone");
    }
    #[test] fn a_check_is_due_daily_sooner_after_a_failed_try_and_after_the_clock_goes_back() {
        let now = 100 * 3_600_000;
        assert!(due(&json!({}), now));
        assert!(!due(&json!({"checkedAt": now - 3_600_000}), now), "an old record without triedAt");
        assert!(due(&json!({"checkedAt": now - CHECK_EVERY_MS}), now));
        assert!(due(&json!({"checkedAt": now + 1}), now));
        let ok = |at: u64| json!({"checkedAt": at, "triedAt": at});
        assert!(!due(&ok(now - RETRY_AFTER_MS), now), "a check that reached the feed waits 20 hours");
        assert!(due(&ok(now - CHECK_EVERY_MS), now));
        let failed = |checked: Option<u64>, at: u64| json!({"checkedAt": checked, "triedAt": at, "error": "UPDATE_FEED"});
        assert!(!due(&failed(Some(now - 30 * 3_600_000), now - 3_600_000), now));
        assert!(due(&failed(Some(now - 30 * 3_600_000), now - RETRY_AFTER_MS), now), "a failed try is tried again after 3 hours");
        assert!(due(&failed(None, now - RETRY_AFTER_MS), now));
        assert!(due(&failed(None, now + 1), now));
        // Checked at 10, the clock set back to 9 and a try failed there: at 12 the 3 hours are up (GPT -d GA1).
        assert!(due(&failed(Some(now - 2 * 3_600_000), now - RETRY_AFTER_MS), now));
        assert!(!due(&json!({"checkedAt": now - 3_600_000, "triedAt": now - 3_600_000, "error": "CHECK_UNFINISHED"}), now));
    }
    #[test] fn one_check_at_a_time_and_a_lock_that_cannot_be_had_stops_the_check() {
        let root = std::env::temp_dir().join(format!("swb-check-lock-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root); fs::create_dir_all(&root).unwrap();
        let held = check_lock(&root).expect("can be had").expect("free");
        assert!(matches!(check_lock(&root), Ok(None)), "a second check finds it held");
        assert!(fs::rename(root.join(CHECK_LOCK), root.join("moved.lock")).is_err(), "renamed while held");
        assert!(fs::remove_file(root.join(CHECK_LOCK)).is_err(), "deleted while held");
        drop(held);
        assert!(matches!(check_lock(&root), Ok(Some(_))), "free again once its holder is gone");
        fs::write(root.join("update.json.4242.tmp"), b"half").unwrap();
        fs::write(root.join("other.tmp"), b"not ours").unwrap();
        clear_temps(&root);
        assert!(!root.join("update.json.4242.tmp").exists() && root.join("other.tmp").exists());
        let odd = root.join("odd"); fs::create_dir_all(odd.join(CHECK_LOCK)).unwrap();
        assert!(check_lock(&odd).is_err(), "a folder in its place: the check stops");
        fs::remove_dir_all(&root).unwrap();
    }
    /// What launch relies on between its check and the installer's start (GPT GA1): while held, the checked
    /// installer cannot be written, renamed or deleted, and can still be read (as the loader and NSIS read it).
    #[test] fn a_held_installer_cannot_be_changed_renamed_or_deleted() {
        let root = std::env::temp_dir().join(format!("swb-hold-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root); fs::create_dir_all(&root).unwrap();
        let file = root.join("setup.exe");
        fs::write(&file, b"MZ checked").unwrap();
        let held = hold(&file).unwrap();
        assert!(fs::OpenOptions::new().write(true).open(&file).is_err(), "written while held");
        assert!(fs::rename(&file, root.join("other.exe")).is_err(), "renamed while held");
        assert!(fs::remove_file(&file).is_err(), "deleted while held");
        assert_eq!(fs::read(&file).unwrap(), b"MZ checked", "readable while held");
        drop(held);
        fs::remove_dir_all(&root).unwrap();
    }
    #[test] fn the_recovery_key_is_read_only_when_it_is_there() {
        assert_eq!(recovery_key(Some(&json!({"recoveryPubkey": " abc "}))).as_deref(), Some("abc"));
        assert_eq!(recovery_key(Some(&json!({"recoveryPubkey": ""}))), None);
        assert_eq!(recovery_key(Some(&json!({"other": "abc"}))), None);
        assert_eq!(recovery_key(None), None);
    }

    #[test] fn the_hand_over_succeeds_only_when_the_marker_is_seen() {
        let never = None::<fn(Duration) -> Option<bool>>;
        // The marker comes while the installer runs.
        let mut polls = 0;
        assert_eq!(hand_over(|| { polls += 1; polls > 2 }, Some(|_: Duration| Some(false)), Duration::ZERO), Ok(()));
        // The installer ends without it — a stop in .onInit, a crash (Fable F2).
        assert_eq!(hand_over(|| false, Some(|_: Duration| Some(true)), Duration::ZERO), Err("UPDATE_STOPPED"));
        // It ends just as the marker is there.
        let mut polls = 0;
        assert_eq!(hand_over(|| { polls += 1; polls > 1 }, Some(|_: Duration| Some(true)), Duration::ZERO), Ok(()));
        // No process to watch: the marker alone, and its never coming is not a success (Fable F1).
        assert_eq!(hand_over(|| false, never, Duration::ZERO), Err("UPDATE_UNCONFIRMED"));
        let mut polls = 0;
        assert_eq!(hand_over(|| { polls += 1; polls > 1 }, never, Duration::from_secs(5)), Ok(()));
        // A wait that fails at once (카본 끝판 A1) is asked once, then the marker alone is watched with a limit — no
        // loop without a pause; the marker coming then is still a success.
        let mut waits = 0;
        let started = std::time::Instant::now();
        assert_eq!(hand_over(|| false, Some(|_: Duration| { waits += 1; None }), Duration::from_millis(600)), Err("UPDATE_UNCONFIRMED"));
        assert_eq!(waits, 1);
        assert!(started.elapsed() >= Duration::from_millis(500));
        let mut polls = 0;
        assert_eq!(hand_over(|| { polls += 1; polls > 2 }, Some(|_: Duration| None), Duration::from_secs(5)), Ok(()));
    }

    #[test] fn the_record_is_written_whole_and_read_back() {
        let root = std::env::temp_dir().join(format!("swb-update-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root); fs::create_dir_all(&root).unwrap();
        assert_eq!(read(&root), json!({}));
        let r = checked(&json!({}), "0.7.0", Err("UPDATE_FEED"), 9);
        write(&root, &r).unwrap();
        assert_eq!(read(&root), r);
        write(&root, &checked(&r, "0.7.0", Ok(Some("0.7.2")), 10)).unwrap();
        assert_eq!(read(&root)["available"], "0.7.2");
        assert!(fs::read_dir(&root).unwrap().all(|e| !e.unwrap().file_name().to_string_lossy().ends_with(".tmp")), "no temporary file is left");
        fs::write(root.join(STATE_FILE), vec![b' '; 5000]).unwrap();
        assert_eq!(read(&root), json!({}));
        fs::remove_dir_all(&root).unwrap();
    }
}
