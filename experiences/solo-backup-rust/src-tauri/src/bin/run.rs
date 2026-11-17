//! WorkBackupRun.exe — one scheduled run, then exit (STAGE1_DESIGN.md 4.2).
//! Task Scheduler starts it as the signed-in user at normal privilege with
//! `--run hourly|logon|wake|unlock`; 「지금 백업」 uses `--run manual`. It holds the
//! state lock for the run, asks the worker for a single `$run`, writes one line
//! to runs.jsonl and ends. Nothing stays resident between runs, and it never
//! shows a window or wakes the window app.
//!
//! Exit codes: 0 run recorded (including skipped, not due, busy, partial),
//! 2 a profile's backup failed, 1 the run itself failed, 64 bad arguments,
//! 70 no usable state folder (nothing can be recorded).
//!
//! The installer also runs it, elevated, for the machine setup (4.2 「컴퓨터 전체 설치」):
//! `--install` makes the run-task folder, `--uninstall` removes every user's run tasks of this
//! installation (both: one JSON line out; exit 0 done, 1 failed, 77 not elevated), `--open-app`
//! opens the window app as the person at the desktop at the end of an install. While the
//! installer's marker is in this folder, a run ends at once with exit 0 (`platform::installing`).
//!
//! The helper (4.2 「도우미」, `helper.rs`): `--register-helper` (the installer, elevated) makes the helper task for the
//! account that approved the install — one JSON line out; exit 0 done (also when that account gets no helper), 1
//! failed, 77 not elevated. `--vss-helper` is that task's fixed action. `--uninstall` also takes every user's helper
//! task, shadow copies, links and folders away. A run whose partial snapshot left out files another program held asks
//! the helper for shadow copy links and has the worker fill them (`$fill`) before it ends.
//!
//! 「새 PC로 옮겨 오기」의 다시 깔기 (4.6b, `reinstall.rs`): the window app starts `--reinstall <number> <id>…` elevated
//! (one administrator approval) for the table's machine-wide programs; its exit code is `reinstall::elevated_main`'s.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// The binary root looks beside itself for modules; the helper lives in its own folder (`src/bin/run/`).
// Outside src/bin: the Tauri bundler takes every file and folder there for a program of its own (11-16 CI).
#[path = "../run_helper.rs"] mod helper;
// 공간 비우기 1판의 훑기 (4.15) — 회차 실행기만 쓴다.
#[path = "../space.rs"] mod space;
// AI 도구의 MCP 보기 도구 (4.16): `--mcp`.
#[path = "../mcp.rs"] mod mcp;
use backup_native::{bundle, notify, platform, power, runlog, schedule, secret, worker::Worker};
use serde_json::{json, Map, Value};
use std::{fs::{self, File}, path::{Path, PathBuf}, sync::{Arc, Mutex}, time::{Duration, Instant, SystemTime, UNIX_EPOCH}};

/// `request`: the request task SYNK 솔리오 starts after it leaves a request file (4.13 「읽는 때」).
const TRIGGERS: [&str; 7] = ["hourly", "logon", "wake", "unlock", "manual", "request", "test"];
/// Per-profile fields copied into runs.jsonl. Everything else the worker sends
/// back stays out, so no file name, path or secret reaches the record.
const FIELDS: [&str; 17] = ["outcome", "reason", "exitCode", "newSnapshot", "files", "bytes", "filesNew", "filesChanged", "filesUnmodified", "dataAdded", "durationMs", "nextAt", "unlock", "lastBackupMs", "automatic", "unreadable", "missing"];
/// The run's overall result is its most notable profile result.
const ORDER: [&str; 7] = ["failed", "partial", "fill", "busy", "complete", "not-due", "skipped"];

