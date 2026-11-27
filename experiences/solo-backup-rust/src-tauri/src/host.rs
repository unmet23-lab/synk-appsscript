//! SYNK 솔리오's windowless host, `WorkBackup.exe --solio` (SOLIO_ONE_CLIENT.md 2.1 · 2.6): the window app without its
//! window, web view or tray. It checks that its parent is SYNK 솔리오's PC app, holds the window lock, starts the Node
//! worker, does the native work (native.rs) and talks to its parent over standard input and output, one JSON value per
//! line. 2.6 is the canonical shape of every line, and SYNK 솔리오's side keeps the same table:
//!
//! - out: `{"hello":{"v":1,"version":…}}` first — or `{"hello":{"v":1,"busy":true}}` and the end (exit 0) while another
//!   host or the window holds the window lock; nothing at all and exit 77 when the parent check refuses; then
//!   `{"id":n,"result":<envelope>}`, `{"state":…}`, `{"ask":n,"native":"openExternal"|"openPath","arg":…}`, and
//!   `{"failed":<code>}` before exit 1. Every failure after the parent check comes after `hello`.
//! - in: `{"id":n,"call":…,"args":[…]}`, `{"answer":n,"ok":…}`, `{"window":"<handle in decimal>"}`, `{"bye":true}`.
//!
//! A line in is at most 128 KB, a line out at most 2 MB; a line with a field not in the table is dropped. The host lives
//! on past its parent (SYNK 솔리오 starts it detached), so a write that fails is ignored, never a panic (F2).
use crate::{bundle, folders, native::{self, NativeHost}, platform, protocol, update, worker::Worker};
use serde_json::{json, Value};
use std::{collections::HashMap, fs, io::{BufRead, Write}, path::{Path, PathBuf}, sync::{Arc, Mutex, atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering}}, time::{Duration, Instant}};

/// A line from SYNK 솔리오, its `\n` not counted.
pub const MAX_IN: usize = 128 * 1024;
/// A line to SYNK 솔리오, its `\n` not counted.
pub const MAX_OUT: usize = 2 * 1024 * 1024;
/// Calls at once; one more is answered `REQUEST_BUSY`.
pub const MAX_CALLS: usize = 64;
/// How long an `ask` waits for SYNK 솔리오's answer.
pub const ASK_WAIT: Duration = Duration::from_secs(30);
/// The parent check refused: nothing was written.
pub const REFUSED_EXIT: i32 = 77;
/// The table's version (`hello.v`).
pub const LINES_VERSION: u64 = 1;
/// The largest id or ask number taken: what SYNK 솔리오's JavaScript counts exactly.
const MAX_ID: u64 = (1 << 53) - 1;
const BUSY_TEXT: &str = "진행 중인 작업이 끝난 뒤 다시 눌러 주세요.";

