fn main() { println!("cargo:rerun-if-env-changed=SWB_RESOURCE_MANIFEST_SHA"); tauri_build::build(); }
