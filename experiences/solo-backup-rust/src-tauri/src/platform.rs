use fs2::FileExt;
use std::{fs::{self, File, OpenOptions}, path::{Path, PathBuf}, os::windows::{fs::MetadataExt, io::AsRawHandle}, ptr};
use windows_sys::Win32::{Foundation::{CloseHandle, HANDLE}, System::JobObjects::*};
use windows_sys::Win32::System::Threading::{CreateEventW,OpenEventW,SetEvent,WaitForSingleObject,EVENT_MODIFY_STATE};
use sha2::{Digest,Sha256};

/// 0.7.0's own folder name (STAGE1_DESIGN.md 4.1 · 5.1): settings, credentials and records in
/// %APPDATA%\SynkWorkBackup; restic's cache and temporary files in %LOCALAPPDATA%\SynkWorkBackup.
pub const PRODUCT_DIR: &str = "SynkWorkBackup";
/// The 0.5.0 app's and the 0.6.1 beta's state, which 0.7.0 neither reads nor writes.
const EARLIER: [&str; 2] = ["SoloWorkBackup", "SoloWorkBackupRustBeta"];

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
/// The roaming and local profile folders the app's two folders live in.
struct Places { appdata: PathBuf, local: PathBuf }
impl Places {
    fn from_env() -> Result<Self, String> {
        let var = |name: &str| std::env::var_os(name).map(PathBuf::from).filter(|p| p.is_absolute()).ok_or_else(|| String::from("STATE_ROOT"));
        Ok(Self { appdata: var("APPDATA")?, local: var("LOCALAPPDATA")? })
    }
    /// What an app folder may not overlap: the earlier apps' state (in every mode) and, for a test,
    /// 0.7.0's own two folders. Each as written and at its real location (review GA1 · GA3).
    fn protected(&self, test: bool) -> Vec<PathBuf> {
        let mut list: Vec<PathBuf> = EARLIER.iter().map(|name| self.appdata.join(name)).collect();
        if test { list.push(self.appdata.join(PRODUCT_DIR)); list.push(self.local.join(PRODUCT_DIR)); }
        list.into_iter().flat_map(|path| { let real = real_path(&path); std::iter::once(path).chain(real) }).collect()
    }
}
/// `path` with its deepest existing ancestor resolved (junctions, links, short names): where a folder
/// there is, or would be created. `None` when no ancestor resolves or a part is `..`.
fn real_path(path: &Path) -> Option<PathBuf> {
    let mut rest = Vec::new(); let mut cursor = path;
    loop {
        if let Ok(found) = fs::canonicalize(cursor) { return Some(rest.iter().rev().fold(found, |out, part| out.join(part))); }
        rest.push(cursor.file_name()?.to_os_string()); cursor = cursor.parent()?;
    }
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
    let places = Places::from_env()?;
    let requested = if test { PathBuf::from(std::env::var_os("SOLO_BACKUP_TEST_STATE").ok_or("TEST_STATE_REQUIRED")?) }
        else { places.appdata.join(PRODUCT_DIR) };
    checked_dir(&requested, &places, test)
}
/// restic's cache and temporary files (STAGE1_DESIGN.md 5.1): %LOCALAPPDATA%\SynkWorkBackup, kept out
/// of the roaming profile, or a `local` folder inside a test state. Checked like the state folder.
pub fn cache_dir(root: &Path, test: bool) -> Result<PathBuf, String> {
    let places = Places::from_env()?;
    let requested = if test { root.join("local") } else { places.local.join(PRODUCT_DIR) };
    checked_dir(&requested, &places, test)
}
/// Creates and checks one of the app's folders: absolute, outside the earlier apps' state (and, for a
/// test, outside 0.7.0's own folders too) both where it is written and where it really lands, not a
/// reparse point. The real location is checked before anything is created and again after.
fn checked_dir(requested: &Path, places: &Places, test: bool) -> Result<PathBuf, String> {
    let protected = places.protected(test);
    let hits = |path: &Path| protected.iter().any(|p| overlap(path, p));
    if !requested.is_absolute() || hits(requested) || real_path(requested).is_none_or(|planned| hits(&planned)) { return Err("PRODUCTION_STATE_FORBIDDEN".into()); }
    fs::create_dir_all(requested).map_err(|_| "STATE_ROOT")?;
    let root = fs::canonicalize(requested).map_err(|_| "STATE_ROOT")?;
    if hits(&root) || fs::symlink_metadata(requested).map_err(|_| "STATE_ROOT")?.file_attributes() & 0x400 != 0 { return Err("PRODUCTION_STATE_FORBIDDEN".into()); }
    // std::fs::canonicalize returns extended-length syntax on Windows. The engine rejects
    // device/UNC inputs; pass the checked local drive spelling it expects.
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

fn signal_name(root:&Path)->Vec<u16>{format!("Local\\SynkWorkBackup-{:x}",Sha256::digest(key_path(root).as_bytes())).encode_utf16().chain([0]).collect()}
pub struct InstanceSignal(HANDLE);
unsafe impl Send for InstanceSignal {}
unsafe impl Sync for InstanceSignal {}
impl InstanceSignal {
    pub fn new(root:&Path)->Result<Self,String>{let name=signal_name(root);let handle=unsafe{CreateEventW(ptr::null(),0,0,name.as_ptr())};if handle.is_null(){Err("INSTANCE_SIGNAL".into())}else{Ok(Self(handle))}}
    pub fn wait(&self)->bool{unsafe{WaitForSingleObject(self.0,500)==0}}
}
impl Drop for InstanceSignal{fn drop(&mut self){unsafe{CloseHandle(self.0);}}}
fn signal_existing(root:&Path){let name=signal_name(root);let event=unsafe{OpenEventW(EVENT_MODIFY_STATE,0,name.as_ptr())};if !event.is_null(){unsafe{SetEvent(event);CloseHandle(event);}}}

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
    #[test] fn paths_are_isolated() {
        assert!(overlap(Path::new(r"C:\Users\Work"),Path::new(r"c:\users\work\state")));
        assert!(!overlap(Path::new(r"C:\Work"),Path::new(r"C:\Worker")));
        assert_eq!(worker_path(Path::new(r"\\?\C:\Work\state")).unwrap(),PathBuf::from(r"C:\Work\state"));
        assert!(worker_path(Path::new(r"\\?\UNC\server\state")).is_err());
        let base=std::env::temp_dir().join(format!("swb-places-{}",std::process::id()));let _=fs::remove_dir_all(&base);
        let places=Places{appdata:base.join("Roaming"),local:base.join("Local")};fs::create_dir_all(&places.appdata).unwrap();
        let junction=|link:&Path,target:&Path|{fs::create_dir_all(target).unwrap();assert!(std::process::Command::new("cmd").arg("/c").arg("mklink").arg("/J").arg(link).arg(target).output().unwrap().status.success());};
        let refused=|path:&Path,test:bool|checked_dir(path,&places,test)==Err("PRODUCTION_STATE_FORBIDDEN".into());
        // 0.7.0 neither reads nor writes the 0.5.0 app's or the 0.6.1 beta's state, in any mode.
        for earlier in ["SoloWorkBackup","SoloWorkBackupRustBeta","SoloWorkBackupRustBeta/child"] {
            assert!(refused(&places.appdata.join(earlier),false),"{earlier}");
            assert!(refused(&places.appdata.join(earlier),true),"{earlier}");
        }
        assert!(refused(&places.appdata,false)&&refused(&places.appdata,true));
        assert!(refused(&places.appdata.join(PRODUCT_DIR),true),"a test never uses 0.7.0's own folder");
        assert!(refused(&places.local.join(PRODUCT_DIR).join("x"),true));
        // GA1: the production folder moved elsewhere and joined back. A test may not use where it really is.
        junction(&places.appdata.join(PRODUCT_DIR),&base.join("moved"));
        assert!(refused(&base.join("moved"),true)&&refused(&base.join("moved").join("child"),true));
        // A path that would land inside protected state through a junction is refused before anything is made there.
        junction(&base.join("link"),&places.appdata.join("SoloWorkBackupRustBeta"));
        assert!(refused(&base.join("link").join("x"),false)&&!places.appdata.join("SoloWorkBackupRustBeta").join("x").exists());
        // GA3: the local profile folder joined into the 0.6.1 beta's state. The cache may not land there.
        junction(&places.local,&places.appdata.join("SoloWorkBackupRustBeta"));
        assert!(refused(&places.local.join(PRODUCT_DIR),false)&&!places.appdata.join("SoloWorkBackupRustBeta").join(PRODUCT_DIR).exists());
        // What is allowed: a fresh production folder, and a test folder of its own.
        fs::remove_dir(places.appdata.join(PRODUCT_DIR)).unwrap();
        assert!(checked_dir(&places.appdata.join(PRODUCT_DIR),&places,false).is_ok());
        assert!(checked_dir(&base.join("test-state"),&places,true).is_ok());
        let _=fs::remove_dir_all(&base);
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
