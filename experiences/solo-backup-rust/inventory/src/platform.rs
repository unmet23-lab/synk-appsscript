use crate::model::{display_text, CollectorStatus, Program};
use std::{
    ffi::OsString,
    io::{self, Read},
    os::windows::{
        ffi::{OsStrExt, OsStringExt},
        process::CommandExt,
    },
    path::{Component, Path, PathBuf},
    ptr,
    time::{Duration, Instant},
};
use windows_sys::Win32::{
    Foundation::*,
    Storage::FileSystem::*,
    System::{Com::CoTaskMemFree, Registry::*, SystemInformation::GetSystemDirectoryW},
    UI::Shell::*,
};

fn wide(p: &Path) -> Vec<u16> {
    p.as_os_str().encode_wide().chain(Some(0)).collect()
}
fn native(p: &Path) -> Vec<u16> {
    let mut out: Vec<u16> = "\\\\?\\".encode_utf16().collect();
    out.extend(p.as_os_str().encode_wide());
    out.push(0);
    out
}
pub fn key(p: &Path) -> String {
    p.to_string_lossy()
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_lowercase()
}
pub fn within(p: &Path, root: &Path) -> bool {
    let a = key(p);
    let b = key(root);
    a == b || a.starts_with(&(b + "\\"))
}
pub fn skip_attributes(a: u32) -> bool {
    a & (FILE_ATTRIBUTE_REPARSE_POINT
        | FILE_ATTRIBUTE_OFFLINE
        | FILE_ATTRIBUTE_RECALL_ON_OPEN
        | FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS)
        != 0
}
pub fn attributes(p: &Path) -> io::Result<u32> {
    let a = unsafe { GetFileAttributesW(native(p).as_ptr()) };
    if a == INVALID_FILE_ATTRIBUTES {
        Err(io::Error::last_os_error())
    } else {
        Ok(a)
    }
}
pub fn lexical_shape(p: &Path) -> Result<(), &'static str> {
    let s = p.to_str().ok_or("non_unicode_path")?;
    let b = s.as_bytes();
    if b.len() < 3
        || !b[0].is_ascii_alphabetic()
        || b[1] != b':'
        || b[2] != b'\\'
        || s.contains('/')
        || s[2..].contains(':')
        || s.contains('\0')
    {
        return Err("absolute_local_drive_required");
    }
    for segment in s[3..].split('\\') {
        if segment == "."
            || segment == ".."
            || segment.ends_with('.')
            || segment.ends_with(' ')
            || segment.chars().any(char::is_control)
        {
            return Err("ambiguous_path");
        }
    }
    if p.components()
        .any(|c| matches!(c, Component::ParentDir | Component::CurDir))
    {
        return Err("ambiguous_path");
    }
    Ok(())
}
pub fn lexical_local(p: &Path) -> Result<(), &'static str> {
    lexical_shape(p)?;
    let s = p.to_str().ok_or("non_unicode_path")?;
    let root = PathBuf::from(format!("{}\\", &s[..2]));
    if unsafe { GetDriveTypeW(wide(&root).as_ptr()) } != 3 {
        return Err("fixed_drive_required");
    }
    Ok(())
}
pub fn safe_existing(p: &Path) -> Result<u32, String> {
    lexical_local(p).map_err(str::to_string)?;
    let mut cur = PathBuf::new();
    let mut last = 0;
    for component in p.components() {
        cur.push(component.as_os_str());
        if matches!(component, Component::Prefix(_)) {
            continue;
        }
        last = attributes(&cur).map_err(|e| match e.raw_os_error() {
            Some(2 | 3) => "not_found".into(),
            Some(5) => "access_denied".into(),
            _ => format!("metadata_error_{}", e.raw_os_error().unwrap_or(0)),
        })?;
        if skip_attributes(last) {
            return Err("reparse_or_cloud_placeholder".into());
        }
    }
    Ok(last)
}

