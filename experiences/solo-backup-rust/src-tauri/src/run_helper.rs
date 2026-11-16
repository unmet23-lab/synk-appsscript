//! The helper (STAGE1_DESIGN.md 4.2 「도우미 — 섀도 복사본만 만든다」, review F4 recommendation A).
//!
//! `WorkBackupRun.exe --vss-helper` runs from the helper task — elevated, as the same user, started by that user's
//! run through Task Scheduler — and does three things only: it makes a shadow copy of each fixed local NTFS volume the
//! run asked for (WMI `Win32_ShadowCopy.Create`), puts a directory link to that copy in the administrators-only folder
//! `%ProgramData%\SynkWorkBackup\helper\<SID>\snap-<letter>` (the user may read and pass through it, never write), and
//! once that run has ended takes the link and the copy away again. It never reads, uploads or writes a user file, and
//! no Node or restic runs on the administrator side. The run reads the locked files again through the link at normal
//! privilege (the fill, 4.2): a shadow copy keeps every file's permissions, so the user reads only what they already could.
//!
//! What a normal-privilege process can change reaches the helper as small data only: the request (`vss-request.json`
//! in the user's state folder — volume letters, the run's process number, a request id and its time; 4 KB at most,
//! opened without following a link). The helper checks that the process is this installation's run executable and
//! runs as the same user, and writes only inside its own folder. No path comes from an environment variable.
//!
//! A shadow copy made while the disk is busy can make Windows drop the volume's other shadow copies (11-15 T5: a
//! restore point was lost that way). So none is made on a volume that already has a copy the helper did not make
//! (a restore point, another backup program's) or while the volume is busy; that volume stays with the partial
//! snapshot rule. Whether a copy may be made beside others when the disk is quiet is measured in T5 and the 72-hour
//! test before it changes.
use backup_native::{platform, schedule};
use serde_json::{json, Value};
use std::{fs::{self, File, OpenOptions}, path::{Path, PathBuf}, time::{Duration, Instant, SystemTime, UNIX_EPOCH}};

/// The run's request, in its state folder.
pub const REQUEST: &str = "vss-request.json";
const REQUEST_MAX: u64 = 4096;
/// A request older than this (or more than a minute ahead) is not taken.
const REQUEST_AGE_MS: u64 = 10 * 60 * 1000;
/// The helper's answer, in its own folder (the user may read it).
const STATUS: &str = "status.json";
/// The copies the helper made and when — administrators only may change it.
const LEDGER: &str = "ledger.json";
/// At most six shadow copies a day for one user (4.2 「채움의 비용」 — the engine asks every 4 hours at most).
const DAILY_MAX: usize = 6;
const DAY_MS: u64 = 86_400_000;
/// How long the links stay for one run at most when that run does not end: the fill of a large locked file to the
/// cloud can take hours. The helper task's own time limit is longer (`schedule::helper_task_xml`).
const HOLD_MAX_MS: u32 = 6 * 3_600_000;
/// The share of idle time (percent, over `IDLE_SAMPLE`) below which a volume counts as busy. Measured again in T5
/// and the 72-hour test.
const IDLE_MIN: f64 = 80.0;
const IDLE_SAMPLE: Duration = Duration::from_secs(5);
/// How long a run waits for the helper's answer.
const WAIT: Duration = Duration::from_secs(120);
/// Why a volume got no link. A fixed set, so the run record carries no free text.
const REASONS: [&str; 10] = ["not-fixed", "not-ntfs", "other-copies", "limit", "busy", "idle-unknown", "create", "link", "volume", "copies"];

fn epoch_ms() -> u64 { SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0) }