#[derive(Debug, PartialEq, Eq)]
struct Args { trigger: &'static str, test: bool }

fn parse(argv: &[String]) -> Result<Args, String> {
    let (mut trigger, mut test, mut i) = (None, false, 0);
    while i < argv.len() {
        match argv[i].as_str() {
            "--run" if trigger.is_none() => {
                let value = argv.get(i + 1).ok_or("INVALID_ARGUMENT")?;
                trigger = Some(*TRIGGERS.iter().find(|t| **t == value.as_str()).ok_or("INVALID_ARGUMENT")?); i += 2;
            }
            // A release build has no test mode (STAGE1_DESIGN.md 4.2 「알림」).
            "--test-mode" if !test && cfg!(debug_assertions) => { test = true; i += 1; }
            _ => return Err("INVALID_ARGUMENT".into()),
        }
    }
    let trigger = trigger.ok_or("INVALID_ARGUMENT")?;
    if trigger == "test" && !test { return Err("TEST_MODE_REQUIRED".into()); }
    Ok(Args { trigger, test })
}

/// `--install` / `--uninstall`: the installer's machine setup, with its administrator token only.
/// Needs no state folder, lock or resources (an uninstall works on a damaged install too).
fn machine(mode: &str) -> i32 {
    if mode == "--open-app" {
        let app = std::env::current_exe().map(|exe| exe.with_file_name("WorkBackup.exe"));
        return match app.map_err(|_| "EXECUTABLE".to_string()).and_then(|app| platform::open_as_shell_user(&app)) {
            Ok(()) => 0,
            Err(error) => { println!("{}", json!({ "ok": false, "error": error })); 1 }
        };
    }
    if !platform::elevated() { println!("{}", json!({ "ok": false, "error": "NOT_ELEVATED" })); return 77; }
    if mode == "--register-helper" {
        let (code, value) = match std::env::current_exe() { Ok(exe) => helper::register(&exe), Err(_) => (1, json!({ "ok": false, "error": "EXECUTABLE" })) };
        println!("{value}");
        return code;
    }
    let result = if mode == "--install" {
        schedule::prepare_folder().map(|security| (true, json!({ "ok": true, "folder": schedule::FOLDER, "security": security })))
    } else {
        // What could not be removed is counted and the rest still goes; the uninstaller logs a failure. The helper's
        // shadow copies go first, while its tasks are still there to stop.
        let helpers = helper::remove_all();
        let helpers_ok = helpers["failed"].as_u64() == Some(0);
        std::env::current_exe().map_err(|_| "EXECUTABLE".to_string()).and_then(|exe| schedule::remove_installation(&exe))
            .map(|removal| { let ok = removal.failed == 0 && helpers_ok; (ok, json!({ "ok": ok, "removal": removal, "helper": helpers })) })
    };
    match result {
        Ok((ok, value)) => { println!("{value}"); if ok { 0 } else { 1 } }
        Err(error) => { println!("{}", json!({ "ok": false, "error": error })); 1 }
    }
}

fn epoch_ms() -> u64 { SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0) }

/// UTC ISO-8601 with milliseconds (civil-from-days, H. Hinnant).
fn iso(ms: u64) -> String {
    let (secs, rem_ms) = (ms / 1000, ms % 1000);
    let (z, rem) = ((secs / 86400) as i64 + 719_468, secs % 86400);
    let era = z.div_euclid(146_097); let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1; let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!("{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{rem_ms:03}Z", rem / 3600, rem % 3600 / 60, rem % 60)
}

fn below_normal() {
    use windows_sys::Win32::System::Threading::{GetCurrentProcess, SetPriorityClass, BELOW_NORMAL_PRIORITY_CLASS};
    // Node and restic inherit the class (CreateProcess keeps BELOW_NORMAL for children).
    unsafe { SetPriorityClass(GetCurrentProcess(), BELOW_NORMAL_PRIORITY_CLASS); }
}

fn resources() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|_| "EXECUTABLE")?;
    let beside = exe.parent().ok_or("EXECUTABLE")?.join("resources");
    Ok(if cfg!(debug_assertions) { std::env::var_os("SWB_RESOURCES").map(PathBuf::from).unwrap_or(beside) } else { beside })
}

/// The worker's host calls in run mode: the DPAPI secret store, and for the daily 옮겨 오기 꾸러미 (4.6) where this PC's
/// folders are and the programs winget knows — reading only. Nothing here installs (`reinstall.user` · `.elevate` are
/// the window app's).
fn host(method: &str, args: Value) -> Result<Value, String> {
    let list = args.as_array().cloned().unwrap_or_default();
    let first = || list.first().and_then(Value::as_str).ok_or_else(|| "HOST_REQUEST".to_string());
    match method {
        "secret.encrypt" => Ok(json!(secret::encrypt(first()?)?)),
        "secret.decrypt" => { let value = secret::decrypt(first()?)?; Ok(json!(value.as_str())) }
        "folders.snapshot" => backup_native::folders::host(method, &list).unwrap_or_else(|| Err("HOST_METHOD".into())),
        "reinstall.installed" => backup_native::reinstall::host(method, &list).unwrap_or_else(|| Err("HOST_METHOD".into())),
        // Whether this account's run tasks are all there, for SYNK 솔리오's status file (4.13): read only.
        "startup.read" => {
            let exe = std::env::current_exe().map_err(|_| "EXECUTABLE")?;
            let sid = schedule::current_sid()?;
            Ok(json!(schedule::registered(&exe, &schedule::account_label(&sid), &sid)?))
        }
        _ => Err("HOST_METHOD".into()),
    }
}

fn short(value: &Value) -> Value { value.as_str().map(|s| Value::from(s.chars().take(40).collect::<String>())).unwrap_or(Value::Null) }
fn profile_name(name: &str) -> bool { !name.is_empty() && name.len() <= 16 && name.bytes().all(|b| b.is_ascii_alphanumeric()) }

/// progress.json for the window: job kind, stage and percent per profile only.
fn progress(value: &Value) -> Value {
    let mut profiles = Map::new();
    if let Some(all) = value["profiles"].as_object() {
        for (name, job) in all.iter().filter(|(name, _)| profile_name(name)) {
            profiles.insert(name.clone(), if job.is_object() { json!({"kind": short(&job["kind"]), "stage": short(&job["stage"]), "percent": job["percent"].as_f64()}) } else { Value::Null });
        }
    }
    json!({"pid": std::process::id(), "at": iso(epoch_ms()), "profiles": profiles})
}

