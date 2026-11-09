use crate::{platform,secret};
use base64::{engine::general_purpose::STANDARD,Engine};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
use std::{collections::BTreeMap,fs,io::Write,path::{Path,PathBuf},os::windows::fs::MetadataExt};
use zeroize::Zeroizing;

fn read(root:&Path,name:&str,cap:u64)->Result<Vec<u8>,String>{
    let path=root.join(name);let meta=fs::symlink_metadata(&path).map_err(|_|"MIGRATION_INPUT")?;
    if !meta.is_file()||meta.file_attributes()&0x400!=0||meta.len()>cap{return Err("MIGRATION_INPUT".into());}
    let real=fs::canonicalize(&path).map_err(|_|"MIGRATION_INPUT")?;
    if !platform::key_path(&real).starts_with(&(platform::key_path(root)+"\\")){return Err("MIGRATION_INPUT".into());}
    fs::read(path).map_err(|_|"MIGRATION_INPUT".into())
}
fn digest(bytes:&[u8])->String{format!("{:x}",Sha256::digest(bytes))}
fn parse(bytes:&[u8])->Result<Value,String>{serde_json::from_slice(bytes).map_err(|_|"MIGRATION_FORMAT".into())}

// Operator-only, offline preview. No network, no registry mutation, no tokens
// copied, no writes or rename in the legacy directory. New copy is restore-only
// and uses the previously provisioned B2 READ key, never its backup write key.
pub fn cloud_preview(source:&Path,output:&Path)->Result<Value,String>{
    let source=fs::canonicalize(source).map_err(|_|"MIGRATION_SOURCE")?;
    if !output.is_absolute()||output.exists()||platform::overlap(&source,output){return Err("MIGRATION_OUTPUT".into());}
    let parent=fs::canonicalize(output.parent().ok_or("MIGRATION_OUTPUT")?).map_err(|_|"MIGRATION_OUTPUT")?;
    if platform::overlap(&source,&parent.join(output.file_name().ok_or("MIGRATION_OUTPUT")?)){return Err("MIGRATION_OUTPUT".into());}
    let mut originals=BTreeMap::new();
    for (name,cap) in [("Local State",1048576),("cloud-vault/settings.json",1048576),("cloud-vault/credential.bin",131072),("account-recovery/recovery.bin",131072)]{
        originals.insert(name,read(&source,name,cap)?);
    }
    let local=std::str::from_utf8(&originals["Local State"]).map_err(|_|"MIGRATION_FORMAT")?;
    let credential=secret::legacy_decrypt(&STANDARD.encode(&originals["cloud-vault/credential.bin"]),local)?;
    let recovery=secret::legacy_decrypt(&STANDARD.encode(&originals["account-recovery/recovery.bin"]),local)?;
    let mut credential:Value=parse(credential.as_bytes())?;
    let recovery:Value=parse(recovery.as_bytes())?;
    let read_key=&recovery["readKey"]["credentials"];
    let mut config=parse(&originals["cloud-vault/settings.json"])?;
    let repository=config["repositoryId"].as_str().ok_or("MIGRATION_FORMAT")?;
    if config["schema"]!=1||config["provider"]["type"]!="b2"||repository.len()!=64||credential["version"]!=2
        ||recovery["verified"]["repositoryId"]!=config["repositoryId"]
        ||read_key["keyId"].as_str().is_none_or(|s|s.is_empty())||read_key["applicationKey"].as_str().is_none_or(|s|s.is_empty())
        ||read_key["keyId"]==credential["keyId"] {return Err("READ_KEY_REQUIRED".into());}
    credential["keyId"]=read_key["keyId"].clone();credential["applicationKey"]=read_key["applicationKey"].clone();
    let plaintext=Zeroizing::new(serde_json::to_string(&credential).map_err(|_|"MIGRATION_FORMAT")?);
    let encoded=secret::encrypt(&plaintext)?;
    config["mode"]=json!("restore");config["readOnly"]=json!(true);config["automatic"]=json!(false);
    config["sources"]=json!([]);config["lastRestore"]=Value::Null;config["lastSelectedRestore"]=Value::Null;
    config["remoteRecovery"]=Value::Null;config["pausedUntil"]=Value::Null;config["protectRun"]=Value::Null;
    config["recoverySaved"]=json!(true);
    // A concurrent completed backup invalidates this attempt; do not retry a
    // mixed snapshot or write a partial copy that could appear configured.
    for(name,bytes)in &originals{if read(&source,name,1048576)?!=*bytes{return Err("MIGRATION_SOURCE_CHANGED".into());}}
    // Publish only a complete sibling directory. If another app creates the
    // destination meanwhile, the no-replace rename fails and leaves it alone.
    let staging=parent.join(format!(".solo-backup-rust-migration-{}-{}",std::process::id(),std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|_|"MIGRATION_OUTPUT")?.as_nanos()));
    fs::create_dir(&staging).map_err(|_|"MIGRATION_OUTPUT")?;
    fs::create_dir(staging.join("cloud-vault")).map_err(|_|"MIGRATION_OUTPUT")?;
    let mut marker=fs::OpenOptions::new().create_new(true).write(true).open(staging.join("migration-incomplete")).map_err(|_|"MIGRATION_OUTPUT")?;
    marker.write_all(b"not ready").map_err(|_|"MIGRATION_OUTPUT")?;
    fn write(path:PathBuf,bytes:&[u8])->Result<(),String>{let mut file=fs::OpenOptions::new().create_new(true).write(true).open(path).map_err(|_|"MIGRATION_OUTPUT")?;file.write_all(bytes).and_then(|_|file.sync_all()).map_err(|_|"MIGRATION_OUTPUT".into())}
    write(staging.join("cloud-vault/credential.bin"),&STANDARD.decode(encoded).map_err(|_|"MIGRATION_FORMAT")?)?;
    write(staging.join("cloud-vault/settings.json"),&serde_json::to_vec_pretty(&config).map_err(|_|"MIGRATION_FORMAT")?)?;
    let hashes:BTreeMap<_,_>=originals.iter().map(|(n,b)|(*n,digest(b))).collect();
    let receipt=json!({"version":1,"readOnly":true,"automatic":false,"writeKeyCopied":false,"googleTokensCopied":false,"sourceHashes":hashes});
    write(staging.join("migration-receipt.json"),&serde_json::to_vec_pretty(&receipt).unwrap())?;
    for(name,bytes)in &originals{if read(&source,name,1048576)?!=*bytes{return Err("MIGRATION_SOURCE_CHANGED".into());}}
    drop(marker);
    fs::remove_file(staging.join("migration-incomplete")).map_err(|_|"MIGRATION_OUTPUT")?;
    publish(&staging,output)?;
    Ok(receipt)
}

