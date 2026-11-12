//! Resource bundle check shared by the window app and the run executable
//! (STAGE1_DESIGN.md 4.3 「리소스 확인 비용」). The manifest is pinned by hash at
//! build time; every listed file must match its size and SHA-256.
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{fs, io::Read, path::{Component, Path}};

/// The run executable leaves restic.exe to the engine, which hashes it against
/// its own pinned SHA-256 before the first use in every worker (engine.cjs), so
/// a scheduled run reads that 31 MB file once instead of twice. Its size is
/// still checked here.
pub const RUN_SKIP: &[&str] = &["restic.exe"];

const REQUIRED: [&str; 7] = ["node.exe", "restic.exe", "worker/dispatcher.cjs", "worker/handlers.cjs", "worker/runner.cjs", "contract/methods.json", "engine/package.json"];

pub fn verify(root: &Path, skip: &[&str]) -> Result<(), String> {
    let bytes = fs::read(root.join("manifest.json")).map_err(|_| "BUNDLE_MISSING")?;
    if let Some(expected) = option_env!("SWB_RESOURCE_MANIFEST_SHA") {
        if format!("{:x}", Sha256::digest(&bytes)) != expected { return Err("BUNDLE_INTEGRITY".into()); }
    } else if !cfg!(debug_assertions) { return Err("BUNDLE_UNSEALED".into()); }
    let manifest: Value = serde_json::from_slice(&bytes).map_err(|_| "BUNDLE_INVALID")?;
    let files = manifest["files"].as_object().ok_or("BUNDLE_INVALID")?;
    if REQUIRED.iter().any(|name| !files.contains_key(*name)) { return Err("BUNDLE_INVALID".into()); }
    for (name, entry) in files {
        if name.contains('\\') || Path::new(name).components().any(|c| !matches!(c, Component::Normal(_))) { return Err("BUNDLE_INVALID".into()); }
        let path = root.join(name);
        let meta = fs::metadata(&path).map_err(|_| "BUNDLE_MISSING")?;
        if !meta.is_file() { return Err("BUNDLE_MISSING".into()); }
        if Some(meta.len()) != entry["size"].as_u64() { return Err("BUNDLE_INTEGRITY".into()); }
        if skip.contains(&name.as_str()) { continue; }
        let mut file = fs::File::open(&path).map_err(|_| "BUNDLE_MISSING")?;
        let mut hash = Sha256::new(); let mut buffer = vec![0u8; 1 << 20]; let mut size = 0u64;
        loop { let read = file.read(&mut buffer).map_err(|_| "BUNDLE_READ")?; if read == 0 { break; } size += read as u64; hash.update(&buffer[..read]); }
        if Some(size) != entry["size"].as_u64() || Some(format!("{:x}", hash.finalize()).as_str()) != entry["sha256"].as_str() { return Err("BUNDLE_INTEGRITY".into()); }
    }
    Ok(())
}

#[cfg(test)] mod tests {
    use super::*;
    use serde_json::json;
    fn put(dir: &Path, name: &str, bytes: &[u8], files: &mut serde_json::Map<String, Value>) {
        let path = dir.join(name); fs::create_dir_all(path.parent().unwrap()).unwrap(); fs::write(&path, bytes).unwrap();
        files.insert(name.into(), json!({"size": bytes.len(), "sha256": format!("{:x}", Sha256::digest(bytes))}));
    }
    #[test] fn skipped_files_keep_the_size_check() {
        let dir = std::env::temp_dir().join(format!("swb-bundle-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir); fs::create_dir_all(&dir).unwrap();
        let mut files = serde_json::Map::new();
        for name in REQUIRED { put(&dir, name, name.as_bytes(), &mut files); }
        fs::write(dir.join("manifest.json"), serde_json::to_vec(&json!({"files": files})).unwrap()).unwrap();
        assert_eq!(verify(&dir, &[]), Ok(()));
        // Same size, different bytes: only a skipped file passes.
        fs::write(dir.join("restic.exe"), b"RESTIC.EXE").unwrap();
        assert_eq!(verify(&dir, &[]), Err("BUNDLE_INTEGRITY".into()));
        assert_eq!(verify(&dir, RUN_SKIP), Ok(()));
        fs::write(dir.join("restic.exe"), b"restic.exe!").unwrap();
        assert_eq!(verify(&dir, RUN_SKIP), Err("BUNDLE_INTEGRITY".into()), "size still checked");
        fs::write(dir.join("node.exe"), b"NODE.EXE").unwrap();
        assert_eq!(verify(&dir, RUN_SKIP), Err("BUNDLE_INTEGRITY".into()), "node is executed, so it is hashed");
        fs::remove_dir_all(&dir).unwrap();
    }
}
