use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce};
use base64::{engine::general_purpose::STANDARD, Engine};
use std::{ptr, slice};
use windows_sys::Win32::{Foundation::LocalFree, Security::Cryptography::{CryptProtectData, CryptUnprotectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN}};
use zeroize::Zeroizing;

const MARKER: &[u8] = b"SWBR1";
pub const MAX_SECRET: usize = 65536;

fn dpapi(input: &[u8], encrypt: bool) -> Result<Zeroizing<Vec<u8>>, String> {
    if input.is_empty() || input.len() > MAX_SECRET + 4096 { return Err("SECRET_SIZE".into()); }
    let mut data = CRYPT_INTEGER_BLOB { cbData: input.len() as u32, pbData: input.as_ptr() as *mut u8 };
    let mut output = CRYPT_INTEGER_BLOB { cbData: 0, pbData: ptr::null_mut() };
    let result = unsafe {
        if encrypt { CryptProtectData(&mut data, ptr::null(), ptr::null(), ptr::null(), ptr::null(), CRYPTPROTECT_UI_FORBIDDEN, &mut output) }
        else { CryptUnprotectData(&mut data, ptr::null_mut(), ptr::null(), ptr::null(), ptr::null(), CRYPTPROTECT_UI_FORBIDDEN, &mut output) }
    };
    if result == 0 { return Err("SECRET_UNAVAILABLE".into()); }
    let value = unsafe { Zeroizing::new(slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec()) };
    unsafe { std::ptr::write_bytes(output.pbData, 0, output.cbData as usize); LocalFree(output.pbData as *mut _); }
    Ok(value)
}

pub fn encrypt(input: &str) -> Result<String, String> {
    if input.len() > MAX_SECRET { return Err("SECRET_SIZE".into()); }
    let protected = dpapi(input.as_bytes(), true)?;
    let mut result = MARKER.to_vec(); result.extend_from_slice(&protected);
    Ok(STANDARD.encode(result))
}

pub fn decrypt(encoded: &str) -> Result<Zeroizing<String>, String> {
    if encoded.len() > (MAX_SECRET + 4096) * 2 { return Err("SECRET_SIZE".into()); }
    let bytes = STANDARD.decode(encoded).map_err(|_| "SECRET_FORMAT")?;
    if !bytes.starts_with(MARKER) { return Err("LEGACY_SECRET".into()); }
    let plaintext = dpapi(&bytes[MARKER.len()..], false)?;
    let value = String::from_utf8(plaintext.to_vec()).map_err(|_| "SECRET_FORMAT")?;
    Ok(Zeroizing::new(value))
}

// Used only by the offline migration verifier. It is never a webview command.
// Electron/Chromium v10: prefix + 12-byte IV + ciphertext + 16-byte GCM tag.
pub fn legacy_decrypt(encoded: &str, local_state: &str) -> Result<Zeroizing<String>, String> {
    if encoded.len() > (MAX_SECRET + 4096) * 2 || local_state.len() > 1024 * 1024 { return Err("SECRET_SIZE".into()); }
    let bytes = STANDARD.decode(encoded).map_err(|_| "SECRET_FORMAT")?;
    if bytes.len() < 31 || &bytes[..3] != b"v10" { return Err("LEGACY_SECRET".into()); }
    let state: serde_json::Value = serde_json::from_str(local_state).map_err(|_| "LEGACY_SECRET")?;
    let wrapped = STANDARD.decode(state["os_crypt"]["encrypted_key"].as_str().ok_or("LEGACY_SECRET")?).map_err(|_| "LEGACY_SECRET")?;
    if !wrapped.starts_with(b"DPAPI") { return Err("LEGACY_SECRET".into()); }
    let key = dpapi(&wrapped[5..], false)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| "LEGACY_SECRET")?;
    let clear = Zeroizing::new(cipher.decrypt(Nonce::from_slice(&bytes[3..15]), &bytes[15..]).map_err(|_| "LEGACY_SECRET")?);
    Ok(Zeroizing::new(String::from_utf8(clear.to_vec()).map_err(|_| "LEGACY_SECRET")?))
}

#[cfg(test)] mod tests {
    use super::*;
    #[test] fn current_user_roundtrip_and_tamper() {
        let sample = "복구 정보 fixture"; let encoded = encrypt(sample).unwrap();
        assert_eq!(decrypt(&encoded).unwrap().as_str(), sample);
        let mut bytes = STANDARD.decode(&encoded).unwrap(); let last = bytes.len()-1; bytes[last] ^= 1;
        assert!(decrypt(&STANDARD.encode(bytes)).is_err());
        assert!(encrypt(&"x".repeat(MAX_SECRET+1)).is_err());
    }
    #[test] fn electron_fixture_when_provided() {
        let root = std::env::var("SWB_LEGACY_FIXTURE").expect("required exact Electron safeStorage fixture: set SWB_LEGACY_FIXTURE");
        {
            let root = std::path::PathBuf::from(root);
            let fixture: serde_json::Value = serde_json::from_slice(&std::fs::read(root.join("fixture.json")).unwrap()).unwrap();
            let state = std::fs::read_to_string(root.join("state/Local State")).unwrap();
            let value = legacy_decrypt(fixture["cipher"].as_str().unwrap(), &state).unwrap();
            assert_eq!(value.as_str(), fixture["sample"].as_str().unwrap());
            assert_eq!(decrypt(&encrypt(&value).unwrap()).unwrap().as_str(), value.as_str());
        }
    }
}
