use crate::{
    model::{display_text, Inventory},
    platform::{self, Scope},
};
use std::{
    collections::BTreeMap,
    fs::{self, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(serde::Deserialize)]
struct Text {
    title: String,
    intro: String,
    categories: BTreeMap<String, Category>,
}
#[derive(serde::Deserialize)]
struct Category {
    label: String,
    backup: String,
    restore: String,
}
pub fn render_details(r: &Inventory) -> String {
    let t: Text =
        serde_json::from_str(include_str!("../report-text.json")).expect("bundled report text");
    let mut out = format!(
        "{}\n\n{}\n\n진단 시각(Unix 초): {}\n탐색 소요: {}ms\n탐색 범위: {}\n\n",
        t.title, t.intro, r.generated_unix_seconds, r.elapsed_ms, r.limits
    );
    out.push_str(&format!("관찰한 파일: {}개 / 논리 크기 {:.2} GiB\n완전 탐색: {}\n※ 부분 탐색의 합계이며 요금제 필요 용량이 아닙니다. 각 폴더 크기는 상위 폴더와 겹칩니다.\n\n",r.total.files,r.total.logical_bytes as f64/1073741824.0,if r.scan_complete {"설정된 범위 내 완료"} else {"아니요 — 제외·상한·미확인 항목 있음"}));
    out.push_str("현재 앱의 백업 설정과 대조\n");
    out.push_str(&format!(
        "상태: {} / 자동 백업 설정: {:?}\n",
        r.coverage.status, r.coverage.automatic
    ));
    for p in &r.coverage.sources {
        out.push_str(&format!("- 지정 경로: {}\n", p.display));
    }
    out.push_str("이 목록은 설정만 읽은 결과입니다. 업로드 성공·최신성·새 PC 복구를 검증한 결과가 아닙니다.\n\n");
    for id in [
        "irreplaceable",
        "ai_settings",
        "credential_location",
        "regenerable",
        "external_manual",
    ] {
        let c = &t.categories[id];
        out.push_str(&format!(
            "{}\n백업 준비: {}\n새 PC: {}\n",
            c.label, c.backup, c.restore
        ));
        for item in r.candidates.iter().filter(|c| c.category == id) {
            let status = match item.configured_coverage.as_str() {
                "inside_configured_source_not_verified" => "지정된 백업 경로 안(실제 복구 미검증)",
                "contains_some_configured_sources" => "일부 하위 경로만 백업 지정",
                "outside_this_apps_configured_sources" => "이 앱의 현재 백업 지정 범위 밖",
                _ => "백업 설정 확인 불가",
            };
            out.push_str(&format!(
                "- {}\n  발견 상태: {} / {}\n  관찰: {}개, {:.2} MiB / 근거: {}\n",
                item.path.display,
                display_text(&item.state),
                status,
                item.stats.files,
                item.stats.logical_bytes as f64 / 1048576.0,
                item.evidence.join(", ")
            ));
            if !item.stats.incomplete.is_empty() {
                out.push_str(&format!(
                    "  미확인 사유: {}\n",
                    item.stats.incomplete.join(", ")
                ));
            }
            if item.path.lossy {
                out.push_str("  경로 표시 일부 변환됨 — 자동 복원에 사용 금지\n");
            }
            if !item.stats.excluded.is_empty() {
                out.push_str(&format!(
                    "  의도적으로 탐색 제외: {}\n",
                    item.stats.excluded.join(", ")
                ));
            }
        }
        out.push('\n');
    }
    let c = &t.categories["reinstallable"];
    out.push_str(&format!(
        "{}\n{}\n{}\n등록 항목은 구성요소·복수 버전을 포함하며 실제 사용 중인 앱 수와 다릅니다.\n",
        c.label, c.backup, c.restore
    ));
    for c in &r.collectors {
        out.push_str(&format!(
            "- 수집: {} / {} / {}건\n",
            c.collector, c.status, c.count
        ));
    }
    for p in &r.programs {
        out.push_str(&format!(
            "- {} | {} | {} | {}\n  {}\n",
            display_text(&p.name),
            display_text(&p.version),
            display_text(&p.publisher),
            p.source,
            display_text(&p.install_location)
        ));
    }
    out.push_str("\n새 노트북에서 이어가기 순서\n1. 본인 계정으로 복구 접근을 확인하고, 업무 원본·Markdown·소스·미커밋 변경·Git 이력·모델·학습 데이터를 복원합니다.\n2. 설치 목록을 참고해 공식 프로그램과 필요한 버전을 설치합니다. 라이선스·관리자 권한이 필요할 수 있습니다.\n3. AI 도구의 설정·스킬·작업 기록과 편집기 설정을 복원합니다. DB는 앱을 종료하거나 정식 내보내기로 일관성을 확보해야 합니다.\n4. 비밀키·인증서는 별도 암호화·본인 확인 경로로 복원하고, 서비스는 재로그인합니다. 일반 설정 폴더에도 비밀값이 섞일 수 있습니다.\n5. 대표 프로젝트를 실제 실행하고 파일 해시·환경·의존성·AI 연결을 확인한 뒤 업무 복구 완료로 판단합니다.\n\n완전 복구 전 별도 확인\n- Windows·드라이버·장치별 설정, 앱 라이선스, 브라우저 세션·DPAPI 비밀값은 파일 복사만으로 복구되지 않을 수 있습니다.\n- WSL/Docker, 실행 중인 DB, 클라우드 전용 자료와 SaaS 안의 기록은 별도 내보내기·연결·검증이 필요합니다.\n- 탐색되지 않은 위치는 보호됐다는 뜻이 아닙니다. 자동 백업 대상 추가와 실제 복구 시험은 아직 실행하지 않았습니다.\n\n탐색 중 확인하지 못한 항목\n");
    for e in &r.events {
        out.push_str(&format!(
            "- {}: {}\n",
            e.path
                .as_ref()
                .map(|p| p.display.as_str())
                .unwrap_or("환경 설정"),
            display_text(&e.reason)
        ));
    }
    out.push_str("\n원본 파일 내용·계정 비밀값을 수집하지 않았으며 이 진단기는 네트워크로 보고서를 보내지 않습니다. 다른 동기화 프로그램의 동작까지 통제하지는 않습니다.\n");
    out
}

/// Keep the first report short. Full candidate and program lists remain in the details/JSON.
pub fn render(r: &Inventory) -> String {
    let t: Text =
        serde_json::from_str(include_str!("../report-text.json")).expect("bundled report text");
    let mut out = format!("{}\n\n{}\n\n", t.title, t.intro);
    out.push_str(&format!("설치·위치 등록 {}건, 자료·설정 후보 {}곳\n관찰한 파일 {}개, 논리 크기 {:.2} GiB (부분 결과·필요 구독 용량 아님)\n\n",r.programs.len(),r.candidates.len(),r.total.files,r.total.logical_bytes as f64/1073741824.0));
    out.push_str("현재 이 앱의 백업 지정 경로\n");
    if r.coverage.sources.is_empty() {
        out.push_str("- 지정 경로를 확인하지 못했습니다.\n");
    }
    for p in &r.coverage.sources {
        out.push_str(&format!("- {}\n", p.display));
    }
    out.push_str("설정을 읽었을 뿐 실제 클라우드 보관·복구를 다시 검증한 것은 아닙니다. 다른 GitHub·Drive·백업 서비스의 보관 상태는 대조하지 않았습니다.\n\n우선 확인할 백업 위치\n");
    let present: Vec<_> = r
        .candidates
        .iter()
        .filter(|c| c.state == "present" || c.state == "manual_export_required")
        .collect();
    for id in [
        "irreplaceable",
        "ai_settings",
        "credential_location",
        "external_manual",
    ] {
        let category = &t.categories[id];
        out.push_str(&format!("\n{} — {}\n", category.label, category.backup));
        let mut group: Vec<_> = present.iter().filter(|c| c.category == id).collect();
        group.sort_by_key(|c| {
            let p = Path::new(&c.path.raw);
            let known = c.evidence.iter().any(|e| {
                e.starts_with("known_")
                    || e.starts_with("environment_")
                    || e == "profile_directory_name_hint"
                    || e == "explicit_root"
            });
            let personal_project = p.parent().is_some_and(|parent| {
                present.iter().any(|a| {
                    a.evidence.iter().any(|e| e.starts_with("known_folder_"))
                        && platform::key(parent) == platform::key(Path::new(&a.path.raw))
                })
            });
            (
                if known {
                    0
                } else if personal_project {
                    1
                } else {
                    2
                },
                p.components().count(),
                c.path.raw.clone(),
            )
        });
        let mut shown = 0;
        for c in group {
            let p = Path::new(&c.path.raw);
            let known = c.evidence.iter().any(|e| {
                e.starts_with("known_")
                    || e.starts_with("environment_")
                    || e == "profile_directory_name_hint"
                    || e == "explicit_root"
                    || e == "needs_app_specific_export_or_consistency"
            });
            let nested = present.iter().any(|a| {
                a.path.raw != c.path.raw
                    && !a.evidence.iter().any(|e| e.starts_with("known_folder_"))
                    && platform::within(p, Path::new(&a.path.raw))
            });
            let direct_project = c.evidence.iter().any(|e| {
                e == "git_marker_name_only"
                    || e == "project_manifest_name_only"
                    || e == "workspace_marker_name_only"
                    || e == "ai_directory_name_hint"
            }) && !nested;
            if !(known || direct_project) || shown >= 16 {
                continue;
            }
            shown += 1;
            let coverage = match c.configured_coverage.as_str() {
                "inside_configured_source_not_verified" => "백업 지정 안 · 실제 복구 미검증",
                "contains_some_configured_sources" => "일부 하위 폴더만 백업 지정",
                "outside_this_apps_configured_sources" => "이 앱의 백업 지정 밖",
                _ => "설정 확인 불가",
            };
            out.push_str(&format!("- {}\n  {}\n", c.path.display, coverage));
        }
        let count = r.candidates.iter().filter(|c| c.category == id).count();
        let unavailable = r
            .candidates
            .iter()
            .filter(|c| {
                c.category == id && c.state != "present" && c.state != "manual_export_required"
            })
            .count();
        if count > shown {
            out.push_str(&format!("외 {}곳 요약에서 생략(미발견·접근 불가·제외 상태 {}곳 포함). 전체 위치·사유는 inventory-details.txt 참고.\n",count-shown,unavailable));
        }
    }
    out.push_str("\n재설치·재로그인·별도 내보내기\n");
    for id in [
        "reinstallable",
        "ai_settings",
        "credential_location",
        "external_manual",
    ] {
        let c = &t.categories[id];
        out.push_str(&format!("- {}: {}\n", c.label, c.restore));
    }
    out.push_str("\n다음 실행 순서\n1. 업무 원본·Markdown·소스·미커밋 변경·Git 이력·학습 데이터·고유 모델을 우선 보호합니다.\n2. AI 설정·스킬·작업 기록은 비밀값 혼재와 열린 DB를 고려해 암호화·일관된 복사 방식을 정합니다.\n3. 새 PC에 프로그램을 설치하고 자료·설정을 복원한 뒤 재로그인합니다.\n4. 대표 프로젝트 실행과 실제 파일 대조를 통과한 뒤 업무 복구 완료로 판단합니다.\n\n이번에는 진단만 했습니다. 자동 백업 범위는 늘리지 않았고 완전 복구도 검증하지 않았습니다.\n세부 위치·설치 버전·누락 사유는 inventory-details.txt와 inventory.json에 있습니다.\n원본 내용·대화·키 값을 수집하거나 네트워크로 보고서를 전송하지 않습니다.\n");
    out
}
pub fn default_output(scope: &Scope) -> PathBuf {
    scope.local.join(format!(
        "WorkBackupInventory-report-{}-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis(),
        std::process::id()
    ))
}
pub fn create_output(scope: &Scope, output: &Path) -> io::Result<()> {
    scope.allowed(output).map_err(io::Error::other)?;
    if scope.cloud_path(output) {
        return Err(io::Error::other("known_cloud_output_rejected"));
    }
    let parent = output
        .parent()
        .ok_or_else(|| io::Error::other("parent_required"))?;
    if platform::safe_existing(parent).map_err(io::Error::other)? & 0x10 == 0 {
        return Err(io::Error::other("existing_directory_parent_required"));
    }
    // Deliberately not create_dir_all; never adopt or clean up a pre-existing directory.
    fs::create_dir(output)
}
fn new_file(p: &Path, bytes: &[u8]) -> io::Result<()> {
    let mut f = OpenOptions::new().write(true).create_new(true).open(p)?;
    f.write_all(bytes)?;
    f.sync_all()
}
pub fn write_report(scope: &Scope, output: &Path, report: &Inventory) -> io::Result<()> {
    create_output(scope, output)?;
    let result = (|| {
        let bytes = serde_json::to_vec_pretty(report).map_err(io::Error::other)?;
        new_file(&output.join("inventory.json"), &bytes)?;
        new_file(&output.join("backup-plan.txt"), render(report).as_bytes())?;
        new_file(
            &output.join("inventory-details.txt"),
            render_details(report).as_bytes(),
        )
    })();
    if result.is_err() {
        let _ = new_file(
            &output.join("inventory.partial.json"),
            b"{\"status\":\"output_incomplete\",\"original_files_unchanged_by_scanner\":true}",
        );
        let _ = new_file(&output.join("errors.txt"), b"Output incomplete. Existing files were not overwritten. Partial artifacts were preserved.");
    }
    result
}
