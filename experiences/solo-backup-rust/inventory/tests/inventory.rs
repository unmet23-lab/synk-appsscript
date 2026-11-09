#![cfg(windows)]
use std::{
    collections::HashSet,
    fs,
    os::windows::process::CommandExt,
    path::{Path, PathBuf},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use work_backup_inventory::{
    model::display_text,
    platform::{self, Scope},
    report, scan,
};

// Isolated fixtures are deliberately preserved. No production deletion helper is needed.
fn fixture() -> (Scope, PathBuf) {
    let scope = Scope::current().unwrap();
    let dir = scope.local.join(format!(
        "WorkBackupInventory-test-{}-{}-{}",
        std::process::id(),
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos(),
        std::thread::current().name().unwrap_or("test")
    ));
    fs::create_dir(&dir).unwrap();
    (scope, dir)
}
fn write(root: &Path, name: &str, data: &[u8]) {
    fs::write(root.join(name), data).unwrap();
}
fn junction(path: &Path, target: &Path) {
    let quote = |p: &Path| p.to_string_lossy().replace('\'', "''");
    let script=format!("$ErrorActionPreference='Stop';New-Item -ItemType Junction -Path '{}' -Target '{}' | Out-Null",quote(path),quote(target));
    let status = std::process::Command::new(
        platform::system_directory()
            .unwrap()
            .join("WindowsPowerShell\\v1.0\\powershell.exe"),
    )
    .args(["-NoProfile", "-NonInteractive", "-Command", &script])
    .creation_flags(0x08000000)
    .status()
    .unwrap();
    assert!(status.success());
}
#[test]
fn originals_and_secret_contents_are_preserved_and_not_collected() {
    let (scope, root) = fixture();
    write(&root, "plan.md", b"original work");
    write(&root, ".env", b"FAKE_SECRET_VALUE_NEVER_COLLECT_THIS");
    write(&root, "package.json", b"{}");
    fs::create_dir(root.join("output")).unwrap();
    write(&root.join("output"), "trained.safetensors", b"unique model");
    fs::create_dir(root.join("node_modules")).unwrap();
    write(&root.join("node_modules"), "dependency", b"skip candidate");
    let (c, total) = scan::scan_roots(&scope, std::slice::from_ref(&root), 10000);
    assert_eq!(fs::read(root.join("plan.md")).unwrap(), b"original work");
    assert_eq!(
        fs::read(root.join(".env")).unwrap(),
        b"FAKE_SECRET_VALUE_NEVER_COLLECT_THIS"
    );
    assert_eq!(total.files, 4);
    assert_eq!(total.extensions["model"], 1);
    let json = serde_json::to_string(&c).unwrap();
    assert!(!json.contains("FAKE_SECRET_VALUE"));
    assert!(json.contains("recreate_candidate_unverified"));
}
#[test]
fn overlapping_roots_are_counted_once_and_subtotals_are_separate() {
    let (scope, root) = fixture();
    let sub = root.join("nested");
    fs::create_dir(&sub).unwrap();
    write(&root, "one.md", b"12");
    write(&sub, "two.md", b"345");
    let (c, total) = scan::scan_roots(&scope, &[root.clone(), sub.clone(), root.clone()], 1000);
    assert_eq!(total.files, 2);
    assert_eq!(total.logical_bytes, 5);
    assert_eq!(c.len(), 2);
    assert_eq!(
        c.iter()
            .find(|c| c.path.raw == sub.to_string_lossy())
            .unwrap()
            .stats
            .logical_bytes,
        3
    );
}
#[test]
fn limits_are_explicit_and_not_reported_as_complete_zero() {
    let (scope, root) = fixture();
    for n in 0..12 {
        write(&root, &format!("{n}.md"), b"x");
    }
    let (c, total) = scan::scan_roots(&scope, std::slice::from_ref(&root), 3);
    assert!(total.files <= 3);
    assert!(!total.incomplete.is_empty());
    assert!(!c[0].stats.incomplete.is_empty());
}
#[test]
fn cache_names_need_context_and_generic_data_is_not_skipped() {
    let empty = HashSet::new();
    let package = HashSet::from(["package.json".into()]);
    let cargo = HashSet::from(["cargo.toml".into()]);
    let venv = HashSet::from(["pyvenv.cfg".into()]);
    assert!(scan::cache_rule("node_modules", &empty, &empty).is_none());
    assert!(scan::cache_rule("node_modules", &package, &empty).is_some());
    assert!(scan::cache_rule("target", &empty, &empty).is_none());
    assert!(scan::cache_rule("target", &cargo, &empty).is_some());
    assert!(scan::cache_rule("venv", &empty, &venv).is_some());
    for name in ["data", "output", "dist", "build", ".cache", ".git"] {
        assert!(scan::cache_rule(name, &package, &venv).is_none());
    }
}
#[test]
fn reparse_points_and_linked_ancestors_are_not_followed() {
    let (scope, root) = fixture();
    let original = root.join("original");
    let scanroot = root.join("scan");
    fs::create_dir(&original).unwrap();
    fs::create_dir(&scanroot).unwrap();
    write(&original, "keep.md", b"do not scan");
    let link = scanroot.join("linked");
    junction(&link, &original);
    assert!(platform::safe_existing(&link).is_err());
    assert!(platform::safe_existing(&link.join("keep.md")).is_err());
    let (_, total) = scan::scan_roots(&scope, &[scanroot], 1000);
    assert_eq!(total.files, 0);
    assert!(total
        .excluded
        .iter()
        .any(|x| x == "reparse_or_cloud_placeholder"));
    assert!(report::create_output(&scope, &link.join("report")).is_err());
    assert!(!original.join("report").exists());
    assert_eq!(fs::read(original.join("keep.md")).unwrap(), b"do not scan");
}
#[test]
fn output_is_new_only_and_never_creates_missing_parents() {
    let (scope, root) = fixture();
    write(&root, "sentinel", b"unchanged");
    assert!(report::create_output(&scope, &root).is_err());
    assert!(report::create_output(&scope, &root.join("missing\\report")).is_err());
    assert!(!root.join("missing").exists());
    let new = root.join("fresh");
    report::create_output(&scope, &new).unwrap();
    assert!(report::create_output(&scope, &new).is_err());
    assert_eq!(fs::read(root.join("sentinel")).unwrap(), b"unchanged");
    assert!(report::create_output(&scope, &scope.profile.join("OneDrive\\report")).is_err());
}
#[test]
fn cloud_placeholder_attributes_are_not_safe_to_open() {
    for bit in [0x400, 0x1000, 0x40000, 0x400000] {
        assert!(platform::skip_attributes(bit));
    }
    assert!(!platform::skip_attributes(0x10));
    assert!(!platform::skip_attributes(0x20));
}
#[test]
fn unsafe_root_forms_are_rejected() {
    for p in [
        "relative",
        "C:relative",
        "\\\\server\\share",
        "\\\\?\\C:\\test",
        "C:\\folder\\..\\secret",
        "C:\\folder.\\x",
        "C:\\file:stream",
        "C:/folder",
    ] {
        assert!(platform::lexical_local(Path::new(p)).is_err(), "{p}");
    }
    let s = Scope::current().unwrap();
    assert!(s
        .allowed(&s.profile.parent().unwrap().join("OtherUser\\Documents"))
        .is_err());
}
#[test]
fn coverage_only_exports_safe_fields_and_rejects_malformed_sources() {
    let scope = Scope::current().unwrap();
    let source = scope.profile.join("Documents");
    let bytes=serde_json::to_vec(&serde_json::json!({"sources":[source],"automatic":true,"applicationKey":"FAKE_KEY_DO_NOT_SERIALIZE","bucket":"FAKE_BUCKET_PRIVATE"})).unwrap();
    let result = scan::parse_coverage(&bytes);
    let json = serde_json::to_string(&result).unwrap();
    assert_eq!(result.sources.len(), 1);
    assert_eq!(result.automatic, Some(true));
    assert!(!json.contains("FAKE_"));
    assert_eq!(scan::parse_coverage(b"{").status, "invalid");
    assert_eq!(scan::parse_coverage(&vec![b' '; 262145]).status, "oversize");
    assert_eq!(
        scan::parse_coverage(br#"{"sources":["relative"],"automatic":true}"#).status,
        "invalid_sources"
    );
}
#[test]
fn external_display_strings_cannot_inject_report_lines_or_direction() {
    assert_eq!(display_text("Name\n\r\t\u{202e}safe\u{200b}"), "Namesafe");
    assert!(display_text(&"a".repeat(1100)).ends_with("[truncated]"));
    let result = platform::parse_msix(
        br#"[{"Name":"Fake\nPackage","Version":"1","Publisher":"P","InstallLocation":"C:\\A"}]"#,
    )
    .unwrap();
    assert_eq!(result[0].name, "FakePackage");
    assert!(platform::parse_msix(b"not json").is_err());
    assert!(platform::parse_msix(b"{}").is_err());
}
#[test]
fn expired_msix_deadline_is_a_failure_status_not_zero_success() {
    let (p, status) = platform::msix_programs(Instant::now() - Duration::from_secs(1));
    assert!(p.is_empty());
    assert_ne!(status.status, "complete");
}

#[test]
fn msix_data_root_uses_validated_family_not_arbitrary_provider_paths() {
    let ok=platform::parse_msix(br#"[{"Name":"ExampleAI","Version":"1","Publisher":"P","InstallLocation":"C:\\Apps","PackageFamilyName":"Example.AI_abcdef"}]"#).unwrap();
    assert_eq!(ok[0].package_family.as_deref(), Some("Example.AI_abcdef"));
    let bad=br#"[{"Name":"ExampleAI","Version":"1","Publisher":"P","InstallLocation":"C:\\Apps","PackageFamilyName":"..\\outside"}]"#;
    assert!(platform::parse_msix(bad).is_err());
}

#[test]
fn excluded_parent_marks_explicit_nested_candidate_incomplete() {
    let (scope, root) = fixture();
    write(&root, "Cargo.toml", b"fixture");
    let target = root.join("target");
    fs::create_dir(&target).unwrap();
    let release = target.join("release");
    fs::create_dir(&release).unwrap();
    write(&release, "unique.md", b"preserve me");
    let (c, total) = scan::scan_roots(&scope, &[root, release.clone()], 1000);
    assert_eq!(total.files, 1);
    let nested = c
        .iter()
        .find(|c| c.path.raw == release.to_string_lossy())
        .unwrap();
    assert!(nested
        .stats
        .excluded
        .iter()
        .any(|s| s == "recreate_candidate_unverified_not_scanned"));
    assert_eq!(fs::read(release.join("unique.md")).unwrap(), b"preserve me");
}

#[test]
fn reports_are_private_new_artifacts_and_retry_preserves_the_first_result() {
    use work_backup_inventory::model::{Coverage, Inventory};
    let (scope, root) = fixture();
    let source = root.join("source");
    fs::create_dir(&source).unwrap();
    let nested = source.join("Windows");
    fs::create_dir(&nested).unwrap();
    write(&nested, "work.md", b"FAKE_PRIVATE_DOCUMENT_BODY");
    write(&source, "Project.sln", b"fixture");
    let (candidates, total) = scan::scan_roots(&scope, std::slice::from_ref(&source), 1000);
    assert_eq!(total.files, 2);
    let inv = Inventory {
        schema_version: 1,
        generated_unix_seconds: 0,
        elapsed_ms: 0,
        scan_complete: true,
        limits: "fixture".into(),
        total,
        programs: vec![],
        collectors: vec![],
        candidates,
        events: vec![],
        coverage: Coverage {
            status: "not_found".into(),
            automatic: None,
            sources: vec![],
        },
        limitations: vec![],
    };
    let output = root.join("report");
    assert!(report::render(&inv).contains(source.to_str().unwrap()));
    report::write_report(&scope, &output, &inv).unwrap();
    let before = fs::read(output.join("inventory.json")).unwrap();
    assert!(!String::from_utf8_lossy(&before).contains("FAKE_PRIVATE_DOCUMENT_BODY"));
    assert!(output.join("backup-plan.txt").is_file());
    assert!(output.join("inventory-details.txt").is_file());
    assert!(report::write_report(&scope, &output, &inv).is_err());
    assert_eq!(fs::read(output.join("inventory.json")).unwrap(), before);
    assert_eq!(
        fs::read(nested.join("work.md")).unwrap(),
        b"FAKE_PRIVATE_DOCUMENT_BODY"
    );
}

#[test]
fn lora_detection_uses_tokens_instead_of_unrelated_substrings() {
    for name in ["lora", "loras", "synk-lora", "lora_training"] {
        assert!(scan::ai_name(name));
    }
    for name in ["flora", "explorations", "colorado trip"] {
        assert!(!scan::ai_name(name));
    }
}

#[test]
fn completion_distinguishes_intentional_exclusions_from_errors() {
    use work_backup_inventory::model::{CollectorStatus, Stats};
    let mut total = Stats::default();
    total.issue("system_directory");
    total.issue("manual_export_required_not_scanned");
    let c = vec![CollectorStatus {
        collector: "fixture".into(),
        status: "complete".into(),
        count: 0,
    }];
    assert!(scan::collection_complete(&total, &[], &c));
    total.issue("time_limit");
    assert!(!scan::collection_complete(&total, &[], &c));
    assert!(!scan::collection_complete(
        &Stats::default(),
        &[],
        &[CollectorStatus {
            collector: "fixture".into(),
            status: "timeout".into(),
            count: 0
        }]
    ));
}

#[test]
fn disconnected_configured_sources_and_null_msix_locations_do_not_erase_other_records() {
    let coverage = scan::parse_coverage(br#"{"sources":["Z:\\offline-project"],"automatic":true}"#);
    assert_eq!(coverage.sources.len(), 1);
    let list = platform::parse_msix(
        br#"[{"Name":"Example","Version":"1","Publisher":"P","InstallLocation":null}]"#,
    )
    .unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].install_location, "");
}