#[derive(Clone, Debug)]
pub struct Entry {
    pub path: PathBuf,
    pub name: OsString,
    pub attributes: u32,
    pub size: u64,
}
impl Entry {
    pub fn is_dir(&self) -> bool {
        self.attributes & FILE_ATTRIBUTE_DIRECTORY != 0
    }
}
struct Search(HANDLE);
impl Drop for Search {
    fn drop(&mut self) {
        unsafe {
            FindClose(self.0);
        }
    }
}
pub fn entries(p: &Path, cap: usize, deadline: Instant) -> (Vec<Entry>, Option<String>) {
    if let Err(e) = safe_existing(p) {
        return (vec![], Some(e));
    }
    let mut data: WIN32_FIND_DATAW = unsafe { std::mem::zeroed() };
    let h = unsafe { FindFirstFileW(native(&p.join("*")).as_ptr(), &mut data) };
    if h == INVALID_HANDLE_VALUE {
        let e = unsafe { GetLastError() };
        return (
            vec![],
            if e == ERROR_FILE_NOT_FOUND {
                None
            } else {
                Some(format!("enumeration_error_{e}"))
            },
        );
    }
    let _search = Search(h);
    let mut result = Vec::new();
    loop {
        if Instant::now() >= deadline {
            return (result, Some("time_limit".into()));
        }
        let end = data
            .cFileName
            .iter()
            .position(|c| *c == 0)
            .unwrap_or(data.cFileName.len());
        let name = OsString::from_wide(&data.cFileName[..end]);
        if name != "." && name != ".." {
            if result.len() >= cap {
                return (result, Some("directory_entry_limit".into()));
            }
            result.push(Entry {
                path: p.join(&name),
                name,
                attributes: data.dwFileAttributes,
                size: (u64::from(data.nFileSizeHigh) << 32) | u64::from(data.nFileSizeLow),
            });
        }
        if unsafe { FindNextFileW(h, &mut data) } == 0 {
            let e = unsafe { GetLastError() };
            return (
                result,
                if e == ERROR_NO_MORE_FILES {
                    None
                } else {
                    Some(format!("enumeration_error_{e}"))
                },
            );
        }
    }
}
pub fn file_size(p: &Path) -> io::Result<u64> {
    safe_existing(p).map_err(io::Error::other)?;
    let mut d: WIN32_FIND_DATAW = unsafe { std::mem::zeroed() };
    let h = unsafe { FindFirstFileW(native(p).as_ptr(), &mut d) };
    if h == INVALID_HANDLE_VALUE {
        return Err(io::Error::last_os_error());
    }
    let _s = Search(h);
    Ok((u64::from(d.nFileSizeHigh) << 32) | u64::from(d.nFileSizeLow))
}