fn record_profiles(result: &Value, started: u64, line: &mut Value) -> &'static str {
    let mut profiles = Map::new(); let mut first_restic: Option<u64> = None;
    if let Some(all) = result["profiles"].as_object() {
        for (name, entry) in all.iter().filter(|(name, _)| profile_name(name)) {
            let mut kept = Map::new();
            for field in FIELDS { let v = &entry[field]; if !v.is_null() { kept.insert(field.into(), if v.is_string() { short(v) } else { v.clone() }); } }
            if let Some(unlock) = kept.get_mut("unlock") { *unlock = json!({"ran": unlock["ran"].as_bool(), "ok": unlock["ok"].as_bool(), "exitCode": unlock["exitCode"].as_i64()}); }
            if let Some(at) = entry["resticStartedAt"].as_u64() { first_restic = Some(first_restic.map_or(at, |f| f.min(at))); }
            profiles.insert(name.clone(), Value::Object(kept));
        }
    }
    if let Some(at) = first_restic { line["resticStartMs"] = json!(at.saturating_sub(started)); }
    if let Some(kb) = result["worker"]["maxRssKb"].as_u64() { line["workerPeakWorkingSetBytes"] = json!(kb * 1024); }
    let overall = ORDER.iter().copied().find(|o| profiles.values().any(|p| p["outcome"] == *o)).unwrap_or("skipped");
    line["profiles"] = Value::Object(profiles);
    overall
}

/// What the run did with SYNK 솔리오's requests (4.13): at most 20, each its kind, result and reason words — never a name,
/// a path or a hint.
fn record_requests(value: &Value, line: &mut Value) {
    let word = |v: &Value| v.as_str().filter(|s| !s.is_empty() && s.len() <= 24 && s.bytes().all(|b| b.is_ascii_lowercase() || b == b'-')).map(String::from);
    let list: Vec<Value> = value["requests"].as_array().into_iter().flatten().take(20).filter_map(|r| {
        let mut kept = Map::new();
        kept.insert("kind".into(), json!(word(&r["kind"])?));
        kept.insert("result".into(), json!(word(&r["result"])?));
        if let Some(reason) = word(&r["reason"]) { kept.insert("reason".into(), json!(reason)); }
        Some(Value::Object(kept))
    }).collect();
    if !list.is_empty() { line["requests"] = json!(list); }
}

/// Per-profile fill fields copied into runs.jsonl (4.2 채움 판): counts and reasons, no path.
const FILL_FIELDS: [&str; 9] = ["outcome", "reason", "exitCode", "asked", "failed", "left", "cut", "durationMs", "dataAdded"];
fn record_fills(result: &Value, line: &mut Value) {
    let Some(all) = result["profiles"].as_object() else { return };
    for (name, entry) in all.iter().filter(|(name, _)| profile_name(name)) {
        if !line["profiles"][name].is_object() { continue; }
        let mut kept = Map::new();
        for field in FILL_FIELDS { let v = &entry[field]; if !v.is_null() { kept.insert(field.into(), if v.is_string() { short(v) } else { v.clone() }); } }
        line["profiles"][name]["fill"] = Value::Object(kept);
    }
}

