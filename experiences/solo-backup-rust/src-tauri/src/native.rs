//! The native side the worker asks for (STAGE1_DESIGN.md 4.1 · 4.2): the DPAPI secret store, the engine lock, the
//! run tasks in Task Scheduler, the file and message dialogs, opening a page or a folder, and 옮겨 오기's own methods.
//! The window app (main.rs) and the windowless host SYNK 솔리오 starts (host.rs, SOLIO_ONE_CLIENT.md 2.1) share it;
//! they differ only in how an allowed page or folder is opened and in which window owns a dialog.
use crate::{platform, schedule, secret};
use serde_json::{json, Value};
use std::{collections::VecDeque, fs, num::NonZeroIsize, path::{Path, PathBuf}, sync::{Mutex, atomic::{AtomicBool, Ordering}}};

/// Opens what the allow-lists let through: `("openExternal", url)` or `("openPath", folder)`.
pub type Opener = dyn Fn(&str, &str) -> Result<(), String> + Send + Sync;
/// The window a dialog is owned by, when there is one (a raw window handle).
pub type Owner = dyn Fn() -> Option<isize> + Send + Sync;

pub struct NativeHost {
    root: PathBuf, exe: PathBuf, test: bool, packaged: bool,
    dialogs: Mutex<VecDeque<Value>>, dialog_busy: AtomicBool, engine: Mutex<Option<fs::File>>,
    open: Box<Opener>, owner: Box<Owner>,
}
impl NativeHost {
    /// `dialogs`: a test's scripted answers (scripted_dialogs). The window opens with the shell and owns no dialog
    /// (`window`); the host asks SYNK 솔리오 to open and gives its window as the owner.
    #[allow(clippy::too_many_arguments)]
    pub fn new(root: PathBuf, exe: PathBuf, test: bool, packaged: bool, dialogs: VecDeque<Value>, open: Box<Opener>, owner: Box<Owner>) -> Self {
        Self { root, exe, test, packaged, dialogs: Mutex::new(dialogs), dialog_busy: AtomicBool::new(false), engine: Mutex::new(None), open, owner }
    }
    /// The window app's own: opened by the shell here, no owner window.
    pub fn window(root: PathBuf, exe: PathBuf, test: bool, packaged: bool, dialogs: VecDeque<Value>) -> Self {
        Self::new(root, exe, test, packaged, dialogs, Box::new(|_: &str, value: &str| shell_open(value)), Box::new(|| None::<isize>))
    }
    pub fn call(&self, method: &str, args: Value) -> Result<Value, String> {
        let args = args.as_array().ok_or("HOST_REQUEST")?;
        let first = args.first().unwrap_or(&Value::Null);
        match method {
            "secret.encrypt" => Ok(json!(secret::encrypt(first.as_str().ok_or("HOST_REQUEST")?)?)),
            "secret.decrypt" => { let value = secret::decrypt(first.as_str().ok_or("HOST_REQUEST")?)?; Ok(json!(value.as_str())) }
            // The engine lock while one of the window's operations runs (STAGE1_DESIGN.md 4.1).
            "engine.lock" => {
                let mut held = self.engine.lock().unwrap();
                if held.is_some() { return Ok(json!(true)); }
                match platform::try_lock(&self.root, platform::ENGINE_LOCK)? { Some(file) => { *held = Some(file); Ok(json!(true)) } None => Ok(json!(false)) }
            }
            "engine.unlock" => { *self.engine.lock().unwrap() = None; Ok(json!(true)) }
            "run.progress" => Ok(crate::runlog::live(&self.root)),
            // The Wi-Fi this PC is on, for 「쉬는 Wi-Fi 고르기」 (4.13): read only when the window asks, never kept or logged —
            // Windows counts reading it as a location access, and without location permission it is null. Never in tests.
            "wifi.name" => Ok(if self.test { Value::Null } else { json!(crate::power::wifi_name()) }),
            // The Downloads folder wherever Windows keeps it, for 「되살린 파일」 at its default place (화면 세션 부탁 2).
            "folders.downloads" => { let id = &crate::folders::KNOWN.iter().find(|(name, _)| *name == "downloads").ok_or("FOLDERS_KNOWN")?.1; Ok(json!(crate::folders::known_folder(id)?)) }
            // 「자동 실행 등록」 is now the four run tasks in Task Scheduler (STAGE1_DESIGN.md 4.1 · 4.2).
            "startup.read" => Ok(json!(run_tasks_registered(&self.exe, self.test)?)),
            "startup.set" => Ok(json!(set_run_tasks(&self.exe, first.as_bool().ok_or("HOST_REQUEST")?, self.test, self.packaged)?)),
            "openExternal" => {
                let value = first.as_str().ok_or("HOST_REQUEST")?;
                if self.test || !(platform::oauth_allowed(value) || platform::account_page_allowed(value) || crate::reinstall::page_allowed(value)) { return Err("OPEN_FORBIDDEN".into()); }
                (self.open)(method, value)?; Ok(Value::Null)
            }
            "openPath" => {
                let value = first.as_str().ok_or("HOST_REQUEST")?;
                if self.test || !platform::open_directory_allowed(Path::new(value), &self.root) { return Err("OPEN_FORBIDDEN".into()); }
                (self.open)(method, value)?; Ok(Value::Null)
            }
            "dialog.open" | "dialog.save" | "dialog.message" => {
                if self.dialog_busy.swap(true, Ordering::SeqCst) { return Err("DIALOG_BUSY".into()); }
                let result = self.dialog(method, first); self.dialog_busy.store(false, Ordering::SeqCst); result
            }
            // 옮겨 오기 v1 · v2 (STAGE1_DESIGN.md 4.6 · 4.6b): each module answers its own methods, None for the rest.
            m if m.starts_with("files.") => crate::files::host(m, args).unwrap_or_else(|| Err("HOST_METHOD".into())),
            m if m.starts_with("folders.") => crate::folders::host(m, args).unwrap_or_else(|| Err("HOST_METHOD".into())),
            m if m.starts_with("reinstall.") => crate::reinstall::host(m, args).unwrap_or_else(|| Err("HOST_METHOD".into())),
            _ => Err("HOST_METHOD".into()),
        }
    }
    fn dialog(&self, method: &str, options: &Value) -> Result<Value, String> {
        if self.test {
            let next = self.dialogs.lock().unwrap().pop_front().ok_or("TEST_DIALOG_MISSING")?;
            if next["method"] != method { return Err("TEST_DIALOG_ORDER".into()); }
            return Ok(next["value"].clone());
        }
        // The host's dialogs sit on SYNK 솔리오's window when it gave one that is still its own (host.rs owner_window).
        let owner = (self.owner)().and_then(NonZeroIsize::new).map(OwnerWindow);
        let title = options["title"].as_str().unwrap_or("업무 백업");
        let mut dialog = rfd::FileDialog::new().set_title(title);
        if let Some(owner) = &owner { dialog = dialog.set_parent(owner); }
        match method {
            "dialog.open" => {
                let properties = options["properties"].as_array().ok_or("HOST_REQUEST")?;
                let directory = properties.contains(&json!("openDirectory")); let multi = properties.contains(&json!("multiSelections"));
                let paths = match (directory, multi) { (true, true) => dialog.pick_folders(), (true, false) => dialog.pick_folder().map(|p| vec![p]), (false, _) => dialog.add_filter("JSON", &["json"]).pick_file().map(|p| vec![p]) };
                Ok(json!({"canceled": paths.is_none(), "filePaths": paths.unwrap_or_default().iter().map(|p| p.to_string_lossy().to_string()).collect::<Vec<_>>()}))
            }
            "dialog.save" => {
                let picked = dialog.set_file_name(options["defaultPath"].as_str().unwrap_or("업무백업-복구키.json")).add_filter("JSON", &["json"]).save_file();
                Ok(json!({"canceled": picked.is_none(), "filePath": picked.map(|p| p.to_string_lossy().to_string())}))
            }
            "dialog.message" => {
                let buttons = options["buttons"].as_array().ok_or("HOST_REQUEST")?; let cancel = buttons.first().and_then(Value::as_str).ok_or("HOST_REQUEST")?;
                let confirm = buttons.get(1).and_then(Value::as_str).ok_or("HOST_REQUEST")?;
                let text = format!("{}\n\n{}", options["message"].as_str().unwrap_or(""), options["detail"].as_str().unwrap_or(""));
                // Put Cancel first: rfd/TaskDialog's first button is the default.
                // Native Escape/close yields Cancel, never a confirmation.
                let mut message = rfd::MessageDialog::new().set_title("업무 백업").set_description(text).set_buttons(rfd::MessageButtons::OkCancelCustom(cancel.into(), confirm.into()));
                if let Some(owner) = &owner { message = message.set_parent(owner); }
                let accepted = matches!(message.show(), rfd::MessageDialogResult::Custom(ref s) if s == confirm);
                Ok(json!({"response": if accepted { 1 } else { 0 }}))
            }
            _ => Err("HOST_METHOD".into()),
        }
    }
}

