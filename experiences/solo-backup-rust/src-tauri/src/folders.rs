//! Where things are on this PC, for 「새 PC로 옮겨 오기」 (STAGE1_DESIGN.md 4.6 「자리 맞추기 · OneDrive」): the known
//! folders (`SHGetKnownFolderPath`, wherever OneDrive moved them), the OneDrive roots and accounts, the fixed
//! drives and their free space. The old PC puts this snapshot in the move kit; the new PC reads its own and the
//! engine pairs the two (`engine/src/move-plan.cjs`). Nothing here writes.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{os::windows::ffi::{OsStrExt, OsStringExt}, path::{Path, PathBuf}, ptr};
use windows_sys::{core::GUID, Win32::{Foundation::*, Storage::FileSystem::*, System::{Com::CoTaskMemFree, Registry::*}, UI::Shell::*}};

/// The six folders a person keeps work in, then the profile's app-data folders (for app settings, 4.6b).
pub const KNOWN: [(&str, GUID); 9] = [
    ("documents", FOLDERID_Documents), ("desktop", FOLDERID_Desktop), ("pictures", FOLDERID_Pictures), ("music", FOLDERID_Music),
    ("videos", FOLDERID_Videos), ("downloads", FOLDERID_Downloads), ("profile", FOLDERID_Profile), ("roaming", FOLDERID_RoamingAppData), ("local", FOLDERID_LocalAppData),
];
/// The default 「OneDrive 밖 새 폴더」 under the profile.
pub const MOVE_BASE: &str = "옮겨 온 자료";

fn wide(text: &str) -> Vec<u16> { text.encode_utf16().chain([0]).collect() }
fn from_wide(ptr: *const u16) -> PathBuf {
    let len = (0..).take_while(|&i| unsafe { *ptr.add(i) } != 0).count();
    PathBuf::from(std::ffi::OsString::from_wide(unsafe { std::slice::from_raw_parts(ptr, len) }))
}
pub fn known_folder(id: &GUID) -> Result<PathBuf, String> {
    let mut out: *mut u16 = ptr::null_mut();
    let hr = unsafe { SHGetKnownFolderPath(id, 0, ptr::null_mut(), &mut out) };
    let path = if hr >= 0 && !out.is_null() { Ok(from_wide(out)) } else { Err(format!("FOLDERS_KNOWN:{hr:#x}")) };
    if !out.is_null() { unsafe { CoTaskMemFree(out as *const _) }; }
    path
}
fn key(path: &Path) -> String { crate::platform::key_path(path) }
/// Whether `path` is `root` or inside it.
pub fn inside(path: &Path, root: &Path) -> bool { let (p, r) = (key(path), key(root)); !r.is_empty() && (p == r || p.starts_with(&(r + "\\"))) }

