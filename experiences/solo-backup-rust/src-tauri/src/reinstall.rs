//! 옮겨 오기 v2의 다시 깔기 (STAGE1_DESIGN.md 4.6b 「관리자 확인을 한 번에 모으기」).
//!
//! - Normal privilege (`host`): whether winget is ready, what is installed, `winget show` for a program outside the
//!   table, installing one user-scope (or outside-the-table) program, and asking for the one elevation.
//! - Elevated (`WorkBackupRun.exe --reinstall <number> <id>…`, `elevated_main`): installs the table's machine-scope
//!   programs the command line names (no request file: an administrator who is not the person reads another profile's
//!   folders — GPT GB7), after the person confirms the list in this process's own window, with an environment built
//!   from Windows' own folders (temporary files, winget state and PATH out of the person's reach), winget from App
//!   Installer's protected package folder, and its results in an administrators-only work folder users can read.
use serde_json::{json, Value};
use std::{collections::BTreeSet, os::windows::{ffi::OsStrExt, process::CommandExt}, path::{Path, PathBuf}, process::Command, ptr, time::{Duration, Instant}};
use windows_sys::Win32::Foundation::*;

/// The fixed table (engine/src/move-apps.json), compiled in: the elevated side accepts only its machine-scope ids.
pub const TABLE: &str = include_str!("../../engine/src/move-apps.json");
const FAMILY: &str = "Microsoft.DesktopAppInstaller_8wekyb3d8bbwe";
const ONE: Duration = Duration::from_secs(20 * 60);
const ALL: Duration = Duration::from_secs(2 * 60 * 60);
const MIN_VERSION: (u32, u32) = (1, 6);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Program { pub id: String, pub name: String, pub scope: String }
pub fn table() -> Vec<Program> {
    let value: Value = serde_json::from_str(TABLE).expect("embedded move-apps.json");
    value["programs"].as_array().into_iter().flatten().filter_map(|p| Some(Program { id: p["id"].as_str()?.into(), name: p["name"].as_str()?.into(), scope: p["scope"].as_str()?.into() })).collect()
}
/// A winget package id: letters, digits and `.+_-`, 1–128 characters (review M15).
pub fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 128 && id.bytes().next().is_some_and(|b| b.is_ascii_alphanumeric()) && id.bytes().all(|b| b.is_ascii_alphanumeric() || b".+_-".contains(&b))
}
fn wide(text: &str) -> Vec<u16> { text.encode_utf16().chain([0]).collect() }