pub fn known_folder(id: &windows_sys::core::GUID) -> io::Result<PathBuf> {
    let mut p = ptr::null_mut();
    let hr = unsafe { SHGetKnownFolderPath(id, 0x4000, ptr::null_mut(), &mut p) };
    if hr < 0 {
        return Err(io::Error::other(format!("known_folder_{hr}")));
    }
    let mut n = 0;
    unsafe {
        while *p.add(n) != 0 && n < 32768 {
            n += 1;
        }
    }
    let value = unsafe { OsString::from_wide(std::slice::from_raw_parts(p, n)) };
    unsafe {
        CoTaskMemFree(p as _);
    }
    Ok(PathBuf::from(value))
}
pub fn system_directory() -> io::Result<PathBuf> {
    let mut v = vec![0; 32768];
    let n = unsafe { GetSystemDirectoryW(v.as_mut_ptr(), v.len() as u32) } as usize;
    if n == 0 || n >= v.len() {
        return Err(io::Error::other("system_directory_unavailable"));
    }
    Ok(PathBuf::from(OsString::from_wide(&v[..n])))
}
#[derive(Clone)]
pub struct Scope {
    pub profile: PathBuf,
    pub local: PathBuf,
    pub roaming: PathBuf,
    pub folders: Vec<(String, PathBuf)>,
    pub forbidden: Vec<PathBuf>,
    pub clouds: Vec<PathBuf>,
    pub unresolved_known_folders: Vec<String>,
}
impl Scope {
    pub fn current() -> io::Result<Self> {
        let profile = known_folder(&FOLDERID_Profile)?;
        let local = known_folder(&FOLDERID_LocalAppData)?;
        let roaming = known_folder(&FOLDERID_RoamingAppData)?;
        let mut unresolved_known_folders = vec![];
        let folders = [
            ("Documents", FOLDERID_Documents),
            ("Desktop", FOLDERID_Desktop),
            ("Downloads", FOLDERID_Downloads),
            ("Pictures", FOLDERID_Pictures),
            ("Videos", FOLDERID_Videos),
            ("Music", FOLDERID_Music),
        ]
        .into_iter()
        .filter_map(|(n, id)| match known_folder(&id) {
            Ok(p) => Some((n.into(), p)),
            Err(_) => {
                unresolved_known_folders.push(n.into());
                None
            }
        })
        .collect();
        let mut forbidden = Vec::new();
        for id in [
            FOLDERID_Windows,
            FOLDERID_ProgramFiles,
            FOLDERID_ProgramFilesX86,
            FOLDERID_ProgramData,
            FOLDERID_Public,
        ] {
            if let Ok(p) = known_folder(&id) {
                forbidden.push(p);
            }
        }
        let mut clouds = vec![
            profile.join("OneDrive"),
            profile.join("Dropbox"),
            profile.join("Google Drive"),
        ];
        for name in ["OneDrive", "OneDriveConsumer", "OneDriveCommercial"] {
            if let Some(v) = std::env::var_os(name) {
                let p = PathBuf::from(v);
                if lexical_local(&p).is_ok() {
                    clouds.push(p);
                }
            }
        }
        Ok(Self {
            profile,
            local,
            roaming,
            folders,
            forbidden,
            clouds,
            unresolved_known_folders,
        })
    }
    pub fn allowed(&self, p: &Path) -> Result<(), String> {
        lexical_local(p).map_err(str::to_string)?;
        if self.forbidden.iter().any(|f| within(p, f)) {
            return Err("system_or_shared_directory".into());
        }
        // Never enter another user's tree, including roots discovered on another fixed disk.
        let parts: Vec<_> = p.components().collect();
        if parts.get(2).is_some_and(|x| {
            x.as_os_str()
                .to_string_lossy()
                .eq_ignore_ascii_case("Users")
        }) && !within(p, &self.profile)
        {
            return Err("other_user_or_users_root".into());
        }
        if parts.get(2).is_some_and(|c| {
            matches!(
                c.as_os_str()
                    .to_string_lossy()
                    .to_ascii_lowercase()
                    .as_str(),
                "$recycle.bin"
                    | "system volume information"
                    | "windows"
                    | "program files"
                    | "program files (x86)"
                    | "programdata"
            )
        }) {
            return Err("system_directory".into());
        }
        Ok(())
    }
    pub fn cloud_path(&self, p: &Path) -> bool {
        self.clouds.iter().any(|f| within(p, f))
            || p.components().any(|c| {
                let n = c.as_os_str().to_string_lossy().to_lowercase();
                n.starts_with("onedrive")
                    || n == "dropbox"
                    || n == "google drive"
                    || n == "googledrive"
            })
    }
}
pub fn fixed_drives() -> Vec<PathBuf> {
    (b'A'..=b'Z')
        .map(|c| PathBuf::from(format!("{}:\\", c as char)))
        .filter(|p| unsafe { GetDriveTypeW(wide(p).as_ptr()) } == 3)
        .collect()
}