/// A window handle rfd takes as a dialog's owner (raw-window-handle 0.6, the Win32 kind).
struct OwnerWindow(NonZeroIsize);
impl raw_window_handle::HasWindowHandle for OwnerWindow {
    fn window_handle(&self) -> Result<raw_window_handle::WindowHandle<'_>, raw_window_handle::HandleError> {
        let raw = raw_window_handle::RawWindowHandle::Win32(raw_window_handle::Win32WindowHandle::new(self.0));
        // Checked as a live window of the host's parent just before the dialog (host.rs owner_window); a window that goes
        // meanwhile only leaves the dialog without its owner.
        Ok(unsafe { raw_window_handle::WindowHandle::borrow_raw(raw) })
    }
}
impl raw_window_handle::HasDisplayHandle for OwnerWindow {
    fn display_handle(&self) -> Result<raw_window_handle::DisplayHandle<'_>, raw_window_handle::HandleError> { Ok(raw_window_handle::DisplayHandle::windows()) }
}

/// A test's scripted dialog answers (SOLO_BACKUP_TEST_DIALOGS, 128 KB at most); none outside a test.
pub fn scripted_dialogs(test: bool) -> Result<VecDeque<Value>, String> {
    if !test { return Ok(VecDeque::new()); }
    match std::env::var_os("SOLO_BACKUP_TEST_DIALOGS") {
        Some(path) => {
            let data = fs::read(path).map_err(|_| "TEST_DIALOGS")?;
            if data.len() > 131072 { return Err("TEST_DIALOGS".into()); }
            serde_json::from_slice::<VecDeque<Value>>(&data).map_err(|_| "TEST_DIALOGS".into())
        }
        None => Ok(VecDeque::new()),
    }
}

