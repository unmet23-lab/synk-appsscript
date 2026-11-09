use crate::{
    model::*,
    platform::{self, Entry, Scope},
};
use std::{
    collections::{HashMap, HashSet, VecDeque},
    fs::OpenOptions,
    io::Read,
    os::windows::fs::{MetadataExt, OpenOptionsExt},
    path::{Path, PathBuf},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

#[derive(Clone)]
pub struct Options {
    pub extra_roots: Vec<PathBuf>,
    pub seconds: u64,
    pub max_entries: usize,
    pub installed_programs: bool,
    pub discover_drives: bool,
}
impl Default for Options {
    fn default() -> Self {
        Self {
            extra_roots: vec![],
            seconds: 120,
            max_entries: 400000,
            installed_programs: true,
            discover_drives: true,
        }
    }
}

pub fn parse_coverage(bytes: &[u8]) -> Coverage {
    #[derive(serde::Deserialize)]
    struct Settings {
        sources: Vec<String>,
        automatic: Option<bool>,
    }
    let bad = |s: &str| Coverage {
        status: s.into(),
        automatic: None,
        sources: vec![],
    };
    if bytes.len() > 256 * 1024 {
        return bad("oversize");
    }
    let Ok(s) = serde_json::from_slice::<Settings>(bytes) else {
        return bad("invalid");
    };
    if s.sources.len() > 256
        || s.sources
            .iter()
            .any(|p| platform::lexical_shape(Path::new(p)).is_err())
    {
        return bad("invalid_sources");
    }
    Coverage {
        status: "configuration_only_not_remote_verified".into(),
        automatic: s.automatic,
        sources: s
            .sources
            .iter()
            .map(|p| ReportPath::new(Path::new(p)))
            .collect(),
    }
}
pub fn read_coverage(scope: &Scope) -> Coverage {
    let p = scope
        .roaming
        .join("SoloWorkBackup\\cloud-vault\\settings.json");
    let bad = |s: &str| Coverage {
        status: s.into(),
        automatic: None,
        sources: vec![],
    };
    if let Err(e) = platform::safe_existing(&p) {
        return bad(&e);
    }
    if platform::file_size(&p).unwrap_or(u64::MAX) > 256 * 1024 {
        return bad("oversize_or_unreadable");
    }
    // Final component must not be followed if it changes to a link between the checks.
    let Ok(f) = OpenOptions::new()
        .read(true)
        .custom_flags(0x00200000)
        .open(&p)
    else {
        return bad("unreadable");
    };
    let Ok(meta) = f.metadata() else {
        return bad("unreadable");
    };
    if !meta.is_file() || platform::skip_attributes(meta.file_attributes()) {
        return bad("reparse_or_not_file");
    }
    let mut bytes = Vec::new();
    if f.take(256 * 1024 + 1).read_to_end(&mut bytes).is_err() {
        return bad("unreadable");
    }
    parse_coverage(&bytes)
}
fn relation(p: &Path, c: &Coverage) -> String {
    if c.status != "configuration_only_not_remote_verified" {
        return "unknown_configuration".into();
    }
    if c.sources
        .iter()
        .any(|s| platform::within(p, Path::new(&s.raw)))
    {
        return "inside_configured_source_not_verified".into();
    }
    if c.sources
        .iter()
        .any(|s| platform::within(Path::new(&s.raw), p))
    {
        return "contains_some_configured_sources".into();
    }
    "outside_this_apps_configured_sources".into()
}
pub fn cache_rule(
    name: &str,
    siblings: &HashSet<String>,
    child_names: &HashSet<String>,
) -> Option<&'static str> {
    match name {
        "node_modules" if siblings.contains("package.json") => {
            Some("node_modules_with_package_json")
        }
        "target" if siblings.contains("cargo.toml") => Some("target_with_cargo_toml"),
        ".venv" | "venv" if child_names.contains("pyvenv.cfg") => Some("venv_with_pyvenv_cfg"),
        _ => None,
    }
}
fn project_marker(entries: &[Entry]) -> Option<&'static str> {
    if entries
        .iter()
        .any(|e| e.name.to_string_lossy().eq_ignore_ascii_case(".git"))
    {
        return Some("git_marker_name_only");
    }
    if entries.iter().any(|e| {
        !e.is_dir()
            && matches!(
                e.name.to_string_lossy().to_lowercase().as_str(),
                "package.json"
                    | "cargo.toml"
                    | "pyproject.toml"
                    | "requirements.txt"
                    | "environment.yml"
            )
    }) {
        return Some("project_manifest_name_only");
    }
    if entries.iter().any(|e| {
        !e.is_dir()
            && e.path.extension().is_some_and(|v| {
                matches!(
                    v.to_string_lossy().to_lowercase().as_str(),
                    "sln" | "code-workspace"
                )
            })
    }) {
        return Some("workspace_marker_name_only");
    }
    None
}
pub fn ai_name(name: &str) -> bool {
    [
        "comfyui",
        "stable-diffusion",
        "huggingface",
        "checkpoints",
        "datasets",
    ]
    .iter()
    .any(|x| name.contains(x))
        || name
            .split(|c: char| !c.is_alphanumeric())
            .any(|s| matches!(s, "lora" | "loras"))
        || name == "models"
}
fn secret_name(name: &str) -> bool {
    ["secret", "credential", "보안"]
        .iter()
        .any(|x| name.contains(x))
        || matches!(name, ".ssh" | ".gnupg" | ".aws" | ".azure")
}