struct Reg(HKEY);
impl Drop for Reg {
    fn drop(&mut self) {
        unsafe {
            RegCloseKey(self.0);
        }
    }
}
fn reg_open(parent: HKEY, name: &str, view: u32) -> Result<Reg, u32> {
    let mut h = ptr::null_mut();
    let w: Vec<u16> = name.encode_utf16().chain(Some(0)).collect();
    let rc = unsafe { RegOpenKeyExW(parent, w.as_ptr(), 0, KEY_READ | view, &mut h) };
    if rc == ERROR_SUCCESS {
        Ok(Reg(h))
    } else {
        Err(rc)
    }
}
fn reg_string(key: HKEY, name: &str) -> String {
    let w: Vec<u16> = name.encode_utf16().chain(Some(0)).collect();
    let mut kind = 0;
    let mut len = 0;
    if unsafe {
        RegQueryValueExW(
            key,
            w.as_ptr(),
            ptr::null(),
            &mut kind,
            ptr::null_mut(),
            &mut len,
        )
    } != 0
        || !matches!(kind, REG_SZ | REG_EXPAND_SZ)
        || len > 16384
        || len % 2 != 0
    {
        return String::new();
    }
    let mut buffer = vec![0u16; len as usize / 2 + 1];
    let cap = len;
    if unsafe {
        RegQueryValueExW(
            key,
            w.as_ptr(),
            ptr::null(),
            &mut kind,
            buffer.as_mut_ptr() as _,
            &mut len,
        )
    } != 0
        || len > cap
        || !matches!(kind, REG_SZ | REG_EXPAND_SZ)
    {
        return String::new();
    }
    let end = buffer.iter().position(|v| *v == 0).unwrap_or(buffer.len());
    display_text(&String::from_utf16_lossy(&buffer[..end]))
}
pub fn registry_programs(deadline: Instant) -> (Vec<Program>, CollectorStatus) {
    let mut programs = Vec::new();
    let mut status = "complete";
    for hive in [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE] {
        let views: &[u32] = if hive == HKEY_CURRENT_USER {
            &[0]
        } else {
            &[KEY_WOW64_64KEY, KEY_WOW64_32KEY]
        };
        for &view in views {
            let root = match reg_open(
                hive,
                "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
                view,
            ) {
                Ok(root) => root,
                Err(ERROR_FILE_NOT_FOUND) => continue,
                Err(_) => {
                    status = "partial_or_unavailable";
                    continue;
                }
            };
            for index in 0..10000 {
                if Instant::now() >= deadline {
                    status = "time_limit";
                    break;
                }
                let mut name = [0u16; 256];
                let mut size = name.len() as u32;
                let rc = unsafe {
                    RegEnumKeyExW(
                        root.0,
                        index,
                        name.as_mut_ptr(),
                        &mut size,
                        ptr::null(),
                        ptr::null_mut(),
                        ptr::null_mut(),
                        ptr::null_mut(),
                    )
                };
                if rc == ERROR_NO_MORE_ITEMS {
                    break;
                }
                if rc != 0 {
                    status = "partial_or_unavailable";
                    continue;
                }
                if let Ok(child) = reg_open(
                    root.0,
                    &String::from_utf16_lossy(&name[..size as usize]),
                    view,
                ) {
                    let name = reg_string(child.0, "DisplayName");
                    if name.is_empty() {
                        continue;
                    }
                    programs.push(Program {
                        name,
                        version: reg_string(child.0, "DisplayVersion"),
                        publisher: reg_string(child.0, "Publisher"),
                        install_location: reg_string(child.0, "InstallLocation"),
                        source: "uninstall_registration".into(),
                        package_family: None,
                    });
                } else {
                    status = "partial_or_unavailable";
                }
                if index == 9999 {
                    status = "entry_limit";
                }
            }
        }
    }
    programs.sort_by(|a, b| {
        (&a.name, &a.version, &a.publisher).cmp(&(&b.name, &b.version, &b.publisher))
    });
    programs
        .dedup_by(|a, b| a.name == b.name && a.version == b.version && a.publisher == b.publisher);
    let count = programs.len();
    (
        programs,
        CollectorStatus {
            collector: "uninstall_registry".into(),
            status: status.into(),
            count,
        },
    )
}

pub fn parse_msix(bytes: &[u8]) -> Result<Vec<Program>, &'static str> {
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "PascalCase")]
    struct Package {
        name: String,
        version: String,
        publisher: String,
        install_location: Option<String>,
        #[serde(default)]
        package_family_name: Option<String>,
    }
    let list: Vec<Package> = serde_json::from_slice(bytes).map_err(|_| "invalid_response")?;
    if list.len() > 10000 {
        return Err("entry_limit");
    }
    if list.iter().any(|p| {
        p.package_family_name.as_ref().is_some_and(|v| {
            v.is_empty()
                || v.len() > 255
                || !v
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-'))
                || v == "."
                || v == ".."
        })
    }) {
        return Err("invalid_package_family");
    }
    Ok(list
        .into_iter()
        .map(|p| Program {
            name: display_text(&p.name),
            version: display_text(&p.version),
            publisher: display_text(&p.publisher),
            install_location: display_text(p.install_location.as_deref().unwrap_or("")),
            source: "current_user_msix".into(),
            package_family: p.package_family_name,
        })
        .collect())
}
pub fn msix_programs(deadline: Instant) -> (Vec<Program>, CollectorStatus) {
    let result = (|| -> Result<Vec<Program>, String> {
        let system = system_directory().map_err(|_| "system_directory_unavailable")?;
        let powershell = system.join("WindowsPowerShell\\v1.0\\powershell.exe");
        let modules = system.join("WindowsPowerShell\\v1.0\\Modules");
        safe_existing(&powershell)?;
        safe_existing(&modules)?;
        let module = modules.join("Appx\\Appx.psd1");
        safe_existing(&module)?;
        let script = format!("$ErrorActionPreference='Stop';[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false);Import-Module '{}' -ErrorAction Stop;$p=@(Get-AppxPackage -ErrorAction Stop | Select-Object Name,@{{Name='Version';Expression={{$_.Version.ToString()}}}},Publisher,InstallLocation,PackageFamilyName);ConvertTo-Json -InputObject $p -Compress", module.to_string_lossy().replace('\'', "''"));
        let stop = deadline.min(Instant::now() + Duration::from_secs(30));
        if Instant::now() >= stop {
            return Err("time_limit".into());
        }
        let mut command = std::process::Command::new(powershell);
        command
            .args([
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                &script,
            ])
            .env("PSModulePath", modules)
            .current_dir(system);
        let bytes = bounded_process(command, stop, 2 * 1024 * 1024)?;
        parse_msix(&bytes).map_err(str::to_string)
    })();
    match result {
        Ok(p) => {
            let count = p.len();
            (
                p,
                CollectorStatus {
                    collector: "current_user_msix".into(),
                    status: "complete".into(),
                    count,
                },
            )
        }
        Err(e) => (
            vec![],
            CollectorStatus {
                collector: "current_user_msix".into(),
                status: e,
                count: 0,
            },
        ),
    }
}