/// What this run can judge of 2.2 from its profile records, for the profiles that back up on their own
/// (`automatic`): the first backup — one of them has a backup — and 「사흘 넘게」. Off, read-only and paused
/// are the person's choice and are not judged; a profile that never backed up has no age to judge. The first
/// backup is judged from the state, not from this run's new snapshot, so a notice that could not be shown is
/// tried again by the next run (GPT workbackup-notify GB2) and a backup made by hand with automatic off is not
/// told as 「이제 매시간 저절로 지킵니다」.
fn problems(profiles: &Value, now: u64) -> (Vec<notify::Notice>, Vec<&'static str>) {
    let (mut found, mut judged) = (Vec::new(), Vec::new());
    let all: Vec<&Value> = profiles.as_object().map(|p| p.values().collect()).unwrap_or_default();
    let chosen = |p: &Value| p["outcome"] == "skipped" && ["read-only", "paused"].contains(&p["reason"].as_str().unwrap_or(""));
    // A profile the person set aside (off · paused · read-only) may be the one a notice was about: while there is one,
    // the problem is not judged resolved and its record stays (끝판 b B4).
    let set_aside = all.iter().any(|p| p["outcome"] == "skipped" && ["off", "read-only", "paused"].contains(&p["reason"].as_str().unwrap_or("")));
    let watched: Vec<&Value> = all.into_iter().filter(|p| p["automatic"] == true && !chosen(p)).collect();
    if watched.iter().any(|p| p["lastBackupMs"].is_u64()) { found.push(notify::first_backup()); }
    // 「몇 파일만 못 지킴」: a partial snapshot this run kept (its count is there only when its list was saved). A run
    // that backed up every profile it watches completely has it resolved.
    // A fill that read every file the partial snapshot could not leaves nothing to tell (4.2 채움 판).
    let filled = |p: &Value| p["fill"]["outcome"] == "fill" && p["fill"]["left"] == 0 && p["fill"]["cut"] != true;
    if watched.iter().any(|p| p["outcome"] == "partial" && p["unreadable"].is_u64() && !filled(p)) { found.push(notify::partial()); }
    // 「폴더를 찾을 수 없음」: a folder this run did not find, whether the others were backed up or none was there.
    if watched.iter().any(|p| p["missing"].as_u64().is_some_and(|n| n > 0)) { found.push(notify::missing()); }
    let backed_up = |p: &Value| p["outcome"] == "complete" || (p["outcome"] == "partial" && p["unreadable"].is_u64());
    if !watched.is_empty() && !set_aside && watched.iter().all(|p| backed_up(p)) { judged.push("partial"); judged.push("missing"); }
    if !watched.is_empty() {
        if !set_aside { judged.push("stale"); }
        // Late: three days past the last backup, or stopped for the clock with the clock behind that backup — such a
        // clock cannot count the three days (끝판 b A2).
        let late: Vec<&Value> = watched.iter().copied().filter(|p| p["lastBackupMs"].as_u64().is_some_and(|at|
            now.saturating_sub(at) > notify::STALE_MS || (now < at && p["reason"] == "clock"))).collect();
        let waiting = |p: &Value| match (p["outcome"].as_str(), p["reason"].as_str()) {
            (Some("skipped"), Some("metered")) => Some("metered"),
            (Some("skipped"), Some("network")) => Some("network"),
            (Some("skipped"), Some("battery" | "saver")) => Some("battery"),
            (Some("skipped"), Some("clock")) => Some("clock"),
            _ => None,
        };
        if !late.is_empty() {
            // One late profile with no known wait (a failure) makes it 「확인하기」: a wait never hides a failure (끝판 b A3).
            let causes: Vec<Option<&str>> = late.iter().map(|p| waiting(p)).collect();
            let cause = if causes.contains(&None) { "" } else { ["clock", "metered", "network", "battery"].into_iter().find(|c| causes.contains(&Some(*c))).unwrap_or("") };
            found.push(notify::stale(cause));
        }
    }
    (found, judged)
}

/// Where the day's space scan walks (4.15): this PC's fixed drives — or, for a test run of a debug build, only the folders
/// given in SWB_SPACE_ROOTS (never this PC's drives), with SWB_SPACE_TEMP as its temp folder and SWB_SPACE_BUDGET_MS.
fn space_places(test: bool) -> Option<(space::Places, Duration)> {
    if !test { return Some((space::Places::from_env(schedule::current_sid().ok()), space::BUDGET)); }
    if !cfg!(debug_assertions) { return None; }
    let roots = std::env::var("SWB_SPACE_ROOTS").ok()?;
    let mut places = space::Places::from_env(None);
    places.roots = roots.split(';').filter(|r| !r.is_empty()).map(PathBuf::from).collect();
    places.temp = std::env::var_os("SWB_SPACE_TEMP").map(PathBuf::from);
    (places.local, places.profile) = (None, None);
    places.cloud_drives.clear();
    let budget = std::env::var("SWB_SPACE_BUDGET_MS").ok().and_then(|v| v.parse().ok()).map(Duration::from_millis).unwrap_or(space::BUDGET);
    Some((places, budget))
}
/// Whether this PC has started protection: a run whose every profile is 「not set up」 does not scan (4.15). A run with no
/// profile record (busy, failed before the worker) is of a PC that has run tasks, so it does.
fn space_wanted(line: &Value) -> bool {
    line["profiles"].as_object().is_none_or(|p| p.is_empty() || !p.values().all(|r| r["outcome"] == "skipped" && r["reason"] == "not-configured"))
}