struct Key(HKEY);
impl Drop for Key { fn drop(&mut self) { unsafe { RegCloseKey(self.0); } } }
fn open_key(parent: HKEY, name: &str) -> Option<Key> {
    let mut out: HKEY = ptr::null_mut();
    (unsafe { RegOpenKeyExW(parent, wide(name).as_ptr(), 0, KEY_READ, &mut out) } == 0).then_some(Key(out))
}
fn reg_string(key: &Key, name: &str) -> Option<String> {
    let mut buffer = vec![0u16; 1024]; let mut bytes = (buffer.len() * 2) as u32;
    let status = unsafe { RegGetValueW(key.0, ptr::null(), wide(name).as_ptr(), RRF_RT_REG_SZ, ptr::null_mut(), buffer.as_mut_ptr() as *mut _, &mut bytes) };
    if status != 0 { return None; }
    let units = (bytes as usize / 2).saturating_sub(1).min(buffer.len());
    Some(String::from_utf16_lossy(&buffer[..units])).filter(|s| !s.is_empty())
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OneDriveRoot { pub kind: String, pub path: PathBuf, pub email_sha256: Option<String> }
/// OneDrive's folders on this PC: its environment variables, then each account in the registry
/// (`HKCU\Software\Microsoft\OneDrive\Accounts\<kind>` — `UserFolder`, `UserEmail`). The mail is kept only as SHA-256.
/// The OneDrive account's mail as the kit carries it: SHA-256 of the trimmed, lower-case mail — never the mail.
pub fn email_hash(mail: &str) -> String { format!("{:x}", Sha256::digest(mail.trim().to_lowercase().as_bytes())) }
pub fn onedrive_roots() -> Vec<OneDriveRoot> {
    let mut roots: Vec<OneDriveRoot> = Vec::new();
    let mut add = |kind: &str, path: PathBuf, email: Option<String>| {
        if !path.is_absolute() { return; }
        let email_sha256 = email.map(|m| email_hash(&m));
        match roots.iter_mut().find(|r| key(&r.path) == key(&path)) {
            Some(found) => { if found.email_sha256.is_none() { found.email_sha256 = email_sha256; } if found.kind == "environment" { found.kind = kind.into(); } }
            None => roots.push(OneDriveRoot { kind: kind.into(), path, email_sha256 }),
        }
    };
    if let Some(accounts) = open_key(HKEY_CURRENT_USER, r"Software\Microsoft\OneDrive\Accounts") {
        for index in 0..64u32 {
            let mut name = vec![0u16; 256]; let mut len = name.len() as u32;
            if unsafe { RegEnumKeyExW(accounts.0, index, name.as_mut_ptr(), &mut len, ptr::null(), ptr::null_mut(), ptr::null_mut(), ptr::null_mut()) } != 0 { break; }
            let kind = String::from_utf16_lossy(&name[..len as usize]);
            if let Some(account) = open_key(accounts.0, &kind) {
                if let Some(folder) = reg_string(&account, "UserFolder") { add(&kind, PathBuf::from(folder), reg_string(&account, "UserEmail")); }
            }
        }
    }
    for name in ["OneDrive", "OneDriveConsumer", "OneDriveCommercial"] {
        if let Some(path) = std::env::var_os(name) { add("environment", PathBuf::from(path), None); }
    }
    roots
}
pub fn in_onedrive(path: &Path, roots: &[OneDriveRoot]) -> bool { roots.iter().any(|r| inside(path, &r.path)) }
/// The signed-in user's SID from the process token (as schedule.rs, which this module's test hosts do not build).
fn current_sid() -> Option<String> {
    use windows_sys::Win32::{Security::{GetTokenInformation, TokenUser, TOKEN_QUERY, TOKEN_USER, Authorization::ConvertSidToStringSidW}, System::Threading::{GetCurrentProcess, OpenProcessToken}};
    unsafe {
        let mut token: HANDLE = ptr::null_mut();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 { return None; }
        let mut size = 0u32;
        GetTokenInformation(token, TokenUser, ptr::null_mut(), 0, &mut size);
        let mut buffer = vec![0u8; size as usize];
        let ok = GetTokenInformation(token, TokenUser, buffer.as_mut_ptr() as *mut _, size, &mut size) != 0;
        CloseHandle(token);
        if !ok { return None; }
        let user = &*(buffer.as_ptr() as *const TOKEN_USER);
        let mut text: *mut u16 = ptr::null_mut();
        if ConvertSidToStringSidW(user.User.Sid, &mut text) == 0 { return None; }
        let len = (0..).take_while(|&i| *text.add(i) != 0).count();
        let sid = String::from_utf16_lossy(std::slice::from_raw_parts(text, len));
        LocalFree(text as *mut _);
        Some(sid)
    }
}
/// Other sync clients' folders (review M18): this user's roots in Windows' cloud-files sync root list
/// (`HKLM\…\Explorer\SyncRootManager\*\UserSyncRoots`, which OneDrive, Dropbox, Google Drive, iCloud and Box use) and
/// the folders in Dropbox's `info.json`. They are treated like OneDrive, without the same-account comparison.
pub fn sync_roots() -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = Vec::new();
    let mut add = |path: PathBuf| if path.is_absolute() && !roots.iter().any(|r| key(r) == key(&path)) { roots.push(path); };
    // The list is the whole machine's: each value is named by a user's SID. Only this user's roots count — another
    // account's folders are neither this person's sync folders nor theirs to carry in a kit (카본 끝판 G1). Without the
    // SID, only roots inside this user's profile are taken.
    let sid = current_sid();
    let profile = known_folder(&FOLDERID_Profile).ok();
    if let Some(manager) = open_key(HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\SyncRootManager") {
        for index in 0..256u32 {
            let mut name = vec![0u16; 512]; let mut len = name.len() as u32;
            if unsafe { RegEnumKeyExW(manager.0, index, name.as_mut_ptr(), &mut len, ptr::null(), ptr::null_mut(), ptr::null_mut(), ptr::null_mut()) } != 0 { break; }
            let Some(users) = open_key(manager.0, &format!(r"{}\UserSyncRoots", String::from_utf16_lossy(&name[..len as usize]))) else { continue };
            for value in 0..64u32 {
                let (mut vname, mut vlen) = (vec![0u16; 256], 256u32);
                let mut data = vec![0u16; 1024]; let mut bytes = (data.len() * 2) as u32; let mut kind = 0u32;
                if unsafe { RegEnumValueW(users.0, value, vname.as_mut_ptr(), &mut vlen, ptr::null(), &mut kind, data.as_mut_ptr() as *mut u8, &mut bytes) } != 0 { break; }
                if kind != REG_SZ { continue; }
                let owner = String::from_utf16_lossy(&vname[..(vlen as usize).min(vname.len())]);
                let units = (bytes as usize / 2).min(data.len()); let path = PathBuf::from(String::from_utf16_lossy(&data[..units]).trim_end_matches('\0'));
                let mine = match (&sid, &profile) { (Some(sid), _) => owner.eq_ignore_ascii_case(sid), (None, Some(profile)) => inside(&path, profile), (None, None) => false };
                if mine { add(path); }
            }
        }
    }
    // Dropbox keeps `info.json` in Local or in Roaming, by how it was installed (카본 끝판 G2).
    for base in ["LOCALAPPDATA", "APPDATA"] {
        let Some(dir) = std::env::var_os(base) else { continue };
        if let Ok(text) = std::fs::read_to_string(PathBuf::from(dir).join(r"Dropbox\info.json")) { if let Ok(value) = serde_json::from_str::<Value>(&text) {
            for kind in ["personal", "business"] { if let Some(path) = value[kind]["path"].as_str() { add(PathBuf::from(path)); } }
        } }
    }
    roots
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Drive { pub letter: char, pub label: String, pub file_system: String }
/// The fixed drives (`DRIVE_FIXED`) — where 「같은 드라이브가 있으면 같은 경로」 can go.
pub fn fixed_drives() -> Vec<Drive> {
    let mask = unsafe { GetLogicalDrives() };
    (0..26u8).filter(|i| mask & (1 << i) != 0).filter_map(|i| {
        let letter = (b'A' + i) as char; let root = wide(&format!("{letter}:\\"));
        if unsafe { GetDriveTypeW(root.as_ptr()) } != 3 { return None; } // DRIVE_FIXED
        let (mut label, mut fs) = (vec![0u16; 261], vec![0u16; 261]);
        let ok = unsafe { GetVolumeInformationW(root.as_ptr(), label.as_mut_ptr(), 261, ptr::null_mut(), ptr::null_mut(), ptr::null_mut(), fs.as_mut_ptr(), 261) } != 0;
        // A volume Windows cannot read (locked by BitLocker, not formatted) is no place to put files (카본 끝판 G3).
        if !ok { return None; }
        let text = |v: &[u16]| String::from_utf16_lossy(&v[..v.iter().position(|&c| c == 0).unwrap_or(0)]);
        Some(Drive { letter, label: text(&label), file_system: text(&fs) })
    }).collect()
}
/// Bytes this user may still write on the volume that holds `path` (the deepest existing folder above it).
pub fn free_bytes(path: &Path) -> Result<u64, String> {
    let mut cursor = Some(path);
    while let Some(dir) = cursor { if dir.is_dir() { break; } cursor = dir.parent(); }
    let dir = cursor.ok_or("FOLDERS_FREE")?;
    // A folder deeper than the old 260-unit limit is asked through its drive's root (카본 끝판 G5): the call takes no
    // long path, and the drive's root gives the same volume unless a volume is mounted further down.
    let units = dir.as_os_str().encode_wide().count();
    let asked: PathBuf = if units < 248 { dir.to_path_buf() } else { dir.components().take(2).collect() };
    let text: Vec<u16> = asked.as_os_str().encode_wide().chain([0]).collect();
    let mut free = 0u64;
    if unsafe { GetDiskFreeSpaceExW(text.as_ptr(), &mut free, ptr::null_mut(), ptr::null_mut()) } == 0 { return Err(format!("FOLDERS_FREE:{}", unsafe { GetLastError() })); }
    Ok(free)
}
fn fixed(path: &Path, drives: &[Drive]) -> bool {
    path.to_str().and_then(|s| s.chars().next()).is_some_and(|c| drives.iter().any(|d| d.letter.eq_ignore_ascii_case(&c)))
}
/// This PC as the move kit and the pairing see it (STAGE1_DESIGN.md 4.6 「옮겨 오기 꾸러미」).
pub fn snapshot() -> Result<Value, String> {
    let roots = onedrive_roots(); let synced = sync_roots();
    let mut known = serde_json::Map::new();
    for (name, id) in &KNOWN {
        // A folder Windows cannot give (a broken redirect) is left out, not guessed.
        if let Ok(path) = known_folder(id) {
            let sync = in_onedrive(&path, &roots) || synced.iter().any(|r| inside(&path, r));
            known.insert((*name).into(), json!({"path":path,"oneDrive":in_onedrive(&path, &roots),"synced":sync}));
        }
    }
    if !known.contains_key("profile") { return Err("FOLDERS_PROFILE".into()); }
    let drives = fixed_drives();
    Ok(json!({
        "schema":1,
        "computer":std::env::var("COMPUTERNAME").unwrap_or_default(),
        "known":known,
        "oneDrive":roots.iter().map(|r| json!({"kind":r.kind,"path":r.path,"emailSha256":r.email_sha256})).collect::<Vec<_>>(),
        "syncRoots":synced,
        "drives":drives.iter().map(|d| json!({"letter":d.letter.to_string(),"label":d.label,"fileSystem":d.file_system})).collect::<Vec<_>>(),
    }))
}
/// Whether `path` may hold a 「OneDrive 밖 새 폴더」 (or another place the person picks): a plain path on a fixed
/// drive, outside every OneDrive folder, not a protected place, no link or file on the way.
pub fn check_place(text: &str) -> Value {
    let path = match crate::files::checked(text) { Ok(path) => path, Err(_) => return json!({"ok":false,"reason":"NOT_LOCAL"}) };
    if !fixed(&path, &fixed_drives()) { return json!({"ok":false,"reason":"NOT_FIXED"}); }
    if in_onedrive(&path, &onedrive_roots()) { return json!({"ok":false,"reason":"IN_ONEDRIVE"}); }
    if sync_roots().iter().any(|r| inside(&path, r)) { return json!({"ok":false,"reason":"IN_SYNC_FOLDER"}); }
    // A protected place is said as one before the disk is looked at; of what the look finds, only a file above is
    // 「FILE_ABOVE」, any other code goes as it is (카본 끝판 G4).
    if crate::files::protected(&path) { return json!({"ok":false,"reason":"PROTECTED"}); }
    if let Err(code) = crate::files::chain(&path) { return json!({"ok":false,"reason":match code.as_str() { "MOVE_SKIP_LINK" => "LINK_ABOVE".to_string(), "MOVE_SKIP_FILE" => "FILE_ABOVE".to_string(), _ => code }}); }
    match free_bytes(&path) { Ok(free) => json!({"ok":true,"free":free}), Err(code) => json!({"ok":false,"reason":code}) }
}
/// The host methods the worker calls (`folders.*`). `None`: not a method of this module.
pub fn host(method: &str, args: &[Value]) -> Option<Result<Value, String>> {
    let first = args.first().unwrap_or(&Value::Null);
    Some(match method {
        "folders.snapshot" => snapshot(),
        "folders.check" => first.as_str().map(check_place).ok_or_else(|| "HOST_REQUEST".into()),
        "folders.free" => (|| { let list = first.as_array().filter(|l| l.len() <= 64).ok_or("HOST_REQUEST")?;
            list.iter().map(|p| { let path = crate::files::checked(p.as_str().ok_or("HOST_REQUEST")?)?; free_bytes(&path).map(Value::from) }).collect::<Result<Vec<_>, String>>().map(Value::from) })(),
        _ => return None,
    })
}

#[cfg(test)] mod tests {
    use super::*;
    #[test] fn snapshot_has_the_known_folders() {
        let snap = snapshot().unwrap();
        let profile = PathBuf::from(snap["known"]["profile"]["path"].as_str().unwrap());
        assert!(profile.is_absolute() && profile.is_dir());
        for name in ["documents", "desktop", "roaming", "local"] { assert!(snap["known"][name]["path"].as_str().is_some_and(|p| Path::new(p).is_absolute()), "{name}"); }
        assert!(snap["drives"].as_array().unwrap().iter().any(|d| d["letter"] == "C"));
        // The mail is never in the snapshot, only its hash.
        assert!(!snap.to_string().contains('@'));
        assert!(free_bytes(&profile).unwrap() > 0);
    }
    #[test] fn the_mail_goes_only_as_its_hash() {
        // 카본 끝판 G6: checked with a made-up mail, so a PC without OneDrive checks it too.
        let hash = email_hash("  Kim.Lee@Example.COM ");
        assert_eq!(hash, email_hash("kim.lee@example.com"));
        assert!(hash.len() == 64 && hash.bytes().all(|b| b.is_ascii_hexdigit()) && !hash.contains('@'));
        assert_ne!(hash, email_hash("kim.lee@example.org"));
        // Only this user's sync roots: the SID is read from the token.
        assert!(current_sid().is_some_and(|s| s.starts_with("S-1-")));
    }
    #[test] fn onedrive_membership_is_by_folder_boundary() {
        let roots = vec![OneDriveRoot { kind: "Personal".into(), path: PathBuf::from(r"C:\Users\a\OneDrive"), email_sha256: None }];
        assert!(in_onedrive(Path::new(r"C:\Users\a\OneDrive\문서"), &roots) && in_onedrive(Path::new(r"c:\users\a\onedrive"), &roots));
        assert!(!in_onedrive(Path::new(r"C:\Users\a\OneDrive2\문서"), &roots) && !in_onedrive(Path::new(r"C:\Users\a\Documents"), &roots));
    }
    #[test] fn places_for_a_new_folder() {
        let temp = crate::platform::worker_path(&std::fs::canonicalize(std::env::temp_dir()).unwrap()).unwrap();
        assert_eq!(check_place(temp.join("swb-new-place").to_str().unwrap())["ok"], true);
        assert_eq!(check_place(r"\\server\share")["reason"], "NOT_LOCAL");
        if let Some(windir) = std::env::var_os("windir") { assert_eq!(check_place(PathBuf::from(windir).join("x").to_str().unwrap())["reason"], "PROTECTED"); }
        for root in onedrive_roots() { assert_eq!(check_place(root.path.join("x").to_str().unwrap())["reason"], "IN_ONEDRIVE"); }
        for root in sync_roots() { assert!(check_place(root.join("x").to_str().unwrap())["ok"] == false, "{}", root.display()); }
    }
}