/// winget.exe inside App Installer's package folder (never the per-user alias, which the person can replace), found with
/// the package API for the current user and checked to be under `%ProgramFiles%\WindowsApps` with no link on the way.
pub fn find_winget() -> Result<PathBuf, String> {
    use windows_sys::Win32::Storage::Packaging::Appx::{GetPackagePathByFullName, GetPackagesByPackageFamily};
    let family = wide(FAMILY);
    let (mut count, mut length) = (0u32, 0u32);
    let first = unsafe { GetPackagesByPackageFamily(family.as_ptr(), &mut count, ptr::null_mut(), &mut length, ptr::null_mut()) };
    if count == 0 || (first != ERROR_INSUFFICIENT_BUFFER && first != 0) { return Err("WINGET_MISSING".into()); }
    let mut names = vec![ptr::null_mut::<u16>(); count as usize]; let mut buffer = vec![0u16; length as usize];
    if unsafe { GetPackagesByPackageFamily(family.as_ptr(), &mut count, names.as_mut_ptr(), &mut length, buffer.as_mut_ptr()) } != 0 { return Err("WINGET_MISSING".into()); }
    let program_files = crate::folders::known_folder(&windows_sys::Win32::UI::Shell::FOLDERID_ProgramFiles)?.join("WindowsApps");
    for name in names.iter().take(count as usize) {
        let mut len = 0u32;
        unsafe { GetPackagePathByFullName(*name, &mut len, ptr::null_mut()) };
        let mut path = vec![0u16; len as usize];
        if len == 0 || unsafe { GetPackagePathByFullName(*name, &mut len, path.as_mut_ptr()) } != 0 { continue; }
        let folder = PathBuf::from(String::from_utf16_lossy(&path[..path.iter().position(|&c| c == 0).unwrap_or(path.len())]));
        let exe = folder.join("winget.exe");
        if !crate::folders::inside(&exe, &program_files) || crate::files::chain(&folder).is_err() { continue; }
        if crate::files::info(&exe).ok().flatten().is_some_and(|i| i.kind == crate::files::Kind::File) { return Ok(exe); }
    }
    Err("WINGET_MISSING".into())
}
fn version_of(text: &str) -> Option<(u32, u32)> {
    let v = text.trim().trim_start_matches('v'); let mut parts = v.split('.');
    Some((parts.next()?.parse().ok()?, parts.next()?.parse().ok()?))
}
fn quiet(command: &mut Command) -> &mut Command { command.creation_flags(0x08000000) }
/// Runs `winget` with `args`, killing the whole tree after `limit`. `(exit code, stdout)`.
fn run(winget: &Path, args: &[&str], env: Option<&[(String, String)]>, cwd: Option<&Path>, limit: Duration) -> Result<(i32, String), String> {
    let mut command = Command::new(winget);
    quiet(&mut command).args(args).stdin(std::process::Stdio::null()).stdout(std::process::Stdio::piped()).stderr(std::process::Stdio::null());
    if let Some(env) = env { command.env_clear(); for (k, v) in env { command.env(k, v); } }
    if let Some(cwd) = cwd { command.current_dir(cwd); }
    let job = crate::platform::ProcessJob::new()?;
    let mut child = command.spawn().map_err(|_| "WINGET_START")?;
    job.assign(&child)?;
    let mut out = child.stdout.take().ok_or("WINGET_START")?;
    let reader = std::thread::spawn(move || { let mut s = Vec::new(); let _ = std::io::Read::read_to_end(&mut out, &mut s); s });
    let started = Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait().map_err(|_| "WINGET_WAIT")? { break status; }
        if started.elapsed() > limit { job.terminate(); let _ = child.wait(); return Err("WINGET_TIMEOUT".into()); }
        std::thread::sleep(Duration::from_millis(200));
    };
    let text = String::from_utf8_lossy(&reader.join().unwrap_or_default()).into_owned();
    Ok((status.code().unwrap_or(-1), text))
}
const AGREE: [&str; 5] = ["--silent", "--accept-package-agreements", "--accept-source-agreements", "--disable-interactivity", "--exact"];
/// The one install command per id (4.6b): machine and user scope from the table, no scope for a program outside it.
pub fn install_args(id: &str, scope: Option<&str>) -> Vec<String> {
    let mut args: Vec<String> = ["install", "--id", id, "--source", "winget"].iter().map(|s| s.to_string()).collect();
    if let Some(scope) = scope { args.push("--scope".into()); args.push(scope.into()); }
    args.extend(AGREE.iter().map(|s| s.to_string()));
    args
}
/// What a winget exit code means to the person.
pub fn outcome(code: i32) -> &'static str {
    match code as u32 { 0 => "installed", 0x8A15_002B => "already", 0x8A15_0109 | 3010 | 1641 => "reboot", _ => "failed" }
}