struct Scanner<'a> {
    scope: &'a Scope,
    deadline: Instant,
    max_entries: usize,
    visited: usize,
    candidates: Vec<Candidate>,
    index: HashMap<String, usize>,
    events: Vec<Event>,
    total: Stats,
    coverage: Coverage,
}
impl<'a> Scanner<'a> {
    fn exhausted(&self) -> bool {
        self.visited >= self.max_entries || Instant::now() >= self.deadline
    }
    fn event(&mut self, path: Option<&Path>, reason: &str) {
        if self.events.len() < 5000 {
            self.events.push(Event {
                path: path.map(ReportPath::new),
                reason: reason.into(),
            });
        } else {
            self.total.issue("event_list_limit");
        }
    }
    fn add(&mut self, p: &Path, category: &str, evidence: &str) {
        let k = platform::key(p);
        if let Some(i) = self.index.get(&k).copied() {
            if !self.candidates[i].evidence.iter().any(|v| v == evidence) {
                self.candidates[i].evidence.push(evidence.into());
            }
            return;
        }
        if self.candidates.len() >= 5000 {
            self.total.issue("candidate_limit");
            return;
        }
        let state = match self
            .scope
            .allowed(p)
            .and_then(|_| platform::safe_existing(p).map(|_| ()))
        {
            Ok(()) => "present".into(),
            Err(e) => e,
        };
        let mut stats = Stats::default();
        if state != "present" {
            stats.issue(&state);
        }
        self.index.insert(k, self.candidates.len());
        self.candidates.push(Candidate {
            path: ReportPath::new(p),
            category: category.into(),
            evidence: vec![evidence.into()],
            state,
            configured_coverage: relation(p, &self.coverage),
            stats,
        });
    }
    fn list(&mut self, p: &Path) -> Vec<Entry> {
        if self.exhausted() {
            self.issue(p, "global_scan_limit");
            return vec![];
        }
        let cap = 20000.min(self.max_entries.saturating_sub(self.visited));
        let (mut entries, error) = platform::entries(p, cap, self.deadline);
        self.visited += entries.len();
        if let Some(e) = error {
            self.issue(p, &e);
        }
        entries.sort_by(|a, b| a.name.cmp(&b.name));
        entries
    }
    fn ancestors(&self, p: &Path) -> Vec<usize> {
        p.ancestors()
            .filter_map(|a| self.index.get(&platform::key(a)).copied())
            .collect()
    }
    fn issue(&mut self, p: &Path, why: &str) {
        self.total.issue(why);
        self.event(Some(p), why);
        for i in self.ancestors(p) {
            self.candidates[i].stats.issue(why);
        }
    }
    fn count_file(&mut self, p: &Path, bytes: u64) {
        // Extensions only; filenames/content and arbitrary extensions are not emitted.
        let ext = p
            .extension()
            .map(|v| v.to_string_lossy().to_ascii_lowercase())
            .unwrap_or_default();
        let class = match ext.as_str() {
            "md" | "mdx" => "markdown",
            "safetensors" | "ckpt" | "gguf" | "pt" | "pth" | "onnx" => "model",
            "db" | "sqlite" | "sqlite3" => "database_needs_consistency",
            "json" | "toml" | "yaml" | "yml" | "ini" => "configuration_or_data",
            "psd" | "blend" | "prproj" | "aep" => "creative_project",
            "py" | "rs" | "js" | "ts" | "tsx" | "ipynb" => "source_code",
            _ => "other",
        };
        let add = |s: &mut Stats| {
            s.files += 1;
            s.logical_bytes = s.logical_bytes.saturating_add(bytes);
            *s.extensions.entry(class.into()).or_default() += 1;
        };
        add(&mut self.total);
        for i in self.ancestors(p) {
            add(&mut self.candidates[i].stats);
        }
    }
    fn skip_tree(&mut self, p: &Path, reason: &str) {
        self.issue(p, reason);
        for c in &mut self.candidates {
            if platform::within(Path::new(&c.path.raw), p) {
                c.stats.issue(reason);
            }
        }
    }
    fn safe_entry(&mut self, e: &Entry) -> bool {
        if e.name.to_str().is_none() {
            self.issue(&e.path, "non_unicode_name_skipped");
            return false;
        }
        if platform::skip_attributes(e.attributes) {
            self.issue(&e.path, "reparse_or_cloud_placeholder");
            return false;
        }
        if let Err(reason) = self.scope.allowed(&e.path) {
            self.issue(&e.path, &reason);
            return false;
        }
        true
    }
    fn discover(&mut self, root: &Path) {
        let mut queue = VecDeque::from([(root.to_path_buf(), 0)]);
        let start = self.visited;
        while let Some((p, depth)) = queue.pop_front() {
            if self.exhausted() || self.visited.saturating_sub(start) >= 20000 {
                self.event(Some(root), "shallow_discovery_limit");
                self.total.issue("shallow_discovery_limit");
                break;
            }
            let entries = self.list(&p);
            if let Some(m) = project_marker(&entries) {
                self.add(&p, "irreplaceable", m);
                continue;
            }
            for e in entries.into_iter().filter(|e| e.is_dir()) {
                if !self.safe_entry(&e) {
                    continue;
                }
                // Known user folders are scanned separately. Do not enumerate other profiles.
                if platform::within(&e.path, &self.scope.profile) {
                    continue;
                }
                let name = e.name.to_string_lossy().to_lowercase();
                if ai_name(&name) {
                    self.add(&e.path, "irreplaceable", "ai_directory_name_hint");
                } else if depth < 3 && queue.len() < 20000 {
                    queue.push_back((e.path, depth + 1));
                }
            }
        }
    }
    fn measure(&mut self) {
        let manual: Vec<PathBuf> = self
            .candidates
            .iter()
            .filter(|c| c.state == "manual_export_required")
            .map(|c| PathBuf::from(&c.path.raw))
            .collect();
        let mut roots: Vec<PathBuf> = self
            .candidates
            .iter()
            .filter(|c| c.state == "present")
            .map(|c| PathBuf::from(&c.path.raw))
            .collect();
        roots.sort_by_key(|p| (p.components().count(), platform::key(p)));
        let mut minimal: Vec<PathBuf> = vec![];
        for p in roots {
            if !minimal.iter().any(|r| platform::within(&p, r)) {
                minimal.push(p);
            }
        }
        let mut queue: VecDeque<(PathBuf, usize)> = minimal.into_iter().map(|p| (p, 0)).collect();
        let mut seen = HashSet::new();
        while let Some((p, depth)) = queue.pop_front() {
            if self.exhausted() {
                self.total.issue("global_scan_limit");
                for c in &mut self.candidates {
                    if c.state == "present" {
                        c.stats.issue("global_scan_limit");
                    }
                }
                break;
            }
            if !seen.insert(platform::key(&p)) {
                continue;
            }
            if manual.iter().any(|root| platform::within(&p, root)) {
                self.skip_tree(&p, "manual_export_required_not_scanned");
                continue;
            }
            let attrs = match platform::safe_existing(&p) {
                Ok(a) => a,
                Err(e) => {
                    self.issue(&p, &e);
                    continue;
                }
            };
            if attrs & 0x10 == 0 {
                self.visited += 1;
                match platform::file_size(&p) {
                    Ok(n) => self.count_file(&p, n),
                    Err(_) => self.issue(&p, "metadata_unreadable"),
                };
                continue;
            }
            let entries = self.list(&p);
            if let Some(m) = project_marker(&entries) {
                self.add(&p, "irreplaceable", m);
            }
            let siblings: HashSet<String> = entries
                .iter()
                .map(|e| e.name.to_string_lossy().to_lowercase())
                .collect();
            for e in entries {
                if !self.safe_entry(&e) {
                    continue;
                }
                if !e.is_dir() {
                    self.count_file(&e.path, e.size);
                    continue;
                }
                let name = e.name.to_string_lossy().to_lowercase();
                if secret_name(&name) {
                    self.add(
                        &e.path,
                        "credential_location",
                        "sensitive_directory_name_hint",
                    );
                } else if ai_name(&name) {
                    self.add(&e.path, "irreplaceable", "ai_directory_name_hint");
                }
                let child_names = if matches!(name.as_str(), "venv" | ".venv")
                    && platform::safe_existing(&e.path.join("pyvenv.cfg")).is_ok()
                {
                    HashSet::from(["pyvenv.cfg".into()])
                } else {
                    HashSet::new()
                };
                if let Some(rule) = cache_rule(&name, &siblings, &child_names) {
                    self.add(&e.path, "regenerable", rule);
                    self.skip_tree(&e.path, "recreate_candidate_unverified_not_scanned");
                    continue;
                }
                if depth >= 64 {
                    self.skip_tree(&e.path, "depth_limit");
                    continue;
                }
                if queue.len() >= 100000 {
                    self.skip_tree(&e.path, "queue_limit");
                    continue;
                }
                queue.push_back((e.path, depth + 1));
            }
        }
    }
}

