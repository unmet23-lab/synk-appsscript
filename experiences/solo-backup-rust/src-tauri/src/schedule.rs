//! Per-user run tasks in Windows Task Scheduler (STAGE1_DESIGN.md 4.2 「회차 작업」).
//!
//! One task per trigger, so every run knows why it started (`--run <trigger>` — a single
//! task with four triggers can pass only one argument): hourly (time trigger repeating
//! every hour, no end), logon (+2 min), wake (System log Power-Troubleshooter event 1,
//! +2 min) and unlock (session unlock). Each runs as the signed-in user with an
//! interactive token at the lowest run level, starts on battery and keeps running when
//! the power cord comes out, starts a missed run when possible, ignores a new start
//! while one is running, runs at priority 7 (below normal) and may run up to 72 hours —
//! the run executable ends restic itself before that. Runs that overlap across the
//! four tasks meet at the engine lock and the second one records 「바쁨」.
//!
//! The tasks live in `\SYNK 업무 백업` when the installer made that folder writable for
//! users; otherwise in the root folder (the user's name in the task name keeps users
//! apart there). Registration never needs administrator rights.
use std::path::Path;
use windows::core::BSTR;
use windows::Win32::Foundation::{RPC_E_CHANGED_MODE, VARIANT_TRUE};
use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED};
use windows::Win32::System::TaskScheduler::{ITaskFolder, ITaskService, TaskScheduler, TASK_CREATE_OR_UPDATE, TASK_LOGON_INTERACTIVE_TOKEN};
use windows::Win32::System::Variant::VARIANT;

pub const FOLDER: &str = "\\SYNK 업무 백업";
const ROOT: &str = "\\";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Trigger { Hourly, Logon, Wake, Unlock }
impl Trigger {
    pub const ALL: [Trigger; 4] = [Trigger::Hourly, Trigger::Logon, Trigger::Wake, Trigger::Unlock];
    pub fn arg(self) -> &'static str { match self { Trigger::Hourly => "hourly", Trigger::Logon => "logon", Trigger::Wake => "wake", Trigger::Unlock => "unlock" } }
    pub fn label(self) -> &'static str { match self { Trigger::Hourly => "매시간", Trigger::Logon => "로그온", Trigger::Wake => "깨어남", Trigger::Unlock => "잠금 해제" } }
}

/// Characters Task Scheduler refuses in a task name are dropped; at most 40 characters.
pub fn user_label(name: &str) -> String {
    let clean: String = name.chars().filter(|c| !matches!(c, '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|') && !c.is_control()).take(40).collect();
    if clean.trim().is_empty() { "사용자".into() } else { clean.trim().to_string() }
}
pub fn task_name(user: &str, trigger: Trigger) -> String { format!("회차 - {} - {}", user_label(user), trigger.label()) }

fn escape(text: &str) -> String {
    text.chars().map(|c| match c { '&' => "&amp;".into(), '<' => "&lt;".into(), '>' => "&gt;".into(), '"' => "&quot;".into(), '\'' => "&apos;".into(), c => c.to_string() }).collect()
}

