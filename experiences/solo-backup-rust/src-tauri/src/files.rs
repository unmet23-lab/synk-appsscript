//! 옮겨 오기의 「덮지 않고 놓기」(STAGE1_DESIGN.md 4.6). The engine writes each restored file to a temporary
//! name inside the folder it lands in; this module gives it its final name without ever replacing a file,
//! compares when the name is taken, and opens nothing through a reparse point.
//!
//! - The final name is given only with `MoveFileExW` without `MOVEFILE_REPLACE_EXISTING` (nor COPY_ALLOWED).
//! - Every folder on the way, from the drive root down, must be a real folder; an OneDrive (cloud) folder counts
//!   as one, a junction or symbolic link does not. Folders are only created, never replaced.
//! - Existing files are opened with `FILE_FLAG_OPEN_REPARSE_POINT`; an online-only placeholder is never read.
//! - The only file this module deletes is the engine's own temporary file (`~synk-<move id>-<n>.part`).
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{os::windows::ffi::OsStrExt, path::{Component, Path, PathBuf}, ptr};
use windows_sys::Win32::{Foundation::*, Storage::FileSystem::*};

/// How many 「(복구본 N)」 names are tried before giving up on one file.
pub const COPY_NAMES: u32 = 100;
const MAX_PATH_UNITS: usize = 32_767;
/// How long a rename the antivirus, indexer or sync client holds up (error 32 · 33 · 5) is tried again.
const BUSY_TRIES: u32 = 40;
const BUSY_WAIT: std::time::Duration = std::time::Duration::from_millis(250);
/// Paths per `files.probe`: the answer goes back to the worker in one frame, which may not pass 128 KiB (MAX_REQUEST).
const MAX_PROBE: usize = 500;
/// Same size and a last-write time this close count as the same file (the tar header can carry whole seconds).
const SAME_TIME_MS: i64 = 1_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind { File, Dir, Link }
#[derive(Debug, Clone, Copy)]
pub struct Info { pub kind: Kind, pub size: u64, pub mtime_ms: i64, pub placeholder: bool }
#[derive(Debug, Clone)]
pub struct Expect { pub size: u64, pub mtime_ms: i64, pub sha256: String, pub hidden: bool }
/// Where the file went. `Same`'s flag: the content was compared (`true`), or only size and time of an
/// online-only file (`false` — 「내용 확인 안 함」, which keeps the old device's backups from cleanup).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Placed { Placed(PathBuf), Same(PathBuf, bool), Copy(PathBuf) }
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Match { Different, Verified, Unverified }