// Private: production only supplies the fixed OS PowerShell command above. No CLI override.
fn bounded_process(
    mut command: std::process::Command,
    stop: Instant,
    max_bytes: usize,
) -> Result<Vec<u8>, String> {
    let mut child = command
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .creation_flags(0x08000000)
        .spawn()
        .map_err(|_| "spawn_failed")?;
    let pipe = child.stdout.take().ok_or("pipe_unavailable")?;
    let (tx, rx) = std::sync::mpsc::channel();
    let reader = std::thread::spawn(move || {
        let mut data = Vec::new();
        let ok = pipe
            .take(max_bytes as u64 + 1)
            .read_to_end(&mut data)
            .is_ok();
        let _ = tx.send((ok, data));
    });
    let mut data = None;
    let outcome = loop {
        if let Ok(value) = rx.try_recv() {
            data = Some(value);
        }
        if data.as_ref().is_some_and(|(_, v)| v.len() > max_bytes) {
            break Err("output_limit".into());
        }
        match child.try_wait() {
            Ok(Some(status)) => {
                if let Some((ok, bytes)) = data.take() {
                    if !status.success() {
                        break Err("collector_failed".into());
                    }
                    break if ok {
                        Ok(bytes)
                    } else {
                        Err("read_failed".into())
                    };
                }
            }
            Err(_) => break Err("wait_failed".into()),
            _ => {}
        }
        if Instant::now() >= stop {
            break Err("timeout".into());
        }
        std::thread::sleep(Duration::from_millis(20));
    };
    if outcome.is_err() {
        let _ = child.kill();
    }
    let _ = child.wait();
    let _ = reader.join();
    outcome
}

#[cfg(test)]
mod process_tests {
    use super::*;
    fn command(script: &str) -> std::process::Command {
        let mut cmd = std::process::Command::new(
            system_directory()
                .unwrap()
                .join("WindowsPowerShell\\v1.0\\powershell.exe"),
        );
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", script]);
        cmd
    }
    #[test]
    fn active_child_is_killed_on_timeout() {
        let started = Instant::now();
        let err = bounded_process(
            command("Start-Sleep -Seconds 20"),
            started + Duration::from_millis(200),
            1024,
        )
        .unwrap_err();
        assert_eq!(err, "timeout");
        assert!(started.elapsed() < Duration::from_secs(5));
    }
    #[test]
    fn child_output_limit_and_nonzero_exit_are_failures() {
        let err = bounded_process(
            command("[Console]::Write(('x'*10000))"),
            Instant::now() + Duration::from_secs(10),
            64,
        )
        .unwrap_err();
        assert_eq!(err, "output_limit");
        let err = bounded_process(
            command("exit 23"),
            Instant::now() + Duration::from_secs(10),
            1024,
        )
        .unwrap_err();
        assert_eq!(err, "collector_failed");
    }
    #[test]
    fn child_output_is_drained_after_successful_exit() {
        let bytes = bounded_process(
            command("[Console]::Write('[]')"),
            Instant::now() + Duration::from_secs(10),
            1024,
        )
        .unwrap();
        assert_eq!(bytes, b"[]");
    }
}