pub fn collection_complete(
    total: &Stats,
    candidates: &[Candidate],
    collectors: &[CollectorStatus],
) -> bool {
    total.incomplete.is_empty()
        && candidates
            .iter()
            .all(|c| c.stats.incomplete.is_empty() || c.state == "not_found")
        && collectors
            .iter()
            .all(|c| matches!(c.status.as_str(), "complete" | "disabled"))
}
pub fn scan(scope: &Scope, options: &Options) -> Inventory {
    let start = Instant::now();
    let deadline = start + Duration::from_secs(options.seconds);
    let mut s = Scanner {
        scope,
        deadline,
        max_entries: options.max_entries,
        visited: 0,
        candidates: vec![],
        index: HashMap::new(),
        events: vec![],
        total: Stats::default(),
        coverage: read_coverage(scope),
    };
    let mut programs = vec![];
    let mut collectors = vec![];
    for name in &scope.unresolved_known_folders {
        s.total.issue("known_folder_unavailable");
        s.event(None, &format!("known_folder_{name}_unavailable"));
    }
    if options.installed_programs {
        let (p, c) = platform::registry_programs(deadline);
        programs.extend(p);
        collectors.push(c);
        let (p, c) = platform::msix_programs(deadline);
        programs.extend(p);
        collectors.push(c);
    }
    for (label, p) in &scope.folders {
        s.add(p, "irreplaceable", &format!("known_folder_{label}"));
    }
    for name in [
        ".codex",
        ".claude",
        ".claude.json",
        ".agents",
        ".gemini",
        ".ollama",
        ".config",
    ] {
        s.add(
            &scope.profile.join(name),
            "ai_settings",
            "known_ai_or_developer_location",
        );
    }
    for name in [
        ".ssh",
        ".gnupg",
        ".aws",
        ".azure",
        ".gitconfig",
        ".git-credentials",
        ".npmrc",
        ".pypirc",
    ] {
        s.add(
            &scope.profile.join(name),
            "credential_location",
            "known_sensitive_location_metadata_only",
        );
    }
    for name in [
        "Code\\User",
        "Cursor\\User",
        "Windsurf\\User",
        "Claude",
        "Blender Foundation\\Blender",
        "obsidian",
        "SoloWorkBackup",
    ] {
        s.add(
            &scope.roaming.join(name),
            "ai_settings",
            "known_application_settings",
        );
    }
    for name in ["Ollama", "Docker", "Packages"] {
        s.add(
            &scope.local.join(name),
            "external_manual",
            "needs_app_specific_export_or_consistency",
        );
    }
    for program in &programs {
        let name = program.name.to_ascii_lowercase();
        if ["codex", "claude", "chatgpt", "cursor", "vscode"]
            .iter()
            .any(|n| name.contains(n))
        {
            if let Some(family) = &program.package_family {
                s.add(
                    &scope.local.join("Packages").join(family),
                    "external_manual",
                    "known_msix_ai_application_data",
                );
            }
        }
    }
    // Large container/app stores are recorded, not recursively opened in this version.
    for c in &mut s.candidates {
        if c.category == "external_manual" && c.state == "present" {
            c.state = "manual_export_required".into();
            c.stats.issue("not_scanned");
        }
    }
    for name in [
        "CODEX_HOME",
        "CLAUDE_CONFIG_DIR",
        "OLLAMA_MODELS",
        "HF_HOME",
        "XDG_CONFIG_HOME",
    ] {
        if let Some(value) = std::env::var_os(name) {
            let p = PathBuf::from(value);
            if scope
                .allowed(&p)
                .and_then(|_| platform::safe_existing(&p).map(|_| ()))
                .is_ok()
            {
                s.add(&p, "ai_settings", &format!("environment_{name}"));
            } else {
                s.event(None, &format!("environment_{name}_set_but_rejected"));
            }
        }
    }
    // Top-level personal work folders, without opening private file contents.
    for e in s.list(&scope.profile) {
        let n = e.name.to_string_lossy().to_lowercase();
        if e.is_dir()
            && (secret_name(&n)
                || ai_name(&n)
                || matches!(
                    n.as_str(),
                    "projects" | "repos" | "source" | "work" | "workspace" | "dev"
                ))
        {
            s.add(
                &e.path,
                if secret_name(&n) {
                    "credential_location"
                } else {
                    "irreplaceable"
                },
                "profile_directory_name_hint",
            );
        }
    }
    // Executable locations are evidence of availability, never execution or usage proof.
    let mut hints = 0;
    let mut hint_status = "complete";
    if options.installed_programs {
        if let Some(value) = std::env::var_os("PATH") {
            for parent in std::env::split_paths(&value).take(256) {
                if s.exhausted() {
                    hint_status = "time_limit";
                    break;
                }
                if scope.allowed(&parent).is_err() || platform::safe_existing(&parent).is_err() {
                    continue;
                }
                for name in [
                    "python.exe",
                    "node.exe",
                    "git.exe",
                    "cargo.exe",
                    "ollama.exe",
                    "code.cmd",
                    "cursor.cmd",
                    "uv.exe",
                ] {
                    let p = parent.join(name);
                    if platform::safe_existing(&p).is_ok_and(|a| a & 0x10 == 0) {
                        programs.push(Program {
                            name: name.into(),
                            version: String::new(),
                            publisher: String::new(),
                            install_location: display_text(&p.to_string_lossy()),
                            source: "path_hint_not_executed".into(),
                            package_family: None,
                        });
                        hints += 1;
                    }
                }
            }
        }
    }
    collectors.push(CollectorStatus {
        collector: "path_executable_hints".into(),
        status: if options.installed_programs {
            hint_status
        } else {
            "disabled"
        }
        .into(),
        count: hints,
    });
    for p in &options.extra_roots {
        s.add(p, "irreplaceable", "explicit_root");
    }
    if options.discover_drives {
        for d in platform::fixed_drives() {
            s.discover(&d);
        }
    }
    s.measure();
    s.candidates
        .sort_by(|a, b| (&a.category, &a.path.raw).cmp(&(&b.category, &b.path.raw)));
    let scan_complete = collection_complete(&s.total, &s.candidates, &collectors);
    Inventory { schema_version:1, generated_unix_seconds:SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs(), elapsed_ms:start.elapsed().as_millis(), scan_complete,
        limits:format!("{} seconds / {} entries / discovery depth 4 / directory 20000 / scan depth 64; observed {} entries",options.seconds,options.max_entries,s.visited),
        total:s.total, programs, collectors, candidates:s.candidates,events:s.events,coverage:s.coverage,
        limitations:vec!["Metadata only; no file contents, AI messages, tokens or credentials were inspected. Only safe fields of this app's fixed settings file were read.".into(),"This is discovery, not a backup or a recovery guarantee. Configuration overlap is not remote verification.".into(),"Bounded current-user/fixed-disk sample; portable software, custom locations, other users, WSL/Docker volumes and online SaaS may be missing.".into(),"Logical bytes counted once per path; parent/child candidate sizes overlap. Hard links can count more than once; not cloud billed size.".into(),"No consistent snapshot: running apps may change files. Open databases need an app-specific export, application shutdown or VSS.".into(),"Login sessions, DPAPI-protected secrets, licenses, drivers and Windows itself are not portable file restores.".into(),"Reparse points and cloud placeholders were skipped, never hydrated. Case-sensitive directory trees are not fully supported.".into(),"The scanner performs no upload; third-party software can independently sync local reports.".into()] }
}

/// Fixture-only entry point: shares the exact traversal and overlap logic, without collecting the host.
pub fn scan_roots(scope: &Scope, roots: &[PathBuf], max_entries: usize) -> (Vec<Candidate>, Stats) {
    let mut s = Scanner {
        scope,
        deadline: Instant::now() + Duration::from_secs(20),
        max_entries,
        visited: 0,
        candidates: vec![],
        index: HashMap::new(),
        events: vec![],
        total: Stats::default(),
        coverage: Coverage {
            status: "not_found".into(),
            automatic: None,
            sources: vec![],
        },
    };
    for p in roots {
        s.add(p, "irreplaceable", "fixture");
    }
    s.measure();
    (s.candidates, s.total)
}