pub fn link_name(volume: &str) -> String { format!("snap-{}", &volume[..1]) }
fn volume_ok(v: &str) -> bool { v.len() == 2 && v.as_bytes()[0].is_ascii_uppercase() && v.as_bytes()[1] == b':' }
fn id_ok(id: &str) -> bool { (8..=64).contains(&id.len()) && id.bytes().all(|b| b.is_ascii_hexdigit() || b == b'-') }
fn sid_ok(sid: &str) -> bool { sid.starts_with("S-1-") && sid.len() <= 184 && sid.bytes().all(|b| b.is_ascii_digit() || b == b'-' || b == b'S') }
/// A shadow copy id as WMI gives it, `{8-4-4-4-12}`; checked before it goes into a WMI path or query.
fn shadow_id_ok(id: &str) -> bool {
    let b = id.as_bytes();
    b.len() == 38 && b[0] == b'{' && b[37] == b'}' && b[1..37].iter().enumerate().all(|(i, c)| if [8, 13, 18, 23].contains(&i) { *c == b'-' } else { c.is_ascii_hexdigit() })
}
fn device_ok(device: &str) -> bool {
    device.strip_prefix(r"\\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy").is_some_and(|n| !n.is_empty() && n.len() <= 6 && n.bytes().all(|b| b.is_ascii_digit()))
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Request { pub id: String, pub pid: u32, pub at: u64, pub volumes: Vec<String> }

/// The request as data: exactly these fields, a known id and process, a recent time, 1 ~ 26 distinct volume letters.
pub fn parse_request(bytes: &[u8], now: u64) -> Result<Request, String> {
    let value: Value = serde_json::from_slice(bytes).map_err(|_| "request")?;
    let object = value.as_object().ok_or("request")?;
    if object.len() != 5 || object.get("v") != Some(&json!(1)) { return Err("request".into()); }
    let id = object.get("id").and_then(Value::as_str).filter(|id| id_ok(id)).ok_or("request")?.to_string();
    let pid = object.get("pid").and_then(Value::as_u64).filter(|p| *p > 0 && *p <= u32::MAX as u64).ok_or("request")? as u32;
    let at = object.get("at").and_then(Value::as_u64).ok_or("request")?;
    if at + REQUEST_AGE_MS < now || at > now + 60_000 { return Err("request-age".into()); }
    let list = object.get("volumes").and_then(Value::as_array).filter(|l| (1..=26).contains(&l.len())).ok_or("request")?;
    let mut volumes = Vec::new();
    for v in list {
        let v = v.as_str().filter(|v| volume_ok(v)).ok_or("request")?;
        if volumes.iter().any(|x: &String| x == v) { return Err("request".into()); }
        volumes.push(v.to_string());
    }
    Ok(Request { id, pid, at, volumes })
}
pub fn request_json(r: &Request) -> Value { json!({"v": 1, "id": r.id, "pid": r.pid, "at": r.at, "volumes": r.volumes}) }

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Link { pub volume: String, pub root: PathBuf }
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Answer { pub links: Vec<Link>, pub refused: Vec<(String, String)>, pub error: Option<String> }

/// The helper's answer for request `id`, or `None` while there is none for it yet. Every link must be the fixed one
/// in `dir` for a volume that was asked (4.2 「채움의 비용」), every refusal a known reason.
pub fn parse_status(bytes: &[u8], id: &str, at: u64, dir: &Path, asked: &[String]) -> Result<Option<Answer>, String> {
    let value: Value = serde_json::from_slice(bytes).map_err(|_| "status")?;
    if value["v"] != 1 { return Err("status".into()); }
    // A request the helper could not read has no id: it answers that it was written after this request.
    if value["id"].is_null() {
        return Ok(value["at"].as_u64().filter(|t| *t >= at).map(|_| Answer { error: Some(value["error"].as_str().filter(|e| e.len() <= 24 && e.bytes().all(|b| b.is_ascii_lowercase() || b == b'-')).unwrap_or("status").to_string()), ..Answer::default() }));
    }
    if value["id"] != id { return Ok(None); }
    let mut answer = Answer::default();
    let mut seen: Vec<String> = Vec::new();
    for link in value["links"].as_array().ok_or("status")? {
        let volume = link["volume"].as_str().filter(|v| volume_ok(v) && asked.iter().any(|a| a == v)).ok_or("status")?;
        let root = PathBuf::from(link["root"].as_str().ok_or("status")?);
        if root != dir.join(link_name(volume)) || seen.iter().any(|s| s == volume) { return Err("status".into()); }
        seen.push(volume.into());
        answer.links.push(Link { volume: volume.into(), root });
    }
    for refusal in value["refused"].as_array().ok_or("status")? {
        let volume = refusal["volume"].as_str().filter(|v| volume_ok(v) && asked.iter().any(|a| a == v)).ok_or("status")?;
        let reason = refusal["reason"].as_str().filter(|r| REASONS.contains(r)).ok_or("status")?;
        if seen.iter().any(|s| s == volume) { return Err("status".into()); }
        seen.push(volume.into());
        answer.refused.push((volume.into(), reason.into()));
    }
    Ok(Some(answer))
}

#[derive(Debug, Clone, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
struct Copy { id: String, volume: String, at: u64 }
#[derive(Debug, Clone, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
struct Ledger { v: u32, made: Vec<u64>, copies: Vec<Copy> }
impl Ledger {
    fn parse(bytes: &[u8]) -> Ledger {
        serde_json::from_slice::<Ledger>(bytes).ok().filter(|l| l.v == 1).map(|mut l| { l.copies.retain(|c| shadow_id_ok(&c.id) && volume_ok(&c.volume)); l }).unwrap_or(Ledger { v: 1, ..Ledger::default() })
    }
    /// How many copies may still be made in the 24 hours before `now`.
    fn left(&self, now: u64) -> usize { DAILY_MAX.saturating_sub(self.made.iter().filter(|t| **t + DAY_MS > now && **t <= now + 60_000).count()) }
    fn forget_old(&mut self, now: u64) { self.made.retain(|t| *t + DAY_MS > now && *t <= now + 60_000); }
}

/// The volumes a run's result asks a fill for: each profile's `fill` list (4.2), distinct, sorted.
pub fn fill_volumes(result: &Value) -> Vec<String> {
    let mut out: Vec<String> = result["profiles"].as_object().into_iter().flat_map(|p| p.values())
        .flat_map(|p| p["fill"].as_array().cloned().unwrap_or_default()).filter_map(|v| v.as_str().filter(|v| volume_ok(v)).map(String::from)).collect();
    out.sort(); out.dedup(); out
}

// ---- Windows ----

mod win {
    use std::{ffi::OsString, fs::{File, OpenOptions}, os::windows::{ffi::{OsStrExt, OsStringExt}, fs::{MetadataExt, OpenOptionsExt}, io::AsRawHandle}, path::{Path, PathBuf}, ptr};
    use windows_sys::Win32::{Foundation::{CloseHandle, LocalFree, HANDLE}, Security::{Authorization::{ConvertSidToStringSidW, ConvertStringSecurityDescriptorToSecurityDescriptorW, GetSecurityInfo, SE_FILE_OBJECT},
        GetAce, GetTokenInformation, TokenUser, ACCESS_ALLOWED_ACE, ACE_HEADER, ACL, DACL_SECURITY_INFORMATION, OWNER_SECURITY_INFORMATION, SECURITY_ATTRIBUTES, TOKEN_QUERY, TOKEN_USER}};

    pub const FLAG_OPEN_REPARSE_POINT: u32 = 0x0020_0000;
    pub const FLAG_BACKUP_SEMANTICS: u32 = 0x0200_0000;
    const READ_CONTROL: u32 = 0x0002_0000;
    const FILE_READ_ATTRIBUTES: u32 = 0x80;
    const REPARSE: u32 = 0x400;
    const DIRECTORY: u32 = 0x10;
    /// Rights that let someone change, replace or delete what the helper trusts (4.2 「시작할 때 확인」 ①).
    const DANGER: u32 = 0x2 | 0x4 | 0x10 | 0x40 | 0x100 | 0x1_0000 | 0x4_0000 | 0x8_0000 | 0x1000_0000 | 0x4000_0000;
    /// For a folder above the helper's own ones (%ProgramData%): others may add their own entries there — Windows lets
    /// every user make a folder in %ProgramData% — but not delete, rename or take over what is in it.
    const DANGER_ABOVE: u32 = 0x40 | 0x1_0000 | 0x4_0000 | 0x8_0000 | 0x1000_0000;
    const TRUSTED: [&str; 3] = ["S-1-5-32-544", "S-1-5-18", "S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464"];

    pub fn wide(path: &Path) -> Vec<u16> { path.as_os_str().encode_wide().chain([0]).collect() }
    fn text_of(p: *const u16) -> String { unsafe { let len = (0..).take_while(|&i| *p.add(i) != 0).count(); String::from_utf16_lossy(std::slice::from_raw_parts(p, len)) } }

    /// A known folder from the API (never an environment variable — 4.2 「시작할 때 확인」 ②).
    pub fn known(id: &windows_sys::core::GUID) -> Result<PathBuf, String> {
        use windows_sys::Win32::UI::Shell::SHGetKnownFolderPath;
        let mut out: *mut u16 = ptr::null_mut();
        let hr = unsafe { SHGetKnownFolderPath(id, 0, ptr::null_mut(), &mut out) };
        if hr < 0 || out.is_null() { return Err("known-folder".into()); }
        let len = unsafe { (0..).take_while(|&i| *out.add(i) != 0).count() };
        let path = PathBuf::from(OsString::from_wide(unsafe { std::slice::from_raw_parts(out, len) }));
        unsafe { windows::Win32::System::Com::CoTaskMemFree(Some(out as *const _)); }
        Ok(path)
    }

    /// Opens `path` itself — a link is opened as the link, never followed — to read its attributes and security.
    pub fn open_here(path: &Path) -> Result<File, String> {
        OpenOptions::new().access_mode(READ_CONTROL | FILE_READ_ATTRIBUTES).share_mode(7).custom_flags(FLAG_OPEN_REPARSE_POINT | FLAG_BACKUP_SEMANTICS).open(path).map_err(|_| "open".to_string())
    }
    /// Whether the object open in `file` is a folder (`dir`) or a file that is no link, owned by Administrators,
    /// SYSTEM or TrustedInstaller, and whose permission gives no one else a right to change, replace or delete it
    /// (read and pass-through rights of others, such as the user's on their own helper folder, are fine).
    pub fn trusted(file: &File, dir: bool) -> Result<(), String> { check(file, dir, DANGER) }
    /// A folder above the helper's own: no link, a trusted owner, and no one else may delete, rename or take over its entries.
    pub fn trusted_above(file: &File) -> Result<(), String> { check(file, true, DANGER_ABOVE) }
    fn check(file: &File, dir: bool, danger: u32) -> Result<(), String> {
        let attributes = file.metadata().map_err(|_| "attributes")?.file_attributes();
        if attributes & REPARSE != 0 || (attributes & DIRECTORY != 0) != dir { return Err("link".into()); }
        unsafe {
            let (mut owner, mut dacl, mut sd) = (ptr::null_mut(), ptr::null_mut::<ACL>(), ptr::null_mut());
            if GetSecurityInfo(file.as_raw_handle() as HANDLE, SE_FILE_OBJECT, OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION, &mut owner, ptr::null_mut(), &mut dacl, ptr::null_mut(), &mut sd) != 0 { return Err("security".into()); }
            let result = (|| {
                if !sid_text(owner).is_some_and(|o| TRUSTED.contains(&o.as_str())) { return Err("owner".to_string()); }
                if dacl.is_null() { return Err("acl".into()); }
                for i in 0..u32::from((*dacl).AceCount) {
                    let mut ace = ptr::null_mut();
                    if GetAce(dacl, i, &mut ace) == 0 { return Err("acl".into()); }
                    let header = &*(ace as *const ACE_HEADER);
                    // Deny entries only take rights away; an inherit-only entry does not apply to this object.
                    if header.AceType == 1 || header.AceFlags & 0x8 != 0 { continue; }
                    if header.AceType != 0 { return Err("acl".into()); }
                    let allowed = &*(ace as *const ACCESS_ALLOWED_ACE);
                    if allowed.Mask & danger == 0 { continue; }
                    let sid = sid_text(&allowed.SidStart as *const u32 as *mut _);
                    if !sid.is_some_and(|s| TRUSTED.contains(&s.as_str())) { return Err("acl".into()); }
                }
                Ok(())
            })();
            LocalFree(sd);
            result
        }
    }
    pub fn sid_text(sid: *mut core::ffi::c_void) -> Option<String> {
        if sid.is_null() { return None; }
        unsafe {
            let mut text: *mut u16 = ptr::null_mut();
            if ConvertSidToStringSidW(sid, &mut text) == 0 { return None; }
            let out = text_of(text);
            LocalFree(text as _);
            Some(out)
        }
    }
    /// The user SID of the token of a process open with at least PROCESS_QUERY_LIMITED_INFORMATION.
    pub fn process_sid(process: HANDLE) -> Option<String> {
        use windows_sys::Win32::System::Threading::OpenProcessToken;
        unsafe {
            let mut token: HANDLE = ptr::null_mut();
            if OpenProcessToken(process, TOKEN_QUERY, &mut token) == 0 { return None; }
            let mut size = 0u32;
            GetTokenInformation(token, TokenUser, ptr::null_mut(), 0, &mut size);
            let mut buffer = vec![0u8; size as usize];
            let ok = GetTokenInformation(token, TokenUser, buffer.as_mut_ptr() as *mut _, size, &mut size) != 0;
            CloseHandle(token);
            if !ok { return None; }
            sid_text((*(buffer.as_ptr() as *const TOKEN_USER)).User.Sid)
        }
    }
    pub struct Process(pub HANDLE);
    impl Drop for Process { fn drop(&mut self) { unsafe { CloseHandle(self.0); } } }
    /// Opens process `pid` to wait for it, when it is `exe` running as `sid`.
    pub fn same_run(pid: u32, exe: &Path, sid: &str) -> Result<Process, String> {
        use windows_sys::Win32::System::Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION};
        unsafe {
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | 0x0010_0000, 0, pid);
            if handle.is_null() { return Err("requester".into()); }
            let process = Process(handle);
            let mut buffer = [0u16; 1024];
            let mut len = buffer.len() as u32;
            if QueryFullProcessImageNameW(process.0, 0, buffer.as_mut_ptr(), &mut len) == 0 { return Err("requester".into()); }
            let image = PathBuf::from(OsString::from_wide(&buffer[..len as usize]));
            if backup_native::platform::key_path(&image) != backup_native::platform::key_path(exe) { return Err("requester".into()); }
            if process_sid(process.0).as_deref() != Some(sid) { return Err("requester".into()); }
            Ok(process)
        }
    }
    pub fn wait(process: &Process, ms: u32) { unsafe { windows_sys::Win32::System::Threading::WaitForSingleObject(process.0, ms); } }
    /// The user at this desktop: the token owner of the shell window's process (the installer's own session).
    pub fn shell_sid() -> Option<String> {
        use windows_sys::Win32::{System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION}, UI::WindowsAndMessaging::{GetShellWindow, GetWindowThreadProcessId}};
        unsafe {
            let shell = GetShellWindow();
            let mut pid = 0u32;
            if shell.is_null() || GetWindowThreadProcessId(shell, &mut pid) == 0 || pid == 0 { return None; }
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if handle.is_null() { return None; }
            let process = Process(handle);
            process_sid(process.0)
        }
    }
    /// Makes a folder with exactly the permission `sddl` (no inherited entries), or says it was already there.
    pub fn make_dir(path: &Path, sddl: &str) -> Result<bool, String> {
        use windows_sys::Win32::{Foundation::{GetLastError, ERROR_ALREADY_EXISTS}, Storage::FileSystem::CreateDirectoryW};
        unsafe {
            let text: Vec<u16> = sddl.encode_utf16().chain([0]).collect();
            let mut sd = ptr::null_mut();
            if ConvertStringSecurityDescriptorToSecurityDescriptorW(text.as_ptr(), 1, &mut sd, ptr::null_mut()) == 0 { return Err("sddl".into()); }
            let attributes = SECURITY_ATTRIBUTES { nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32, lpSecurityDescriptor: sd, bInheritHandle: 0 };
            let made = CreateDirectoryW(wide(path).as_ptr(), &attributes) != 0;
            let error = GetLastError();
            LocalFree(sd);
            if made { Ok(true) } else if error == ERROR_ALREADY_EXISTS { Ok(false) } else { Err("folder".into()) }
        }
    }
    /// A directory link at `link` to the shadow copy device `device` (`mklink /d` — T5 11-15).
    pub fn make_link(link: &Path, device: &str) -> Result<(), String> {
        use windows_sys::Win32::Storage::FileSystem::CreateSymbolicLinkW;
        let target: Vec<u16> = format!("{device}\\").encode_utf16().chain([0]).collect();
        if unsafe { CreateSymbolicLinkW(wide(link).as_ptr(), target.as_ptr(), 1) } == 0 { Err("link".into()) } else { Ok(()) }
    }
    /// Reads a small file without following a link at its own name; more than `max` bytes is refused.
    pub fn read_small(path: &Path, max: u64) -> Result<Vec<u8>, String> {
        use std::io::Read;
        let file = OpenOptions::new().read(true).share_mode(1).custom_flags(FLAG_OPEN_REPARSE_POINT).open(path).map_err(|_| "missing".to_string())?;
        let meta = file.metadata().map_err(|_| "read")?;
        if meta.file_attributes() & (REPARSE | DIRECTORY) != 0 || meta.len() > max { return Err("read".into()); }
        let mut bytes = Vec::new();
        file.take(max + 1).read_to_end(&mut bytes).map_err(|_| "read")?;
        if bytes.len() as u64 > max { return Err("read".into()); }
        Ok(bytes)
    }
    /// `C:` is a fixed local drive with NTFS; its volume name (`\\?\Volume{…}\`) for matching shadow copies.
    pub fn volume(letter: &str) -> Result<String, &'static str> {
        use windows_sys::Win32::Storage::FileSystem::{GetDriveTypeW, GetVolumeInformationW, GetVolumeNameForVolumeMountPointW};
        let root: Vec<u16> = format!("{letter}\\").encode_utf16().chain([0]).collect();
        unsafe {
            if GetDriveTypeW(root.as_ptr()) != 3 { return Err("not-fixed"); }
            let mut fs = [0u16; 32];
            if GetVolumeInformationW(root.as_ptr(), ptr::null_mut(), 0, ptr::null_mut(), ptr::null_mut(), ptr::null_mut(), fs.as_mut_ptr(), fs.len() as u32) == 0 { return Err("volume"); }
            if text_of(fs.as_ptr()) != "NTFS" { return Err("not-ntfs"); }
            let mut name = [0u16; 64];
            if GetVolumeNameForVolumeMountPointW(root.as_ptr(), name.as_mut_ptr(), name.len() as u32) == 0 { return Err("volume"); }
            Ok(text_of(name.as_ptr()))
        }
    }
    /// 4.2 「시작할 때 확인」 ③: a link a normal-privilege process made is not followed by this process.
    pub fn redirection_trust() -> bool {
        use windows_sys::Win32::System::Threading::{ProcessRedirectionTrustPolicy, SetProcessMitigationPolicy};
        let enforce: u32 = 1;
        unsafe { SetProcessMitigationPolicy(ProcessRedirectionTrustPolicy, &enforce as *const u32 as *const _, 4) != 0 }
    }
}

