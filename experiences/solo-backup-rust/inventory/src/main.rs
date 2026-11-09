use std::{path::PathBuf, process::ExitCode};
use work_backup_inventory::{
    model::display_text,
    platform::Scope,
    report,
    scan::{self, Options},
};
fn run() -> Result<(), String> {
    let mut args = std::env::args_os().skip(1);
    let mut options = Options::default();
    let mut output = None;
    while let Some(arg) = args.next() {
        match arg.to_str() {
            Some("--output") => {
                if output.is_some() {
                    return Err("duplicate_output".into());
                }
                output = Some(PathBuf::from(args.next().ok_or("output_path_required")?));
            }
            Some("--root") => {
                if options.extra_roots.len() >= 256 {
                    return Err("too_many_roots".into());
                }
                options
                    .extra_roots
                    .push(PathBuf::from(args.next().ok_or("root_path_required")?));
            }
            Some("--seconds") => {
                options.seconds = args
                    .next()
                    .and_then(|x| x.to_str().and_then(|s| s.parse().ok()))
                    .ok_or("invalid_seconds")?;
                if !(1..=300).contains(&options.seconds) {
                    return Err("seconds_range_1_to_300".into());
                }
            }
            Some("--max-entries") => {
                options.max_entries = args
                    .next()
                    .and_then(|x| x.to_str().and_then(|s| s.parse().ok()))
                    .ok_or("invalid_entry_limit")?;
                if !(100..=1000000).contains(&options.max_entries) {
                    return Err("entries_range_100_to_1000000".into());
                }
            }
            Some("--help") => {
                println!("WorkBackupInventory 0.1.0\nRead-only current-user work inventory. No upload or backup changes.\nNo arguments: automatically scan and create a new LocalAppData report directory.\nOptions: --root ABSOLUTE_LOCAL_PATH (repeatable) --output NEW_DIRECTORY\n         --seconds 1..300 (default 120) --max-entries 100..1000000 (default 400000)");
                return Ok(());
            }
            _ => return Err("unknown_argument_use_help".into()),
        }
    }
    let scope = Scope::current().map_err(|_| "known_folders_unavailable")?;
    let output = output.unwrap_or_else(|| report::default_output(&scope));
    println!(
        "프로그램·작업 자료·설정 위치를 읽기 전용으로 확인합니다. 최대 {}초.",
        options.seconds
    );
    let result = scan::scan(&scope, &options);
    report::write_report(&scope, &output, &result)
        .map_err(|e| format!("report_not_complete: {}", display_text(&e.to_string())))?;
    println!(
        "{}",
        serde_json::json!({"status":"report_created_not_backed_up","output":display_text(&output.to_string_lossy()),"candidates":result.candidates.len(),"program_records":result.programs.len(),"observed_files":result.total.files,"logical_bytes":result.total.logical_bytes,"scan_complete":result.scan_complete})
    );
    Ok(())
}
fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("진단을 완료하지 못했습니다: {}", display_text(&e));
            ExitCode::FAILURE
        }
    }
}
