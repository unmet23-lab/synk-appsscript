//! Updates (STAGE1_DESIGN.md 4.10): the Tauri updater, checked against the public key built into the
//! app (tauri.conf.json `plugins.updater.pubkey`) and bound to the version each package was signed for
//! (`requireSignedVersion`). The package is the NSIS installer itself; installing it asks the
//! administrator prompt once, and the installer refuses to go down a version (`allowDowngrades` off).
//!
//! The window app runs this headless (`WorkBackup.exe --update-check` · `--update-install`, and a
//! click on the 「update」 notice). Nothing here touches the backup state except `update.json` in the
//! state folder, which says what the last check found — for the run executable's notice and the window:
//! `{"v":1,"checkedAt":<ms>,"current":"0.7.0","available":"0.7.1"|null,"error":<code>|null}`.
//! No feed text other than a checked version number is kept or shown.
use serde_json::{json, Value};
use std::{fs, path::Path, time::Duration};
use tauri::{AppHandle, Runtime};
use tauri_plugin_updater::{Error, Update, UpdaterExt};

pub const STATE_FILE: &str = "update.json";
/// The run executable checks once in this while (4.10 「업데이트 준비됨」 — daily).
pub const CHECK_EVERY_MS: u64 = 20 * 3_600_000;
const CHECK_TIMEOUT: Duration = Duration::from_secs(60);
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

async fn find<R: Runtime>(app: &AppHandle<R>, timeout: Duration) -> Result<Option<Update>, &'static str> {
    if !configured(app) { return Err("UPDATE_NOT_CONFIGURED"); }
    let updater = app.updater_builder().timeout(timeout).build().map_err(|e| code(&e))?;
    updater.check().await.map_err(|e| code(&e))
}

/// Asks the feed whether a newer version is there. `Ok(None)`: this is the newest.
pub async fn check<R: Runtime>(app: &AppHandle<R>) -> Result<Option<Update>, &'static str> { find(app, CHECK_TIMEOUT).await }

/// What `update.json` says after a check.
pub fn record(current: &str, available: Option<&str>, error: Option<&str>, now_ms: u64) -> Value {
    json!({ "v": 1, "checkedAt": now_ms, "current": version_text(current), "available": available.and_then(version_text), "error": error })
}

/// Written whole and then moved into place, so a reader never sees half of it.
pub fn write(root: &Path, value: &Value) -> Result<(), String> {
    let temp = root.join(format!("{STATE_FILE}.tmp"));
    fs::write(&temp, serde_json::to_vec(value).map_err(|_| "UPDATE_RECORD")?).map_err(|_| "UPDATE_RECORD")?;
    fs::rename(&temp, root.join(STATE_FILE)).map_err(|_| "UPDATE_RECORD".to_string())
}

/// The last record, or `{}` when there is none or it is not ours.
pub fn read(root: &Path) -> Value {
    let path = root.join(STATE_FILE);
    match fs::metadata(&path) {
        Ok(m) if m.is_file() && m.len() <= 4096 => fs::read(&path).ok().and_then(|b| serde_json::from_slice::<Value>(&b).ok()).filter(|v| v["v"] == 1).unwrap_or_else(|| json!({})),
        _ => json!({}),
    }
}

/// Whether the run executable should check again: never checked, checked over 20 hours ago, or the clock
/// went back past the last check.
pub fn due(record: &Value, now_ms: u64) -> bool {
    record["checkedAt"].as_u64().is_none_or(|at| at > now_ms || now_ms - at >= CHECK_EVERY_MS)
}

/// Downloads the newer version, checks its signature against the built-in key and the version it was
/// signed for, then starts its installer (its progress window only, after the administrator prompt) and
/// returns once the installer has taken over. What returns an error is a refusal or a failure.
/// The engine lock is taken before anything is fetched and held until the installer's own marker is in the
/// install folder (`launch`), so no backup or restore of this user starts in between (GPT GA2).
/// `started` is told the version just before the installer is started — after the file is written, held and compared
/// and the install folder is checked once more, so a failure before that never follows a 「started」 (카본 끝판 A2).
pub async fn install<R: Runtime>(app: &AppHandle<R>, root: &Path, started: impl FnOnce(&str)) -> Result<(), &'static str> {
    let _engine = crate::platform::try_lock(root, crate::platform::ENGINE_LOCK).map_err(|_| "STATE_LOCK")?.ok_or("RUN_ACTIVE")?;
    let update = find(app, DOWNLOAD_TIMEOUT).await?.ok_or("UP_TO_DATE")?;
    // The plugin's download checks the signature and the signed version; its own install is not used (launch).
    let bytes = update.download(|_, _| {}, || {}).await.map_err(|e| code(&e))?;
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
    use super::*;

    #[test] fn only_plain_version_numbers_are_kept() {
        assert_eq!(version_text("0.7.1").as_deref(), Some("0.7.1"));
        assert_eq!(version_text("1.0.0-beta.2").as_deref(), Some("1.0.0-beta.2"));
        for bad in ["", "0.7.1 <script>", "0.7.1\n", "../0.7.1", &"9".repeat(33)] { assert_eq!(version_text(bad), None, "{bad:?}"); }
    }
    #[test] fn the_record_keeps_versions_and_a_code_only() {
        let r = record("0.7.0", Some("0.7.1"), None, 5);
        assert_eq!(r, json!({"v":1,"checkedAt":5,"current":"0.7.0","available":"0.7.1","error":null}));
        assert_eq!(record("0.7.0", Some("evil text"), Some("UPDATE_FEED"), 5)["available"], Value::Null);
    }
    #[test] fn a_check_is_due_daily_and_after_the_clock_goes_back() {
        let now = 100 * 3_600_000;
        assert!(due(&json!({}), now));
        assert!(!due(&json!({"checkedAt": now - 3_600_000}), now));
        assert!(due(&json!({"checkedAt": now - CHECK_EVERY_MS}), now));
        assert!(due(&json!({"checkedAt": now + 1}), now));
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
        let r = record("0.7.0", None, Some("UPDATE_FEED"), 9);
        write(&root, &r).unwrap();
        assert_eq!(read(&root), r);
        write(&root, &record("0.7.0", Some("0.7.2"), None, 10)).unwrap();
        assert_eq!(read(&root)["available"], "0.7.2");
        assert!(!root.join("update.json.tmp").exists());
        fs::write(root.join(STATE_FILE), vec![b' '; 5000]).unwrap();
        assert_eq!(read(&root), json!({}));
        fs::remove_dir_all(&root).unwrap();
    }
}