// ---- WMI ----

mod wmi {
    use std::mem::ManuallyDrop;
    use windows::core::{BSTR, PCWSTR};
    use windows::Win32::Foundation::RPC_E_CHANGED_MODE;
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CoSetProxyBlanket, CoUninitialize, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED, EOAC_NONE, RPC_C_AUTHN_LEVEL_CALL, RPC_C_IMP_LEVEL_IMPERSONATE};
    use windows::Win32::System::Variant::{VariantClear, VARIANT, VARIANT_0, VARIANT_0_0, VARIANT_0_0_0, VT_BSTR, VT_I4, VT_UI4};
    use windows::Win32::System::Wmi::{IEnumWbemClassObject, IWbemClassObject, IWbemLocator, IWbemServices, WbemLocator, WBEM_FLAG_FORWARD_ONLY, WBEM_FLAG_RETURN_IMMEDIATELY, WBEM_FLAG_RETURN_WBEM_COMPLETE, WBEM_GENERIC_FLAG_TYPE, WBEM_INFINITE};

    const AUTHN_WINNT: u32 = 10;
    const AUTHZ_NONE: u32 = 0;
    const NOT_FOUND: i32 = 0x8004_1002u32 as i32;

    struct Com(bool);
    impl Drop for Com { fn drop(&mut self) { if self.0 { unsafe { CoUninitialize(); } } } }
    struct Var(VARIANT);
    impl Var {
        fn empty() -> Self { Var(VARIANT::default()) }
        fn text(value: &str) -> Self {
            Var(VARIANT { Anonymous: VARIANT_0 { Anonymous: ManuallyDrop::new(VARIANT_0_0 { vt: VT_BSTR, wReserved1: 0, wReserved2: 0, wReserved3: 0, Anonymous: VARIANT_0_0_0 { bstrVal: ManuallyDrop::new(BSTR::from(value)) } }) } })
        }
        fn as_text(&self) -> Option<String> { unsafe { let inner = &self.0.Anonymous.Anonymous; (inner.vt == VT_BSTR).then(|| inner.Anonymous.bstrVal.to_string()) } }
        fn as_number(&self) -> Option<i64> { unsafe { let inner = &self.0.Anonymous.Anonymous; if inner.vt == VT_I4 { Some(inner.Anonymous.lVal as i64) } else if inner.vt == VT_UI4 { Some(inner.Anonymous.ulVal as i64) } else { None } } }
    }
    impl Drop for Var { fn drop(&mut self) { unsafe { let _ = VariantClear(&mut self.0); } } }

    pub struct Wmi { services: IWbemServices, _com: Com }
    fn code(stage: &str, e: windows::core::Error) -> String { format!("{stage}:{:#x}", e.code().0) }
    fn get(object: &IWbemClassObject, name: &str) -> Var {
        let mut value = Var::empty();
        let wide: Vec<u16> = name.encode_utf16().chain([0]).collect();
        let _ = unsafe { object.Get(PCWSTR(wide.as_ptr()), 0, &mut value.0, None, None) };
        value
    }
    impl Wmi {
        pub fn connect() -> Result<Wmi, String> {
            let hr = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
            let com = if hr.is_ok() { Com(true) } else if hr == RPC_E_CHANGED_MODE { Com(false) } else { return Err("wmi-com".into()) };
            let locator: IWbemLocator = unsafe { CoCreateInstance(&WbemLocator, None, CLSCTX_INPROC_SERVER) }.map_err(|e| code("wmi-locator", e))?;
            let services = unsafe { locator.ConnectServer(&BSTR::from("ROOT\\CIMV2"), &BSTR::new(), &BSTR::new(), &BSTR::new(), 0, &BSTR::new(), None) }.map_err(|e| code("wmi-connect", e))?;
            unsafe { CoSetProxyBlanket(&services, AUTHN_WINNT, AUTHZ_NONE, PCWSTR::null(), RPC_C_AUTHN_LEVEL_CALL, RPC_C_IMP_LEVEL_IMPERSONATE, None, EOAC_NONE) }.map_err(|e| code("wmi-blanket", e))?;
            Ok(Wmi { services, _com: com })
        }
        fn query(&self, wql: &str) -> Result<Vec<IWbemClassObject>, String> {
            let flags = WBEM_GENERIC_FLAG_TYPE(WBEM_FLAG_FORWARD_ONLY.0 | WBEM_FLAG_RETURN_IMMEDIATELY.0);
            let rows: IEnumWbemClassObject = unsafe { self.services.ExecQuery(&BSTR::from("WQL"), &BSTR::from(wql), flags, None) }.map_err(|e| code("wmi-query", e))?;
            let _ = unsafe { CoSetProxyBlanket(&rows, AUTHN_WINNT, AUTHZ_NONE, PCWSTR::null(), RPC_C_AUTHN_LEVEL_CALL, RPC_C_IMP_LEVEL_IMPERSONATE, None, EOAC_NONE) };
            let mut out = Vec::new();
            loop {
                let mut one = [None];
                let mut count = 0u32;
                let hr = unsafe { rows.Next(WBEM_INFINITE, &mut one, &mut count) };
                if hr.is_err() { return Err(format!("wmi-next:{:#x}", hr.0)); }
                match one[0].take() { Some(row) if count == 1 => out.push(row), _ => break }
            }
            Ok(out)
        }
        /// Every shadow copy on this computer: (id, volume name).
        pub fn copies(&self) -> Result<Vec<(String, String)>, String> {
            Ok(self.query("SELECT ID, VolumeName FROM Win32_ShadowCopy")?.iter().filter_map(|row| Some((get(row, "ID").as_text()?, get(row, "VolumeName").as_text()?))).collect())
        }
        /// A client-accessible shadow copy of `letter` (`C:`); its id.
        pub fn create(&self, letter: &str) -> Result<String, String> {
            let mut class = None;
            unsafe { self.services.GetObject(&BSTR::from("Win32_ShadowCopy"), WBEM_FLAG_RETURN_WBEM_COMPLETE, None, Some(&mut class), None) }.map_err(|e| code("wmi-class", e))?;
            let class = class.ok_or("wmi-class")?;
            let (mut input, mut output) = (None, None);
            unsafe { class.GetMethod(windows::core::w!("Create"), 0, &mut input, &mut output) }.map_err(|e| code("wmi-method", e))?;
            let params = unsafe { input.ok_or("wmi-method")?.SpawnInstance(0) }.map_err(|e| code("wmi-params", e))?;
            let (volume, context) = (Var::text(&format!("{letter}\\")), Var::text("ClientAccessible"));
            unsafe { params.Put(windows::core::w!("Volume"), 0, &volume.0, 0) }.map_err(|e| code("wmi-params", e))?;
            unsafe { params.Put(windows::core::w!("Context"), 0, &context.0, 0) }.map_err(|e| code("wmi-params", e))?;
            let mut result = None;
            unsafe { self.services.ExecMethod(&BSTR::from("Win32_ShadowCopy"), &BSTR::from("Create"), WBEM_GENERIC_FLAG_TYPE(0), None, &params, Some(&mut result), None) }.map_err(|e| code("wmi-create", e))?;
            let result = result.ok_or("wmi-create")?;
            let returned = get(&result, "ReturnValue").as_number();
            if returned != Some(0) { return Err(format!("wmi-create:{}", returned.unwrap_or(-1))); }
            let id = get(&result, "ShadowID").as_text().filter(|id| super::shadow_id_ok(id)).ok_or("wmi-create")?;
            Ok(id)
        }
        /// The device of shadow copy `id` (`\\?\GLOBALROOT\Device\HarddiskVolumeShadowCopyN`).
        pub fn device(&self, id: &str) -> Result<String, String> {
            if !super::shadow_id_ok(id) { return Err("wmi-id".into()); }
            self.query(&format!("SELECT DeviceObject FROM Win32_ShadowCopy WHERE ID = '{id}'"))?.first().and_then(|row| get(row, "DeviceObject").as_text())
                .filter(|d| super::device_ok(d)).ok_or_else(|| "wmi-device".to_string())
        }
        /// Deletes shadow copy `id`; `false` when it was not there any more.
        pub fn delete(&self, id: &str) -> Result<bool, String> {
            if !super::shadow_id_ok(id) { return Err("wmi-id".into()); }
            match unsafe { self.services.DeleteInstance(&BSTR::from(format!("Win32_ShadowCopy.ID=\"{id}\"")), WBEM_GENERIC_FLAG_TYPE(0), None, None) } {
                Ok(()) => Ok(true),
                Err(e) if e.code().0 == NOT_FOUND => Ok(false),
                Err(e) => Err(code("wmi-delete", e)),
            }
        }
        /// The share of time volume `letter` was idle over `sample`, from the raw disk counter twice; `None` when the
        /// counter cannot be read — then no copy is made (GPT GB2).
        pub fn idle(&self, letter: &str, sample: std::time::Duration) -> Option<f64> {
            let wql = format!("SELECT PercentIdleTime, Timestamp_Sys100NS FROM Win32_PerfRawData_PerfDisk_LogicalDisk WHERE Name = '{letter}'");
            let read = || -> Option<(u64, u64)> {
                let rows = self.query(&wql).ok()?;
                let row = rows.first()?;
                let number = |name: &str| { let v = get(row, name); v.as_text().and_then(|t| t.parse::<u64>().ok()).or_else(|| v.as_number().map(|n| n as u64)) };
                Some((number("PercentIdleTime")?, number("Timestamp_Sys100NS")?))
            };
            let (idle0, time0) = read()?;
            std::thread::sleep(sample);
            let (idle1, time1) = read()?;
            super::idle_share(idle0, time0, idle1, time1)
        }
    }
}

