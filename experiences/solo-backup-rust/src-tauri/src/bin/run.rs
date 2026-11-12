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
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use backup_native::{bundle, platform, power, runlog, secret, worker::Worker};
use serde_json::{json, Map, Value};
use std::{fs::{self, File}, path::{Path, PathBuf}, sync::{Arc, Mutex}, time::{Instant, SystemTime, UNIX_EPOCH}};

const TRIGGERS: [&str; 6] = ["hourly", "logon", "wake", "unlock", "manual", "test"];
/// Per-profile fields copied into runs.jsonl. Everything else the worker sends
/// back stays out, so no file name, path or secret reaches the record.
const FIELDS: [&str; 13] = ["outcome", "reason", "exitCode", "newSnapshot", "files", "bytes", "filesNew", "filesChanged", "filesUnmodified", "dataAdded", "durationMs", "nextAt", "unlock"];
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
            "--test-mode" if !test => { test = true; i += 1; }
            _ => return Err("INVALID_ARGUMENT".into()),
        }
    }
    let trigger = trigger.ok_or("INVALID_ARGUMENT")?;
    if trigger == "test" && !test { return Err("TEST_MODE_REQUIRED".into()); }
    Ok(Args { trigger, test })
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

/// The worker's only host calls in run mode are the DPAPI secret store.
fn host(method: &str, args: Value) -> Result<Value, String> {
    let first = args.as_array().and_then(|a| a.first()).and_then(Value::as_str).ok_or("HOST_REQUEST")?;
    match method {
        "secret.encrypt" => Ok(json!(secret::encrypt(first)?)),
        "secret.decrypt" => { let value = secret::decrypt(first)?; Ok(json!(value.as_str())) }
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

/// Runs with the state lock held. The worker owns the lock from its start; the
/// caller keeps the worker alive until runs.jsonl is written.
fn execute(args: &Args, root: &Path, lock: File, clock: Instant, started: u64, line: &mut Value, keep: &mut Option<Arc<Worker>>, writing: Arc<Mutex<bool>>) -> Result<i32, String> {
    if root.join("migration-incomplete").exists() { return Err("MIGRATION_INCOMPLETE".into()); }
    let resources = resources()?;
    let checked = Instant::now();
    bundle::verify(&resources, bundle::RUN_SKIP)?;
    line["verifyMs"] = json!(checked.elapsed().as_millis() as u64);
    let conditions = power::read();
    // 「지금 백업」 is never rested (4.2 step 3).
    let skip = if args.trigger == "manual" { None } else { power::skip_reason(&conditions) };
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
        let value = worker.call("$run", json!([{"trigger": args.trigger, "skipCloud": skip}]), 0).await?;
        let _ = worker.stop().await;
        Ok::<_, String>((ready, value))
    });
    // A failed call leaves no worker running behind the record (review C2).
    if result.is_err() { worker.terminate(); }
    if let Some(usage) = worker.usage() { line["job"] = json!(usage); }
    let (ready, value) = result.map_err(|code| failure.lock().unwrap().clone().unwrap_or(code))?;
    line["workerReadyMs"] = json!(ready);
    let overall = record_profiles(&value, started, line);
    line["outcome"] = json!(overall);
    Ok(if overall == "failed" { 2 } else { 0 })
}

fn run() -> i32 {
    let (clock, started) = (Instant::now(), epoch_ms());
    let argv: Vec<String> = std::env::args().skip(1).collect();
    let Ok(args) = parse(&argv) else { return 64 };
    if args.trigger != "manual" { below_normal(); }
    let Ok((root, lock)) = platform::open_state(args.test) else { return 70 };
    let mut line = json!({"v": 1, "trigger": args.trigger, "start": iso(started)});
    let mut worker = None;
    // A second handle to the same lock file keeps the lock until the record is written, also when
    // execute() fails before or while starting the worker (review C1).
    let guard = lock.as_ref().and_then(|f| f.try_clone().ok());
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
    line["end"] = json!(iso(epoch_ms()));
    line["ms"] = json!(clock.elapsed().as_millis() as u64);
    line["exit"] = json!(code);
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
        for bad in [&["--run"][..], &["--run", "daily"], &["--run", "hourly", "--run", "wake"], &["hourly"], &[], &["--run", "manual", "--background"]] {
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
    #[test] fn progress_is_only_kind_stage_percent() {
        let value = json!({"profiles": {"local": {"kind": "backup", "stage": "작업 파일 백업 중", "percent": 42.5, "sources": ["C:\\x"]}, "b2": null}});
        let out = progress(&value);
        assert_eq!(out["profiles"], json!({"local": {"kind": "backup", "stage": "작업 파일 백업 중", "percent": 42.5}, "b2": null}));
        assert_eq!(out["pid"], std::process::id());
    }
}