fn safe_name(name: &str) -> bool {
    // Windows device names, with any extension (`nul.txt`), including COM¹–³ / LPT¹–³.
    let stem: Vec<char> = name.split('.').next().unwrap_or("").to_uppercase().chars().collect();
    let text: String = stem.iter().collect();
    let numbered = stem.len() == 4 && (text.starts_with("COM") || text.starts_with("LPT")) && matches!(stem[3], '0'..='9' | '¹' | '²' | '³');
    let reserved = matches!(text.as_str(), "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$") || numbered;
    !name.is_empty() && name.encode_utf16().count() <= 255 && !name.ends_with('.') && !name.ends_with(' ') && !reserved
        && !name.chars().any(|c| c.is_control() || matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'))
}
/// A plain absolute local-drive path (`X:\…`), each part a safe Windows name, no `.` or `..`.
pub fn checked(text: &str) -> Result<PathBuf, String> {
    let bytes = text.as_bytes();
    if bytes.len() < 3 || !bytes[0].is_ascii_alphabetic() || bytes[1] != b':' || bytes[2] != b'\\' || text.contains('/') || text.encode_utf16().count() > MAX_PATH_UNITS {
        return Err("MOVE_PATH".into());
    }
    let rest = text[3..].trim_end_matches('\\');
    if !rest.is_empty() && rest.split('\\').any(|part| !safe_name(part)) { return Err("MOVE_PATH".into()); }
    let path = PathBuf::from(text);
    if path.components().any(|c| matches!(c, Component::ParentDir | Component::CurDir)) { return Err("MOVE_PATH".into()); }
    Ok(path)
}
fn key(path: &Path) -> String { crate::platform::key_path(path) }
fn inside(path: &Path, root: &Path) -> bool { let (p, r) = (key(path), key(root)); p == r || p.starts_with(&(r + "\\")) }
/// Places a move never writes: Windows, the program folders, ProgramData, this app's and the earlier apps' state.
pub fn protected(path: &Path) -> bool {
    let env = |name: &str| std::env::var_os(name).map(PathBuf::from).filter(|p| p.is_absolute());
    let mut roots: Vec<PathBuf> = ["SystemRoot", "windir", "ProgramFiles", "ProgramFiles(x86)", "ProgramW6432", "ProgramData"].iter().filter_map(|n| env(n)).collect();
    if let Some(appdata) = env("APPDATA") { for name in [crate::platform::PRODUCT_DIR, "SoloWorkBackup", "SoloWorkBackupRustBeta"] { roots.push(appdata.join(name)); } }
    if let Some(local) = env("LOCALAPPDATA") { roots.push(local.join(crate::platform::PRODUCT_DIR)); }
    roots.iter().any(|root| inside(path, root))
}
fn long(path: &Path) -> Vec<u16> {
    let mut out: Vec<u16> = r"\\?\".encode_utf16().collect();
    out.extend(path.as_os_str().encode_wide()); out.push(0); out
}
struct Handle(HANDLE);
impl Drop for Handle { fn drop(&mut self) { unsafe { CloseHandle(self.0); } } }
fn open(path: &Path, access: u32) -> Result<Option<Handle>, String> {
    let handle = unsafe { CreateFileW(long(path).as_ptr(), access, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, ptr::null(), OPEN_EXISTING,
        FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_SEQUENTIAL_SCAN, ptr::null_mut()) };
    if handle == INVALID_HANDLE_VALUE {
        let code = unsafe { GetLastError() };
        return if matches!(code, ERROR_FILE_NOT_FOUND | ERROR_PATH_NOT_FOUND) { Ok(None) } else { Err(format!("MOVE_OPEN:{code}")) };
    }
    Ok(Some(Handle(handle)))
}
/// Cloud-file tags (OneDrive and other cloud filters) and data deduplication are kept data, not links.
fn kept_tag(tag: u32) -> bool { tag & 0xFFFF_0FFF == 0x9000_001A || tag == 0x8000_0013 }
fn info_of(handle: &Handle) -> Result<Info, String> {
    let mut tag: FILE_ATTRIBUTE_TAG_INFO = unsafe { std::mem::zeroed() };
    let mut standard: FILE_STANDARD_INFO = unsafe { std::mem::zeroed() };
    let mut basic: FILE_BASIC_INFO = unsafe { std::mem::zeroed() };
    let ok = unsafe {
        GetFileInformationByHandleEx(handle.0, FileAttributeTagInfo, &mut tag as *mut _ as *mut _, std::mem::size_of_val(&tag) as u32) != 0
        && GetFileInformationByHandleEx(handle.0, FileStandardInfo, &mut standard as *mut _ as *mut _, std::mem::size_of_val(&standard) as u32) != 0
        && GetFileInformationByHandleEx(handle.0, FileBasicInfo, &mut basic as *mut _ as *mut _, std::mem::size_of_val(&basic) as u32) != 0
    };
    if !ok { return Err(format!("MOVE_INFO:{}", unsafe { GetLastError() })); }
    let reparse = tag.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT != 0;
    let kind = if reparse && !kept_tag(tag.ReparseTag) { Kind::Link } else if standard.Directory != 0 { Kind::Dir } else { Kind::File };
    let placeholder = tag.FileAttributes & (FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS | FILE_ATTRIBUTE_RECALL_ON_OPEN | FILE_ATTRIBUTE_OFFLINE) != 0;
    // FILETIME (100 ns since 1601) → milliseconds since 1970.
    let mtime_ms = (basic.LastWriteTime - 116_444_736_000_000_000) / 10_000;
    Ok(Info { kind, size: standard.EndOfFile.max(0) as u64, mtime_ms, placeholder })
}
/// What is at `path`, without following a reparse point and without reading an online-only file. `None`: nothing.
pub fn info(path: &Path) -> Result<Option<Info>, String> {
    match open(path, FILE_READ_ATTRIBUTES)? { Some(handle) => info_of(&handle).map(Some), None => Ok(None) }
}
/// Every existing folder from the drive root down to `dir` is a real folder (cloud folders count). The parts
/// that do not exist yet are fine; `mkdirs` makes them.
pub fn chain(dir: &Path) -> Result<(), String> {
    let mut cursor = PathBuf::new();
    for part in dir.components() {
        cursor.push(part.as_os_str());
        if matches!(part, Component::Prefix(_)) { continue; }
        match info(&cursor)? { None => return Ok(()), Some(Info { kind: Kind::Dir, .. }) => {}, Some(Info { kind: Kind::Link, .. }) => return Err("MOVE_SKIP_LINK".into()), Some(_) => return Err("MOVE_SKIP_FILE".into()) }
    }
    Ok(())
}
/// Makes `dir` and the folders above it that are missing, through real folders only. Never replaces anything.
pub fn mkdirs(dir: &Path) -> Result<(), String> {
    if protected(dir) { return Err("MOVE_PROTECTED".into()); }
    let mut cursor = PathBuf::new();
    for part in dir.components() {
        cursor.push(part.as_os_str());
        if matches!(part, Component::Prefix(_) | Component::RootDir) { continue; }
        let found = match info(&cursor)? {
            Some(found) => found,
            None => {
                if unsafe { CreateDirectoryW(long(&cursor).as_ptr(), ptr::null()) } == 0 && unsafe { GetLastError() } != ERROR_ALREADY_EXISTS { return Err(format!("MOVE_MKDIR:{}", unsafe { GetLastError() })); }
                info(&cursor)?.ok_or("MOVE_MKDIR")?
            }
        };
        match found.kind { Kind::Dir => {}, Kind::Link => return Err("MOVE_SKIP_LINK".into()), Kind::File => return Err("MOVE_SKIP_FILE".into()) }
    }
    Ok(())
}
/// SHA-256 of a regular file, opened without following a reparse point. Refuses links and online-only files.
pub fn sha256(path: &Path) -> Result<String, String> {
    // Looked at with an attributes-only handle first: opening an online-only file for data can recall it.
    let first = info(path)?.ok_or("MOVE_GONE")?;
    if first.kind != Kind::File || first.placeholder { return Err("MOVE_NOT_READABLE".into()); }
    let handle = open(path, FILE_READ_ATTRIBUTES | FILE_READ_DATA)?.ok_or("MOVE_GONE")?;
    let found = info_of(&handle)?;
    if found.kind != Kind::File || found.placeholder { return Err("MOVE_NOT_READABLE".into()); }
    // The same no-follow handle, read through std (it now owns and closes it).
    let mut file = unsafe { <std::fs::File as std::os::windows::io::FromRawHandle>::from_raw_handle(handle.0 as _) }; std::mem::forget(handle);
    let mut hash = Sha256::new(); let mut buffer = vec![0u8; 1 << 20];
    loop {
        let read = std::io::Read::read(&mut file, &mut buffer).map_err(|e| format!("MOVE_READ:{}", e.raw_os_error().unwrap_or(0)))?;
        if read == 0 { break; }
        hash.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hash.finalize()))
}
/// Whether the file already at `path` holds what the backup holds (STAGE1_DESIGN.md 4.6 「덮지 않고 놓기」, review
/// M3): a file with its content on disk is always compared by SHA-256; an online-only one is never read, and the
/// same size and time make it only 「내용 확인 안 함」. A file that cannot be read counts as different.
pub fn same(path: &Path, found: &Info, expect: &Expect) -> Match {
    if found.kind != Kind::File || found.size != expect.size { return Match::Different; }
    if found.placeholder { return if (found.mtime_ms - expect.mtime_ms).abs() < SAME_TIME_MS { Match::Unverified } else { Match::Different }; }
    match sha256(path) { Ok(hash) if hash == expect.sha256 => Match::Verified, _ => Match::Different }
}
/// `이름 (복구본).확장자`, then `이름 (복구본 2).확장자` … A name without an extension (or a dot file such as
/// `.gitignore`) gets it at the end. Over 255 UTF-16 units, the part before the extension is shortened (review M9).
pub fn copy_name(target: &Path, n: u32) -> Option<PathBuf> {
    let name = target.file_name()?.to_str()?;
    let mark = if n <= 1 { "(복구본)".to_string() } else { format!("(복구본 {n})") };
    let (stem, ext) = match name.rfind('.') { Some(i) if i > 0 => (&name[..i], &name[i..]), _ => (name, "") };
    let mut stem: Vec<char> = stem.chars().collect();
    let units = |s: &[char]| s.iter().map(|c| c.len_utf16()).sum::<usize>() + 1 + mark.encode_utf16().count() + ext.encode_utf16().count();
    while units(&stem) > 255 { stem.pop()?; }
    let stem: String = stem.into_iter().collect::<String>().trim_end_matches(['.', ' ']).to_string();
    if stem.is_empty() { return None; }
    Some(target.with_file_name(format!("{stem} {mark}{ext}")))
}
/// The engine's temporary name: `~synk-<move id, 8–32 hex>-<n>.part`.
pub fn temp_name(name: &str) -> bool {
    let Some(rest) = name.strip_prefix("~synk-").and_then(|r| r.strip_suffix(".part")) else { return false };
    let Some((id, n)) = rest.split_once('-') else { return false };
    (8..=32).contains(&id.len()) && id.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
        && (1..=9).contains(&n.len()) && n.bytes().all(|b| b.is_ascii_digit())
}
/// `true`: renamed. `false`: the name is taken (183 · 80 — review M11). A rename someone holds up (32 · 33 · 5)
/// is tried again for about ten seconds, then the file fails on its own (`MOVE_BUSY`).
fn move_no_replace(from: &Path, to: &Path) -> Result<bool, String> {
    for _ in 0..BUSY_TRIES {
        if unsafe { MoveFileExW(long(from).as_ptr(), long(to).as_ptr(), 0) } != 0 { return Ok(true); }
        match unsafe { GetLastError() } {
            ERROR_ALREADY_EXISTS | ERROR_FILE_EXISTS => return Ok(false),
            // A folder under the name gives 5 on some systems: taken, not busy.
            ERROR_SHARING_VIOLATION | ERROR_LOCK_VIOLATION | ERROR_ACCESS_DENIED => { if info(to)?.is_some() { return Ok(false); } std::thread::sleep(BUSY_WAIT); }
            code => return Err(format!("MOVE_RENAME:{code}")),
        }
    }
    Err("MOVE_BUSY".into())
}
/// Puts the hidden attribute on a placed file when the backup list had it (review M12). Nothing else is restored.
fn hide(path: &Path) {
    let wide = long(path);
    let now = unsafe { GetFileAttributesW(wide.as_ptr()) };
    if now != INVALID_FILE_ATTRIBUTES && now & FILE_ATTRIBUTE_HIDDEN == 0 { unsafe { SetFileAttributesW(wide.as_ptr(), now | FILE_ATTRIBUTE_HIDDEN); } }
}
fn checked_temp(temp: &Path, target: &Path) -> Result<Info, String> {
    let same_folder = temp.parent().zip(target.parent()).is_some_and(|(a, b)| key(a) == key(b));
    if !same_folder || !temp.file_name().and_then(|n| n.to_str()).is_some_and(temp_name) || protected(target) { return Err("MOVE_REQUEST".into()); }
    let found = info(temp)?.ok_or("MOVE_GONE")?;
    if found.kind != Kind::File || found.placeholder { return Err("MOVE_REQUEST".into()); }
    Ok(found)
}
fn delete_temp(temp: &Path) -> Result<(), String> {
    if unsafe { DeleteFileW(long(temp).as_ptr()) } == 0 { return Err(format!("MOVE_DELETE:{}", unsafe { GetLastError() })); }
    Ok(())
}
/// Gives the engine's temporary file `temp` the name `target` in the same folder, or, when `target` is taken by
/// another content, the first free 「(복구본 N)」 name. Never replaces a file. When `target` or an earlier
/// 「(복구본 N)」 already holds the same content, the temporary file is deleted instead (review M9). After the 100th
/// name it fails with `MOVE_COPY_NAMES` and the engine puts the file in 「따로 둔 것」.
pub fn place(temp: &Path, target: &Path, expect: &Expect) -> Result<Placed, String> {
    let staged = checked_temp(temp, target)?;
    if staged.size != expect.size { return Err("MOVE_SIZE".into()); }
    chain(target.parent().ok_or("MOVE_REQUEST")?)?;
    for n in 0..=COPY_NAMES {
        let name = if n == 0 { target.to_path_buf() } else { copy_name(target, n).ok_or("MOVE_REQUEST")? };
        let done = |name: PathBuf| -> Result<Placed, String> { if expect.hidden { hide(&name); } Ok(if n == 0 { Placed::Placed(name) } else { Placed::Copy(name) }) };
        if move_no_replace(temp, &name)? { return done(name); }
        match info(&name)? {
            // Nothing there: taken a moment ago and gone again, or refused for another reason. One more try.
            None => { if move_no_replace(temp, &name)? { return done(name); } if info(&name)?.is_none() { return Err("MOVE_RENAME_DENIED".into()); } }
            Some(found) => match same(&name, &found, expect) {
                Match::Different => {}
                kind => { delete_temp(temp)?; return Ok(Placed::Same(name, kind == Match::Verified)); }
            },
        }
    }
    Err("MOVE_COPY_NAMES".into())
}
/// Deletes a temporary file an interrupted move left (its name is in the move's ledger). Nothing else.
pub fn discard(temp: &Path) -> Result<bool, String> {
    if !temp.file_name().and_then(|n| n.to_str()).is_some_and(temp_name) || protected(temp) { return Err("MOVE_REQUEST".into()); }
    // Not through a junction or link above it (GPT GB6): the name alone would let a link elsewhere lose its file.
    chain(temp.parent().ok_or("MOVE_REQUEST")?)?;
    match info(temp)? { None => Ok(false), Some(Info { kind: Kind::File, placeholder: false, .. }) => delete_temp(temp).map(|_| true), Some(_) => Err("MOVE_REQUEST".into()) }
}