/// Percent idle between two raw samples of a 100 ns idle timer and its 100 ns timestamp, 0 ~ 100.
fn idle_share(idle0: u64, time0: u64, idle1: u64, time1: u64) -> Option<f64> {
    if time1 <= time0 || idle1 < idle0 { return None; }
    Some((100.0 * (idle1 - idle0) as f64 / (time1 - time0) as f64).clamp(0.0, 100.0))
}

// ---- The helper's own folder ----

/// The administrators' part of every helper folder: Administrators and SYSTEM full, nothing inherited.
const ROOT_SDDL: &str = "O:BAD:P(A;OICI;FA;;;BA)(A;OICI;FA;;;SY)";
/// A user's folder: the same, and that user may list, read and pass through (read and execute).
fn user_sddl(sid: &str) -> String { format!("O:BAD:P(A;OICI;FA;;;BA)(A;OICI;FA;;;SY)(A;OICI;0x1200a9;;;{sid})") }

/// `%ProgramData%\SynkWorkBackup\helper\<SID>` — the same path for the run (to read the answer) and the helper.
pub fn user_dir(sid: &str) -> Result<PathBuf, String> {
    if !sid_ok(sid) { return Err("sid".into()); }
    Ok(win::known(&windows_sys::Win32::UI::Shell::FOLDERID_ProgramData)?.join(platform::PRODUCT_DIR).join("helper").join(sid))
}
/// Makes or checks each of the helper's three folders under %ProgramData%. One that is a link, has another owner
/// or lets anyone else change it is never used (a standard user can make a folder in %ProgramData% first): then
/// there is no helper on this computer and the partial snapshot rule keeps the files (`folder-not-ours`).
fn prepare_dir(sid: &str) -> Result<PathBuf, String> {
    let dir = user_dir(sid)?;
    let data = dir.parent().and_then(Path::parent).and_then(Path::parent).ok_or("folder")?;
    win::trusted_above(&win::open_here(data).map_err(|_| "folder")?).map_err(|_| "folder-not-ours")?;
    let steps = [(dir.parent().unwrap().parent().unwrap().to_path_buf(), ROOT_SDDL.to_string()), (dir.parent().unwrap().to_path_buf(), ROOT_SDDL.to_string()), (dir.clone(), user_sddl(sid))];
    for (path, sddl) in steps {
        win::make_dir(&path, &sddl)?;
        win::trusted(&win::open_here(&path).map_err(|_| "folder")?, true).map_err(|_| "folder-not-ours")?;
    }
    Ok(dir)
}
/// The file one helper on this computer holds while it checks for other copies and makes one (GPT workbackup-fill-b
/// GA2): two accounts' helpers that both passed the check would otherwise both make a copy on the same volume. It is
/// in the administrators-only helper folder, so no other account can hold it; one not had within a minute is a refusal.
const CREATION_LOCK: &str = "create.lock";
fn creation_lock(helper_root: &Path) -> Option<File> {
    use fs2::FileExt;
    let file = OpenOptions::new().read(true).write(true).create(true).truncate(false).open(helper_root.join(CREATION_LOCK)).ok()?;
    let until = Instant::now() + Duration::from_secs(60);
    loop {
        if file.try_lock_exclusive().is_ok() { return Some(file); }
        if Instant::now() > until { return None; }
        std::thread::sleep(Duration::from_millis(250));
    }
}
fn write_inside(dir: &Path, name: &str, value: &Value) -> Result<(), String> {
    let temp = dir.join(format!("{name}.tmp"));
    fs::write(&temp, value.to_string()).map_err(|_| "write")?;
    fs::rename(&temp, dir.join(name)).map_err(|_| "write".into())
}
fn read_ledger(dir: &Path) -> Ledger { win::read_small(&dir.join(LEDGER), 65_536).map(|b| Ledger::parse(&b)).unwrap_or(Ledger { v: 1, ..Ledger::default() }) }
fn save_ledger(dir: &Path, ledger: &Ledger) -> Result<(), String> { write_inside(dir, LEDGER, &serde_json::to_value(ledger).map_err(|_| "write")?) }