fn publish(staging:&Path,output:&Path)->Result<(),String>{
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{MoveFileExW,MOVEFILE_WRITE_THROUGH};
    let source:Vec<u16>=staging.as_os_str().encode_wide().chain([0]).collect();
    let target:Vec<u16>=output.as_os_str().encode_wide().chain([0]).collect();
    if unsafe{MoveFileExW(source.as_ptr(),target.as_ptr(),MOVEFILE_WRITE_THROUGH)}==0{return Err("MIGRATION_OUTPUT".into());}
    Ok(())
}

#[cfg(test)] mod tests{
    use super::*;
    #[test] fn preview_preserves_source_and_uses_only_read_credential(){
        let fixture=PathBuf::from(std::env::var("SWB_LEGACY_FIXTURE").expect("required Electron fixture"));
        let source=fixture.join("state");
        let output=fixture.join(format!("migration-{}-{}",std::process::id(),std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let before=read(&fs::canonicalize(&source).unwrap(),"cloud-vault/settings.json",1048576).unwrap();
        let result=cloud_preview(&source,&output).unwrap();
        assert_eq!(result["writeKeyCopied"],false);
        assert_eq!(fs::read(source.join("cloud-vault/settings.json")).unwrap(),before);
        let config=parse(&fs::read(output.join("cloud-vault/settings.json")).unwrap()).unwrap();
        assert_eq!(config["mode"],"restore");assert_eq!(config["readOnly"],true);assert_eq!(config["automatic"],false);
        let credential=secret::decrypt(&STANDARD.encode(fs::read(output.join("cloud-vault/credential.bin")).unwrap())).unwrap();
        let value=parse(credential.as_bytes()).unwrap();assert_eq!(value["keyId"],"read-key-fixture");
        assert!(!credential.contains("write-key-fixture"));assert!(!output.join("account-recovery/google.bin").exists());
        assert!(!output.join("migration-incomplete").exists());assert!(cloud_preview(&source,&output).is_err());
        assert!(cloud_preview(&source,&source.join("nested")).is_err());
        let competing=output.with_extension("competing");fs::create_dir(&competing).unwrap();
        assert!(publish(&output,&competing).is_err());
        assert!(output.join("cloud-vault/credential.bin").is_file());
        assert_eq!(fs::read_dir(competing).unwrap().count(),0);
    }
}