fn probe_value(path: &str) -> Value {
    let found = checked(path).and_then(|p| if protected(&p) { Err("MOVE_PROTECTED".into()) } else { chain(p.parent().unwrap_or(&p)).and_then(|_| info(&p)) });
    match found {
        Ok(None) => json!({"kind":"missing"}),
        Ok(Some(i)) => json!({"kind":match i.kind { Kind::File => "file", Kind::Dir => "dir", Kind::Link => "link" },"size":i.size,"mtimeMs":i.mtime_ms,"placeholder":i.placeholder}),
        Err(code) if code == "MOVE_SKIP_LINK" => json!({"kind":"link-above"}),
        Err(code) if code == "MOVE_SKIP_FILE" => json!({"kind":"file-above"}),
        Err(code) => json!({"kind":"error","code":code}),
    }
}
fn arg_path(value: &Value) -> Result<PathBuf, String> { checked(value.as_str().ok_or("HOST_REQUEST")?) }
/// The host methods the worker calls (`files.*`). `None`: not a method of this module.
pub fn host(method: &str, args: &[Value]) -> Option<Result<Value, String>> {
    let first = args.first().unwrap_or(&Value::Null);
    Some(match method {
        "files.probe" => (|| {
            let list = first.as_array().ok_or("HOST_REQUEST")?;
            if list.len() > MAX_PROBE { return Err("HOST_REQUEST".into()); }
            list.iter().map(|p| p.as_str().map(probe_value).ok_or_else(|| "HOST_REQUEST".to_string())).collect::<Result<Vec<_>, _>>().map(Value::from)
        })(),
        "files.mkdirs" => arg_path(first).and_then(|dir| match mkdirs(&dir) {
            Ok(()) => Ok(json!({"ok":true})),
            Err(code) if code == "MOVE_SKIP_LINK" || code == "MOVE_SKIP_FILE" || code == "MOVE_PROTECTED" => Ok(json!({"ok":false,"skip":code})),
            Err(code) => Err(code),
        }),
        "files.place" => (|| {
            let temp = arg_path(&first["temp"])?; let target = arg_path(&first["target"])?;
            let sha = first["sha256"].as_str().filter(|s| s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())).ok_or("HOST_REQUEST")?;
            let expect = Expect { size: first["size"].as_u64().ok_or("HOST_REQUEST")?, mtime_ms: first["mtimeMs"].as_i64().ok_or("HOST_REQUEST")?, sha256: sha.into(), hidden: first["hidden"].as_bool().unwrap_or(false) };
            Ok(match place(&temp, &target, &expect)? {
                Placed::Placed(p) => json!({"result":"placed","path":p}), Placed::Copy(p) => json!({"result":"copy","path":p}),
                Placed::Same(p, verified) => json!({"result":if verified { "same" } else { "same-unverified" },"path":p}),
            })
        })(),
        "files.discard" => arg_path(first).and_then(|temp| discard(&temp)).map(Value::from),
        // 「OneDrive에 없거나 다른 것만」 (4.6): whether the OneDrive place already holds the backed-up content.
        "files.compare" => (|| {
            let at = arg_path(&first["path"])?;
            if protected(&at) { return Err("MOVE_PROTECTED".into()); }
            let sha = first["sha256"].as_str().filter(|s| s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())).ok_or("HOST_REQUEST")?;
            let expect = Expect { size: first["size"].as_u64().ok_or("HOST_REQUEST")?, mtime_ms: first["mtimeMs"].as_i64().ok_or("HOST_REQUEST")?, sha256: sha.into(), hidden: false };
            if chain(at.parent().unwrap_or(&at)).is_err() { return Ok(json!({"match":"different"})); }
            Ok(match info(&at)? { None => json!({"match":"missing"}), Some(found) => json!({"match":match same(&at, &found, &expect) { Match::Different => "different", Match::Verified => "verified", Match::Unverified => "unverified" }}) })
        })(),
        _ => return None,
    })
}

