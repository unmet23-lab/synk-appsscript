//! Run log and progress file in the user's state folder (STAGE1_DESIGN.md 4.2 「회차 기록」).
//! `runs.jsonl` gets one JSON line per scheduled run and rolls over at 1 MB to
//! `runs.1.jsonl`. `progress.json` lets the window show 「백업 중 N%」 while a run
//! holds the engine. Neither file carries file names, paths or secrets.
use serde_json::Value;
use std::{fs::{self, OpenOptions}, io::Write, path::Path};

pub const LIMIT: u64 = 1_000_000;

pub fn append(root: &Path, line: &Value) -> Result<(), String> {
    let path = root.join("runs.jsonl");
    // A second run that loses the rename race just appends to the new file.
    if fs::metadata(&path).is_ok_and(|m| m.len() >= LIMIT) { let _ = fs::rename(&path, root.join("runs.1.jsonl")); }
    let mut text = serde_json::to_string(line).map_err(|_| "RUNLOG_JSON")?; text.push('\n');
    let mut file = OpenOptions::new().create(true).append(true).open(&path).map_err(|_| "RUNLOG_OPEN")?;
    file.write_all(text.as_bytes()).map_err(|_| "RUNLOG_WRITE".into())
}

/// Replaces progress.json in one step (write a sibling, then rename over it).
pub fn progress(root: &Path, value: &Value) -> Result<(), String> {
    let tmp = root.join(format!("progress.{}.tmp", std::process::id()));
    fs::write(&tmp, serde_json::to_vec(value).map_err(|_| "PROGRESS_JSON")?).map_err(|_| "PROGRESS_WRITE")?;
    fs::rename(&tmp, root.join("progress.json")).map_err(|_| { let _ = fs::remove_file(&tmp); "PROGRESS_WRITE".into() })
}

/// What a live scheduled run reports in progress.json (kind · stage · percent per
/// profile), or null when no run is alive. The file is the run's; a leftover file from a
/// run that died is ignored by checking its process.
pub fn live(root:&Path)->Value{
    use windows_sys::Win32::{Foundation::{CloseHandle,STILL_ACTIVE},System::Threading::{GetExitCodeProcess,OpenProcess,PROCESS_QUERY_LIMITED_INFORMATION}};
    use serde_json::json;
    let Ok(bytes)=fs::read(root.join("progress.json")) else {return Value::Null};
    if bytes.len()>65536 {return Value::Null;}
    let Ok(value)=serde_json::from_slice::<Value>(&bytes) else {return Value::Null};
    let Some(pid)=value["pid"].as_u64().and_then(|p|u32::try_from(p).ok()) else {return Value::Null};
    let alive=unsafe{let handle=OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION,0,pid);if handle.is_null(){false}else{let mut code=0u32;let ok=GetExitCodeProcess(handle,&mut code)!=0&&code==STILL_ACTIVE as u32;CloseHandle(handle);ok}};
    if !alive {return Value::Null;}
    let mut profiles=serde_json::Map::new();
    if let Some(all)=value["profiles"].as_object(){for (name,job) in all.iter().filter(|(n,_)|n.len()<=16&&n.bytes().all(|b|b.is_ascii_alphanumeric())){
        let text=|v:&Value|v.as_str().map(|s|Value::from(s.chars().take(40).collect::<String>())).unwrap_or(Value::Null);
        profiles.insert(name.clone(),if job.is_object(){json!({"kind":text(&job["kind"]),"stage":text(&job["stage"]),"percent":job["percent"].as_f64()})}else{Value::Null});
    }}
    json!({"profiles":profiles})
}

#[cfg(test)] mod tests {
    use super::*;
    use serde_json::json;
    #[test] fn appends_and_rolls_over() {
        let dir = std::env::temp_dir().join(format!("swb-runlog-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir); fs::create_dir_all(&dir).unwrap();
        append(&dir, &json!({"n":1})).unwrap(); append(&dir, &json!({"n":2})).unwrap();
        let text = fs::read_to_string(dir.join("runs.jsonl")).unwrap();
        assert_eq!(text.lines().count(), 2);
        fs::write(dir.join("runs.jsonl"), vec![b'x'; LIMIT as usize]).unwrap();
        append(&dir, &json!({"n":3})).unwrap();
        assert_eq!(fs::read_to_string(dir.join("runs.jsonl")).unwrap(), "{\"n\":3}\n");
        assert_eq!(fs::metadata(dir.join("runs.1.jsonl")).unwrap().len(), LIMIT);
        progress(&dir, &json!({"percent":5})).unwrap(); progress(&dir, &json!({"percent":6})).unwrap();
        assert_eq!(fs::read_to_string(dir.join("progress.json")).unwrap(), "{\"percent\":6}");
        // A progress file whose process is gone (a run that died) is not shown.
        progress(&dir, &json!({"pid": 4_000_000_000u64, "profiles": {"local": {"kind": "backup", "stage": "x", "percent": 1}}})).unwrap();
        assert_eq!(live(&dir), Value::Null);
        progress(&dir, &json!({"pid": std::process::id(), "profiles": {"local": {"kind": "backup", "stage": "x", "percent": 1, "path": "kept-out"}, "../b": null}})).unwrap();
        assert_eq!(live(&dir), json!({"profiles": {"local": {"kind": "backup", "stage": "x", "percent": 1.0}}}));
        fs::remove_dir_all(&dir).unwrap();
    }
}