/// Takes away what the helper made before: its links in `dir` and the shadow copies its ledger names. A copy that
/// is gone already is fine; one that cannot be deleted stays in the ledger for the next time. The answer is left: a
/// run that reads it every 500 ms must not miss a refusal written and taken away in between (GPT workbackup-fill GB3).
/// It names a request id, so an old one is never taken for a new request; the next helper start removes it.
fn sweep(wmi: &wmi::Wmi, dir: &Path, ledger: &mut Ledger) {
    for letter in b'A'..=b'Z' {
        let link = dir.join(format!("snap-{}", letter as char));
        if fs::symlink_metadata(&link).is_ok_and(|m| m.file_type().is_symlink()) { let _ = fs::remove_dir(&link); }
    }
    ledger.copies.retain(|copy| wmi.delete(&copy.id).is_err());
}

fn status_error(dir: &Path, error: &str) { let _ = write_inside(dir, STATUS, &json!({"v": 1, "id": null, "at": epoch_ms(), "error": error})); }

/// `--vss-helper`: one request, then the links stay until that run ends. Exit 0 (an answer was written, also a
/// refusal), 1 the helper could not start, 77 not elevated.
pub fn serve() -> i32 {
    if !platform::elevated() { return 77; }
    let trusting = win::redirection_trust();
    let Ok(exe) = std::env::current_exe() else { return 1 };
    // 4.2 「시작할 때 확인」 ①: the executable and every folder above it up to Program Files belong to the administrators.
    if !cfg!(debug_assertions) && check_self(&exe).is_err() { return 1; }
    let Ok(sid) = schedule::current_sid() else { return 1 };
    let Ok(dir) = prepare_dir(&sid) else { return 1 };
    let Ok(wmi) = wmi::Wmi::connect() else { status_error(&dir, "wmi"); return 1 };
    let mut ledger = read_ledger(&dir);
    sweep(&wmi, &dir, &mut ledger);
    let _ = fs::remove_file(dir.join(STATUS));
    let now = epoch_ms();
    ledger.forget_old(now);
    let _ = save_ledger(&dir, &ledger);
    let request = win::known(&windows_sys::Win32::UI::Shell::FOLDERID_RoamingAppData)
        .and_then(|appdata| win::read_small(&appdata.join(platform::PRODUCT_DIR).join(REQUEST), REQUEST_MAX))
        .and_then(|bytes| parse_request(&bytes, now));
    let request = match request { Ok(r) => r, Err(e) => { status_error(&dir, if e == "request-age" { "request-age" } else { "request" }); return 0; } };
    let process = match win::same_run(request.pid, &exe, &sid) { Ok(p) => p, Err(_) => { status_error(&dir, "requester"); return 0; } };
    let (mut links, mut refused, mut idle) = (Vec::new(), Vec::new(), serde_json::Map::new());
    // Another copy on this volume (a restore point, another program's) could be lost to a new one: not there. Asked
    // before the idle sample and again right before the copy is made, so one made meanwhile is seen (GPT GB1).
    let others = |name: &str, ledger: &Ledger| -> Result<usize, ()> {
        let ours: Vec<String> = ledger.copies.iter().map(|c| c.id.to_ascii_lowercase()).collect();
        wmi.copies().map(|list| list.iter().filter(|(id, volume)| volume.eq_ignore_ascii_case(name) && !ours.contains(&id.to_ascii_lowercase())).count()).map_err(|_| ())
    };
    for letter in &request.volumes {
        let name = match win::volume(letter) { Ok(n) => n, Err(reason) => { refused.push(json!({"volume": letter, "reason": reason})); continue; } };
        match others(&name, &ledger) { Err(()) => { refused.push(json!({"volume": letter, "reason": "copies"})); continue; } Ok(n) if n > 0 => { refused.push(json!({"volume": letter, "reason": "other-copies"})); continue; } Ok(_) => {} }
        if ledger.left(epoch_ms()) == 0 { refused.push(json!({"volume": letter, "reason": "limit"})); continue; }
        // A disk not measured is not taken for a quiet one (GPT GB2).
        let share = wmi.idle(letter, IDLE_SAMPLE);
        idle.insert(letter.clone(), share.map(|s| json!((s * 10.0).round() / 10.0)).unwrap_or(Value::Null));
        match share { None => { refused.push(json!({"volume": letter, "reason": "idle-unknown"})); continue; } Some(s) if s < IDLE_MIN => { refused.push(json!({"volume": letter, "reason": "busy"})); continue; } Some(_) => {} }
        // From the last check to the link, one helper at a time on this computer (GPT workbackup-fill-b GA2).
        let Some(_creating) = dir.parent().and_then(creation_lock) else { refused.push(json!({"volume": letter, "reason": "busy"})); continue; };
        match others(&name, &ledger) { Err(()) => { refused.push(json!({"volume": letter, "reason": "copies"})); continue; } Ok(n) if n > 0 => { refused.push(json!({"volume": letter, "reason": "other-copies"})); continue; } Ok(_) => {} }
        let id = match wmi.create(letter) { Ok(id) => id, Err(_) => { refused.push(json!({"volume": letter, "reason": "create"})); continue; } };
        // Into the ledger before anything else, so the next start or the uninstall deletes it whatever happens next.
        ledger.made.push(epoch_ms());
        ledger.copies.push(Copy { id: id.clone(), volume: letter.clone(), at: epoch_ms() });
        let _ = save_ledger(&dir, &ledger);
        // Windows does not stop another program (System Restore, another backup) from making a copy between the check and
        // ours: the lock above only puts our helpers in line. So it is looked at once more, and when one came meanwhile
        // ours goes at once — the two do not stay side by side on a busy disk (GPT workbackup-fill GB1 · -b GA2).
        if !matches!(others(&name, &ledger), Ok(0)) {
            if wmi.delete(&id).is_ok() { ledger.copies.retain(|c| c.id != id); let _ = save_ledger(&dir, &ledger); }
            refused.push(json!({"volume": letter, "reason": "other-copies"}));
            continue;
        }
        let link = dir.join(link_name(letter));
        match wmi.device(&id).and_then(|device| win::make_link(&link, &device)) {
            Ok(()) => links.push(json!({"volume": letter, "root": link.to_string_lossy()})),
            Err(_) => { if wmi.delete(&id).is_ok() { ledger.copies.retain(|c| c.id != id); let _ = save_ledger(&dir, &ledger); } refused.push(json!({"volume": letter, "reason": "link"})); }
        }
    }
    let answer = json!({"v": 1, "id": request.id, "at": epoch_ms(), "links": links, "refused": refused, "idle": idle, "redirectionTrust": trusting});
    if write_inside(&dir, STATUS, &answer).is_err() { sweep(&wmi, &dir, &mut ledger); let _ = save_ledger(&dir, &ledger); return 1; }
    // The links stay while that run reads through them (its fill), then go with the copies.
    if !links.is_empty() { win::wait(&process, HOLD_MAX_MS); }
    sweep(&wmi, &dir, &mut ledger);
    let _ = save_ledger(&dir, &ledger);
    0
}