/// Whether this folder can be changed only by administrators (SYSTEM, Administrators, TrustedInstaller, and CREATOR
/// OWNER for what they make): no allow entry gives anyone else write, delete or permission rights, and the owner is one
/// of them. The elevated side stops when its own folder fails this (like the VSS helper, 4.2).
pub fn admin_only(dir: &Path) -> Result<bool, String> {
    use windows_sys::Win32::Security::{Authorization::{ConvertSidToStringSidW, GetNamedSecurityInfoW, SE_FILE_OBJECT}, GetAce, ACCESS_ALLOWED_ACE, ACE_HEADER, ACL, DACL_SECURITY_INFORMATION, OWNER_SECURITY_INFORMATION, PSECURITY_DESCRIPTOR, PSID};
    const TRUSTED: [&str; 4] = ["S-1-5-18", "S-1-5-32-544", "S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464", "S-1-3-0"];
    const WRITE: u32 = 0x0000_0002 | 0x0000_0004 | 0x0000_0040 | 0x0001_0000 | 0x0004_0000 | 0x0008_0000 | 0x4000_0000 | 0x1000_0000 | 0x0000_0100 | 0x0000_0010;
    let sid_text = |sid: PSID| -> Option<String> {
        let mut out: *mut u16 = ptr::null_mut();
        if unsafe { ConvertSidToStringSidW(sid, &mut out) } == 0 { return None; }
        let len = (0..).take_while(|&i| unsafe { *out.add(i) } != 0).count();
        let text = String::from_utf16_lossy(unsafe { std::slice::from_raw_parts(out, len) });
        unsafe { LocalFree(out as _) }; Some(text)
    };
    let name: Vec<u16> = dir.as_os_str().encode_wide().chain([0]).collect();
    let (mut owner, mut dacl, mut sd): (PSID, *mut ACL, PSECURITY_DESCRIPTOR) = (ptr::null_mut(), ptr::null_mut(), ptr::null_mut());
    let status = unsafe { GetNamedSecurityInfoW(name.as_ptr(), SE_FILE_OBJECT, OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION, &mut owner, ptr::null_mut(), &mut dacl, ptr::null_mut(), &mut sd) };
    if status != 0 { return Err(format!("REINSTALL_ACL:{status}")); }
    struct Free(PSECURITY_DESCRIPTOR); impl Drop for Free { fn drop(&mut self) { unsafe { LocalFree(self.0 as _) }; } }
    let _free = Free(sd);
    if dacl.is_null() || !sid_text(owner).is_some_and(|s| TRUSTED[..3].contains(&s.as_str())) { return Ok(false); }
    for index in 0..unsafe { (*dacl).AceCount } as u32 {
        let mut ace: *mut core::ffi::c_void = ptr::null_mut();
        if unsafe { GetAce(dacl, index, &mut ace) } == 0 { return Ok(false); }
        let header = unsafe { &*(ace as *const ACE_HEADER) };
        if header.AceType != 0 { continue; } // ACCESS_ALLOWED_ACE_TYPE only; deny entries narrow rights
        let allowed = unsafe { &*(ace as *const ACCESS_ALLOWED_ACE) };
        if allowed.Mask & WRITE == 0 { continue; }
        let sid = unsafe { (ace as *mut u8).add(8) } as PSID;
        if !sid_text(sid).is_some_and(|s| TRUSTED.contains(&s.as_str())) { return Ok(false); }
    }
    Ok(true)
}