/// Task XML (schema 1.2). `sid` is the signed-in user's SID; `start` is a local
/// `YYYY-MM-DDTHH:MM:SS` for the hourly trigger's first boundary.
pub fn task_xml(trigger: Trigger, exe: &Path, sid: &str, start: &str) -> Result<String, String> {
    let exe = exe.to_str().ok_or("SCHEDULE_PATH")?.trim_start_matches(r"\\?\");
    if !Path::new(exe).is_absolute() || exe.contains(['"', '\r', '\n']) { return Err("SCHEDULE_PATH".into()); }
    if !sid.starts_with("S-1-") || !sid.bytes().all(|b| b.is_ascii_digit() || b == b'-' || b == b'S') { return Err("SCHEDULE_USER".into()); }
    if start.len() != 19 || !start.bytes().enumerate().all(|(i, b)| match i { 4 | 7 => b == b'-', 10 => b == b'T', 13 | 16 => b == b':', _ => b.is_ascii_digit() }) { return Err("SCHEDULE_TIME".into()); }
    let user = escape(sid);
    let body = match trigger {
        Trigger::Hourly => format!("<TimeTrigger><Repetition><Interval>PT1H</Interval><StopAtDurationEnd>false</StopAtDurationEnd></Repetition><StartBoundary>{start}</StartBoundary><Enabled>true</Enabled></TimeTrigger>"),
        Trigger::Logon => format!("<LogonTrigger><Enabled>true</Enabled><UserId>{user}</UserId><Delay>PT2M</Delay></LogonTrigger>"),
        Trigger::Wake => escape_subscription_trigger(),
        Trigger::Unlock => format!("<SessionStateChangeTrigger><Enabled>true</Enabled><StateChange>SessionUnlock</StateChange><UserId>{user}</UserId></SessionStateChangeTrigger>"),
    };
    Ok(format!(concat!(
        "<Task version=\"1.2\" xmlns=\"http://schemas.microsoft.com/windows/2004/02/mit/task\">",
        "<RegistrationInfo><Author>SYNK 업무 백업</Author><Description>업무 백업 회차({label})</Description></RegistrationInfo>",
        "<Triggers>{body}</Triggers>",
        "<Principals><Principal id=\"Author\"><UserId>{user}</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>",
        "<Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>",
        "<StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><AllowHardTerminate>true</AllowHardTerminate><StartWhenAvailable>true</StartWhenAvailable>",
        "<RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable><IdleSettings><StopOnIdleEnd>false</StopOnIdleEnd><RestartOnIdle>false</RestartOnIdle></IdleSettings>",
        "<AllowStartOnDemand>true</AllowStartOnDemand><Enabled>true</Enabled><Hidden>false</Hidden><RunOnlyIfIdle>false</RunOnlyIfIdle><WakeToRun>false</WakeToRun>",
        "<ExecutionTimeLimit>PT72H</ExecutionTimeLimit><Priority>7</Priority></Settings>",
        "<Actions Context=\"Author\"><Exec><Command>{command}</Command><Arguments>--run {arg}</Arguments></Exec></Actions></Task>"),
        label = trigger.label(), body = body, user = user, command = escape(exe), arg = trigger.arg()))
}
fn escape_subscription_trigger() -> String {
    let query = "<QueryList><Query Id=\"0\" Path=\"System\"><Select Path=\"System\">*[System[Provider[@Name='Microsoft-Windows-Power-Troubleshooter'] and EventID=1]]</Select></Query></QueryList>";
    format!("<EventTrigger><Enabled>true</Enabled><Subscription>{}</Subscription><Delay>PT2M</Delay></EventTrigger>", escape(query))
}

/// COM for the calling thread (multithreaded); undone on drop when this call started it.
struct Com(bool);
impl Com {
    fn init() -> Result<Self, String> {
        let hr = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
        if hr.is_ok() { Ok(Com(true)) } else if hr == RPC_E_CHANGED_MODE { Ok(Com(false)) } else { Err(format!("SCHEDULE_COM:{:#x}", hr.0)) }
    }
}
impl Drop for Com { fn drop(&mut self) { if self.0 { unsafe { CoUninitialize(); } } } }

fn service() -> Result<ITaskService, String> {
    let service: ITaskService = unsafe { CoCreateInstance(&TaskScheduler, None, CLSCTX_INPROC_SERVER) }.map_err(|e| format!("SCHEDULE_SERVICE:{:#x}", e.code().0))?;
    unsafe { service.Connect(&VARIANT::default(), &VARIANT::default(), &VARIANT::default(), &VARIANT::default()) }.map_err(|e| format!("SCHEDULE_CONNECT:{:#x}", e.code().0))?;
    Ok(service)
}
fn folder(service: &ITaskService, path: &str) -> Option<ITaskFolder> { unsafe { service.GetFolder(&BSTR::from(path)) }.ok() }

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct Placement { pub folder: String, pub tasks: Vec<String> }

/// Registers (or updates) the four tasks for the current user. Tries the product folder
/// first and falls back to the root folder when that folder is missing or refuses.
pub fn register(exe: &Path, user: &str, sid: &str, start: &str) -> Result<Placement, String> {
    let _com = Com::init()?;
    let service = service()?;
    let xmls: Vec<(String, String)> = Trigger::ALL.iter().map(|t| Ok((task_name(user, *t), task_xml(*t, exe, sid, start)?))).collect::<Result<_, String>>()?;
    let mut last = String::from("SCHEDULE_FOLDER");
    for path in [FOLDER, ROOT] {
        let Some(target) = folder(&service, path) else { continue };
        let mut done = Vec::new();
        let mut failed = None;
        for (name, xml) in &xmls {
            match unsafe { target.RegisterTask(&BSTR::from(name.as_str()), &BSTR::from(xml.as_str()), TASK_CREATE_OR_UPDATE.0, &VARIANT::default(), &VARIANT::default(), TASK_LOGON_INTERACTIVE_TOKEN, &VARIANT::default()) } {
                Ok(_) => done.push(name.clone()),
                Err(e) => { failed = Some(format!("SCHEDULE_REGISTER:{:#x}", e.code().0)); break; }
            }
        }
        match failed {
            None => {
                // One place only: copies left in the other place (from a registration before the
                // installer made the folder, or before it refused) would start every run twice.
                for other in [FOLDER, ROOT].into_iter().filter(|p| *p != path) {
                    if let Some(old) = folder(&service, other) { for name in &done { if unsafe { old.GetTask(&BSTR::from(name.as_str())) }.is_ok() { let _ = unsafe { old.DeleteTask(&BSTR::from(name.as_str()), 0) }; } } }
                }
                return Ok(Placement { folder: path.into(), tasks: done });
            }
            // A half-made set is removed before trying the next folder.
            Some(code) => { for name in &done { let _ = unsafe { target.DeleteTask(&BSTR::from(name.as_str()), 0) }; } last = code; }
        }
    }
    Err(last)
}

/// Removes the four tasks of this user from both places; missing tasks are fine.
pub fn remove(user: &str) -> Result<(), String> {
    let _com = Com::init()?;
    let service = service()?;
    for path in [FOLDER, ROOT] {
        let Some(target) = folder(&service, path) else { continue };
        for t in Trigger::ALL {
            let name = task_name(user, t);
            if unsafe { target.GetTask(&BSTR::from(name.as_str())) }.is_ok() {
                unsafe { target.DeleteTask(&BSTR::from(name.as_str()), 0) }.map_err(|e| format!("SCHEDULE_DELETE:{:#x}", e.code().0))?;
            }
        }
    }
    Ok(())
}

/// The places (folder paths) that hold any of this user's run tasks.
pub fn locations(user: &str) -> Result<Vec<String>, String> {
    let _com = Com::init()?;
    let service = service()?;
    Ok([FOLDER, ROOT].into_iter().filter(|path| folder(&service, path).is_some_and(|f| Trigger::ALL.iter().any(|t| unsafe { f.GetTask(&BSTR::from(task_name(user, *t).as_str())) }.is_ok()))).map(String::from).collect())
}

/// True when all four tasks exist in one place, are enabled and start this executable
/// with their own trigger argument.
pub fn registered(exe: &Path, user: &str) -> Result<bool, String> {
    let _com = Com::init()?;
    let service = service()?;
    let command = format!("<Command>{}</Command>", escape(exe.to_str().ok_or("SCHEDULE_PATH")?.trim_start_matches(r"\\?\")));
    for path in [FOLDER, ROOT] {
        let Some(target) = folder(&service, path) else { continue };
        let all = Trigger::ALL.iter().all(|t| {
            let Ok(task) = (unsafe { target.GetTask(&BSTR::from(task_name(user, *t).as_str())) }) else { return false };
            let enabled = unsafe { task.Enabled() }.is_ok_and(|v| v == VARIANT_TRUE);
            let xml = unsafe { task.Xml() }.map(|x| x.to_string()).unwrap_or_default();
            enabled && xml.contains(&command) && xml.contains(&format!("<Arguments>--run {}</Arguments>", t.arg()))
        });
        if all { return Ok(true); }
    }
    Ok(false)
}

/// The signed-in user's SID from the process token (never from environment variables).
pub fn current_sid() -> Result<String, String> {
    use windows_sys::Win32::{Foundation::{CloseHandle, LocalFree, HANDLE}, Security::{GetTokenInformation, TokenUser, TOKEN_QUERY, TOKEN_USER, Authorization::ConvertSidToStringSidW}, System::Threading::{GetCurrentProcess, OpenProcessToken}};
    unsafe {
        let mut token: HANDLE = std::ptr::null_mut();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 { return Err("SCHEDULE_USER".into()); }
        let mut size = 0u32;
        GetTokenInformation(token, TokenUser, std::ptr::null_mut(), 0, &mut size);
        let mut buffer = vec![0u8; size as usize];
        let ok = GetTokenInformation(token, TokenUser, buffer.as_mut_ptr() as *mut _, size, &mut size) != 0;
        CloseHandle(token);
        if !ok { return Err("SCHEDULE_USER".into()); }
        let user = &*(buffer.as_ptr() as *const TOKEN_USER);
        let mut text: *mut u16 = std::ptr::null_mut();
        if ConvertSidToStringSidW(user.User.Sid, &mut text) == 0 { return Err("SCHEDULE_USER".into()); }
        let len = (0..).take_while(|&i| *text.add(i) != 0).count();
        let sid = String::from_utf16_lossy(std::slice::from_raw_parts(text, len));
        LocalFree(text as *mut _);
        Ok(sid)
    }
}

/// Local time now as `YYYY-MM-DDTHH:MM:SS` (the hourly trigger's first boundary).
pub fn local_now() -> String {
    use windows_sys::Win32::System::SystemInformation::GetLocalTime;
    let mut t = unsafe { std::mem::zeroed() };
    unsafe { GetLocalTime(&mut t) };
    let t: windows_sys::Win32::Foundation::SYSTEMTIME = t;
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}", t.wYear, t.wMonth, t.wDay, t.wHour, t.wMinute, t.wSecond)
}

#[cfg(test)] mod tests {
    use super::*;
    const SID: &str = "S-1-5-21-1111111111-2222222222-3333333333-1001";
    #[test] fn names_drop_forbidden_characters() {
        assert_eq!(task_name("유호", Trigger::Wake), "회차 - 유호 - 깨어남");
        assert_eq!(user_label("a\\b:c*d?e\"f<g>h|i/j"), "abcdefghij");
        assert_eq!(user_label("  "), "사용자");
        assert_eq!(user_label(&"x".repeat(80)).chars().count(), 40);
    }
    #[test] fn xml_has_the_promised_settings() {
        let exe = Path::new(r"C:\Program Files\SYNK WorkBackup\WorkBackupRun.exe");
        for t in Trigger::ALL {
            let xml = task_xml(t, exe, SID, "2026-11-12T22:00:00").unwrap();
            for part in ["<LogonType>InteractiveToken</LogonType>", "<RunLevel>LeastPrivilege</RunLevel>", "<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>",
                "<DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>", "<StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>", "<StartWhenAvailable>true</StartWhenAvailable>",
                "<ExecutionTimeLimit>PT72H</ExecutionTimeLimit>", "<Priority>7</Priority>", "<WakeToRun>false</WakeToRun>",
                r"<Command>C:\Program Files\SYNK WorkBackup\WorkBackupRun.exe</Command>"] { assert!(xml.contains(part), "{t:?} {part}"); }
            assert!(xml.contains(&format!("<Arguments>--run {}</Arguments>", t.arg())));
            assert!(xml.contains(&format!("<UserId>{SID}</UserId>")));
        }
        let wake = task_xml(Trigger::Wake, exe, SID, "2026-11-12T22:00:00").unwrap();
        assert!(wake.contains("Microsoft-Windows-Power-Troubleshooter") && wake.contains("EventID=1") && wake.contains("<Delay>PT2M</Delay>") && wake.contains("&lt;QueryList&gt;"));
        let hourly = task_xml(Trigger::Hourly, exe, SID, "2026-11-12T22:00:00").unwrap();
        assert!(hourly.contains("<Interval>PT1H</Interval>") && !hourly.contains("<Duration>") && hourly.contains("<StartBoundary>2026-11-12T22:00:00</StartBoundary>"));
        assert!(task_xml(Trigger::Logon, exe, SID, "2026-11-12T22:00:00").unwrap().contains("<LogonTrigger><Enabled>true</Enabled><UserId>"));
        assert!(task_xml(Trigger::Unlock, exe, SID, "2026-11-12T22:00:00").unwrap().contains("<StateChange>SessionUnlock</StateChange>"));
    }
    #[test] fn xml_refuses_bad_inputs() {
        let exe = Path::new(r"C:\Program Files\SYNK WorkBackup\WorkBackupRun.exe");
        assert!(task_xml(Trigger::Hourly, Path::new("WorkBackupRun.exe"), SID, "2026-11-12T22:00:00").is_err(), "relative path");
        assert!(task_xml(Trigger::Hourly, Path::new("C:\\a\"b\\run.exe"), SID, "2026-11-12T22:00:00").is_err(), "quote in path");
        assert!(task_xml(Trigger::Hourly, exe, "DOMAIN\\user", "2026-11-12T22:00:00").is_err(), "not a SID");
        assert!(task_xml(Trigger::Hourly, exe, SID, "2026-11-12 22:00").is_err(), "time format");
        let amp = task_xml(Trigger::Hourly, Path::new(r"C:\A & B\run.exe"), SID, "2026-11-12T22:00:00").unwrap();
        assert!(amp.contains(r"<Command>C:\A &amp; B\run.exe</Command>"));
    }
    #[test] fn sid_and_time_of_this_process() {
        assert!(current_sid().unwrap().starts_with("S-1-5-"));
        let now = local_now(); assert_eq!(now.len(), 19); assert_eq!(&now[10..11], "T");
    }
}