/// 4.2 「시작할 때 확인」 ①: this executable and each folder above it, up to and with Program Files.
fn check_self(exe: &Path) -> Result<(), String> {
    let files = win::known(&windows_sys::Win32::UI::Shell::FOLDERID_ProgramFiles)?;
    if !platform::overlap(exe, &files) || platform::key_path(exe) == platform::key_path(&files) { return Err("place".into()); }
    win::trusted(&win::open_here(exe)?, false)?;
    let mut cursor = exe.parent();
    while let Some(folder) = cursor {
        win::trusted(&win::open_here(folder)?, true)?;
        if platform::key_path(folder) == platform::key_path(&files) { return Ok(()); }
        cursor = folder.parent();
    }
    Err("place".into())
}

/// `--register-helper`, from the installer as an administrator (4.2 「등록」): the helper task and folder for the
/// account at this desktop, only when that account is the one that approved the installer. Another account's
/// administrator password on a standard user's desktop gives that user no helper (4.2 「표준 사용자」).
pub fn register(exe: &Path) -> (i32, Value) {
    if !platform::elevated() { return (77, json!({"ok": false, "error": "NOT_ELEVATED"})); }
    let Ok(sid) = schedule::current_sid() else { return (1, json!({"ok": false, "error": "SID"})) };
    if win::shell_sid().as_deref() != Some(sid.as_str()) { return (0, json!({"ok": true, "helper": false, "reason": "other-account"})); }
    if let Err(error) = prepare_dir(&sid) { return (0, json!({"ok": true, "helper": false, "reason": error})); }
    match schedule::register_helper(exe, &schedule::account_label(&sid), &sid) {
        Ok(security) => (0, json!({"ok": true, "helper": true, "folder": schedule::HELPER_FOLDER, "security": security})),
        Err(error) if error == "SCHEDULE_HELPER_FOLDER_NOT_OURS" => (0, json!({"ok": true, "helper": false, "reason": "task-folder-not-ours"})),
        Err(error) => (1, json!({"ok": false, "error": error})),
    }
}