/// SYNK 솔리오's PC app (2.6): `<local>\Programs\<one folder>\SYNKPlatform.exe` or `…\SYNKPlatformPreview.exe`, in any
/// case, where `local` is this account's local application data folder; that very file is an installed app of this
/// account (`registered`: the executables its uninstall entries name, GPT workbackup-solio-one-be-20261127 C1); and the
/// parent began before this process did, so a number left by a parent that ended and taken by another process does not
/// count.
pub fn parent_ok(image: &str, local: &str, registered: &[PathBuf], parent_began: u64, own_began: u64) -> bool {
    parent_began < own_began && parent_image_allowed(image, local) && parent_registered(image, registered)
}
/// Whether `image` is one of the executables this account's uninstall entries name — a copy of the PC app's file put in
/// another folder under `Programs` is not.
pub fn parent_registered(image: &str, registered: &[PathBuf]) -> bool {
    let plain = |s: &str| s.strip_prefix(r"\\?\").unwrap_or(s).to_lowercase();
    let image = plain(image);
    !image.is_empty() && registered.iter().any(|exe| plain(&exe.to_string_lossy()) == image)
}
/// The executable an uninstall entry's `DisplayIcon` names (electron-builder writes `<install folder>\<app>.exe,0`): the
/// value without its quotes and its `,<index>`. None for anything that is not a full path ending in `.exe`.
pub fn icon_exe(value: &str) -> Option<PathBuf> {
    let value = value.trim();
    let value = match value.rsplit_once(',') { Some((path, index)) if !index.is_empty() && index.trim_start_matches('-').bytes().all(|b| b.is_ascii_digit()) => path, _ => value };
    let value = value.trim();
    let value = value.strip_prefix('"').and_then(|v| v.strip_suffix('"')).unwrap_or(value);
    let bytes = value.as_bytes();
    let absolute = bytes.len() > 3 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' && bytes[2] == b'\\';
    (absolute && value.to_ascii_lowercase().ends_with(".exe") && !value.contains('"')).then(|| PathBuf::from(value))
}
/// SYNK 솔리오's PC app among this account's uninstall entries (GPT workbackup-solio-one-be-20261127-r2 GA4): electron-builder
/// names a per-user install's entry by UUID v5 of the app id in its own namespace (app-builder-lib NsisTarget, namespace
/// 50e065bc-3134-11e6-9bab-38c9862bdaf3), and the app ids are `im.synk.platform` and `im.synk.platform.preview`
/// (desktop/src/catalog.cjs `identity`). Each key with the executable that install puts in its folder.
/// tests/host-parent-keys.test.cjs works the two keys out again from the catalog.
pub const SOLIO_UNINSTALL: [(&str, &str); 2] = [
    ("a6c97ab2-17f9-56e4-96d9-df6ab3d732aa", "SYNKPlatform.exe"),
    ("c4ee183e-8850-55ce-9d7f-a3a1acb8c830", "SYNKPlatformPreview.exe"),
];
/// The executable one of SOLIO_UNINSTALL's entries names: its `DisplayIcon` (`icon_exe`), and only when that is the very
/// executable that entry installs. Another product's entry, or an entry that names another file, gives none.
pub fn solio_entry_exe(key: &str, icon: &str) -> Option<PathBuf> {
    let key = key.trim_matches(|c| c == '{' || c == '}');
    let (_, file) = SOLIO_UNINSTALL.iter().find(|(k, _)| k.eq_ignore_ascii_case(key))?;
    icon_exe(icon).filter(|exe| exe.file_name().is_some_and(|name| name.to_string_lossy().eq_ignore_ascii_case(file)))
}
/// The executables SYNK 솔리오's own uninstall entries under this account name (`HKCU\…\Uninstall\<SOLIO_UNINSTALL key>`,
/// their `DisplayIcon`). Empty when none can be read. No other product's entry is read.
fn registered_apps() -> Vec<PathBuf> {
    use windows_sys::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_SZ};
    let wide = |s: &str| s.encode_utf16().chain([0]).collect::<Vec<u16>>();
    let value = wide("DisplayIcon");
    let mut found = Vec::new();
    for (key, _) in SOLIO_UNINSTALL {
        let path = wide(&format!(r"Software\Microsoft\Windows\CurrentVersion\Uninstall\{key}"));
        let mut buffer = vec![0u16; 2048];
        let mut size = (buffer.len() * 2) as u32;
        if unsafe { RegGetValueW(HKEY_CURRENT_USER, path.as_ptr(), value.as_ptr(), RRF_RT_REG_SZ, std::ptr::null_mut(), buffer.as_mut_ptr().cast(), &mut size) } != 0 { continue; }
        let text = &buffer[..(size as usize / 2).min(buffer.len())];
        let text = text.iter().position(|c| *c == 0).map_or(text, |end| &text[..end]);
        if let Some(exe) = String::from_utf16(text).ok().as_deref().and_then(|icon| solio_entry_exe(key, icon)) { found.push(exe); }
    }
    found
}
pub fn parent_image_allowed(image: &str, local: &str) -> bool {
    let plain = |s: &str| s.strip_prefix(r"\\?\").unwrap_or(s).to_lowercase();
    let (image, local) = (plain(image), plain(local));
    let local = local.trim_end_matches('\\');
    if local.len() < 3 { return false; }
    let Some(rest) = image.strip_prefix(&format!("{local}\\programs\\")) else { return false };
    let mut parts = rest.split('\\');
    let (Some(folder), Some(file), None) = (parts.next(), parts.next(), parts.next()) else { return false };
    !folder.is_empty() && folder != "." && folder != ".." && !folder.contains('/') && matches!(file, "synkplatform.exe" | "synkplatformpreview.exe")
}

/// One line from SYNK 솔리오, as 2.6 has it.
#[derive(Debug, Clone, PartialEq)]
pub enum Incoming {
    Call { id: u64, method: String, args: Value },
    Answer { ask: u64, ok: bool },
    Window(isize),
    Bye,
}
/// The line read as one of the table's, or none: not one JSON object, a field not in the table or one missing, a value
/// of the wrong kind, an id below 1, or a line over 128 KB. The method and its arguments are checked when the call is
/// answered (`gate`), so a call to a method not on the list is still answered.
pub fn parse_line(bytes: &[u8]) -> Option<Incoming> {
    if bytes.len() > MAX_IN { return None; }
    let value: Value = serde_json::from_slice(bytes).ok()?;
    let map = value.as_object()?;
    let mut keys: Vec<&str> = map.keys().map(String::as_str).collect();
    keys.sort_unstable();
    let number = |v: &Value| v.as_u64().filter(|n| (1..=MAX_ID).contains(n));
    match keys.as_slice() {
        ["args", "call", "id"] => {
            let args = &map["args"];
            if !args.is_array() { return None; }
            Some(Incoming::Call { id: number(&map["id"])?, method: map["call"].as_str()?.to_owned(), args: args.clone() })
        }
        ["answer", "ok"] => Some(Incoming::Answer { ask: number(&map["answer"])?, ok: map["ok"].as_bool()? }),
        ["window"] => {
            let text = map["window"].as_str()?;
            if text.is_empty() || text.len() > 20 || !text.bytes().all(|b| b.is_ascii_digit()) { return None; }
            let handle = isize::try_from(text.parse::<u64>().ok()?).ok().filter(|h| *h != 0)?;
            Some(Incoming::Window(handle))
        }
        ["bye"] if map["bye"] == true => Some(Incoming::Bye),
        _ => None,
    }
}

/// What reading one line gave.
#[derive(Debug, PartialEq, Eq)]
pub enum Line { Text(Vec<u8>), TooLong, End }
/// One line of at most `limit` bytes before its `\n`. A longer one is read through to its end and given as `TooLong`, so
/// the next line is read whole; nothing longer than `limit` is ever held. The end of the input, a part line before it
/// or a read that fails is `End`.
pub fn read_line(reader: &mut impl BufRead, limit: usize) -> Line {
    let (mut line, mut over) = (Vec::new(), false);
    loop {
        let Ok(available) = reader.fill_buf() else { return Line::End };
        if available.is_empty() { return Line::End; }
        let end = available.iter().position(|b| *b == b'\n');
        let part = &available[..end.unwrap_or(available.len())];
        if !over && line.len() + part.len() > limit { over = true; line = Vec::new(); }
        if !over { line.extend_from_slice(part); }
        let used = end.map_or(available.len(), |i| i + 1);
        reader.consume(used);
        if end.is_some() { return if over { Line::TooLong } else { Line::Text(line) }; }
    }
}

/// The one writer of standard output: one whole line at a time, under its lock.
pub struct Out { sink: Mutex<Box<dyn Write + Send>> }
impl Out {
    pub fn new(sink: Box<dyn Write + Send>) -> Self { Self { sink: Mutex::new(sink) } }
    /// Writes `value` as one line. False when it is not sent because it is over 2 MB. A write that fails — SYNK 솔리오
    /// gone — is ignored: the host goes on with its work (F2).
    pub fn send(&self, value: &Value) -> bool {
        let Ok(mut bytes) = serde_json::to_vec(value) else { return false };
        if bytes.len() > MAX_OUT { return false; }
        bytes.push(b'\n');
        let mut sink = self.sink.lock().unwrap_or_else(|e| e.into_inner());
        let _ = sink.write_all(&bytes);
        let _ = sink.flush();
        true
    }
}

/// The opens handed to SYNK 솔리오 (`ask`), each waiting for its answer.
#[derive(Default)]
pub struct Asks { next: AtomicU64, waiting: Mutex<HashMap<u64, std::sync::mpsc::SyncSender<bool>>>, closed: AtomicBool }
impl Asks {
    /// Hands one open to SYNK 솔리오 and waits up to `wait` for its answer. Anything but a 「yes」 in time is OPEN_FAILED:
    /// a 「no」, no answer, `bye`, the input closed, or the line not sent.
    pub fn ask(&self, out: &Out, native: &str, arg: &str, wait: Duration) -> Result<(), String> {
        let (tx, rx) = std::sync::mpsc::sync_channel(1);
        let number = self.next.fetch_add(1, Ordering::SeqCst) + 1;
        {
            let mut waiting = self.waiting.lock().unwrap_or_else(|e| e.into_inner());
            if self.closed.load(Ordering::SeqCst) { return Err("OPEN_FAILED".into()); }
            waiting.insert(number, tx);
        }
        let answer = if out.send(&json!({"ask": number, "native": native, "arg": arg})) { rx.recv_timeout(wait).unwrap_or(false) } else { false };
        self.waiting.lock().unwrap_or_else(|e| e.into_inner()).remove(&number);
        if answer { Ok(()) } else { Err("OPEN_FAILED".into()) }
    }
    /// SYNK 솔리오's answer; one to no waiting ask is dropped.
    pub fn answer(&self, number: u64, ok: bool) {
        if let Some(tx) = self.waiting.lock().unwrap_or_else(|e| e.into_inner()).remove(&number) { let _ = tx.try_send(ok); }
    }
    /// `bye` or the input closed: every waiting ask ends as not opened, and no new one is handed over.
    pub fn close(&self) {
        let mut waiting = self.waiting.lock().unwrap_or_else(|e| e.into_inner());
        self.closed.store(true, Ordering::SeqCst);
        for (_, tx) in waiting.drain() { let _ = tx.try_send(false); }
    }
}

/// A failure code as a `failed` line carries it: capitals, digits and underscores, 2 to 64 of them — the part before a `:`
/// detail, or `HOST_FAILED` for anything else.
pub fn failure_code(code: &str) -> String {
    let word = code.split(':').next().unwrap_or("");
    // Two characters at least, so a drive letter before a path's `:` is never taken for a code.
    let plain = (2..=64).contains(&word.len()) && word.bytes().all(|b| b.is_ascii_uppercase() || b.is_ascii_digit() || b == b'_');
    if plain { word.to_owned() } else { "HOST_FAILED".to_owned() }
}

/// A job the host finishes before it ends (2.1 「끝」): any profile's job (a first backup, a restore, a move) or programs
/// being installed (다시 깔기). A scheduled run's progress the worker shows as a profile's job (`scheduled: true`,
/// handlers.cjs withRun) is the run executable's, not the host's: the host does not wait for it, so it does not keep the
/// window lock from a host SYNK 솔리오 starts again (GPT workbackup-solio-one-be-20261127 C3).
/// A recommended backup or restore going (`recommended.busy`) is waited for too (Fable 설계 검토 호스트끝 F4).
pub fn working(state: &Value) -> bool {
    state["profiles"].as_object().is_some_and(|p| p.values().any(|s| !s["job"].is_null() && s["job"]["scheduled"] != true)) || state["move"]["reinstall"]["running"] == true
        || state["recommended"]["busy"] == true
}

/// Whether the end still waits before the worker stops: a call not answered yet — by the host to SYNK 솔리오, or by the
/// worker to the host even after its caller's time limit (`Worker::unanswered`) — or a job going (`working`).
pub fn ending_waits(calls_open: usize, state: &Value) -> bool { calls_open > 0 || working(state) }

/// The end's limits (SOLIO_ONE_CLIENT.md 2.1 「끝」 한계 잣대): a job is waited for to its end; a call is waited for to its
/// method's time limit and this margin past it, or past the end's start when that comes later; a call to a method with no
/// time limit, and one whose caller already gave up, for the end's own limit below.
pub const END_MARGIN: Duration = Duration::from_secs(60);
pub const END_NO_LIMIT: Duration = Duration::from_secs(600);
/// Until when the end waits for the calls open now (each one's start and its method's limit in ms, 0 for none).
/// `abandoned`: the worker still owes an answer to a call whose caller gave up at its time limit — the end's own limit.
/// Counted again on every step, so a long call that answers early no longer holds the end (GPT -r4 GA1).
pub fn end_deadline(begun: Instant, open: &[(Instant, u64)], abandoned: bool) -> Instant {
    let base = if abandoned { begun + END_NO_LIMIT } else { begun + END_MARGIN };
    open.iter().fold(base, |at, (start, limit)| {
        let own = if *limit == 0 { begun + END_NO_LIMIT } else { (*start + Duration::from_millis(*limit)).max(begun) + END_MARGIN };
        at.max(own)
    })
}
/// The end's next step: wait, stop the worker (nothing left), or cut it (a call past the deadline, no job going).
#[derive(Debug, PartialEq, Eq)]
pub enum EndStep { Wait, Stop, Cut }
pub fn end_step(calls_open: usize, state: &Value, now: Instant, deadline: Instant) -> EndStep {
    if working(state) { return EndStep::Wait; }
    if calls_open == 0 { return EndStep::Stop; }
    if now < deadline { EndStep::Wait } else { EndStep::Cut }
}

/// The checks of the window's backup_call before a call goes to the worker: the method list, the host's end, the
/// restore-only rule. The method's time limit, or the envelope that answers the call at once.
pub fn gate(method: &str, args: &Value, closing: bool, state: &Value) -> Result<u64, Value> {
    if !protocol::request_allowed(method, args) { return Err(json!({"ok": false, "error": "이 화면에서는 실행할 수 없습니다.", "code": "INVALID_REQUEST"})); }
    if closing { return Err(json!({"ok": false, "error": BUSY_TEXT, "code": "JOB_BUSY"})); }
    let policy = &protocol::methods()[method];
    let read_only = state["readOnly"] == true || state["mode"] == "restore";
    if read_only && !policy.allowed_read_only { return Err(json!({"ok": false, "error": "복구 전용 연결입니다.", "code": "READ_ONLY"})); }
    Ok(policy.timeout_ms)
}

/// The parent process, held open while the host runs so its number is not given to another process meanwhile.
struct Parent { pid: u32, handle: windows_sys::Win32::Foundation::HANDLE, image: String, began: u64 }
impl Drop for Parent { fn drop(&mut self) { unsafe { windows_sys::Win32::Foundation::CloseHandle(self.handle); } } }
/// When a process began, in 100 ns since 1601.
fn began(process: windows_sys::Win32::Foundation::HANDLE) -> Option<u64> {
    use windows_sys::Win32::{Foundation::FILETIME, System::Threading::GetProcessTimes};
    let zero = FILETIME { dwLowDateTime: 0, dwHighDateTime: 0 };
    let (mut created, mut exited, mut kernel, mut user) = (zero, zero, zero, zero);
    if unsafe { GetProcessTimes(process, &mut created, &mut exited, &mut kernel, &mut user) } == 0 { return None; }
    Some((u64::from(created.dwHighDateTime) << 32) | u64::from(created.dwLowDateTime))
}
/// This process's parent: its number from a process snapshot, opened for limited query, its image's full path and when it
/// began. None when any of them cannot be read.
fn parent_process() -> Option<Parent> {
    use windows_sys::Win32::{Foundation::{CloseHandle, INVALID_HANDLE_VALUE}, System::{Diagnostics::ToolHelp::*, Threading::{GetCurrentProcessId, OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION}}};
    let me = unsafe { GetCurrentProcessId() };
    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
    if snapshot == INVALID_HANDLE_VALUE || snapshot.is_null() { return None; }
    let mut entry: PROCESSENTRY32W = unsafe { std::mem::zeroed() };
    entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
    let mut pid = None;
    let mut more = unsafe { Process32FirstW(snapshot, &mut entry) } != 0;
    while more {
        if entry.th32ProcessID == me { pid = Some(entry.th32ParentProcessID); break; }
        more = unsafe { Process32NextW(snapshot, &mut entry) } != 0;
    }
    unsafe { CloseHandle(snapshot); }
    let pid = pid.filter(|p| *p != 0)?;
    let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
    if handle.is_null() { return None; }
    let mut parent = Parent { pid, handle, image: String::new(), began: 0 };
    let mut buffer = vec![0u16; 32768];
    let mut size = buffer.len() as u32;
    if unsafe { QueryFullProcessImageNameW(parent.handle, 0, buffer.as_mut_ptr(), &mut size) } == 0 { return None; }
    parent.image = String::from_utf16(&buffer[..size as usize]).ok()?;
    parent.began = began(parent.handle)?;
    Some(parent)
}
fn own_began() -> Option<u64> { began(unsafe { windows_sys::Win32::System::Threading::GetCurrentProcess() }) }

/// Whether a window SYNK 솔리오 gave is still a window of the host's parent: only then does it own a dialog (F11).
fn owner_window(handle: isize, parent: u32) -> bool {
    use windows_sys::Win32::UI::WindowsAndMessaging::{GetWindowThreadProcessId, IsWindow};
    if parent == 0 { return false; }
    let hwnd = handle as windows_sys::Win32::Foundation::HWND;
    let mut pid = 0u32;
    unsafe { IsWindow(hwnd) != 0 && GetWindowThreadProcessId(hwnd, &mut pid) != 0 && pid == parent }
}

/// `WorkBackup.exe --solio`; its exit code. `test` (a debug build's `--test-mode`) skips the parent check and keeps the
/// state, dialogs and Task Scheduler of a test, as the window's test mode does.
pub fn serve(test: bool) -> i32 {
    let test = test && cfg!(debug_assertions);
    let parent = parent_process();
    if !test {
        let local = folders::KNOWN.iter().find(|(name, _)| *name == "local").and_then(|(_, id)| folders::known_folder(id).ok());
        let allowed = match (&parent, local, own_began()) { (Some(p), Some(local), Some(own)) => parent_ok(&p.image, &local.to_string_lossy(), &registered_apps(), p.began, own), _ => false };
        if !allowed { return REFUSED_EXIT; }
    }
    let parent_pid = parent.as_ref().map_or(0, |p| p.pid);
    let out = Arc::new(Out::new(Box::new(std::io::stdout())));
    let failed = |out: &Out, code: &str| { out.send(&json!({"failed": failure_code(code)})); 1 };
    let exe = match std::env::current_exe() { Ok(exe) => exe, Err(_) => { hello(&out, &PathBuf::new()); return failed(&out, "EXECUTABLE"); } };
    let root = match platform::state_dir(test) { Ok(root) => root, Err(code) => { hello(&out, &exe); return failed(&out, &code); } };
    // The window lock, without waking the window that may hold it (platform::state_root would): SYNK 솔리오 shows the
    // job's progress from the status file meanwhile and tries again (2.4).
    let lock = match platform::try_lock(&root, platform::UI_LOCK) {
        Ok(Some(lock)) => lock,
        Ok(None) => { out.send(&json!({"hello": {"v": LINES_VERSION, "busy": true}})); return 0; }
        Err(code) => { hello(&out, &exe); return failed(&out, &code); }
    };
    hello(&out, &exe);
    let resources = bundle::resources_dir(&exe);
    if let Err(code) = bundle::start_check(&exe, &resources) { return failed(&out, &code); }
    if root.join("migration-incomplete").exists() { return failed(&out, "MIGRATION_INCOMPLETE"); }
    let dialogs = match native::scripted_dialogs(test) { Ok(d) => d, Err(code) => return failed(&out, &code) };
    let asks = Arc::new(Asks::default());
    let owner: Arc<Mutex<Option<isize>>> = Arc::default();
    let (ask_out, ask_list, owner_seen) = (out.clone(), asks.clone(), owner.clone());
    let native = Arc::new(NativeHost::new(root.clone(), exe.clone(), test, !cfg!(debug_assertions), dialogs,
        Box::new(move |method: &str, value: &str| ask_list.ask(&ask_out, method, value, ASK_WAIT)),
        Box::new(move || (*owner_seen.lock().unwrap_or_else(|e| e.into_inner())).filter(|h| owner_window(*h, parent_pid)))));
    let native_end = native.clone();
    let current = Arc::new(Mutex::new(Value::Null));
    let (published, state_out, failure_out, failure_root) = (current.clone(), out.clone(), out.clone(), root.clone());
    let worker = Worker::start(&resources, &root, lock, test, false, Arc::new(move |name, args| native.call(name, args)), Arc::new(move |value| {
        *published.lock().unwrap_or_else(|e| e.into_inner()) = value.clone();
        state_out.send(&json!({"state": value}));
    }), Arc::new(move |code| {
        let _ = fs::write(failure_root.join("native-error.txt"), code);
        failure_out.send(&json!({"failed": failure_code(code)}));
        std::process::exit(1);
    }));
    let worker = match worker { Ok(worker) => worker, Err(code) => return failed(&out, &code) };
    let Ok(runtime) = tokio::runtime::Builder::new_current_thread().enable_time().build() else { worker.terminate(); return failed(&out, "RUNTIME") };
    match runtime.block_on(worker.call("$boot", json!([]), 120_000)) {
        Ok(initial) => { *current.lock().unwrap_or_else(|e| e.into_inner()) = initial.clone(); out.send(&json!({"state": initial})); }
        Err(code) => { worker.terminate(); return failed(&out, &code); }
    }
    let (lines, mut incoming) = tokio::sync::mpsc::unbounded_channel::<Incoming>();
    let (reader_asks, reader_owner) = (asks.clone(), owner.clone());
    // Answers and the owner window are taken here at once, so an ask waiting on a worker's host thread is never held up
    // behind calls; calls go to the loop below. After `bye` the input is read on to its end and dropped.
    std::thread::spawn(move || {
        let stdin = std::io::stdin();
        let mut reader = stdin.lock();
        let mut open = true;
        loop {
            match read_line(&mut reader, MAX_IN) {
                Line::End => { reader_asks.close(); return; }
                Line::TooLong => {}
                Line::Text(bytes) if open => match parse_line(&bytes) {
                    Some(Incoming::Answer { ask, ok }) => reader_asks.answer(ask, ok),
                    Some(Incoming::Window(handle)) => if owner_window(handle, parent_pid) { *reader_owner.lock().unwrap_or_else(|e| e.into_inner()) = Some(handle); },
                    Some(Incoming::Bye) => { reader_asks.close(); open = false; let _ = lines.send(Incoming::Bye); }
                    Some(call) => { let _ = lines.send(call); }
                    None => {}
                },
                Line::Text(_) => {}
            }
        }
    });
    let calls = Arc::new(AtomicUsize::new(0));
    let closing = Arc::new(AtomicBool::new(false));
    // Each call going to the worker: when it began and its method's time limit, for the end's deadline.
    let open: Arc<Mutex<HashMap<u64, (Instant, u64)>>> = Arc::default();
    let mut next_open = 0u64;
    let stopped = runtime.block_on(async {
        // The channel ends with the input (its sender goes with the reader) or at `bye`.
        while let Some(Incoming::Call { id, method, args }) = incoming.recv().await {
            if calls.fetch_add(1, Ordering::SeqCst) >= MAX_CALLS {
                calls.fetch_sub(1, Ordering::SeqCst);
                out.send(&json!({"id": id, "result": {"ok": false, "error": BUSY_TEXT, "code": "REQUEST_BUSY"}}));
                continue;
            }
            // Checked as it arrives, so a call read before `bye` runs even when the end begins before its task does.
            let checked = gate(&method, &args, closing.load(Ordering::SeqCst), &current.lock().unwrap_or_else(|e| e.into_inner()));
            let (worker, out, calls, open) = (worker.clone(), out.clone(), calls.clone(), open.clone());
            next_open += 1;
            let key = next_open;
            if let Ok(timeout) = checked { open.lock().unwrap_or_else(|e| e.into_inner()).insert(key, (Instant::now(), timeout)); }
            tokio::spawn(async move {
                let result = match checked {
                    Err(refused) => refused,
                    Ok(timeout) => match worker.call(&method, args, timeout).await { Ok(value) => value, Err(code) => json!({"ok": false, "error": BUSY_TEXT, "code": code}) },
                };
                open.lock().unwrap_or_else(|e| e.into_inner()).remove(&key);
                if !out.send(&json!({"id": id, "result": result})) {
                    out.send(&json!({"id": id, "result": {"ok": false, "error": "결과가 너무 커서 보내지 못했습니다.", "code": "PAYLOAD_TOO_LARGE"}}));
                }
                calls.fetch_sub(1, Ordering::SeqCst);
            });
        }
        // The end (2.1 「끝」 and its limits): a job going is finished first — SYNK 솔리오 may be gone meanwhile; a host it
        // starts again finds the lock held and says `busy`. Every call still unanswered ends first too, so a write like
        // moveRestoreSettings is never cut half way (GPT workbackup-solio-one-be-20261127 C2), within end_deadline.
        closing.store(true, Ordering::SeqCst);
        let begun = Instant::now();
        // From here a dialog asked for answers canceled without showing, also one a call already going asks for while
        // the worker answers `$ending` below (GPT -r5 GA2).
        native_end.close_dialogs();
        // What waits for a person ends here: the worker stops its own timers (no new setup request, account look or
        // recovery check is taken up), ends a Google sign-in's browser wait (a code already received is still exchanged and
        // saved, r2 GA1) and the first range's finding (`$ending`); the host closes its own open dialogs (Fable 설계 검토
        // 호스트끝 F1 · F2).
        let _ = worker.call("$ending", json!([]), 10_000).await;
        native_end.close_dialogs();
        // A call whose caller gave up at its time limit is still counted until the worker answers it: the worker may
        // still be writing (r2 GA5). It has left `open`, so it shows as more unanswered requests than open calls.
        loop {
            // A dialog that was on its way to the screen as the end began is closed on the next step (GPT -r4 GA3).
            native_end.close_dialogs();
            let unanswered = worker.unanswered();
            let open_calls = open.lock().unwrap_or_else(|e| e.into_inner()).values().copied().collect::<Vec<_>>();
            let deadline = end_deadline(begun, &open_calls, unanswered > open_calls.len());
            let open_now = calls.load(Ordering::SeqCst) + unanswered;
            let step = end_step(open_now, &current.lock().unwrap_or_else(|e| e.into_inner()), Instant::now(), deadline);
            match step {
                EndStep::Wait => tokio::time::sleep(Duration::from_millis(200)).await,
                EndStep::Stop => return worker.stop().await.map(|()| true),
                EndStep::Cut => {
                    // Past every limit with no job going: the worker is cut, and why is left beside the state (as a worker
                    // that failed leaves its code).
                    // Cut as an end the host chose: the worker's output closing is not read as WORKER_EXIT, which would
                    // write over this line (GPT -r4 GA5).
                    let _ = fs::write(root.join("native-error.txt"), format!("END_LIMIT:{open_now}"));
                    worker.cut();
                    return Ok(false);
                }
            }
        }
    });
    match stopped { Ok(true) => 0, _ => 1 }
}
/// The first line: the table's version and this app's own (its file's product version, as update.rs reads it).
fn hello(out: &Out, exe: &Path) {
    let version = update::installed_version(exe).unwrap_or_else(|| env!("CARGO_PKG_VERSION").to_owned());
    out.send(&json!({"hello": {"v": LINES_VERSION, "version": version}}));
}

/// SYNK 솔리오's address (2.5): its PC app registers `synk-solio:` for this account with `setAsDefaultProtocolClient`.
pub const SOLIO_KEY: &str = r"Software\Classes\synk-solio\shell\open\command";
/// The executable a registered `shell\open\command` value starts: the first part, in quotes or up to the first space.
/// None for anything that is not a full path ending in `.exe`.
pub fn command_exe(command: &str) -> Option<PathBuf> {
    let command = command.trim_start();
    let exe = match command.strip_prefix('"') { Some(rest) => &rest[..rest.find('"')?], None => command.split_whitespace().next()? };
    let bytes = exe.as_bytes();
    let absolute = bytes.len() > 3 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' && bytes[2] == b'\\';
    (absolute && exe.to_ascii_lowercase().ends_with(".exe") && !exe.contains('"')).then(|| PathBuf::from(exe))
}
/// Whether SYNK 솔리오 is here for this account: its `synk-solio:` command is registered and names an executable that is there.
pub fn solio_present() -> bool {
    read_command(SOLIO_KEY).as_deref().and_then(command_exe).is_some_and(|exe| exe.is_file())
}
/// The default value of a key under this account's registry, as text.
fn read_command(key: &str) -> Option<String> {
    use windows_sys::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_SZ};
    let key: Vec<u16> = key.encode_utf16().chain([0]).collect();
    let mut buffer = vec![0u16; 4096];
    let mut size = (buffer.len() * 2) as u32;
    let status = unsafe { RegGetValueW(HKEY_CURRENT_USER, key.as_ptr(), std::ptr::null(), RRF_RT_REG_SZ, std::ptr::null_mut(), buffer.as_mut_ptr().cast(), &mut size) };
    if status != 0 { return None; }
    let length = (size as usize / 2).min(buffer.len());
    let text = &buffer[..length];
    let text = text.iter().position(|c| *c == 0).map_or(text, |end| &text[..end]);
    String::from_utf16(text).ok()
}
/// `synk-solio:backup?topic=<word>` for one of the notice words (notify::TOPICS).
pub fn solio_address(topic: &str) -> Option<String> {
    crate::notify::TOPICS.contains(&topic).then(|| format!("synk-solio:backup?topic={topic}"))
}
/// Opens SYNK 솔리오's backup room on `topic`'s screen. SYNK 솔리오 may bring its window to the front: this start came from
/// a person (a click, a shortcut), so it may hand that right on.
pub fn open_solio(topic: &str) -> Result<(), String> {
    let address = solio_address(topic).ok_or("OPEN_FORBIDDEN")?;
    unsafe { windows_sys::Win32::UI::WindowsAndMessaging::AllowSetForegroundWindow(windows_sys::Win32::UI::WindowsAndMessaging::ASFW_ANY); }
    native::shell_open(&address)
}