#[cfg(test)] mod tests {
    use super::*;
    use std::{fs, process::Command};
    fn base(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("swb-files-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir); fs::create_dir_all(&dir).unwrap();
        crate::platform::worker_path(&fs::canonicalize(&dir).unwrap()).unwrap()
    }
    fn junction(link: &Path, target: &Path) { fs::create_dir_all(target).unwrap(); assert!(Command::new("cmd").arg("/c").arg("mklink").arg("/J").arg(link).arg(target).output().unwrap().status.success()); }
    fn expect_of(bytes: &[u8], mtime_ms: i64) -> Expect { Expect { size: bytes.len() as u64, mtime_ms, sha256: format!("{:x}", Sha256::digest(bytes)), hidden: false } }
    fn staged(dir: &Path, n: u32, bytes: &[u8]) -> PathBuf { let p = dir.join(format!("~synk-0123abcd-{n}.part")); fs::write(&p, bytes).unwrap(); p }
    fn mtime(path: &Path) -> i64 { info(path).unwrap().unwrap().mtime_ms }

    #[test] fn names_and_paths() {
        for ok in [r"C:\Users\새 사람\문서", r"D:\a\b.txt", r"C:\"] { assert!(checked(ok).is_ok(), "{ok}"); }
        for bad in [r"C:\a\..\b", r"C:\a\.\b", r"\\server\share\x", r"\\?\C:\x", "C:/x", r"C:\a\b.", r"C:\a\b ", r"C:\a\CON", r"C:\a\nul.txt", r"C:\a\COM1", r"C:\a\LPT9.log", r"C:\a\b:c", r"C:\a\b|c", "relative\\x", r"C:\a\COM¹"] {
            assert!(checked(bad).is_err(), "{bad}");
        }
        assert!(checked(r"C:\a\COMPUTER").is_ok() && checked(r"C:\a\CONSOLE.txt").is_ok() && checked(r"C:\a\com10").is_ok());
        assert_eq!(copy_name(Path::new(r"C:\a\보고서.hwp"), 1).unwrap(), PathBuf::from(r"C:\a\보고서 (복구본).hwp"));
        assert_eq!(copy_name(Path::new(r"C:\a\a.tar.gz"), 2).unwrap(), PathBuf::from(r"C:\a\a.tar (복구본 2).gz"));
        assert_eq!(copy_name(Path::new(r"C:\a\.gitconfig"), 1).unwrap(), PathBuf::from(r"C:\a\.gitconfig (복구본)"));
        assert_eq!(copy_name(Path::new(r"C:\a\README"), 3).unwrap(), PathBuf::from(r"C:\a\README (복구본 3)"));
        assert_eq!(copy_name(Path::new(r"C:\a\.gitignore"), 1).unwrap(), PathBuf::from(r"C:\a\.gitignore (복구본)"));
        let long_name = format!("{}.txt", "가".repeat(250));
        let shortened = copy_name(&Path::new(r"C:\a").join(&long_name), 2).unwrap();
        let last = shortened.file_name().unwrap().to_str().unwrap();
        assert!(last.encode_utf16().count() <= 255 && last.ends_with(" (복구본 2).txt"), "{last}");
        assert!(temp_name("~synk-0123abcd-1.part") && temp_name("~synk-0123456789abcdef0123456789abcdef-999999999.part"));
        for bad in ["~synk-0123ABCD-1.part", "~synk-0123abc-1.part", "~synk-0123abcd-.part", "~synk-0123abcd-1.tmp", "보고서.hwp", "~synk-0123abcd-1.part.exe"] { assert!(!temp_name(bad), "{bad}"); }
    }
    #[test] fn places_without_replacing() {
        let dir = base("place");
        // A free name: the temporary file becomes it.
        let expect = expect_of(b"new content", 1_700_000_000_000);
        let t = staged(&dir, 1, b"new content");
        assert_eq!(place(&t, &dir.join("a.txt"), &expect).unwrap(), Placed::Placed(dir.join("a.txt")));
        assert_eq!(fs::read(dir.join("a.txt")).unwrap(), b"new content"); assert!(!t.exists());
        // Taken by other content of the same size: 「(복구본)」 beside it, the existing file untouched.
        fs::write(dir.join("b.txt"), b"old content").unwrap();
        let expect = expect_of(b"new content", mtime(&dir.join("b.txt")) - 60_000);
        let t = staged(&dir, 2, b"new content");
        assert_eq!(place(&t, &dir.join("b.txt"), &expect).unwrap(), Placed::Copy(dir.join("b (복구본).txt")));
        assert_eq!(fs::read(dir.join("b.txt")).unwrap(), b"old content");
        assert_eq!(fs::read(dir.join("b (복구본).txt")).unwrap(), b"new content");
        // Again with yet another content: the next free name.
        let t = staged(&dir, 3, b"third bytes");
        assert_eq!(place(&t, &dir.join("b.txt"), &expect_of(b"third bytes", 1)).unwrap(), Placed::Copy(dir.join("b (복구본 2).txt")));
        // The same content under a different time: hashed and counted the same; the temporary file goes.
        let t = staged(&dir, 4, b"old content");
        assert_eq!(place(&t, &dir.join("b.txt"), &expect_of(b"old content", 5)).unwrap(), Placed::Same(dir.join("b.txt"), true)); assert!(!t.exists());
        // A move resumed after a crash finds its own earlier 「(복구본)」 and does not make a third copy.
        let t = staged(&dir, 5, b"new content");
        assert_eq!(place(&t, &dir.join("b.txt"), &expect_of(b"new content", 1)).unwrap(), Placed::Same(dir.join("b (복구본).txt"), true));
        // Same size and time but other content (M3): compared by content, so it goes beside and the record is kept.
        fs::write(dir.join("c.txt"), b"cccc").unwrap(); let at = mtime(&dir.join("c.txt"));
        let t = staged(&dir, 6, b"dddd");
        assert_eq!(place(&t, &dir.join("c.txt"), &expect_of(b"dddd", at)).unwrap(), Placed::Copy(dir.join("c (복구본).txt")));
        assert_eq!(fs::read(dir.join("c.txt")).unwrap(), b"cccc");
        // A hidden file in the backup is hidden again.
        let t = staged(&dir, 8, b"ini");
        let mut hidden = expect_of(b"ini", 1); hidden.hidden = true;
        assert_eq!(place(&t, &dir.join("desktop.ini"), &hidden).unwrap(), Placed::Placed(dir.join("desktop.ini")));
        assert!(unsafe { GetFileAttributesW(long(&dir.join("desktop.ini")).as_ptr()) } & FILE_ATTRIBUTE_HIDDEN != 0);
        // A folder where the file goes: beside it.
        fs::create_dir(dir.join("d.txt")).unwrap();
        let t = staged(&dir, 7, b"x");
        assert_eq!(place(&t, &dir.join("d.txt"), &expect_of(b"x", 1)).unwrap(), Placed::Copy(dir.join("d (복구본).txt")));
        let _ = fs::remove_dir_all(&dir);
    }
    #[test] fn refuses_what_is_not_its_own() {
        let dir = base("refuse"); let other = base("refuse-other");
        let t = staged(&dir, 1, b"x");
        assert!(place(&t, &other.join("a.txt"), &expect_of(b"x", 1)).is_err(), "temp and target in different folders");
        assert!(place(&t, &dir.join("a.txt"), &expect_of(b"xy", 1)).is_err(), "size other than the record");
        fs::write(dir.join("plain.txt"), b"keep").unwrap();
        assert!(place(&dir.join("plain.txt"), &dir.join("a.txt"), &expect_of(b"keep", 1)).is_err(), "only the engine's temporary names");
        assert!(discard(&dir.join("plain.txt")).is_err() && dir.join("plain.txt").exists());
        assert!(discard(&t).unwrap() && !t.exists()); assert!(!discard(&t).unwrap(), "already gone");
        if let Some(windir) = std::env::var_os("windir") { assert_eq!(mkdirs(&PathBuf::from(windir).join("swb-never")), Err("MOVE_PROTECTED".into())); }
        let _ = fs::remove_dir_all(&dir); let _ = fs::remove_dir_all(&other);
    }
    #[test] fn never_through_a_junction() {
        let dir = base("junction"); let elsewhere = base("junction-target");
        junction(&dir.join("My Music"), &elsewhere);
        assert_eq!(mkdirs(&dir.join("My Music").join("sub")), Err("MOVE_SKIP_LINK".into()));
        assert!(!elsewhere.join("sub").exists(), "nothing was made where the junction points");
        assert_eq!(chain(&dir.join("My Music").join("sub")), Err("MOVE_SKIP_LINK".into()));
        assert_eq!(info(&dir.join("My Music")).unwrap().unwrap().kind, Kind::Link);
        // A temporary file inside a junction is refused before any rename.
        fs::write(elsewhere.join("~synk-0123abcd-1.part"), b"x").unwrap();
        assert_eq!(place(&dir.join("My Music").join("~synk-0123abcd-1.part"), &dir.join("My Music").join("a.txt"), &expect_of(b"x", 1)), Err("MOVE_SKIP_LINK".into()));
        assert!(!elsewhere.join("a.txt").exists());
        // Nor is a temporary-looking name under a junction deleted (GPT GB6): the file where it points stays.
        assert_eq!(discard(&dir.join("My Music").join("~synk-0123abcd-1.part")), Err("MOVE_SKIP_LINK".into()));
        assert!(elsewhere.join("~synk-0123abcd-1.part").exists());
        // A file where a folder should be.
        fs::write(dir.join("notadir"), b"x").unwrap();
        assert_eq!(mkdirs(&dir.join("notadir").join("x")), Err("MOVE_SKIP_FILE".into()));
        assert!(mkdirs(&dir.join("새 폴더").join("깊이")).is_ok() && dir.join("새 폴더").join("깊이").is_dir());
        let probe = host("files.probe", &[json!([dir.join("My Music").join("x.mp3"), dir.join("notadir"), dir.join("없음.txt")])]).unwrap().unwrap();
        assert_eq!(probe[0]["kind"], "link-above"); assert_eq!(probe[1]["kind"], "file"); assert_eq!(probe[2]["kind"], "missing");
        let _ = fs::remove_dir(dir.join("My Music")); let _ = fs::remove_dir_all(&dir); let _ = fs::remove_dir_all(&elsewhere);
    }
    #[test] fn long_paths_work() {
        let dir = base("long");
        let mut deep = dir.clone(); for i in 0..12 { deep.push(format!("아주긴폴더이름-{i:02}-abcdefghij")); }
        assert!(deep.as_os_str().len() > 260);
        mkdirs(&deep).unwrap();
        let t = deep.join("~synk-0123abcd-1.part");
        let mut bytes = r"\\?\".to_string(); bytes.push_str(t.to_str().unwrap()); fs::write(&bytes, b"deep").unwrap();
        assert_eq!(place(&t, &deep.join("끝.txt"), &expect_of(b"deep", 1)).unwrap(), Placed::Placed(deep.join("끝.txt")));
        assert_eq!(sha256(&deep.join("끝.txt")).unwrap(), expect_of(b"deep", 1).sha256);
        let _ = fs::remove_dir_all(format!(r"\\?\{}", dir.display()));
    }
    #[test] fn a_name_taken_between_look_and_rename() {
        // T16: OneDrive (here: this test) puts the same name down after the plan looked. The rename fails and the
        // file goes beside it; what the other writer put there is kept.
        let dir = base("race");
        assert!(info(&dir.join("x.docx")).unwrap().is_none());
        let t = staged(&dir, 1, b"from backup");
        fs::write(dir.join("x.docx"), b"from onedrive").unwrap();
        assert_eq!(place(&t, &dir.join("x.docx"), &expect_of(b"from backup", 1)).unwrap(), Placed::Copy(dir.join("x (복구본).docx")));
        assert_eq!(fs::read(dir.join("x.docx")).unwrap(), b"from onedrive");
        let _ = fs::remove_dir_all(&dir);
    }
}