/// The uninstaller, as an administrator: every user's helper copies (from each ledger), links and folders.
pub fn remove_all() -> Value {
    let Ok(root) = win::known(&windows_sys::Win32::UI::Shell::FOLDERID_ProgramData).map(|p| p.join(platform::PRODUCT_DIR).join("helper")) else { return json!({"error": "known-folder"}) };
    let product = root.parent().map(Path::to_path_buf).unwrap_or_default();
    // Only folders the helper made: a link or a folder someone else owns under these names is left alone.
    let ours = |path: &Path| win::open_here(path).is_ok_and(|f| win::trusted(&f, true).is_ok());
    if !ours(&product) || !ours(&root) { return json!({"copies": 0, "failed": 0, "removed": false}); }
    let (mut copies, mut failed) = (0, 0);
    let wmi = wmi::Wmi::connect();
    for entry in fs::read_dir(&root).into_iter().flatten().flatten() {
        let dir = entry.path();
        let named = entry.file_name().to_str().is_some_and(sid_ok);
        if !named || !ours(&dir) { failed += 1; continue; }
        let mut ledger = read_ledger(&dir);
        match &wmi {
            Ok(wmi) => { let before = ledger.copies.len(); sweep(wmi, &dir, &mut ledger); copies += before - ledger.copies.len(); failed += ledger.copies.len(); }
            Err(_) => failed += ledger.copies.len(),
        }
        if ledger.copies.is_empty() {
            for name in [LEDGER, STATUS, "ledger.json.tmp", "status.json.tmp"] { let _ = fs::remove_file(dir.join(name)); }
            if fs::remove_dir(&dir).is_err() { failed += 1; }
        } else { let _ = save_ledger(&dir, &ledger); }
    }
    let _ = fs::remove_file(root.join(CREATION_LOCK));
    let removed = fs::remove_dir(&root).is_ok() && fs::remove_dir(&product).is_ok();
    json!({"copies": copies, "failed": failed, "removed": removed})
}

/// What a run got from the helper for its fill.
#[derive(Debug, Default)]
pub struct Asked { pub links: Vec<Link>, pub refused: Vec<(String, String)>, pub error: Option<String>, pub waited_ms: u64 }
impl Asked {
    pub fn without(reason: &str) -> Self { Asked { error: Some(reason.into()), ..Asked::default() } }
    pub fn links_json(&self) -> Value { Value::Array(self.links.iter().map(|l| json!({"volume": l.volume, "root": l.root.to_string_lossy()})).collect()) }
    /// For runs.jsonl: volume letters and fixed reasons only, no path.
    pub fn record(&self, asked: &[String]) -> Value {
        let mut out = json!({"asked": asked, "linked": self.links.iter().map(|l| l.volume.clone()).collect::<Vec<_>>(), "waitMs": self.waited_ms});
        if !self.refused.is_empty() { out["refused"] = Value::Object(self.refused.iter().map(|(v, r)| (v.clone(), json!(r))).collect()); }
        if let Some(e) = &self.error { out["error"] = json!(e); }
        out
    }
}

/// The run, at normal privilege (4.2 step 9): writes the request, wakes this account's helper task and waits for its
/// answer. No helper (a standard user, another account approved the install, the folder is not ours) is an answer
/// too — the fill then counts as tried and the next waits its 4 hours.
pub fn ask(root: &Path, volumes: &[String]) -> Asked {
    let started = std::time::Instant::now();
    let finish = |mut a: Asked| { a.waited_ms = started.elapsed().as_millis() as u64; a };
    let (Ok(exe), Ok(sid)) = (std::env::current_exe(), schedule::current_sid()) else { return finish(Asked::without("sid")) };
    let user = schedule::account_label(&sid);
    let Ok(dir) = user_dir(&sid) else { return finish(Asked::without("sid")) };
    if !schedule::helper_ready(&exe, &user, &sid) { return finish(Asked::without("no-helper")); }
    let id = format!("{:032x}", { use sha2::{Digest, Sha256}; let d = Sha256::digest(format!("{}-{}-{:?}", std::process::id(), epoch_ms(), started).as_bytes()); u128::from_be_bytes(d[..16].try_into().unwrap()) });
    let request = Request { id: id.clone(), pid: std::process::id(), at: epoch_ms(), volumes: volumes.to_vec() };
    let temp = root.join(format!("{REQUEST}.tmp"));
    if fs::write(&temp, request_json(&request).to_string()).and_then(|_| fs::rename(&temp, root.join(REQUEST))).is_err() { return finish(Asked::without("request")); }
    if let Err(_) = schedule::run_helper(&exe, &user, &sid) { return finish(Asked::without("start")); }
    while started.elapsed() < WAIT {
        std::thread::sleep(Duration::from_millis(500));
        let Ok(bytes) = win::read_small(&dir.join(STATUS), 16_384) else { continue };
        match parse_status(&bytes, &id, request.at, &dir, volumes) {
            Ok(Some(answer)) => {
                // Each link is checked as a link the helper made in its own folder before the worker reads through it.
                let links = answer.links.into_iter().filter(|l| fs::symlink_metadata(&l.root).is_ok_and(|m| std::os::windows::fs::FileTypeExt::is_symlink_dir(&m.file_type()))).collect();
                return finish(Asked { links, refused: answer.refused, error: answer.error, waited_ms: 0 });
            }
            Ok(None) => continue,
            Err(_) => return finish(Asked::without("status")),
        }
    }
    finish(Asked::without("timeout"))
}
/// After the fill: the request goes. The helper takes the links away when this run has ended.
pub fn finish(root: &Path) { let _ = fs::remove_file(root.join(REQUEST)); }

