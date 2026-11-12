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
        fs::remove_dir_all(&dir).unwrap();
    }
}