#[cfg(test)] mod tests {
    use super::*;
    use std::io::Cursor;
    const LOCAL: &str = r"C:\Users\Kim\AppData\Local";
    #[test] fn only_solios_pc_app_in_this_accounts_programs_folder_is_a_parent() {
        for image in [r"C:\Users\Kim\AppData\Local\Programs\SYNK Platform\SYNKPlatform.exe", r"C:\Users\Kim\AppData\Local\Programs\SYNK Platform Preview\SYNKPlatformPreview.exe",
                      r"c:\users\kim\appdata\local\programs\synk platform\synkplatform.EXE", r"\\?\C:\Users\Kim\AppData\Local\Programs\x\SYNKPlatform.exe"] {
            assert!(parent_image_allowed(image, LOCAL), "{image}");
            assert!(parent_image_allowed(image, &format!("{LOCAL}\\")), "{image} with the folder's trailing backslash");
        }
        for image in [r"C:\Users\Kim\AppData\Local\Programs\SYNKPlatform.exe", r"C:\Users\Kim\AppData\Local\Programs\a\b\SYNKPlatform.exe",
                      r"C:\Users\Kim\AppData\Local\Programs\..\SYNKPlatform.exe", r"C:\Users\Kim\AppData\Local\Programs\.\SYNKPlatform.exe",
                      r"C:\Users\Kim\AppData\Local\Programs\\SYNKPlatform.exe", r"C:\Users\Kim\AppData\Local\Programs\x\node.exe",
                      r"C:\Users\Kim\AppData\Local\Programs\x\SYNKPlatform.exe.exe", r"C:\Users\Kim\AppData\Local\Programs\x\SYNKPlatform",
                      r"C:\Users\Lee\AppData\Local\Programs\x\SYNKPlatform.exe", r"C:\Users\Kim\AppData\Roaming\Programs\x\SYNKPlatform.exe",
                      r"C:\Program Files\x\SYNKPlatform.exe", r"C:\Windows\System32\cmd.exe", r"C:\Users\Kim\AppData\Local\ProgramsX\x\SYNKPlatform.exe",
                      r"C:\Users\Kim\AppData\LocalX\Programs\x\SYNKPlatform.exe", r"\\server\share\Programs\x\SYNKPlatform.exe", ""] {
            assert!(!parent_image_allowed(image, LOCAL), "{image}");
        }
        assert!(!parent_image_allowed(r"\Programs\x\SYNKPlatform.exe", ""), "no local folder known");
        // A parent that began after this process is another process that took a gone parent's number.
        let good = r"C:\Users\Kim\AppData\Local\Programs\x\SYNKPlatform.exe";
        let registered = [PathBuf::from(good)];
        assert!(parent_ok(good, LOCAL, &registered, 10, 11));
        assert!(!parent_ok(good, LOCAL, &registered, 11, 11) && !parent_ok(good, LOCAL, &registered, 12, 11));
        assert!(!parent_ok(r"C:\x\SYNKPlatform.exe", LOCAL, &[PathBuf::from(r"C:\x\SYNKPlatform.exe")], 10, 11));
    }
    #[test] fn only_the_installed_pc_app_of_this_account_is_a_parent_not_a_copy_beside_it() {
        // GPT workbackup-solio-one-be-20261127 C1: the right name and shape in another folder under Programs is not enough.
        let installed = r"C:\Users\Kim\AppData\Local\Programs\SYNKPlatformPreview\SYNKPlatformPreview.exe";
        let copy = r"C:\Users\Kim\AppData\Local\Programs\evil\SYNKPlatformPreview.exe";
        let registered = [PathBuf::from(r"C:\Users\Kim\AppData\Local\Programs\SYNKWorldPreview\SYNKWorldPreview.exe"), PathBuf::from(installed)];
        assert!(parent_image_allowed(copy, LOCAL), "the shape alone passes");
        assert!(!parent_ok(copy, LOCAL, &registered, 10, 11), "a copy no uninstall entry names");
        assert!(parent_ok(installed, LOCAL, &registered, 10, 11));
        assert!(parent_ok(&format!(r"\\?\{}", installed.to_uppercase()), LOCAL, &registered, 10, 11), "any case, with the long-path prefix");
        assert!(!parent_ok(installed, LOCAL, &[], 10, 11), "no entry read: refused");
        // A registered program that is not the PC app is still refused by the shape.
        let world = r"C:\Users\Kim\AppData\Local\Programs\SYNKWorldPreview\SYNKWorldPreview.exe";
        assert!(!parent_ok(world, LOCAL, &registered, 10, 11));
        assert!(!parent_registered("", &[PathBuf::new()]));
    }
    #[test] fn an_uninstall_entrys_icon_names_its_executable() {
        // As electron-builder writes it on this PC (11-27): `<folder>\<app>.exe,0`.
        assert_eq!(icon_exe(r"C:\Users\Kim\AppData\Local\Programs\SYNKPlatformPreview\SYNKPlatformPreview.exe,0"), Some(PathBuf::from(r"C:\Users\Kim\AppData\Local\Programs\SYNKPlatformPreview\SYNKPlatformPreview.exe")));
        assert_eq!(icon_exe(r#""C:\a b\s.exe",-3"#), Some(PathBuf::from(r"C:\a b\s.exe")));
        assert_eq!(icon_exe(r#""C:\a b\s.exe""#), Some(PathBuf::from(r"C:\a b\s.exe")));
        assert_eq!(icon_exe(r"C:\a,b\s.exe"), Some(PathBuf::from(r"C:\a,b\s.exe")), "a comma in the folder is not an index");
        for bad in ["", "s.exe,0", r"C:\a\s.ico,0", r"C:\a\s.ico", r"\\server\s.exe,0", r#""C:\a\s.exe"#, r"C:s.exe"] { assert_eq!(icon_exe(bad), None, "{bad}"); }
    }
    #[test] fn only_solios_own_uninstall_entries_name_a_parent() {
        let preview = r"C:\Users\Kim\AppData\Local\Programs\SYNKPlatformPreview\SYNKPlatformPreview.exe";
        let release = r"C:\Users\Kim\AppData\Local\Programs\SYNKPlatform\SYNKPlatform.exe";
        assert_eq!(solio_entry_exe("c4ee183e-8850-55ce-9d7f-a3a1acb8c830", &format!("{preview},0")), Some(PathBuf::from(preview)));
        assert_eq!(solio_entry_exe("{A6C97AB2-17F9-56E4-96D9-DF6AB3D732AA}", &format!("{release},0")), Some(PathBuf::from(release)), "braces and case");
        // Another product's entry, even one that names the PC app's file (GPT workbackup-solio-one-be-20261127-r2 GA4).
        assert_eq!(solio_entry_exe("26232ff5-f9d2-5946-ba23-f2a14a3a286e", &format!("{preview},0")), None);
        // Solio's entry naming another file, or the other edition's file.
        assert_eq!(solio_entry_exe("c4ee183e-8850-55ce-9d7f-a3a1acb8c830", r"C:\Users\Kim\AppData\Local\Programs\x\Other.exe,0"), None);
        assert_eq!(solio_entry_exe("c4ee183e-8850-55ce-9d7f-a3a1acb8c830", &format!("{release},0")), None);
        assert_eq!(solio_entry_exe("a6c97ab2-17f9-56e4-96d9-df6ab3d732aa", "not a path"), None);
    }
    #[test] fn only_the_lines_of_the_table_are_taken() {
        assert_eq!(parse_line(br#"{"id":1,"call":"getState","args":[]}"#), Some(Incoming::Call { id: 1, method: "getState".into(), args: json!([]) }));
        assert_eq!(parse_line(br#"{"args":[{"a":1},2],"call":"x","id":9007199254740991}"#), Some(Incoming::Call { id: MAX_ID, method: "x".into(), args: json!([{"a":1},2]) }), "any order; the method is gated later");
        assert_eq!(parse_line(br#"{"answer":3,"ok":true}"#), Some(Incoming::Answer { ask: 3, ok: true }));
        assert_eq!(parse_line(br#"{"answer":3,"ok":false}"#), Some(Incoming::Answer { ask: 3, ok: false }));
        assert_eq!(parse_line(br#"{"window":"1311234"}"#), Some(Incoming::Window(1_311_234)));
        assert_eq!(parse_line(br#"{"bye":true}"#), Some(Incoming::Bye));
        assert_eq!(parse_line(b" {\"bye\":true}\r"), Some(Incoming::Bye), "spaces around the value");
        for bad in [&br#"{"id":1,"call":"getState","args":[],"extra":1}"#[..], br#"{"id":1,"call":"getState"}"#, br#"{"id":0,"call":"getState","args":[]}"#,
                    br#"{"id":-1,"call":"getState","args":[]}"#, br#"{"id":1.5,"call":"getState","args":[]}"#, br#"{"id":"1","call":"getState","args":[]}"#,
                    br#"{"id":9007199254740992,"call":"getState","args":[]}"#, br#"{"id":1,"call":7,"args":[]}"#, br#"{"id":1,"call":"getState","args":{}}"#,
                    br#"{"answer":1,"ok":"true"}"#, br#"{"answer":0,"ok":true}"#, br#"{"answer":1}"#, br#"{"answer":1,"ok":true,"why":"x"}"#,
                    br#"{"window":1311234}"#, br#"{"window":"0"}"#, br#"{"window":"-5"}"#, br#"{"window":"0x1f"}"#, br#"{"window":" 12"}"#, br#"{"window":""}"#,
                    br#"{"window":"99999999999999999999"}"#, br#"{"window":"123456789012345678901"}"#, br#"{"window":"1","bye":true}"#,
                    br#"{"bye":false}"#, br#"{"bye":1}"#, br#"{"bye":true,"now":true}"#, br#"{}"#, br#"[]"#, br#""bye""#, b"not json", b"", br#"{"hello":{"v":1}}"#] {
            assert_eq!(parse_line(bad), None, "{}", String::from_utf8_lossy(bad));
        }
        // 128 KB at most: a call padded to the limit is taken, one byte more is not.
        let padded = |n: usize| format!(r#"{{"id":1,"call":"getState","args":["{}"]}}"#, "x".repeat(n));
        let fits = MAX_IN - padded(0).len();
        assert!(parse_line(padded(fits).as_bytes()).is_some());
        assert_eq!(parse_line(padded(fits + 1).as_bytes()), None);
    }
    #[test] fn a_line_over_the_limit_is_read_through_and_the_next_one_is_whole() {
        let mut input = Cursor::new(b"abc\n0123456789\nde\nxyz".to_vec());
        assert_eq!(read_line(&mut input, 5), Line::Text(b"abc".to_vec()));
        assert_eq!(read_line(&mut input, 5), Line::TooLong);
        assert_eq!(read_line(&mut input, 5), Line::Text(b"de".to_vec()));
        assert_eq!(read_line(&mut input, 5), Line::End, "a part line at the end is not a line");
        assert_eq!(read_line(&mut input, 5), Line::End);
        // Exactly the limit is a line; a long line across many small reads is still read through.
        let mut input = std::io::BufReader::with_capacity(2, Cursor::new(b"12345\n123456789012\n\nok\n".to_vec()));
        assert_eq!(read_line(&mut input, 5), Line::Text(b"12345".to_vec()));
        assert_eq!(read_line(&mut input, 5), Line::TooLong);
        assert_eq!(read_line(&mut input, 5), Line::Text(vec![]));
        assert_eq!(read_line(&mut input, 5), Line::Text(b"ok".to_vec()));
        assert_eq!(read_line(&mut input, 5), Line::End);
    }
    /// A sink the test reads back, and one that always fails (SYNK 솔리오 gone).
    #[derive(Clone, Default)] struct Shared(Arc<Mutex<Vec<u8>>>);
    impl Write for Shared { fn write(&mut self, b: &[u8]) -> std::io::Result<usize> { self.0.lock().unwrap().extend_from_slice(b); Ok(b.len()) } fn flush(&mut self) -> std::io::Result<()> { Ok(()) } }
    struct Broken;
    impl Write for Broken { fn write(&mut self, _: &[u8]) -> std::io::Result<usize> { Err(std::io::ErrorKind::BrokenPipe.into()) } fn flush(&mut self) -> std::io::Result<()> { Err(std::io::ErrorKind::BrokenPipe.into()) } }
    fn lines(sink: &Shared) -> Vec<Value> { String::from_utf8(sink.0.lock().unwrap().clone()).unwrap().lines().map(|l| serde_json::from_str(l).unwrap()).collect() }
    #[test] fn a_line_out_is_whole_at_most_2_mb_and_a_failed_write_is_no_panic() {
        let sink = Shared::default();
        let out = Out::new(Box::new(sink.clone()));
        assert!(out.send(&json!({"state": {"a": 1}})));
        let padded = |n: usize| json!({"state": "x".repeat(n)});
        let fits = MAX_OUT - serde_json::to_vec(&padded(0)).unwrap().len();
        assert!(out.send(&padded(fits)), "2 MB exactly");
        assert!(!out.send(&padded(fits + 1)), "one byte more is not sent");
        let all = sink.0.lock().unwrap().clone();
        assert_eq!(all.iter().filter(|b| **b == b'\n').count(), 2, "two lines, each with its end");
        assert!(all.ends_with(b"\"}\n"));
        assert_eq!(lines(&sink)[0], json!({"state": {"a": 1}}));
        let broken = Out::new(Box::new(Broken));
        assert!(broken.send(&json!({"state": 1})), "a write that fails is let go");
        // Many threads at once: every line arrives whole.
        let sink = Shared::default();
        let out = Arc::new(Out::new(Box::new(sink.clone())));
        let threads: Vec<_> = (0..8).map(|t| { let out = out.clone(); std::thread::spawn(move || for i in 0..50 { out.send(&json!({"id": t * 100 + i, "result": {"ok": true, "value": "y".repeat(3000)}})); }) }).collect();
        for t in threads { t.join().unwrap(); }
        assert_eq!(lines(&sink).len(), 400);
    }
    #[test] fn an_ask_waits_for_its_answer_and_ends_unopened_on_no_or_bye_or_no_answer() {
        let sink = Shared::default();
        let out = Arc::new(Out::new(Box::new(sink.clone())));
        let asks = Arc::new(Asks::default());
        // Answered yes: the line went out, then the answer came.
        let answering = { let (asks, sink) = (asks.clone(), sink.clone()); std::thread::spawn(move || {
            for _ in 0..200 { if let Some(n) = lines(&sink).iter().rev().find_map(|l| l["ask"].as_u64()) { asks.answer(n, true); return; } std::thread::sleep(Duration::from_millis(10)); }
        }) };
        assert_eq!(asks.ask(&out, "openExternal", "https://accounts.google.com/o/oauth2/v2/auth?x=1", Duration::from_secs(5)), Ok(()));
        answering.join().unwrap();
        assert_eq!(lines(&sink)[0], json!({"ask": 1, "native": "openExternal", "arg": "https://accounts.google.com/o/oauth2/v2/auth?x=1"}));
        // Answered no.
        let answering = { let asks = asks.clone(); std::thread::spawn(move || { std::thread::sleep(Duration::from_millis(100)); asks.answer(2, false); }) };
        assert_eq!(asks.ask(&out, "openPath", r"C:\x", Duration::from_secs(5)), Err("OPEN_FAILED".into()));
        answering.join().unwrap();
        // No answer in time; a late answer to it, or one to an ask never made, changes nothing.
        let started = std::time::Instant::now();
        assert_eq!(asks.ask(&out, "openPath", r"C:\x", Duration::from_millis(200)), Err("OPEN_FAILED".into()));
        assert!(started.elapsed() >= Duration::from_millis(200));
        asks.answer(3, true); asks.answer(99, true);
        // `bye` or the input closed while one waits: it ends at once, unopened, and no new one goes out.
        let waiting = { let (asks, out) = (asks.clone(), out.clone()); std::thread::spawn(move || asks.ask(&out, "openExternal", "https://myaccount.google.com/connections", Duration::from_secs(30))) };
        while lines(&sink).len() < 4 { std::thread::sleep(Duration::from_millis(10)); }
        let closed = std::time::Instant::now();
        asks.close();
        assert_eq!(waiting.join().unwrap(), Err("OPEN_FAILED".into()));
        assert!(closed.elapsed() < Duration::from_secs(5));
        assert_eq!(asks.ask(&out, "openExternal", "https://myaccount.google.com/connections", Duration::from_secs(30)), Err("OPEN_FAILED".into()));
        assert_eq!(lines(&sink).len(), 4, "nothing handed over after the end");
        // A line that cannot be sent is not waited for.
        let quiet = Asks::default();
        let started = std::time::Instant::now();
        assert_eq!(quiet.ask(&out, "openExternal", &"x".repeat(MAX_OUT), Duration::from_secs(30)), Err("OPEN_FAILED".into()));
        assert!(started.elapsed() < Duration::from_secs(5));
    }
    #[test] fn a_failure_is_told_as_a_plain_code() {
        for code in ["WORKER_EXIT", "BUNDLE_INTEGRITY", "INSTALL_INCOMPLETE", "PRODUCTION_STATE_FORBIDDEN"] { assert_eq!(failure_code(code), code); }
        assert_eq!(failure_code("SCHEDULE_COM:0x80070005"), "SCHEDULE_COM");
        for odd in ["", "worker exit", r"C:\Users\x", &"A".repeat(65), ":x"] { assert_eq!(failure_code(odd), "HOST_FAILED", "{odd}"); }
        assert_eq!(failure_code("APP_BUILD: no window"), "APP_BUILD");
    }
    #[test] fn the_host_ends_after_the_job_going_and_not_for_automatic_backup() {
        assert!(!working(&Value::Null));
        assert!(!working(&json!({"profiles": {"local": {"job": null, "automatic": true}, "b2": {}}})), "automatic backup is the run's, not the host's");
        for kind in ["protect", "backup", "restore", "restore-selected", "move"] {
            assert!(working(&json!({"profiles": {"local": {"job": null}, "b2": {"job": {"kind": kind, "percent": 37}}}})), "{kind}");
        }
        assert!(working(&json!({"profiles": {}, "move": {"reinstall": {"running": true}}})), "programs being installed");
        assert!(!working(&json!({"profiles": {}, "move": {"reinstall": {"running": false}}})));
        assert!(!working(&json!({"move": {"reinstall": {"running": "yes"}}})));
        // GPT workbackup-solio-one-be-20261127 C3: a scheduled run's progress as the worker shows it (handlers.cjs withRun:
        // the profile's job and the top job, `scheduled: true`) is the run executable's and is not waited for.
        let scheduled = json!({"kind": "backup", "stage": "예약 백업 · 올리는 중", "percent": 40, "scheduled": true});
        assert!(!working(&json!({"profile": "b2", "job": scheduled, "profiles": {"local": {"job": null, "automatic": true}, "b2": {"job": scheduled, "automatic": true}}})));
        // The host's own job beside a scheduled run's is still waited for.
        assert!(working(&json!({"profiles": {"local": {"job": {"kind": "restore", "percent": 3}}, "b2": {"job": scheduled}}})));
        assert!(working(&json!({"profiles": {"b2": {"job": {"kind": "backup", "scheduled": false}}}})), "only scheduled: true is the run's");
    }
    #[test] fn the_end_waits_for_every_call_not_answered_yet() {
        // GPT workbackup-solio-one-be-20261127 C2: a write call going (moveRestoreSettings sets no job) keeps the worker.
        assert!(ending_waits(1, &Value::Null));
        assert!(ending_waits(0, &json!({"profiles": {"b2": {"job": {"kind": "restore"}}}})));
        assert!(!ending_waits(0, &json!({"profiles": {"b2": {"job": {"kind": "backup", "scheduled": true}}}})));
        assert!(!ending_waits(0, &Value::Null));
    }
    #[test] fn the_end_waits_within_its_limits_and_a_job_to_its_end() {
        // SOLIO_ONE_CLIENT.md 2.1 「끝」 한계 잣대 (Fable 설계 검토 호스트끝): a call to its method's limit and a margin, from
        // the end's start at the earliest; a method with no limit and an orphaned call, for the end's own limit.
        // An hour ahead, so an hour before it is never earlier than the clock's start (Windows counts from boot, GPT -r4 GA6).
        let begun = Instant::now() + Duration::from_secs(3600);
        assert_eq!(end_deadline(begun, &[], false), begun + END_MARGIN);
        let long_ago = begun - Duration::from_secs(3600);
        assert_eq!(end_deadline(begun, &[(long_ago, 30_000)], false), begun + END_MARGIN, "a call past its limit still gets the margin");
        assert_eq!(end_deadline(begun, &[(begun, 300_000)], false), begun + Duration::from_secs(300) + END_MARGIN);
        assert_eq!(end_deadline(begun, &[(begun, 300_000), (long_ago, 0)], false), begun + END_NO_LIMIT, "no limit: the end's own");
        // A call whose caller left at its limit has left the open calls; the worker still owes it: the end's own limit,
        // also beside a short call open (GPT -r4 GA1, moveRestoreSettings past its five minutes).
        assert_eq!(end_deadline(begun, &[], true), begun + END_NO_LIMIT);
        assert_eq!(end_deadline(begun, &[(begun, 30_000)], true), begun + END_NO_LIMIT);
        // A long call that answered is no longer open: the next step counts without it.
        assert_eq!(end_deadline(begun, &[(begun, 1_800_000)], false), begun + Duration::from_secs(1800) + END_MARGIN);
        assert_eq!(end_deadline(begun, &[(long_ago, 0)], false), begun + END_NO_LIMIT, "after it, the unlimited call's ten minutes");
        let deadline = begun + END_MARGIN;
        assert_eq!(end_step(0, &Value::Null, begun, deadline), EndStep::Stop);
        assert_eq!(end_step(2, &Value::Null, begun, deadline), EndStep::Wait);
        assert_eq!(end_step(2, &Value::Null, deadline, deadline), EndStep::Cut, "past the deadline: cut");
        let job = json!({"profiles": {"b2": {"job": {"kind": "protect"}}}});
        assert_eq!(end_step(2, &job, deadline + END_NO_LIMIT, deadline), EndStep::Wait, "a job is waited for to its end");
        assert_eq!(end_step(0, &job, begun, deadline), EndStep::Wait);
        // A recommended backup or restore going is a job too (F4).
        assert!(working(&json!({"recommended": {"busy": true}})));
        assert!(!working(&json!({"recommended": {"busy": false}})));
    }
    #[test] fn a_call_is_checked_as_the_windows_backup_call() {
        let code = |r: Result<u64, Value>| r.err().map(|e| e["code"].as_str().unwrap().to_owned());
        assert!(gate("getState", &json!([]), false, &json!({})).is_ok());
        assert_eq!(gate("getState", &json!([]), false, &json!({})), Ok(protocol::methods()["getState"].timeout_ms));
        for (method, args) in [("secret.encrypt", json!([])), ("$shutdown", json!([])), ("$boot", json!([])), ("getState", json!({})), ("getState", json!([1, 2, 3])), ("getState", json!(["x".repeat(65537)]))] {
            assert_eq!(code(gate(method, &args, false, &json!({}))).as_deref(), Some("INVALID_REQUEST"), "{method}");
        }
        assert_eq!(code(gate("getState", &json!([]), true, &json!({}))).as_deref(), Some("JOB_BUSY"));
        // Restore-only: only what the contract allows there.
        for state in [json!({"readOnly": true}), json!({"mode": "restore"})] {
            assert_eq!(code(gate("backupNow", &json!([]), false, &state)).as_deref(), Some("READ_ONLY"), "{state}");
            assert!(gate("restoreLatest", &json!([]), false, &state).is_ok(), "{state}");
        }
        let refused = gate("backupNow", &json!([]), false, &json!({"readOnly": true})).unwrap_err();
        assert_eq!(refused["ok"], false);
        assert!(refused["error"].is_string());
    }
    #[test] fn solios_registered_command_names_its_executable() {
        assert_eq!(command_exe(r#""C:\Users\Kim\AppData\Local\Programs\SYNK Platform\SYNKPlatform.exe" "--" "%1""#), Some(PathBuf::from(r"C:\Users\Kim\AppData\Local\Programs\SYNK Platform\SYNKPlatform.exe")));
        assert_eq!(command_exe(r"C:\Apps\Solio.EXE --x %1"), Some(PathBuf::from(r"C:\Apps\Solio.EXE")));
        assert_eq!(command_exe(r#"  "C:\a b\s.exe""#), Some(PathBuf::from(r"C:\a b\s.exe")));
        for bad in [r#""C:\a b\s.exe"#, r#""""#, "", "   ", r"C:\Program Files\s.exe %1", r"s.exe %1", r"\\server\s.exe", r#""C:\a\s.cmd" %1"#, r"C:\a\s.exe.lnk", r#""..\s.exe""#, r"C:s.exe"] {
            assert_eq!(command_exe(bad), None, "{bad}");
        }
        for topic in crate::notify::TOPICS { assert_eq!(solio_address(topic), Some(format!("synk-solio:backup?topic={topic}"))); }
        for bad in ["settings", "start", "STATUS", "status&x=1", ""] { assert_eq!(solio_address(bad), None, "{bad}"); }
    }
}