/// Runs with the state lock held. The worker owns the lock from its start; the
/// caller keeps the worker alive until runs.jsonl is written.
fn execute(args: &Args, root: &Path, lock: File, clock: Instant, started: u64, line: &mut Value, keep: &mut Option<Arc<Worker>>, writing: Arc<Mutex<bool>>) -> Result<i32, String> {
    if root.join("migration-incomplete").exists() { return Err("MIGRATION_INCOMPLETE".into()); }
    let resources = resources()?;
    let checked = Instant::now();
    bundle::verify(&resources, bundle::RUN_SKIP)?;
    line["verifyMs"] = json!(checked.elapsed().as_millis() as u64);
    let conditions = power::read_in(root);
    // 「지금 백업」 is never rested (4.2 step 3). A request's 「지금 백업」 is, so the worker also gets the rest itself (4.13).
    let rest = power::skip_reason(&conditions);
    let skip = if args.trigger == "manual" { None } else { rest };
    line["power"] = serde_json::to_value(&conditions).unwrap_or(Value::Null);
    line["skipCloud"] = json!(skip);
    let failure: Arc<Mutex<Option<String>>> = Arc::default();
    let (progress_root, failed) = (root.to_path_buf(), failure.clone());
    let worker = Worker::start(&resources, root, lock, args.test, true, Arc::new(host),
        // Progress is written only while the gate is open; run() closes it before removing the file (review C2).
        Arc::new(move |value| { let open = writing.lock().unwrap(); if *open { let _ = runlog::progress(&progress_root, &progress(&value)); } }),
        Arc::new(move |code| { *failed.lock().unwrap() = Some(code.to_owned()); }))?;
    *keep = Some(worker.clone());
    let runtime = tokio::runtime::Builder::new_current_thread().enable_time().build().map_err(|_| "RUNTIME")?;
    let result = runtime.block_on(async {
        worker.call("$boot", json!([]), 120_000).await?;
        let ready = clock.elapsed().as_millis() as u64;
        let value = worker.call("$run", json!([{"trigger": args.trigger, "skipCloud": skip, "rest": rest}]), 0).await?;
        // 4.2 step 9: a partial snapshot left out files another program held. The helper's shadow copy links let the
        // worker read them again into a fill; with none (a test run, an account without a helper, a refused volume)
        // the fill still counts as tried, so the next one waits its 4 hours. A failed fill is not a failed run: the
        // backup is already saved.
        let volumes = helper::fill_volumes(&value);
        let mut fill = None;
        if !volumes.is_empty() {
            let asked = if args.test { helper::Asked::without("test") } else { helper::ask(root, &volumes) };
            let filled = worker.call("$fill", json!([{"links": asked.links_json()}]), 0).await;
            helper::finish(root);
            fill = Some((volumes, asked, filled));
        }
        let _ = worker.stop().await;
        Ok::<_, String>((ready, value, fill))
    });
    // A failed call leaves no worker running behind the record (review C2).
    if result.is_err() { worker.terminate(); }
    if let Some(usage) = worker.usage() { line["job"] = json!(usage); }
    let (ready, value, fill) = result.map_err(|code| failure.lock().unwrap().clone().unwrap_or(code))?;
    line["workerReadyMs"] = json!(ready);
    let overall = record_profiles(&value, started, line);
    record_requests(&value, line);
    if let Some((volumes, asked, filled)) = fill {
        line["helper"] = asked.record(&volumes);
        match filled { Ok(result) => record_fills(&result, line), Err(code) => line["fillError"] = json!(code) }
    }
    line["outcome"] = json!(overall);
    Ok(if overall == "failed" { 2 } else { 0 })
}

fn run() -> i32 {
    let (clock, started) = (Instant::now(), epoch_ms());
    let argv: Vec<String> = std::env::args().skip(1).collect();
    // The elevated reinstall the window app asked for: everything after the flag is reinstall's (a number, then ids).
    if argv.first().map(String::as_str) == Some("--reinstall") { return backup_native::reinstall::elevated_main(&argv[1..]); }
    if let [mode] = argv.as_slice() {
        if ["--install", "--uninstall", "--open-app", "--register-helper"].contains(&mode.as_str()) { return machine(mode); }
        // The helper task's action; nothing while an install or uninstall replaces this folder's files.
        if mode == schedule::HELPER_ARG {
            if std::env::current_exe().ok().and_then(|exe| exe.parent().map(platform::installing)).unwrap_or(false) { return 0; }
            return helper::serve();
        }
    }
    // AI 도구의 MCP 보기 도구 (4.16): 표준 입출력 서버. 엔진 잠금을 쥐지 않고, 우선순위는 보통 아래다. 시험 판만 --test-mode를 받는다.
    let mcp_test = cfg!(debug_assertions) && matches!(argv.as_slice(), [a, b] if a == "--mcp" && b == "--test-mode");
    if mcp_test || matches!(argv.as_slice(), [a] if a == "--mcp") {
        below_normal();
        return match resources() { Ok(resources) => mcp::serve(mcp_test, resources), Err(_) => 70 };
    }
    let Ok(args) = parse(&argv) else { return 64 };
    // An install or uninstall is replacing this folder's files: end before holding any of them (review GA3).
    if std::env::current_exe().ok().and_then(|exe| exe.parent().map(platform::installing)).unwrap_or(false) { return 0; }
    if args.trigger != "manual" { below_normal(); }
    let Ok((root, lock)) = platform::open_state(args.test) else { return 70 };
    let mut line = json!({"v": 1, "trigger": args.trigger, "start": iso(started)});
    let mut worker = None;
    // A second handle to the same lock file keeps the lock until the record is written, also when
    // execute() fails before or while starting the worker (review C1).
    let mut guard = lock.as_ref().and_then(|f| f.try_clone().ok());
    let writing = Arc::new(Mutex::new(true));
    let code = match lock {
        // Another process holds the engine lock: a live run (its progress file) or the
        // window's own operation. Record and end (4.2 step 1).
        None => { line["outcome"] = json!("busy"); line["reason"] = json!(if runlog::live(&root).is_null() { "ui" } else { "run" }); 0 }
        Some(lock) => {
            let code = execute(&args, &root, lock, clock, started, &mut line, &mut worker, writing.clone())
                .unwrap_or_else(|error| { line["outcome"] = json!("failed"); line["error"] = json!(error); 1 });
            let mut open = writing.lock().unwrap();
            *open = false;
            let _ = fs::remove_file(root.join("progress.json"));
            drop(open);
            code
        }
    };
    // A test run keeps the ledger as a real one would, without showing anything.
    if line["profiles"].is_object() {
        let (found, judged) = problems(&line["profiles"], epoch_ms());
        let today: String = schedule::local_now().chars().take(10).collect();
        let records = notify::deliver(&root, &found, &judged, &today, |n| if args.test { Ok(()) } else { notify::show(n) });
        if !records.is_empty() { line["notify"] = json!(records); }
    }
    line["end"] = json!(iso(epoch_ms()));
    line["ms"] = json!(clock.elapsed().as_millis() as u64);
    line["exit"] = json!(code);
    // 공간 비우기 1판 (4.15): the day's first run scans once, after the run — whether it backed up, rested, failed or was
    // busy — with the engine lock already let go (the scan only reads). Its own time is in `space`, not in `ms`; whatever
    // happens to it, this run's result above stays.
    let today: String = schedule::local_now().chars().take(10).collect();
    if let Some((places, budget)) = space_places(args.test).filter(|_| space_wanted(&line) && space::due(&root, &today)) {
        drop(worker.take());
        drop(guard.take());
        line["space"] = space::daily(&root, &places, &today, budget, epoch_ms());
    }
    let _ = runlog::append(&root, &line);
    drop(worker); // the state lock goes with the worker and the guard, after the record is written
    drop(guard);
    code
}