/// The elevated child's environment (review M6), from Windows' own folders, never from the person's variables:
/// temporary files, winget's state and Roaming in the administrators-only `work` folder, PATH the system's.
pub fn child_env(work: &Path) -> Result<Vec<(String, String)>, String> {
    use windows_sys::Win32::UI::Shell::*;
    let k = |id| crate::folders::known_folder(id).map(|p| p.to_string_lossy().into_owned());
    let windows = k(&FOLDERID_Windows)?; let system = k(&FOLDERID_System)?;
    let program_files = k(&FOLDERID_ProgramFiles)?; let data = k(&FOLDERID_ProgramData)?;
    let mut env = vec![
        ("SystemRoot".into(), windows.clone()), ("windir".into(), windows.clone()), ("SystemDrive".into(), windows.get(..2).unwrap_or("C:").into()),
        ("ComSpec".into(), format!(r"{system}\cmd.exe")), ("PATHEXT".into(), ".COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC".into()),
        ("PATH".into(), format!(r"{system};{windows};{system}\Wbem;{system}\WindowsPowerShell\v1.0\;{system}\OpenSSH\")),
        ("ProgramFiles".into(), program_files.clone()), ("ProgramW6432".into(), program_files), ("ProgramFiles(x86)".into(), k(&FOLDERID_ProgramFilesX86)?),
        ("CommonProgramFiles".into(), k(&FOLDERID_ProgramFilesCommon)?), ("ProgramData".into(), data.clone()), ("ALLUSERSPROFILE".into(), data),
        ("PUBLIC".into(), k(&FOLDERID_Public)?), ("USERPROFILE".into(), k(&FOLDERID_Profile)?), ("OS".into(), "Windows_NT".into()),
        ("TEMP".into(), work.join("temp").to_string_lossy().into_owned()), ("TMP".into(), work.join("temp").to_string_lossy().into_owned()),
        ("LOCALAPPDATA".into(), work.join("local").to_string_lossy().into_owned()), ("APPDATA".into(), work.join("roaming").to_string_lossy().into_owned()),
    ];
    for name in ["USERNAME", "USERDOMAIN", "COMPUTERNAME", "PROCESSOR_ARCHITECTURE", "NUMBER_OF_PROCESSORS"] {
        if let Ok(value) = std::env::var(name) { if value.len() < 256 && !value.contains(['\\', '/', ';', '%']) { env.push((name.into(), value)); } }
    }
    Ok(env)
}
/// Installs `ids` (already checked against the table) one by one with the elevated environment, writing each result to
/// `work\progress.json` as it goes. `true` when every one ended installed, already there or waiting for a restart.
pub fn install_machine(winget: &Path, work: &Path, ids: &[Program]) -> Result<bool, String> {
    for sub in ["temp", "local", "roaming"] { std::fs::create_dir_all(work.join(sub)).map_err(|_| "REINSTALL_WORK")?; }
    let env = child_env(work)?;
    let system = crate::folders::known_folder(&windows_sys::Win32::UI::Shell::FOLDERID_System)?;
    let started = Instant::now();
    let mut results: Vec<Value> = ids.iter().map(|p| json!({"id":p.id,"name":p.name,"state":"waiting"})).collect();
    let write = |results: &[Value]| std::fs::write(work.join("progress.json"), serde_json::to_vec(&json!({"schema":1,"programs":results})).unwrap_or_default());
    let mut all = true;
    for (i, program) in ids.iter().enumerate() {
        results[i]["state"] = json!("installing"); let _ = write(&results);
        let left = ALL.checked_sub(started.elapsed()).unwrap_or_default().min(ONE);
        let args = install_args(&program.id, Some("machine"));
        let refs: Vec<&str> = args.iter().map(String::as_str).collect();
        let (state, code) = if left.is_zero() { ("failed", None) } else {
            match run(winget, &refs, Some(&env), Some(&system), left) { Ok((code, _)) => (outcome(code), Some(code)), Err(e) if e == "WINGET_TIMEOUT" => ("timeout", None), Err(_) => ("failed", None) }
        };
        if !matches!(state, "installed" | "already" | "reboot") { all = false; }
        results[i]["state"] = json!(state); results[i]["exitCode"] = json!(code); let _ = write(&results);
    }
    for sub in ["temp", "local", "roaming"] { let _ = std::fs::remove_dir_all(work.join(sub)); }
    Ok(all)
}
/// The ids the command line names: 1 to 64, every one of them one of the table's machine-scope ones (else the whole
/// request is refused). Anyone can start this program with any arguments, so this is the whole check, and the person
/// still confirms the list in this process's own window.
pub fn parse_ids(ids: &[String]) -> Result<Vec<Program>, String> {
    if ids.is_empty() || ids.len() > 64 { return Err("REINSTALL_REQUEST".into()); }
    let machine: Vec<Program> = table().into_iter().filter(|p| p.scope == "machine").collect();
    let mut out = Vec::new(); let mut seen = BTreeSet::new();
    for id in ids {
        let id = Some(id.as_str()).filter(|s| valid_id(s)).ok_or("REINSTALL_REQUEST")?;
        let program = machine.iter().find(|p| p.id == id).ok_or("REINSTALL_NOT_IN_TABLE")?;
        if seen.insert(id.to_string()) { out.push(program.clone()); }
    }
    Ok(out)
}
fn confirm(programs: &[Program]) -> bool {
    use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, IDOK, MB_ICONQUESTION, MB_OKCANCEL, MB_SETFOREGROUND, MB_TOPMOST};
    let list: Vec<String> = programs.iter().map(|p| format!("· {}", p.name)).collect();
    let text = wide(&format!("SYNK 업무 백업이 아래 프로그램 {}개를 이 PC에 깝니다. 각 프로그램의 사용권 계약에 동의하게 됩니다.\n\n{}\n\n깔려면 「확인」을 누르세요.", programs.len(), list.join("\n")));
    unsafe { MessageBoxW(ptr::null_mut(), text.as_ptr(), wide("SYNK 업무 백업 — 프로그램 다시 깔기").as_ptr(), MB_OKCANCEL | MB_ICONQUESTION | MB_TOPMOST | MB_SETFOREGROUND) == IDOK }
}
/// `WorkBackupRun.exe --reinstall <number> <id>…`, started elevated by the window app; `args` is what follows
/// `--reinstall`. Exit 0: all done; 1: some failed; 2: refused (number, ids, folder or winget); 3: the person said no;
/// 77: not elevated.
pub fn elevated_main(args: &[String]) -> i32 {
    let Some((number, ids)) = args.split_first() else { return 2 };
    if number.is_empty() || number.len() > 10 || !number.bytes().all(|b| b.is_ascii_digit()) { return 2; }
    if !crate::platform::elevated() { return 77; }
    let Ok(exe) = std::env::current_exe() else { return 2 };
    let Some(dir) = exe.parent() else { return 2 };
    if !admin_only(dir).unwrap_or(false) { return 2; }
    let Ok(programs) = parse_ids(ids) else { return 2 };
    let Ok(winget) = find_winget() else { return 2 };
    if !confirm(&programs) { return 3; }
    let root = dir.join("reinstall-work");
    let _ = std::fs::remove_dir_all(&root);
    let work = root.join(number);
    match install_machine(&winget, &work, &programs) { Ok(true) => 0, Ok(false) => 1, Err(_) => 2 }
}

/// Whether winget is ready (installed, new enough, its package folder found) and its version.
pub fn status() -> Value {
    match find_winget() {
        Err(code) => json!({"ready":false,"reason":code}),
        Ok(winget) => match run(&winget, &["--version"], None, None, Duration::from_secs(60)) {
            Ok((0, text)) => { let version = text.trim().to_string(); let ok = version_of(&version).is_some_and(|v| v >= MIN_VERSION); json!({"ready":ok,"version":version,"reason":if ok { Value::Null } else { json!("WINGET_OLD") }}) }
            _ => json!({"ready":false,"reason":"WINGET_START"}),
        },
    }
}
/// The ids `winget export --source winget` finds on this PC (normal privilege).
pub fn installed() -> Result<Vec<String>, String> {
    let winget = find_winget()?;
    let dir = std::env::temp_dir().join(format!("swb-winget-{}-{}", std::process::id(), Instant::now().elapsed().as_nanos()));
    std::fs::create_dir_all(&dir).map_err(|_| "WINGET_EXPORT")?;
    let file = dir.join("export.json");
    let result = run(&winget, &["export", "--source", "winget", "--disable-interactivity", "--accept-source-agreements", "-o", &file.to_string_lossy()], None, None, Duration::from_secs(180));
    let text = std::fs::read(&file); let _ = std::fs::remove_dir_all(&dir);
    result?;
    let value: Value = serde_json::from_slice(&text.map_err(|_| "WINGET_EXPORT")?).map_err(|_| "WINGET_EXPORT")?;
    let ids = value["Sources"].as_array().into_iter().flatten().flat_map(|s| s["Packages"].as_array().into_iter().flatten()).filter_map(|p| p["PackageIdentifier"].as_str().filter(|id| valid_id(id)).map(String::from));
    Ok(capped(ids))
}
/// Host answers go back to the worker in one frame of at most 128 KiB (protocol.rs MAX_REQUEST); a list stops well before.
const MAX_ANSWER: usize = 96 * 1024;
fn capped(ids: impl Iterator<Item = String>) -> Vec<String> {
    let (mut out, mut seen, mut bytes) = (Vec::new(), std::collections::HashSet::new(), 0usize);
    for id in ids {
        if !seen.insert(id.clone()) { continue; }
        bytes += id.len() + 3;
        if bytes > MAX_ANSWER { break; }
        out.push(id);
    }
    out
}
/// `winget show` for a program outside the table: its name, publisher and version as winget gives them (review M15).
pub fn show(id: &str) -> Result<Value, String> {
    if !valid_id(id) { return Err("HOST_REQUEST".into()); }
    let (code, text) = run(&find_winget()?, &["show", "--id", id, "--exact", "--source", "winget", "--disable-interactivity", "--accept-source-agreements"], None, None, Duration::from_secs(120))?;
    if code != 0 { return Ok(json!({"found":false})); }
    let short = |v: &str| v.trim().chars().take(512).collect::<String>();
    let field = |label: &str| text.lines().find_map(|l| l.trim().strip_prefix(label).map(short));
    let found = text.lines().find_map(|l| l.trim().strip_prefix("Found ").map(short));
    Ok(json!({"found":found.is_some(),"title":found,"publisher":field("Publisher:"),"version":field("Version:"),"license":field("License Url:"),"homepage":field("Homepage:")}))
}
/// Whether one id is installed (`winget list --id <id> -e`) — the check after an install (review M17).
pub fn listed(id: &str) -> Result<bool, String> {
    if !valid_id(id) { return Err("HOST_REQUEST".into()); }
    let (code, text) = run(&find_winget()?, &["list", "--id", id, "--exact", "--source", "winget", "--disable-interactivity", "--accept-source-agreements"], None, None, Duration::from_secs(120))?;
    Ok(code == 0 && text.contains(id))
}
/// One program at normal privilege: the table's user-scope ones with `--scope user`, one outside the table without a scope
/// (its installer may ask for administrator approval itself).
pub fn install_user(id: &str) -> Result<Value, String> {
    if !valid_id(id) { return Err("HOST_REQUEST".into()); }
    let in_table = table().into_iter().find(|p| p.id == id);
    if in_table.as_ref().is_some_and(|p| p.scope == "machine") { return Err("REINSTALL_NEEDS_ELEVATION".into()); }
    let args = install_args(id, in_table.as_ref().map(|_| "user"));
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let (code, _) = run(&find_winget()?, &refs, None, None, ONE)?;
    Ok(json!({"id":id,"state":outcome(code),"exitCode":code}))
}
/// Writes the request and starts `WorkBackupRun.exe --reinstall <number>` elevated (one administrator approval), then
/// waits for it and reads its results from the administrators-only work folder.
pub fn elevate(ids: &[String]) -> Result<Value, String> {
    use windows_sys::Win32::{System::Threading::{GetExitCodeProcess, WaitForSingleObject}, UI::{Shell::{ShellExecuteExW, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW}, WindowsAndMessaging::SW_SHOWNORMAL}};
    let machine: Vec<String> = table().into_iter().filter(|p| p.scope == "machine").map(|p| p.id).collect();
    if ids.is_empty() || ids.len() > 64 || ids.iter().any(|id| !machine.contains(id)) { return Err("REINSTALL_NOT_IN_TABLE".into()); }
    let exe = std::env::current_exe().map_err(|_| "REINSTALL_EXE")?.parent().ok_or("REINSTALL_EXE")?.join("WorkBackupRun.exe");
    let number = (std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|_| "REINSTALL_CLOCK")?.as_nanos() % 2_000_000_000).to_string();
    // The ids go on the command line: they are table ids (letters, digits, `.+_-`), so no quoting is needed.
    let (verb, file_w, params) = (wide("runas"), wide(&exe.to_string_lossy()), wide(&elevated_args(&number, ids)));
    let mut info: SHELLEXECUTEINFOW = unsafe { std::mem::zeroed() };
    info.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32; info.fMask = SEE_MASK_NOCLOSEPROCESS;
    info.lpVerb = verb.as_ptr(); info.lpFile = file_w.as_ptr(); info.lpParameters = params.as_ptr(); info.nShow = SW_SHOWNORMAL;
    let started = unsafe { ShellExecuteExW(&mut info) } != 0 && !info.hProcess.is_null();
    if !started { return Ok(json!({"started":false,"reason":"DECLINED_OR_FAILED"})); }
    unsafe { WaitForSingleObject(info.hProcess, (ALL + Duration::from_secs(600)).as_millis() as u32) };
    let mut code = 0u32; unsafe { GetExitCodeProcess(info.hProcess, &mut code); CloseHandle(info.hProcess); }
    let progress = exe.parent().map(|d| d.join("reinstall-work").join(&number).join("progress.json")).and_then(|p| std::fs::read(p).ok()).and_then(|b| serde_json::from_slice::<Value>(&b).ok());
    Ok(json!({"started":true,"exitCode":code,"progress":progress}))
}
/// `--reinstall <number> <id> <id> …` — what `elevate` hands the elevated process.
fn elevated_args(number: &str, ids: &[String]) -> String { std::iter::once(format!("--reinstall {number}")).chain(ids.iter().cloned()).collect::<Vec<_>>().join(" ") }
/// The host methods the worker calls (`reinstall.*`). `None`: not a method of this module.
pub fn host(method: &str, args: &[Value]) -> Option<Result<Value, String>> {
    let first = args.first().unwrap_or(&Value::Null);
    let id = || first.as_str().map(String::from).ok_or_else(|| "HOST_REQUEST".to_string());
    Some(match method {
        "reinstall.status" => Ok(status()),
        "reinstall.installed" => installed().map(Value::from),
        "reinstall.show" => id().and_then(|id| show(&id)),
        "reinstall.listed" => id().and_then(|id| listed(&id)).map(Value::from),
        "reinstall.user" => id().and_then(|id| install_user(&id)),
        "reinstall.elevate" => first.as_array().ok_or_else(|| "HOST_REQUEST".to_string())
            .and_then(|a| a.iter().map(|v| v.as_str().map(String::from).ok_or_else(|| "HOST_REQUEST".to_string())).collect::<Result<Vec<_>, _>>()).and_then(|ids| elevate(&ids)),
        _ => return None,
    })
}

