//! Metadata-only, bounded preflight. No writes, content reads, subprocesses or network.
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashSet, VecDeque},
    io::{self, Read},
    path::{Path, PathBuf},
    time::{Duration, Instant},
};
use work_backup_inventory::{
    platform::{self, Scope},
    scan::cache_rule,
};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    sources: Vec<String>,
    exclusions: Vec<String>,
}
#[derive(Serialize)]
struct Omission {
    path: String,
    reason: String,
}
#[derive(Serialize)]
struct Plan {
    schema: u32,
    complete: bool,
    sources: Vec<String>,
    files: u64,
    bytes: u64,
    databases: u64,
    exclusions: Vec<Omission>,
    errors: Vec<Omission>,
}
fn note(list: &mut Vec<Omission>, p: &Path, why: &str) {
    if list.len() < 10000 {
        list.push(Omission {
            path: p.to_string_lossy().into(),
            reason: why.into(),
        });
    }
}
fn excluded_key(k: &str, exclusions: &[(String, String)]) -> bool {
    exclusions
        .iter()
        .any(|(exact, prefix)| k == exact || k.starts_with(prefix))
}
fn scan(request: Request) -> Result<Plan, String> {
    if request.sources.is_empty() || request.sources.len() > 200 || request.exclusions.len() > 10000
    {
        return Err("invalid_plan_size".into());
    }
    let scope = Scope::current().map_err(|_| "scope_unavailable")?;
    let mut roots: Vec<PathBuf> = vec![];
    let mut excluded: Vec<PathBuf> = vec![];
    for s in &request.sources {
        let p = PathBuf::from(s);
        scope.allowed(&p).map_err(|e| format!("source_{e}"))?;
        platform::safe_existing(&p)?;
        if p.parent().is_none() || p.components().count() < 3 {
            return Err("drive_root_forbidden".into());
        }
        roots.push(p);
    }
    for s in &request.exclusions {
        let p = PathBuf::from(s);
        platform::lexical_shape(&p).map_err(str::to_string)?;
        excluded.push(p);
    }
    let excluded_keys: Vec<_> = excluded
        .iter()
        .map(|p| {
            let k = platform::key(p);
            let prefix = format!("{k}\\");
            (k, prefix)
        })
        .collect();
    roots.sort_by_cached_key(|p| (p.components().count(), platform::key(p)));
    let mut minimal: Vec<PathBuf> = vec![];
    for p in roots {
        if !minimal.iter().any(|r| platform::within(&p, r)) {
            minimal.push(p);
        }
    }
    let mut out = Plan {
        schema: 1,
        complete: true,
        sources: minimal.iter().map(|p| p.to_string_lossy().into()).collect(),
        files: 0,
        bytes: 0,
        databases: 0,
        exclusions: vec![],
        errors: vec![],
    };
    for p in &excluded {
        note(&mut out.exclusions, p, "explicit_exclusion");
    }
    let mut queue: VecDeque<_> = minimal.into_iter().map(|p| (p, 0usize)).collect();
    let deadline = Instant::now() + Duration::from_secs(300);
    let mut visited = 0usize;
    let mut seen = HashSet::new();
    while let Some((p, depth)) = queue.pop_front() {
        if Instant::now() >= deadline
            || visited >= 2000000
            || out.exclusions.len() >= 10000
            || out.errors.len() >= 10000
        {
            note(&mut out.errors, &p, "scan_limit");
            out.complete = false;
            break;
        }
        let pkey = platform::key(&p);
        if excluded_key(&pkey, &excluded_keys) || !seen.insert(pkey) {
            continue;
        }
        let attrs = match platform::safe_existing(&p) {
            Ok(a) => a,
            Err(e) => {
                if e == "reparse_or_cloud_placeholder" {
                    note(&mut out.exclusions, &p, &e);
                } else {
                    note(&mut out.errors, &p, &e);
                }
                continue;
            }
        };
        if attrs & 0x10 == 0 {
            match platform::file_size(&p) {
                Ok(n) => {
                    out.files += 1;
                    out.bytes = out.bytes.checked_add(n).ok_or("size_overflow")?;
                    if matches!(
                        p.extension().and_then(|x| x.to_str()),
                        Some("db" | "sqlite" | "sqlite3")
                    ) {
                        out.databases += 1;
                    }
                }
                Err(_) => note(&mut out.errors, &p, "unreadable_metadata"),
            };
            visited += 1;
            continue;
        }
        let (entries, error) = platform::entries(
            &p,
            100000.min(2000000usize.saturating_sub(visited)),
            deadline,
        );
        visited += entries.len();
        if let Some(e) = error {
            note(&mut out.errors, &p, &e);
        }
        let names: HashSet<String> = entries
            .iter()
            .map(|e| e.name.to_string_lossy().to_lowercase())
            .collect();
        let repo = entries.iter().any(|e| e.name == "config" && !e.is_dir())
            && ["data", "keys", "snapshots", "index"]
                .iter()
                .all(|n| entries.iter().any(|e| e.name == *n && e.is_dir()));
        if repo {
            note(&mut out.exclusions, &p, "existing_restic_repository");
            continue;
        }
        for e in entries {
            if excluded_key(&platform::key(&e.path), &excluded_keys) {
                continue;
            }
            if platform::skip_attributes(e.attributes) {
                note(&mut out.exclusions, &e.path, "reparse_or_cloud_placeholder");
                continue;
            }
            if let Err(why) = scope.allowed(&e.path) {
                note(&mut out.exclusions, &e.path, &why);
                continue;
            }
            if e.name.to_str().is_none() || platform::lexical_shape(&e.path).is_err() {
                note(&mut out.errors, &e.path, "ambiguous_path");
                continue;
            }
            if e.is_dir() {
                let name = e.name.to_string_lossy().to_lowercase();
                let child = if matches!(name.as_str(), "venv" | ".venv")
                    && platform::safe_existing(&e.path.join("pyvenv.cfg")).is_ok()
                {
                    HashSet::from(["pyvenv.cfg".into()])
                } else {
                    HashSet::new()
                };
                if let Some(why) = cache_rule(&name, &names, &child) {
                    note(&mut out.exclusions, &e.path, why);
                    continue;
                }
                if depth >= 96 {
                    note(&mut out.errors, &e.path, "depth_limit");
                    continue;
                }
                queue.push_back((e.path, depth + 1));
            } else {
                out.files += 1;
                out.bytes = out.bytes.checked_add(e.size).ok_or("size_overflow")?;
                if matches!(
                    e.path.extension().and_then(|x| x.to_str()),
                    Some("db" | "sqlite" | "sqlite3")
                ) {
                    out.databases += 1;
                }
            }
        }
    }
    if out.exclusions.len() >= 10000 {
        note(
            &mut out.errors,
            Path::new(&out.sources[0]),
            "exclusion_limit",
        );
    }
    if visited >= 2000000 {
        note(&mut out.errors, Path::new(&out.sources[0]), "entry_limit");
    }
    out.complete &= out.errors.is_empty();
    out.exclusions
        .sort_by_cached_key(|e| platform::key(Path::new(&e.path)));
    out.exclusions
        .dedup_by(|a, b| platform::key(Path::new(&a.path)) == platform::key(Path::new(&b.path)));
    Ok(out)
}
fn main() {
    let result = (|| -> Result<Plan, String> {
        let mut bytes = vec![];
        io::stdin()
            .take(2 * 1024 * 1024 + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| "input_read")?;
        if bytes.len() > 2 * 1024 * 1024 {
            return Err("input_limit".into());
        }
        scan(serde_json::from_slice(&bytes).map_err(|_| "invalid_request")?)
    })();
    match result {
        Ok(p) => println!("{}", serde_json::to_string(&p).unwrap()),
        Err(e) => {
            eprintln!("planner: {e}");
            std::process::exit(1);
        }
    }
}