fn main() { std::process::exit(run()); }

#[cfg(test)] mod tests {
    use super::*;
    fn args(list: &[&str]) -> Vec<String> { list.iter().map(|s| s.to_string()).collect() }
    #[test] fn arguments() {
        assert_eq!(parse(&args(&["--run", "hourly"])), Ok(Args { trigger: "hourly", test: false }));
        assert_eq!(parse(&args(&["--test-mode", "--run", "test"])), Ok(Args { trigger: "test", test: true }));
        assert_eq!(parse(&args(&["--run", "test"])), Err("TEST_MODE_REQUIRED".into()));
        for bad in [&["--run"][..], &["--run", "daily"], &["--run", "hourly", "--run", "wake"], &["hourly"], &[], &["--run", "manual", "--background"],
                    &["--install"], &["--uninstall"], &["--open-app"], &["--run", "hourly", "--install"], &["--mcp"], &["--run", "hourly", "--mcp"]] {
            assert!(parse(&args(bad)).is_err(), "{bad:?}");
        }
    }
    #[test] fn iso_dates() {
        assert_eq!(iso(0), "1970-01-01T00:00:00.000Z");
        assert_eq!(iso(1_731_400_000_123), "2024-11-12T08:26:40.123Z");
        assert_eq!(iso(951_782_400_000), "2000-02-29T00:00:00.000Z");
        assert_eq!(iso(1_798_761_599_999), "2026-12-31T23:59:59.999Z");
    }
    #[test] fn records_keep_only_known_fields() {
        let result = json!({"profiles": {
            "local": {"outcome": "complete", "files": 3, "bytes": 10, "newSnapshot": true, "resticStartedAt": 1_500, "unlock": {"ran": true, "ok": true, "path": "C:\\secret"}, "sources": ["C:\\Users\\x"]},
            "b2": {"outcome": "skipped", "reason": "metered"},
            "../x": {"outcome": "failed"}}, "worker": {"maxRssKb": 2}});
        let mut line = json!({});
        assert_eq!(record_profiles(&result, 1_000, &mut line), "complete");
        assert_eq!(line["resticStartMs"], 500);
        assert_eq!(line["workerPeakWorkingSetBytes"], 2048);
        assert_eq!(line["profiles"]["local"], json!({"outcome": "complete", "files": 3, "bytes": 10, "newSnapshot": true, "unlock": {"ran": true, "ok": true, "exitCode": null}}));
        assert_eq!(line["profiles"]["b2"], json!({"outcome": "skipped", "reason": "metered"}));
        assert!(line["profiles"].get("../x").is_none());
        assert!(!line.to_string().contains("C:\\\\"), "no paths in the record");
        let failed = json!({"profiles": {"local": {"outcome": "partial"}, "b2": {"outcome": "failed", "exitCode": 1}}});
        assert_eq!(record_profiles(&failed, 0, &mut json!({})), "failed");
    }
    #[test] fn problems_come_from_the_records_of_profiles_meant_to_run() {
        let now = 10 * notify::STALE_MS;
        let old = now - notify::STALE_MS - 1;
        let names = |found: &[notify::Notice]| found.iter().map(|n| (n.problem, n.body)).collect::<Vec<_>>();
        let first = ("first-backup", notify::first_backup().body);
        let (found, judged) = problems(&json!({"local": {"outcome": "complete", "newSnapshot": true, "automatic": true, "lastBackupMs": now}}), now);
        assert_eq!((names(&found), judged), (vec![first], vec!["partial", "missing", "stale"]));
        // From the state: a later run with no new snapshot still finds it (the ledger keeps it to once).
        let (found, _) = problems(&json!({"local": {"outcome": "not-due", "automatic": true, "lastBackupMs": now}}), now);
        assert_eq!(names(&found), [first]);
        // A backup made by hand with automatic off is not 「이제 매시간 저절로 지킵니다」, nor judged at all.
        let (found, judged) = problems(&json!({"local": {"outcome": "complete", "newSnapshot": true, "lastBackupMs": now}}), now);
        assert!(found.is_empty() && judged.is_empty());
        // Three days exactly is not yet 「사흘 넘게」.
        let (found, _) = problems(&json!({"local": {"outcome": "failed", "automatic": true, "lastBackupMs": now - notify::STALE_MS}}), now);
        assert_eq!(names(&found), [first]);
        for (record, body) in [(json!({"outcome": "failed", "exitCode": 1, "automatic": true, "lastBackupMs": old}), notify::stale("").body),
                               (json!({"outcome": "skipped", "reason": "metered", "automatic": true, "lastBackupMs": old}), notify::stale("metered").body),
                               (json!({"outcome": "skipped", "reason": "network", "automatic": true, "lastBackupMs": old}), notify::stale("network").body),
                               (json!({"outcome": "skipped", "reason": "saver", "automatic": true, "lastBackupMs": old}), notify::stale("battery").body),
                               (json!({"outcome": "skipped", "reason": "clock", "automatic": true, "lastBackupMs": old}), notify::stale("clock").body),
                               (json!({"outcome": "busy", "reason": "job", "automatic": true, "lastBackupMs": old}), notify::stale("").body),
                               (json!({"outcome": "skipped", "reason": "credential", "automatic": true, "lastBackupMs": old}), notify::stale("").body)] {
            let (found, judged) = problems(&json!({"local": {"outcome": "complete", "automatic": true, "lastBackupMs": now}, "b2": record}), now);
            assert_eq!((names(&found), judged), (vec![first, ("stale", body)], vec!["stale"]), "{record}");
        }
        // The person's choice is not judged at all, so an earlier record is kept, not cleared.
        for (reason, automatic) in [("off", false), ("not-configured", false), ("read-only", true), ("paused", true)] {
            let (found, judged) = problems(&json!({"b2": {"outcome": "skipped", "reason": reason, "automatic": automatic, "lastBackupMs": old}}), now);
            assert!(found.is_empty() && judged.is_empty(), "{reason}");
        }
        // A clock behind the last backup: told at once (끝판 b A2).
        let (found, _) = problems(&json!({"local": {"outcome": "skipped", "reason": "clock", "automatic": true, "lastBackupMs": now + 1_000}}), now);
        assert_eq!(names(&found), [first, ("stale", notify::stale("clock").body)]);
        // Both late: a failure is told as 「확인하기」 whatever the other waits on; waits alone, the clock first (끝판 b A3).
        for (local, b2, cause) in [(json!({"outcome": "failed"}), json!({"outcome": "skipped", "reason": "metered"}), ""),
                                   (json!({"outcome": "skipped", "reason": "clock"}), json!({"outcome": "skipped", "reason": "metered"}), "clock"),
                                   (json!({"outcome": "busy", "reason": "job"}), json!({"outcome": "skipped", "reason": "battery"}), "")] {
            let mut profiles = json!({"local": local, "b2": b2});
            for p in ["local", "b2"] { profiles[p]["automatic"] = json!(true); profiles[p]["lastBackupMs"] = json!(old); }
            let (found, _) = problems(&profiles, now);
            assert_eq!(names(&found), [first, ("stale", notify::stale(cause).body)], "{profiles}");
        }
        // A profile set aside keeps the record: a healthy other profile does not make the problem resolved (끝판 b B4).
        for reason in ["off", "paused", "read-only"] {
            let (found, judged) = problems(&json!({"local": {"outcome": "complete", "automatic": true, "lastBackupMs": now},
                                                   "b2": {"outcome": "skipped", "reason": reason, "automatic": reason != "off", "lastBackupMs": old}}), now);
            assert!(judged.is_empty() && names(&found) == [first], "{reason}");
        }
        // A partial snapshot kept with its list is told; one without (exit 3, no list) is not; complete runs resolve it.
        let (found, judged) = problems(&json!({"local": {"outcome": "partial", "unreadable": 2, "automatic": true, "lastBackupMs": now}}), now);
        assert_eq!((names(&found), judged), (vec![first, ("partial", notify::partial().body)], vec!["partial", "missing", "stale"]));
        // A folder not found: told whether the others were backed up or none was there; only a run that backed up
        // every watched profile can resolve it (4.2 「사라진 원본 폴더」).
        let missing = ("missing", notify::missing().body);
        let (found, judged) = problems(&json!({"local": {"outcome": "complete", "missing": 1, "automatic": true, "lastBackupMs": now}}), now);
        assert_eq!((names(&found), judged), (vec![first, missing], vec!["partial", "missing", "stale"]));
        let (found, judged) = problems(&json!({"local": {"outcome": "partial", "unreadable": 1, "missing": 1, "automatic": true, "lastBackupMs": now}}), now);
        assert_eq!((names(&found), judged), (vec![first, ("partial", notify::partial().body), missing], vec!["partial", "missing", "stale"]));
        let (found, judged) = problems(&json!({"local": {"outcome": "failed", "missing": 2, "automatic": true, "lastBackupMs": now}}), now);
        assert_eq!((names(&found), judged), (vec![first, missing], vec!["stale"]));
        let (found, _) = problems(&json!({"local": {"outcome": "complete", "missing": 0, "automatic": true, "lastBackupMs": now}}), now);
        assert_eq!(names(&found), [first]);
        let (found, judged) = problems(&json!({"local": {"outcome": "failed", "missing": 1, "lastBackupMs": now}}), now);
        assert!(found.is_empty() && judged.is_empty(), "automatic off: not told");
        // Exit 3 with no list kept: nothing to tell, and not a backup that could resolve it (GPT GA3).
        let (found, judged) = problems(&json!({"local": {"outcome": "partial", "exitCode": 3, "automatic": true, "lastBackupMs": now}}), now);
        assert_eq!((names(&found), judged), (vec![first], vec!["stale"]));
        let (_, judged) = problems(&json!({"local": {"outcome": "not-due", "automatic": true, "lastBackupMs": now}}), now);
        assert_eq!(judged, ["stale"], "a run that did not back up cannot say the partial one is resolved");
        let (found, judged) = problems(&json!({"local": {"outcome": "failed", "automatic": true}}), now);
        assert!(found.is_empty() && judged == ["stale"], "never backed up: judged, and nothing to show");
        assert_eq!(problems(&json!({"local": {"outcome": "complete", "automatic": true, "lastBackupMs": now}}), now).1, ["partial", "missing", "stale"]);
        assert_eq!(problems(&Value::Null, now), (vec![], vec![]));
    }
    #[test] fn requests_are_recorded_as_words_only() {
        let mut line = json!({});
        record_requests(&json!({"requests": [{"kind": "run-now", "result": "rested", "reason": "network"}, {"kind": "setup", "result": "done", "hint": "a@b.c"},
            {"kind": "C:\\x", "result": "done"}, {"kind": "pick", "result": "rejected", "reason": "이름"}]}), &mut line);
        assert_eq!(line["requests"], json!([{"kind": "run-now", "result": "rested", "reason": "network"}, {"kind": "setup", "result": "done"}, {"kind": "pick", "result": "rejected"}]));
        let mut none = json!({});
        record_requests(&json!({"requests": []}), &mut none);
        assert!(none.get("requests").is_none());
        assert_eq!(parse(&args(&["--run", "request"])), Ok(Args { trigger: "request", test: false }));
    }
    #[test] fn fills_are_recorded_without_paths_and_a_full_one_is_not_told() {
        let mut line = json!({});
        record_profiles(&json!({"profiles": {"local": {"outcome": "partial", "unreadable": 2, "fill": ["C:"], "automatic": true, "lastBackupMs": 5}}}), 0, &mut line);
        assert!(line["profiles"]["local"].get("fill").is_none(), "the run result's drive list is not kept as is");
        record_fills(&json!({"profiles": {"local": {"outcome": "fill", "asked": 2, "failed": 0, "left": 0, "durationMs": 900, "root": "C:\\ProgramData\\x"}, "b2": {"outcome": "skipped"}}}), &mut line);
        assert_eq!(line["profiles"]["local"]["fill"], json!({"outcome": "fill", "asked": 2, "failed": 0, "left": 0, "durationMs": 900}));
        assert!(line["profiles"].get("b2").is_none(), "only profiles this run recorded");
        assert!(!line.to_string().contains("ProgramData"));
        let partial = ("partial", notify::partial().body);
        let (found, judged) = problems(&line["profiles"], 10);
        assert!(!found.iter().any(|n| n.problem == partial.0), "every left-out file was filled");
        assert_eq!(judged, ["partial", "missing", "stale"]);
        line["profiles"]["local"]["fill"]["cut"] = json!(true);
        assert!(problems(&line["profiles"], 10).0.iter().any(|n| n.problem == partial.0), "a cut list is never taken as all filled");
        line["profiles"]["local"]["fill"]["cut"] = Value::Null;
        line["profiles"]["local"]["fill"]["left"] = json!(1);
        assert!(problems(&line["profiles"], 10).0.iter().any(|n| n.problem == partial.0), "one still left out is told");
        line["profiles"]["local"]["fill"] = json!({"outcome": "skipped", "reason": "no-link"});
        assert!(problems(&line["profiles"], 10).0.iter().any(|n| n.problem == partial.0));
    }
    #[test] fn progress_is_only_kind_stage_percent() {
        let value = json!({"profiles": {"local": {"kind": "backup", "stage": "작업 파일 백업 중", "percent": 42.5, "sources": ["C:\\x"]}, "b2": null}});
        let out = progress(&value);
        assert_eq!(out["profiles"], json!({"local": {"kind": "backup", "stage": "작업 파일 백업 중", "percent": 42.5}, "b2": null}));
        assert_eq!(out["pid"], std::process::id());
    }
}