fn run_exe(app: &Path) -> PathBuf { app.with_file_name("WorkBackupRun.exe") }
pub fn run_tasks_registered(app: &Path, test: bool) -> Result<bool, String> {
    if test { return Ok(false); }
    let sid = schedule::current_sid()?;
    schedule::registered(&run_exe(app), &schedule::account_label(&sid), &sid)
}
/// Registers or removes the run tasks. A test or unpackaged build never touches Task
/// Scheduler. 0.7.0 does not touch the Windows Run entry of the 0.6.1 beta (4.1: it neither
/// reads nor writes the earlier apps' state).
fn set_run_tasks(app: &Path, enabled: bool, test: bool, packaged: bool) -> Result<bool, String> {
    if test || !packaged { return Err("STARTUP_TEST_DISABLED".into()); }
    let (run, sid) = (run_exe(app), schedule::current_sid()?);
    let user = schedule::account_label(&sid);
    if enabled {
        if !run.is_file() { return Err("RUN_EXE_MISSING".into()); }
        schedule::register(&run, &user, &sid, &schedule::local_now())?;
    } else { schedule::remove(&user, &sid)?; }
    let active = schedule::registered(&run, &user, &sid)?;
    if active != enabled { return Err("SCHEDULE_NOT_APPLIED".into()); }
    Ok(active)
}

/// Opens a page, a folder or an address with the shell (`open`).
pub fn shell_open(value: &str) -> Result<(), String> {
    use windows_sys::Win32::UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL};
    let wide: Vec<u16> = value.encode_utf16().chain([0]).collect(); let verb: Vec<u16> = "open".encode_utf16().chain([0]).collect();
    let result = unsafe { ShellExecuteW(std::ptr::null_mut(), verb.as_ptr(), wide.as_ptr(), std::ptr::null(), std::ptr::null(), SW_SHOWNORMAL) };
    if result as isize <= 32 { Err("OPEN_FAILED".into()) } else { Ok(()) }
}