#[cfg(test)] mod tests {
    use super::*;
    #[test] fn requests_are_small_data() {
        let now = 1_800_000_000_000;
        let good = json!({"v": 1, "id": "0123456789abcdef0123456789abcdef", "pid": 4242, "at": now - 1000, "volumes": ["C:", "D:"]});
        let r = parse_request(good.to_string().as_bytes(), now).unwrap();
        assert_eq!(r, Request { id: "0123456789abcdef0123456789abcdef".into(), pid: 4242, at: now - 1000, volumes: vec!["C:".into(), "D:".into()] });
        assert_eq!(parse_request(request_json(&r).to_string().as_bytes(), now).unwrap(), r);
        let bad = |change: &dyn Fn(&mut Value)| { let mut v = good.clone(); change(&mut v); parse_request(v.to_string().as_bytes(), now).unwrap_err() };
        assert_eq!(bad(&|v| v["v"] = json!(2)), "request");
        assert_eq!(bad(&|v| v["id"] = json!("../x")), "request");
        assert_eq!(bad(&|v| v["pid"] = json!(0)), "request");
        assert_eq!(bad(&|v| v["pid"] = json!(u64::from(u32::MAX) + 1)), "request");
        assert_eq!(bad(&|v| v["volumes"] = json!([])), "request");
        assert_eq!(bad(&|v| v["volumes"] = json!(["C:", "C:"])), "request");
        assert_eq!(bad(&|v| v["volumes"] = json!(["C:\\"])), "request");
        assert_eq!(bad(&|v| v["volumes"] = json!(["c:"])), "request");
        assert_eq!(bad(&|v| v["path"] = json!("C:\\Windows")), "request", "no other field");
        assert_eq!(bad(&|v| v["at"] = json!(now - REQUEST_AGE_MS - 1)), "request-age");
        assert_eq!(bad(&|v| v["at"] = json!(now + 120_000)), "request-age");
        assert!(parse_request(b"not json", now).is_err());
    }
    #[test] fn answers_name_only_the_fixed_links() {
        let dir = PathBuf::from(r"C:\ProgramData\SynkWorkBackup\helper\S-1-5-21-1-2-3-1001");
        let asked = vec!["C:".to_string(), "D:".to_string()];
        let answer = json!({"v": 1, "id": "abcd1234", "at": 5, "links": [{"volume": "C:", "root": dir.join("snap-C")}], "refused": [{"volume": "D:", "reason": "other-copies"}]});
        let got = parse_status(answer.to_string().as_bytes(), "abcd1234", 1, &dir, &asked).unwrap().unwrap();
        assert_eq!(got.links, vec![Link { volume: "C:".into(), root: dir.join("snap-C") }]);
        assert_eq!(got.refused, vec![("D:".to_string(), "other-copies".to_string())]);
        assert_eq!(parse_status(answer.to_string().as_bytes(), "other999", 1, &dir, &asked).unwrap(), None, "not for this request yet");
        for wrong in [json!({"v": 1, "id": "abcd1234", "links": [{"volume": "C:", "root": r"C:\Users\x\snap-C"}], "refused": []}),
                      json!({"v": 1, "id": "abcd1234", "links": [{"volume": "E:", "root": dir.join("snap-E")}], "refused": []}),
                      json!({"v": 1, "id": "abcd1234", "links": [{"volume": "C:", "root": dir.join("snap-D")}], "refused": []}),
                      json!({"v": 1, "id": "abcd1234", "links": [], "refused": [{"volume": "D:", "reason": "C:\\secret"}]}),
                      json!({"v": 1, "id": "abcd1234", "links": [{"volume": "C:", "root": dir.join("snap-C")}], "refused": [{"volume": "C:", "reason": "busy"}]})] {
            assert!(parse_status(wrong.to_string().as_bytes(), "abcd1234", 1, &dir, &asked).is_err(), "{wrong}");
        }
        // A request the helper could not take: an error written after this request, not one left from before.
        let error = json!({"v": 1, "id": null, "at": 10, "error": "requester"});
        assert_eq!(parse_status(error.to_string().as_bytes(), "abcd1234", 5, &dir, &asked).unwrap().unwrap().error.as_deref(), Some("requester"));
        assert_eq!(parse_status(error.to_string().as_bytes(), "abcd1234", 11, &dir, &asked).unwrap(), None);
    }
    #[test] fn six_copies_a_day() {
        let now = 10 * DAY_MS;
        let mut ledger = Ledger { v: 1, made: vec![now - DAY_MS - 1, now - 5 * 3_600_000, now - 1000], copies: vec![] };
        assert_eq!(ledger.left(now), DAILY_MAX - 2);
        ledger.made.extend([now - 4, now - 3, now - 2, now - 1]);
        assert_eq!(ledger.left(now), 0);
        ledger.forget_old(now);
        assert_eq!(ledger.made.len(), 6);
        assert_eq!(ledger.left(now + DAY_MS), DAILY_MAX, "a day on");
        // A broken or foreign ledger starts empty; copies with a bad id are dropped, never sent to WMI.
        assert_eq!(Ledger::parse(b"{"), Ledger { v: 1, ..Ledger::default() });
        let parsed = Ledger::parse(br#"{"v":1,"made":[1],"copies":[{"id":"{8F3B1C2A-1111-2222-3333-444455556666}","volume":"C:","at":1},{"id":"x\" OR 1","volume":"C:","at":1}]}"#);
        assert_eq!(parsed.copies.len(), 1);
    }
    #[test] fn ids_and_devices_are_checked_before_wmi() {
        assert!(shadow_id_ok("{8F3B1C2A-1111-2222-3333-444455556666}"));
        for bad in ["8F3B1C2A-1111-2222-3333-444455556666", "{8F3B1C2A-1111-2222-3333-44445555666'}", "{8F3B1C2A11112222333344445555666666}"] { assert!(!shadow_id_ok(bad), "{bad}"); }
        assert!(device_ok(r"\\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy12"));
        for bad in [r"\\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy", r"\\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy1\..\x", r"C:\Windows"] { assert!(!device_ok(bad), "{bad}"); }
        assert_eq!(link_name("C:"), "snap-C");
    }
    #[test] fn fill_volumes_come_from_the_profiles() {
        let result = json!({"profiles": {"local": {"outcome": "partial", "fill": ["C:"]}, "b2": {"outcome": "partial", "fill": ["D:", "C:", "../x"]}, "x": {"outcome": "complete"}}});
        assert_eq!(fill_volumes(&result), vec!["C:".to_string(), "D:".to_string()]);
        assert!(fill_volumes(&json!({})).is_empty());
    }
    #[test] fn idle_share_of_two_samples() {
        assert_eq!(idle_share(1_000, 10_000, 5_000, 15_000), Some(80.0));
        assert_eq!(idle_share(0, 0, 9_000, 5_000), Some(100.0), "capped");
        assert_eq!(idle_share(5, 10, 4, 20), None);
        assert_eq!(idle_share(5, 10, 6, 10), None);
    }
    #[test] fn records_carry_letters_and_reasons_only() {
        let asked = Asked { links: vec![Link { volume: "C:".into(), root: PathBuf::from(r"C:\ProgramData\SynkWorkBackup\helper\S-1-5-21-9\snap-C") }], refused: vec![("D:".into(), "busy".into())], error: None, waited_ms: 4100 };
        let record = asked.record(&["C:".into(), "D:".into()]);
        assert_eq!(record, json!({"asked": ["C:", "D:"], "linked": ["C:"], "refused": {"D:": "busy"}, "waitMs": 4100}));
        assert!(!record.to_string().contains("ProgramData"));
        assert_eq!(Asked::without("no-helper").record(&["C:".into()])["error"], "no-helper");
    }
    #[test] fn folders_are_judged_by_their_real_permission() {
        use windows_sys::Win32::UI::Shell::{FOLDERID_ProgramData, FOLDERID_ProgramFiles};
        // %ProgramData% lets every user add a folder, so it is only a folder above ours — never one of ours.
        let data = win::known(&FOLDERID_ProgramData).unwrap();
        assert!(win::trusted_above(&win::open_here(&data).unwrap()).is_ok(), "{data:?}");
        assert!(win::trusted(&win::open_here(&data).unwrap(), true).is_err(), "users may add to it");
        let files = win::known(&FOLDERID_ProgramFiles).unwrap();
        assert!(win::trusted(&win::open_here(&files).unwrap(), true).is_ok(), "{files:?}");
        assert!(win::trusted(&win::open_here(&files).unwrap(), false).is_err(), "a folder is not taken for a file");
        // A folder this user owns is neither.
        let mine = std::env::temp_dir().join(format!("swb-helper-{}", std::process::id()));
        fs::create_dir_all(&mine).unwrap();
        assert_eq!(win::trusted(&win::open_here(&mine).unwrap(), true), Err("owner".into()));
        assert!(win::trusted_above(&win::open_here(&mine).unwrap()).is_err());
        // A link is opened as itself and refused, wherever it points.
        let link = mine.join("snap-C");
        if std::os::windows::fs::symlink_dir(&files, &link).is_ok() || std::process::Command::new("cmd").args(["/c", "mklink", "/j"]).arg(&link).arg(&files).output().is_ok_and(|o| o.status.success()) {
            assert_eq!(win::trusted(&win::open_here(&link).unwrap(), true), Err("link".into()));
            let _ = fs::remove_dir(&link);
        }
        // This test executable is not under Program Files: the helper would not start from here.
        assert!(check_self(&std::env::current_exe().unwrap()).is_err());
        let _ = fs::remove_dir_all(&mine);
    }
    #[test] fn sddl_of_the_folders() {
        assert_eq!(user_sddl("S-1-5-21-1-2-3-1001"), "O:BAD:P(A;OICI;FA;;;BA)(A;OICI;FA;;;SY)(A;OICI;0x1200a9;;;S-1-5-21-1-2-3-1001)");
        assert!(user_dir("../x").is_err());
    }
}
