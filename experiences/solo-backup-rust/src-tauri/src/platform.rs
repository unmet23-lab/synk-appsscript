use fs2::FileExt;
use std::{fs::{self, File, OpenOptions}, path::{Path, PathBuf}, os::windows::{fs::MetadataExt, io::AsRawHandle}, ptr};
use winreg::{RegKey, enums::*};
use windows_sys::Win32::{Foundation::{CloseHandle, HANDLE}, System::JobObjects::*};
use windows_sys::Win32::System::Threading::{CreateEventW,OpenEventW,SetEvent,WaitForSingleObject,EVENT_MODIFY_STATE};
use sha2::{Digest,Sha256};

pub const RUN_NAME: &str = "SoloWorkBackupRustBeta";
const RUN: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const APPROVED: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run";

pub fn key_path(path: &Path) -> String { path.to_string_lossy().trim_start_matches(r"\\?\").replace('/', "\\").trim_end_matches('\\').to_lowercase() }
pub fn worker_path(path:&Path)->Result<PathBuf,String>{
    let text=path.to_str().ok_or("STATE_ROOT")?.trim_start_matches(r"\\?\");
    let bytes=text.as_bytes();if bytes.len()<3||!bytes[0].is_ascii_alphabetic()||bytes[1]!=b':'||bytes[2]!=b'\\'{return Err("STATE_ROOT".into());}
    Ok(PathBuf::from(text))
}
pub fn overlap(a: &Path, b: &Path) -> bool {
    let a = key_path(a); let b = key_path(b);
    a == b || a.starts_with(&(b.clone()+"\\")) || b.starts_with(&(a+"\\"))
}
fn root_allowed(path:&Path,appdata:&Path,test:bool)->bool{
    !overlap(path,&appdata.join("SoloWorkBackup"))&&(!test||!overlap(path,&appdata.join("SoloWorkBackupRustBeta")))
}
/// The two locks of STAGE1_DESIGN.md 4.1. The window app holds `ui.lock` while it is open
/// (one window). Whoever runs restic or writes settings holds `engine.lock`: the run
/// executable for a whole run, the window app only while one of its operations runs.
pub const UI_LOCK: &str = "ui.lock";
pub const ENGINE_LOCK: &str = "engine.lock";

/// The window app: the checked state folder and the window lock. A second window wakes
/// the first one and ends.
pub fn state_root(test: bool) -> Result<(PathBuf, File), String> {
    let root = state_dir(test)?;
    match try_lock(&root, UI_LOCK)? { Some(lock) => Ok((root, lock)), None => { signal_existing(&root); Err("ALREADY_RUNNING".into()) } }
}
/// The run executable: the checked state folder and the engine lock, without waking the
/// window. `None` means another process holds the engine; the run records 「바쁨」 and ends
/// (STAGE1_DESIGN.md 4.2 step 1). An open window alone does not stop a run.
pub fn open_state(test: bool) -> Result<(PathBuf, Option<File>), String> {
    let root = state_dir(test)?;
    let lock = try_lock(&root, ENGINE_LOCK)?;
    Ok((root, lock))
}
/// The checked state folder, in the plain local-drive spelling the worker receives.
pub fn state_dir(test: bool) -> Result<PathBuf, String> {
    let appdata = std::env::var_os("APPDATA").ok_or("STATE_ROOT")?;
    let production = PathBuf::from(&appdata).join("SoloWorkBackup");
    let requested = if test { PathBuf::from(std::env::var_os("SOLO_BACKUP_TEST_STATE").ok_or("TEST_STATE_REQUIRED")?) }
        else { PathBuf::from(&appdata).join("SoloWorkBackupRustBeta") };
    if !requested.is_absolute() || !root_allowed(&requested,Path::new(&appdata),test) { return Err("PRODUCTION_STATE_FORBIDDEN".into()); }
    fs::create_dir_all(&requested).map_err(|_| "STATE_ROOT")?;
    let root = fs::canonicalize(&requested).map_err(|_| "STATE_ROOT")?;
    let protected = fs::canonicalize(&production).unwrap_or(production);
    let real_appdata=fs::canonicalize(Path::new(&appdata)).map_err(|_|"STATE_ROOT")?;
    if overlap(&root, &protected) || !root_allowed(&root,&real_appdata,test) || fs::symlink_metadata(&requested).map_err(|_| "STATE_ROOT")?.file_attributes() & 0x400 != 0 { return Err("PRODUCTION_STATE_FORBIDDEN".into()); }
    // std::fs::canonicalize returns extended-length syntax on Windows. The
    // existing engine deliberately rejects device/UNC inputs; pass the same
    // checked local drive spelling it receives from an Electron folder picker.
    worker_path(&root)
}
/// Takes the lock file `name` in the state folder without waiting. `None` when another
/// process holds it. The lock lasts while the returned file (or a clone of it) is open.
pub fn try_lock(root: &Path, name: &str) -> Result<Option<File>, String> {
    if ![UI_LOCK, ENGINE_LOCK].contains(&name) { return Err("STATE_LOCK".into()); }
    let lockpath = root.join(name);
    if fs::symlink_metadata(&lockpath).is_ok_and(|m| m.file_attributes() & 0x400 != 0) { return Err("STATE_ROOT".into()); }
    let lock = OpenOptions::new().read(true).write(true).create(true).truncate(false).open(lockpath).map_err(|_| "STATE_LOCK")?;
    Ok(if lock.try_lock_exclusive().is_err() { None } else { Some(lock) })
}

fn signal_name(root:&Path)->Vec<u16>{format!("Local\\SoloWorkBackupRustBeta-{:x}",Sha256::digest(key_path(root).as_bytes())).encode_utf16().chain([0]).collect()}
pub struct InstanceSignal(HANDLE);
unsafe impl Send for InstanceSignal {}
unsafe impl Sync for InstanceSignal {}
impl InstanceSignal {
    pub fn new(root:&Path)->Result<Self,String>{let name=signal_name(root);let handle=unsafe{CreateEventW(ptr::null(),0,0,name.as_ptr())};if handle.is_null(){Err("INSTANCE_SIGNAL".into())}else{Ok(Self(handle))}}
    pub fn wait(&self)->bool{unsafe{WaitForSingleObject(self.0,500)==0}}
}
impl Drop for InstanceSignal{fn drop(&mut self){unsafe{CloseHandle(self.0);}}}
fn signal_existing(root:&Path){let name=signal_name(root);let event=unsafe{OpenEventW(EVENT_MODIFY_STATE,0,name.as_ptr())};if !event.is_null(){unsafe{SetEvent(event);CloseHandle(event);}}}

pub fn startup_command(exe: &Path) -> Result<String, String> {
    let text = exe.to_str().ok_or("STARTUP_PATH")?;
    if !exe.is_absolute() || text.contains(['"','\r','\n']) { return Err("STARTUP_PATH".into()); }
    Ok(format!("\"{}\" --background", text.trim_start_matches(r"\\?\")))
}
fn approved_enabled(bytes: Option<Vec<u8>>) -> bool { bytes.is_none_or(|b| b.len() >= 12 && matches!(b[0], 2 | 6)) }
pub fn startup_read(exe: &Path, test: bool) -> Result<bool, String> {
    if test { return Ok(false); }
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let expected = startup_command(exe)?;
    let current = hkcu.open_subkey(RUN).ok().and_then(|k| k.get_value::<String,_>(RUN_NAME).ok());
    let approval = hkcu.open_subkey(APPROVED).ok().and_then(|k| k.get_raw_value(RUN_NAME).ok()).map(|v| v.bytes);
    Ok(current.as_deref() == Some(expected.as_str()) && approved_enabled(approval))
}
pub fn startup_set(exe: &Path, enabled: bool, test: bool, packaged: bool) -> Result<bool, String> {
    if test || !packaged { return Err("STARTUP_TEST_DISABLED".into()); }
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (run,_) = hkcu.create_subkey(RUN).map_err(|_| "STARTUP_FAILED")?;
    if enabled { run.set_value(RUN_NAME, &startup_command(exe)?).map_err(|_| "STARTUP_FAILED")?; }
    else { match run.delete_value(RUN_NAME) { Ok(()) => (), Err(e) if e.kind()==std::io::ErrorKind::NotFound => (), Err(_) => return Err("STARTUP_FAILED".into()) } }
    let active = startup_read(exe, false)?;
    if active != enabled { return Err("STARTUP_DISABLED_BY_WINDOWS".into()); }
    Ok(active)
}

pub fn oauth_allowed(value: &str) -> bool {
    url::Url::parse(value).is_ok_and(|u| u.scheme()=="https" && u.host_str()==Some("accounts.google.com") && u.port().is_none()
        && u.username().is_empty() && u.password().is_none() && u.path()=="/o/oauth2/v2/auth")
}
pub fn open_directory_allowed(path: &Path, root: &Path) -> bool {
    if !path.is_absolute() || overlap(path, root) { return false; }
    let Ok(real) = fs::canonicalize(path) else { return false };
    if overlap(&real, root) { return false; }
    let mut cursor = Some(path);
    while let Some(part) = cursor { if fs::symlink_metadata(part).is_ok_and(|m| m.file_attributes() & 0x400 != 0) { return false; } cursor = part.parent(); }
    real.is_dir()
}

pub struct ProcessJob(HANDLE);
unsafe impl Send for ProcessJob {}
unsafe impl Sync for ProcessJob {}
impl ProcessJob {
    pub fn new() -> Result<Self, String> {
        let handle = unsafe { CreateJobObjectW(ptr::null(), ptr::null()) };
        if handle.is_null() { return Err("PROCESS_JOB".into()); }
        let job=Self(handle);
        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = unsafe { std::mem::zeroed() };
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        if unsafe { SetInformationJobObject(handle, JobObjectExtendedLimitInformation, &info as *const _ as *const _, std::mem::size_of_val(&info) as u32) } == 0 { return Err("PROCESS_JOB".into()); }
        Ok(job)
    }
    pub fn assign(&self, child: &std::process::Child) -> Result<(), String> {
        if unsafe { AssignProcessToJobObject(self.0, child.as_raw_handle() as HANDLE) } == 0 { return Err("PROCESS_JOB".into()); }
        Ok(())
    }
    pub fn terminate(&self) { unsafe { TerminateJobObject(self.0, 1); } }
    /// What the job's processes (worker and every restic it started, ended ones
    /// included) used so far: peak commit and total CPU time (4.2 「회차 기록」).
    pub fn usage(&self) -> Option<JobUsage> {
        let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = unsafe { std::mem::zeroed() };
        let mut basic: JOBOBJECT_BASIC_ACCOUNTING_INFORMATION = unsafe { std::mem::zeroed() };
        let ok = unsafe {
            QueryInformationJobObject(self.0, JobObjectExtendedLimitInformation, &mut limits as *mut _ as *mut _, std::mem::size_of_val(&limits) as u32, ptr::null_mut()) != 0
            && QueryInformationJobObject(self.0, JobObjectBasicAccountingInformation, &mut basic as *mut _ as *mut _, std::mem::size_of_val(&basic) as u32, ptr::null_mut()) != 0
        };
        if !ok { return None; }
        Some(JobUsage { peak_job_bytes: limits.PeakJobMemoryUsed as u64, peak_process_bytes: limits.PeakProcessMemoryUsed as u64,
            cpu_ms: (basic.TotalUserTime.max(0) as u64 + basic.TotalKernelTime.max(0) as u64) / 10_000, processes: basic.TotalProcesses })
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobUsage { pub peak_job_bytes: u64, pub peak_process_bytes: u64, pub cpu_ms: u64, pub processes: u32 }
impl Drop for ProcessJob { fn drop(&mut self) { unsafe { CloseHandle(self.0); } } }

#[cfg(test)] mod tests {
    use super::*;
    #[test] fn paths_and_startup_are_isolated() {
        assert_eq!(RUN_NAME,"SoloWorkBackupRustBeta");
        assert_eq!(startup_command(Path::new(r"C:\Program Files\업무\WorkBackupRust.exe")).unwrap(), "\"C:\\Program Files\\업무\\WorkBackupRust.exe\" --background");
        assert!(startup_set(Path::new(r"C:\test.exe"),true,true,true).is_err());
        assert!(overlap(Path::new(r"C:\Users\Work"),Path::new(r"c:\users\work\state")));
        assert!(!overlap(Path::new(r"C:\Work"),Path::new(r"C:\Worker")));
        assert_eq!(worker_path(Path::new(r"\\?\C:\Work\state")).unwrap(),PathBuf::from(r"C:\Work\state"));
        assert!(worker_path(Path::new(r"\\?\UNC\server\state")).is_err());
        let appdata=Path::new(r"C:\Users\fixture\AppData\Roaming");
        assert!(!root_allowed(&appdata.join("SoloWorkBackupRustBeta"),appdata,true));
        assert!(!root_allowed(&appdata.join("SoloWorkBackupRustBeta/child"),appdata,true));
        assert!(!root_allowed(appdata,appdata,true));
        assert!(root_allowed(&appdata.join("SoloWorkBackupRustBeta"),appdata,false));
        assert!(!approved_enabled(Some(vec![3;12]))); assert!(!approved_enabled(Some(vec![2])));
    }
    #[test] fn oauth_is_exact_origin() {
        assert!(oauth_allowed("https://accounts.google.com/o/oauth2/v2/auth?state=test"));
        for u in ["https://accounts.google.com.evil/o/oauth2/v2/auth", "https://user@accounts.google.com/o/oauth2/v2/auth", "http://accounts.google.com/o/oauth2/v2/auth", "https://accounts.google.com/o/oauth2/v2/token"] { assert!(!oauth_allowed(u)); }
    }
    #[test] fn two_locks_are_independent(){
        let dir=std::env::temp_dir().join(format!("swb-locks-{}",std::process::id()));let _=fs::remove_dir_all(&dir);fs::create_dir_all(&dir).unwrap();
        let ui=try_lock(&dir,UI_LOCK).unwrap().expect("ui lock");
        let engine=try_lock(&dir,ENGINE_LOCK).unwrap().expect("an open window does not hold the engine");
        assert!(try_lock(&dir,ENGINE_LOCK).unwrap().is_none(),"engine lock is exclusive");
        let clone=engine.try_clone().unwrap();drop(engine);
        assert!(try_lock(&dir,ENGINE_LOCK).unwrap().is_none(),"a clone keeps the lock (run.rs keeps one until the record is written)");
        drop(clone);
        assert!(try_lock(&dir,ENGINE_LOCK).unwrap().is_some(),"released when the last handle closes");
        assert!(try_lock(&dir,"other.lock").is_err());
        drop(ui);fs::remove_dir_all(&dir).unwrap();
    }
    #[test] fn job_usage_counts_its_processes(){
        use std::{process::Command,os::windows::process::CommandExt};
        let job=ProcessJob::new().unwrap();
        let comspec=std::env::var_os("ComSpec").unwrap_or_else(||"cmd.exe".into());
        let mut child=Command::new(comspec).args(["/c","ping -n 2 127.0.0.1 >nul"]).creation_flags(0x08000000).spawn().unwrap();
        job.assign(&child).unwrap();child.wait().unwrap();
        let usage=job.usage().unwrap();
        assert!(usage.processes>=1,"cmd and ping are counted: {usage:?}");
        assert!(usage.peak_job_bytes>0&&usage.peak_process_bytes<=usage.peak_job_bytes);
    }
    #[test] fn job_terminates_owned_descendant(){
        use std::{io::{BufRead,BufReader,Write},process::{Command,Stdio},os::windows::process::CommandExt};
        use windows_sys::Win32::System::Threading::{OpenProcess,PROCESS_SYNCHRONIZE};
        let node=std::env::var("SWB_NODE_EXE").expect("set SWB_NODE_EXE to bundled node.exe");
        let script="process.stdin.once('data',()=>{let c=require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{windowsHide:true,stdio:'ignore'});process.stdout.write(String(c.pid)+'\\n');setInterval(()=>{},1000);});";
        let job=ProcessJob::new().unwrap();
        let mut child=Command::new(node).args(["-e",script]).creation_flags(0x08000000).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn().unwrap();
        job.assign(&child).unwrap();child.stdin.take().unwrap().write_all(b"go").unwrap();
        let mut line=String::new();BufReader::new(child.stdout.take().unwrap()).read_line(&mut line).unwrap();let pid:u32=line.trim().parse().unwrap();
        let descendant=unsafe{OpenProcess(PROCESS_SYNCHRONIZE,0,pid)};assert!(!descendant.is_null());
        job.terminate();child.wait().unwrap();assert_eq!(unsafe{WaitForSingleObject(descendant,5000)},0);unsafe{CloseHandle(descendant);}
    }
}
