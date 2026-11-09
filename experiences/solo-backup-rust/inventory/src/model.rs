use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::Path;

pub fn display_text(s: &str) -> String {
    let mut out = String::new();
    for (i, c) in s.chars().filter(|c| !c.is_control() && !matches!(*c, '\u{00ad}' | '\u{061c}' | '\u{180e}' | '\u{200b}'..='\u{200f}' | '\u{202a}'..='\u{202e}' | '\u{2060}'..='\u{206f}' | '\u{feff}')).enumerate() {
        if i == 1024 { out.push_str("…[truncated]"); break; }
        out.push(c);
    }
    out
}

#[derive(Serialize, Clone, Debug)]
pub struct ReportPath {
    pub raw: String,
    pub display: String,
    pub lossy: bool,
}
impl ReportPath {
    pub fn new(p: &Path) -> Self {
        let raw = p.to_string_lossy().into_owned();
        Self {
            display: display_text(&raw),
            raw,
            lossy: p.to_str().is_none(),
        }
    }
}

#[derive(Serialize, Default, Clone, Debug)]
pub struct Stats {
    pub files: u64,
    pub logical_bytes: u64,
    pub extensions: BTreeMap<String, u64>,
    pub incomplete: Vec<String>,
    pub excluded: Vec<String>,
}
impl Stats {
    pub fn issue(&mut self, s: &str) {
        let target = if matches!(
            s,
            "system_directory"
                | "system_or_shared_directory"
                | "other_user_or_users_root"
                | "manual_export_required_not_scanned"
                | "not_scanned"
                | "recreate_candidate_unverified_not_scanned"
                | "reparse_or_cloud_placeholder"
        ) {
            &mut self.excluded
        } else {
            &mut self.incomplete
        };
        if !target.iter().any(|x| x == s) {
            target.push(s.into());
        }
    }
}

#[derive(Serialize, Clone, Debug)]
pub struct Candidate {
    pub path: ReportPath,
    pub category: String,
    pub evidence: Vec<String>,
    pub state: String,
    pub configured_coverage: String,
    pub stats: Stats,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Program {
    pub name: String,
    pub version: String,
    pub publisher: String,
    pub install_location: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub package_family: Option<String>,
}
#[derive(Serialize, Clone, Debug)]
pub struct CollectorStatus {
    pub collector: String,
    pub status: String,
    pub count: usize,
}
#[derive(Serialize, Clone, Debug)]
pub struct Event {
    pub path: Option<ReportPath>,
    pub reason: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct Coverage {
    pub status: String,
    pub automatic: Option<bool>,
    pub sources: Vec<ReportPath>,
}

#[derive(Serialize, Debug)]
pub struct Inventory {
    pub schema_version: u32,
    pub generated_unix_seconds: u64,
    pub elapsed_ms: u128,
    pub scan_complete: bool,
    pub limits: String,
    pub total: Stats,
    pub programs: Vec<Program>,
    pub collectors: Vec<CollectorStatus>,
    pub candidates: Vec<Candidate>,
    pub events: Vec<Event>,
    pub coverage: Coverage,
    pub limitations: Vec<String>,
}