#[cfg(test)] mod tests {
    use super::*;
    use std::fs;
    fn base(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("swb-reinstall-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir); fs::create_dir_all(&dir).unwrap(); dir
    }
    #[test] fn the_table_is_whole() {
        let t = table();
        assert_eq!(t.len(), 27);
        assert_eq!(t.iter().filter(|p| p.scope == "machine").count(), 12);
        assert!(t.iter().all(|p| valid_id(&p.id) && matches!(p.scope.as_str(), "machine" | "user")));
        for bad in ["", "a b", "Git.Git;calc", "--source", "x\"y", &"a".repeat(129), "../x"] { assert!(!valid_id(bad), "{bad}"); }
        assert!(valid_id("Adobe.Acrobat.Reader.64-bit") && valid_id("Microsoft.VCRedist.2015+.x64"));
    }
    #[test] fn commands_are_fixed() {
        assert_eq!(install_args("7zip.7zip", Some("machine")).join(" "), "install --id 7zip.7zip --source winget --scope machine --silent --accept-package-agreements --accept-source-agreements --disable-interactivity --exact");
        assert!(!install_args("Some.Thing", None).iter().any(|a| a == "--scope"));
        assert_eq!((outcome(0), outcome(0x8A15002Bu32 as i32), outcome(3010), outcome(1)), ("installed", "already", "reboot", "failed"));
    }
    #[test] fn a_request_holds_only_the_tables_machine_ids() {
        let ids = |list: &[&str]| list.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        assert_eq!(parse_ids(&ids(&["7zip.7zip", "Git.Git", "7zip.7zip"])).unwrap().iter().map(|p| p.id.as_str()).collect::<Vec<_>>(), ["7zip.7zip", "Git.Git"]);
        assert_eq!(parse_ids(&ids(&["7zip.7zip", "Evil.Thing"])), Err("REINSTALL_NOT_IN_TABLE".into()), "one id outside the table refuses all");
        assert_eq!(parse_ids(&ids(&["Obsidian.Obsidian"])), Err("REINSTALL_NOT_IN_TABLE".into()), "user-scope ones never run elevated");
        assert!(parse_ids(&[]).is_err() && parse_ids(&ids(&["Git.Git;calc"])).is_err() && parse_ids(&ids(&["--source"])).is_err());
        assert!(parse_ids(&vec!["Git.Git".to_string(); 65]).is_err());
        // GPT GB2 · GB7: nothing is written for the elevated side to find; what it gets is the command line.
        assert_eq!(elevated_args("123", &ids(&["Git.Git", "7zip.7zip"])), "--reinstall 123 Git.Git 7zip.7zip");
        assert_eq!(elevated_main(&ids(&["12a", "Git.Git"])), 2, "the number is digits only");
        assert_eq!(elevated_main(&[]), 2);
    }
    #[test] fn the_elevated_children_get_a_fresh_environment() {
        // A stand-in winget records what it was given: arguments, temporary folder, winget state folder, PATH, current folder.
        let dir = base("fake"); let work = dir.join("work");
        let log = dir.join("log.txt");
        let fake = dir.join("winget.cmd");
        fs::write(&fake, format!("@echo %*^|%TEMP%^|%LOCALAPPDATA%^|%APPDATA%^|%PATH%^|%CD%>>\"{}\"\r\n@exit /b 0\r\n", log.display())).unwrap();
        std::env::set_var("SWB_SHOULD_NOT_LEAK", "secret-value");
        let programs: Vec<Program> = table().into_iter().filter(|p| ["7zip.7zip", "Git.Git"].contains(&p.id.as_str())).collect();
        assert!(install_machine(&fake, &work, &programs).unwrap());
        let text = fs::read_to_string(&log).unwrap();
        let lines: Vec<&str> = text.lines().collect();
        assert_eq!(lines.len(), 2, "{text}");
        assert!(lines[0].starts_with("install --id Git.Git --source winget --scope machine") || lines[0].starts_with("install --id 7zip.7zip --source winget --scope machine"), "{text}");
        let parts: Vec<&str> = lines[0].split('|').collect();
        assert!(parts[1].starts_with(&work.join("temp").to_string_lossy().into_owned()), "TEMP inside the work folder: {}", parts[1]);
        assert!(parts[2].starts_with(&work.join("local").to_string_lossy().into_owned()) && parts[3].starts_with(&work.join("roaming").to_string_lossy().into_owned()));
        assert!(!parts[4].to_lowercase().contains("windowsapps") && !parts[4].to_lowercase().contains("appdata"), "PATH is the system's: {}", parts[4]);
        assert!(parts[5].to_lowercase().ends_with("system32"), "current folder: {}", parts[5]);
        assert!(!text.contains("secret-value"));
        let progress: Value = serde_json::from_slice(&fs::read(work.join("progress.json")).unwrap()).unwrap();
        assert!(progress["programs"].as_array().unwrap().iter().all(|p| p["state"] == "installed"));
        assert!(!work.join("temp").exists(), "temporary folders are removed after");
        let _ = fs::remove_dir_all(&dir);
    }
    #[test] fn winget_comes_from_its_package_folder() {
        match find_winget() {
            Ok(path) => {
                let text = path.to_string_lossy().to_lowercase();
                assert!(text.contains(r"\windowsapps\microsoft.desktopappinstaller_") && !text.contains(r"\appdata\"), "{text}");
                assert!(status()["version"].as_str().is_some());
            }
            Err(code) => assert_eq!(code, "WINGET_MISSING"),
        }
    }
    #[test] fn folder_rights() {
        if let Ok(windows) = crate::folders::known_folder(&windows_sys::Win32::UI::Shell::FOLDERID_System) { assert_eq!(admin_only(&windows), Ok(true), "System32 is administrators-only"); }
        let dir = base("acl");
        assert_eq!(admin_only(&dir), Ok(false), "a folder the person owns is not");
        let _ = fs::remove_dir_all(&dir);
    }
    #[test] fn answers_stay_inside_the_worker_frame() {
        let many = (0..5000).map(|i| format!("Vendor{i:05}.{}", "x".repeat(100)));
        let list = capped(many.chain(std::iter::once("Git.Git".to_string())));
        assert!(serde_json::to_vec(&list).unwrap().len() < 128 * 1024);
        assert!(list.len() > 500);
        assert_eq!(capped(["Git.Git".to_string(), "Git.Git".to_string(), "7zip.7zip".to_string()].into_iter()), vec!["Git.Git", "7zip.7zip"]);
    }
}
