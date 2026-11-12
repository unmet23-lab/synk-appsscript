//! T2 probe (STAGE1_DESIGN.md 4.2 · 8): register the four run tasks for the user who
//! runs this probe, read them back, remove them, and write what happened as JSON.
//! Used by the CI workflow `workbackup-schedule-t2.yml` as an administrator and as a
//! standard user, with and without the product folder. Never shipped (an example).
//!   schedule_probe <absolute run exe path> <out.json>
use backup_native::schedule;
use serde_json::json;
use std::path::PathBuf;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.len() != 2 { eprintln!("usage: schedule_probe <run exe> <out.json>"); std::process::exit(64); }
    let (exe, out) = (PathBuf::from(&args[0]), PathBuf::from(&args[1]));
    let user = std::env::var("USERNAME").unwrap_or_default();
    let sid = schedule::current_sid();
    let mut result = json!({ "user": schedule::user_label(&user), "sidKnown": sid.is_ok() });
    if let Ok(sid) = &sid {
        let placed = schedule::register(&exe, &user, sid, &schedule::local_now());
        result["register"] = match &placed { Ok(p) => json!({ "ok": true, "folder": p.folder, "tasks": p.tasks }), Err(e) => json!({ "ok": false, "error": e }) };
        result["registeredAfter"] = json!(schedule::registered(&exe, &user).map_err(|e| e.to_string()));
        result["remove"] = json!(schedule::remove(&user).map(|_| true).map_err(|e| e.to_string()));
        result["registeredAfterRemove"] = json!(schedule::registered(&exe, &user).map_err(|e| e.to_string()));
    }
    std::fs::write(&out, serde_json::to_vec_pretty(&result).unwrap()).expect("write result");
    println!("{result}");
}
