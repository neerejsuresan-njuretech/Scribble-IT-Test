use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use url::Url;
use uuid::Uuid;
use zeroize::Zeroizing;

#[cfg(target_os = "windows")]
const KEYRING_SERVICE: &str = "in.njuretech.scribbleit.windows";
#[cfg(target_os = "macos")]
const KEYRING_SERVICE: &str = "in.njuretech.scribbleit.macos";
#[cfg(target_os = "linux")]
const KEYRING_SERVICE: &str = "in.njuretech.scribbleit.linux";
#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
const KEYRING_SERVICE: &str = "in.njuretech.scribbleit";

#[cfg(target_os = "windows")]
const CREDENTIAL_BACKEND_LABEL: &str = "Windows Credential Manager (DPAPI / keyring)";
#[cfg(target_os = "macos")]
const CREDENTIAL_BACKEND_LABEL: &str = "Apple Keychain (Security.framework / keyring)";
#[cfg(target_os = "linux")]
const CREDENTIAL_BACKEND_LABEL: &str = "Linux Secret Service (GNOME Keyring / KWallet via keyring)";
#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
const CREDENTIAL_BACKEND_LABEL: &str = "OS Secret Keyring";

#[cfg(target_os = "windows")]
const CLIENT_PLATFORM: &str = "windows";
#[cfg(target_os = "macos")]
const CLIENT_PLATFORM: &str = "macos";
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
const CLIENT_PLATFORM: &str = "linux";

const ALLOWED_SECRET_KEYS: [&str; 4] = [
    "access_token",
    "refresh_token",
    "organization_id",
    "api_base_url",
];
const MAX_ATTACHMENT_BYTES: usize = 10 * 1024 * 1024; // 10 MiB hard desktop cap
const SETTINGS_FILENAME: &str = "desktop-settings.json";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct DesktopPersistedSettings {
    api_base_url: Option<String>,
    installation_salt: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DesktopRuntimeInfo {
    pub client_type: String,
    pub client_platform: String,
    pub app_version: String,
    pub app_id: String,
    pub device_name: String,
    pub os_version: String,
    pub device_fingerprint: String,
    pub mdm_claimed: bool,
    pub credential_backend: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PickedAttachmentInfo {
    pub filename: String,
    pub content_type: String,
    pub size_bytes: usize,
    pub storage_key: String,
    pub checksum_sha256: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeepLinkNavigationEvent {
    pub raw_url: String,
    pub route: String,
}

fn validate_secret_key(key: &str) -> Result<(), String> {
    if ALLOWED_SECRET_KEYS.contains(&key) {
        Ok(())
    } else {
        Err("Unsupported secret key requested from desktop vault.".to_string())
    }
}

pub fn validate_api_base_url(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(String::new());
    }
    let parsed = Url::parse(trimmed).map_err(|_| "Invalid server API URL format.".to_string())?;
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("Embedded credentials in server URLs are not permitted.".to_string());
    }
    if parsed.query().is_some() || parsed.fragment().is_some() {
        return Err("Server base URL must not contain query parameters or fragments.".to_string());
    }
    let host = parsed
        .host_str()
        .ok_or_else(|| "Server URL must include a valid host.".to_string())?;
    let is_loopback = host.eq_ignore_ascii_case("localhost") || host == "127.0.0.1" || host == "[::1]";
    match parsed.scheme() {
        "https" => {}
        "http" if is_loopback => {}
        "http" => {
            return Err(
                "Plain HTTP is restricted to localhost development. Use HTTPS for enterprise servers."
                    .to_string(),
            )
        }
        _ => return Err("Only HTTPS server URLs (or localhost HTTP for dev) are permitted.".to_string()),
    }
    Ok(trimmed.trim_end_matches('/').to_string())
}

pub fn validate_external_url(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    let parsed = Url::parse(trimmed).map_err(|_| "Invalid external URL.".to_string())?;
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("External URL must not include embedded credentials.".to_string());
    }
    let host = parsed
        .host_str()
        .ok_or_else(|| "External URL must specify a host.".to_string())?;
    let is_loopback = host.eq_ignore_ascii_case("localhost") || host == "127.0.0.1" || host == "[::1]";
    match parsed.scheme() {
        "https" => Ok(parsed.to_string()),
        "http" if is_loopback => Ok(parsed.to_string()),
        _ => Err("Blocked non-HTTPS external link for security.".to_string()),
    }
}

pub fn sanitize_deep_link(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    let parsed = Url::parse(trimmed).map_err(|_| "Malformed deep link URI.".to_string())?;
    if parsed.scheme() != "scribbleit" {
        return Err("Unsupported deep-link scheme.".to_string());
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("Deep link must not contain credentials.".to_string());
    }

    // Never allow deep links to bypass authentication or inject tokens/roles.
    const FORBIDDEN_PARAMS: [&str; 9] = [
        "token",
        "access_token",
        "refresh_token",
        "session",
        "session_id",
        "role",
        "portal_type",
        "admin",
        "sso_token",
    ];
    for (k, _) in parsed.query_pairs() {
        let lower = k.to_ascii_lowercase();
        if FORBIDDEN_PARAMS.contains(&lower.as_str()) {
            return Err(format!(
                "Deep link rejected forbidden authentication parameter '{}'.",
                k
            ));
        }
    }

    let host = parsed.host_str().unwrap_or("").to_ascii_lowercase();
    let path_segment = parsed.path().trim_matches('/').to_ascii_lowercase();
    let combined = if !host.is_empty() && !path_segment.is_empty() {
        format!("{}/{}", host, path_segment)
    } else if !host.is_empty() {
        host
    } else {
        path_segment
    };

    let route = match combined.as_str() {
        "" | "watchtower" | "home" => "/watchtower".to_string(),
        "incidents" | "incidents/" => "/incidents".to_string(),
        "incidents/new" => "/incidents/new".to_string(),
        "requests" => "/requests".to_string(),
        "requests/new" => "/requests/new".to_string(),
        "changes" => "/changes".to_string(),
        "problems" => "/problems".to_string(),
        "assets" => "/assets".to_string(),
        "portal" => "/portal".to_string(),
        "portal/new" => "/portal/new".to_string(),
        "iam" => "/iam".to_string(),
        "login" | "login/employee" => "/login/employee".to_string(),
        "login/admin" => "/login/admin".to_string(),
        "login/iam" => "/login/iam".to_string(),
        "login/portal" => "/login/portal".to_string(),
        other if other.starts_with("incidents/") => "/incidents".to_string(),
        other if other.starts_with("requests/") => "/requests".to_string(),
        other if other.starts_with("changes/") => "/changes".to_string(),
        _ => return Err("Deep link points to an unrecognized route.".to_string()),
    };

    Ok(route)
}

pub fn sanitize_attachment_filename(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_') {
                c
            } else {
                '_'
            }
        })
        .collect();
    let collapsed = cleaned.replace("..", "_");
    let trimmed = collapsed.trim_matches('.').trim();
    if trimmed.is_empty() {
        "attachment.bin".to_string()
    } else if trimmed.len() > 160 {
        trimmed[..160].to_string()
    } else {
        trimmed.to_string()
    }
}

fn infer_content_type(path: &Path) -> String {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("pdf") => "application/pdf",
        Some("txt") | Some("log") => "text/plain",
        Some("csv") => "text/csv",
        Some("json") => "application/json",
        Some("zip") => "application/zip",
        _ => "application/octet-stream",
    }
    .to_string()
}

fn settings_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to resolve desktop config directory: {}", e))?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to initialize desktop config directory: {}", e))?;
    Ok(dir.join(SETTINGS_FILENAME))
}

fn load_settings(app: &AppHandle) -> Result<DesktopPersistedSettings, String> {
    let path = settings_file_path(app)?;
    if !path.exists() {
        return Ok(DesktopPersistedSettings::default());
    }
    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("Unable to read desktop settings: {}", e))?;
    serde_json::from_str(&raw).map_err(|e| format!("Corrupt desktop settings JSON: {}", e))
}

fn save_settings(app: &AppHandle, settings: &DesktopPersistedSettings) -> Result<(), String> {
    let path = settings_file_path(app)?;
    let serialized = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize desktop settings: {}", e))?;
    fs::write(&path, serialized).map_err(|e| format!("Failed to persist desktop settings: {}", e))
}

fn get_or_create_installation_salt(app: &AppHandle) -> String {
    if let Ok(mut current) = load_settings(app) {
        if let Some(salt) = current.installation_salt.clone() {
            if !salt.trim().is_empty() {
                return salt;
            }
        }
        let generated = Uuid::new_v4().to_string();
        current.installation_salt = Some(generated.clone());
        let _ = save_settings(app, &current);
        return generated;
    }
    Uuid::new_v4().to_string()
}

#[tauri::command]
fn vault_set_secret(key: String, value: String) -> Result<(), String> {
    validate_secret_key(&key)?;
    let entry = keyring::Entry::new(KEYRING_SERVICE, &key)
        .map_err(|e| format!("{} init failed: {}", CREDENTIAL_BACKEND_LABEL, e))?;
    let secret = Zeroizing::new(value);
    if secret.trim().is_empty() {
        let _ = entry.delete_credential();
        return Ok(());
    }
    entry
        .set_password(secret.as_str())
        .map_err(|e| format!("Failed storing secret in {}: {}", CREDENTIAL_BACKEND_LABEL, e))
}

#[tauri::command]
fn vault_get_secret(key: String) -> Result<Option<String>, String> {
    validate_secret_key(&key)?;
    let entry = keyring::Entry::new(KEYRING_SERVICE, &key)
        .map_err(|e| format!("{} init failed: {}", CREDENTIAL_BACKEND_LABEL, e))?;
    match entry.get_password() {
        Ok(val) => Ok(Some(val)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed reading {}: {}", CREDENTIAL_BACKEND_LABEL, e)),
    }
}

#[tauri::command]
fn vault_delete_secret(key: String) -> Result<(), String> {
    validate_secret_key(&key)?;
    let entry = keyring::Entry::new(KEYRING_SERVICE, &key)
        .map_err(|e| format!("{} init failed: {}", CREDENTIAL_BACKEND_LABEL, e))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Failed deleting credential from {}: {}", CREDENTIAL_BACKEND_LABEL, e)),
    }
}

#[tauri::command]
fn vault_clear_session_tokens() -> Result<(), String> {
    for key in ["access_token", "refresh_token", "organization_id"] {
        if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, key) {
            let _ = entry.delete_credential();
        }
    }
    Ok(())
}

#[tauri::command]
fn get_api_base_url(app: AppHandle) -> Result<String, String> {
    let settings = load_settings(&app)?;
    Ok(settings.api_base_url.unwrap_or_default())
}

#[tauri::command]
fn set_api_base_url(app: AppHandle, url: String) -> Result<String, String> {
    let normalized = validate_api_base_url(&url)?;
    let mut settings = load_settings(&app)?;
    settings.api_base_url = if normalized.is_empty() {
        None
    } else {
        Some(normalized.clone())
    };
    save_settings(&app, &settings)?;
    Ok(normalized)
}

fn default_device_name_fallback() -> String {
    #[cfg(target_os = "macos")]
    {
        "MAC-WORKSTATION".to_string()
    }
    #[cfg(target_os = "windows")]
    {
        "WINDOWS-WORKSTATION".to_string()
    }
    #[cfg(target_os = "linux")]
    {
        "LINUX-WORKSTATION".to_string()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        "DESKTOP-WORKSTATION".to_string()
    }
}

#[cfg(target_os = "linux")]
fn parse_linux_os_release_name(contents: &str) -> Option<String> {
    for line in contents.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("PRETTY_NAME=") {
            let unquoted = rest.trim().trim_matches('"').trim_matches('\'').trim();
            if !unquoted.is_empty() {
                return Some(unquoted.to_string());
            }
        }
    }
    None
}

fn detect_os_version_label() -> String {
    #[cfg(target_os = "macos")]
    {
        if let Ok(out) = std::process::Command::new("/usr/bin/sw_vers")
            .arg("-productVersion")
            .output()
        {
            if out.status.success() {
                let ver = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !ver.is_empty() {
                    return format!("macOS {} ({})", ver, std::env::consts::ARCH);
                }
            }
        }
        return format!("macOS ({})", std::env::consts::ARCH);
    }
    #[cfg(target_os = "windows")]
    {
        return format!("Windows ({})", std::env::consts::ARCH);
    }
    #[cfg(target_os = "linux")]
    {
        if let Ok(os_release) = fs::read_to_string("/etc/os-release") {
            if let Some(pretty) = parse_linux_os_release_name(&os_release) {
                return format!("{} ({})", pretty, std::env::consts::ARCH);
            }
        }
        return format!("Linux ({})", std::env::consts::ARCH);
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        format!("{} ({})", std::env::consts::OS, std::env::consts::ARCH)
    }
}

#[tauri::command]
fn get_desktop_runtime_info(app: AppHandle) -> DesktopRuntimeInfo {
    let host = hostname::get()
        .ok()
        .and_then(|s| s.into_string().ok())
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(default_device_name_fallback);
    let salt = get_or_create_installation_salt(&app);
    let mut hasher = Sha256::new();
    hasher.update(host.as_bytes());
    hasher.update(b":");
    hasher.update(salt.as_bytes());
    hasher.update(b":in.njuretech.scribbleit");
    let fingerprint = format!("{:x}", hasher.finalize());

    DesktopRuntimeInfo {
        client_type: "desktop".to_string(),
        client_platform: CLIENT_PLATFORM.to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        app_id: "in.njuretech.scribbleit".to_string(),
        device_name: host,
        os_version: detect_os_version_label(),
        device_fingerprint: fingerprint,
        // Honest telemetry: local desktop fingerprint is NOT independent MDM verification.
        mdm_claimed: false,
        credential_backend: CREDENTIAL_BACKEND_LABEL.to_string(),
    }
}

#[tauri::command]
fn open_external_url(app: AppHandle, url: String) -> Result<(), String> {
    let safe_url = validate_external_url(&url)?;
    app.opener()
        .open_url(safe_url, None::<&str>)
        .map_err(|e| format!("Failed opening external browser URL: {}", e))
}

#[tauri::command]
async fn pick_incident_attachment(app: AppHandle) -> Result<Option<PickedAttachmentInfo>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter(
            "Incident Diagnostics & Documents",
            &["png", "jpg", "jpeg", "webp", "pdf", "txt", "log", "csv", "json", "zip"],
        )
        .blocking_pick_file();

    let Some(file_path) = picked else {
        return Ok(None);
    };

    let path = file_path
        .into_path()
        .map_err(|_| "Selected attachment does not resolve to a local filesystem path.".to_string())?;
    let meta = fs::metadata(&path)
        .map_err(|e| format!("Unable to inspect selected file: {}", e))?;
    if !meta.is_file() {
        return Err("Selected item is not a regular file.".to_string());
    }
    let size_u64 = meta.len();
    if size_u64 == 0 {
        return Err("Empty files cannot be attached to incidents.".to_string());
    }
    if size_u64 > MAX_ATTACHMENT_BYTES as u64 {
        return Err("Attachment exceeds the 10 MiB desktop upload limit.".to_string());
    }

    let bytes = fs::read(&path).map_err(|e| format!("Unable to read selected file: {}", e))?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let checksum = format!("{:x}", hasher.finalize());

    let raw_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("attachment.bin");
    let safe_name = sanitize_attachment_filename(raw_name);
    let storage_key = format!("desktop-uploads/{}-{}", Uuid::new_v4(), safe_name);

    Ok(Some(PickedAttachmentInfo {
        filename: safe_name,
        content_type: infer_content_type(&path),
        size_bytes: bytes.len(),
        storage_key,
        checksum_sha256: checksum,
    }))
}

#[tauri::command]
fn validate_and_sanitize_deep_link(url: String) -> Result<String, String> {
    sanitize_deep_link(&url)
}

fn dispatch_deep_link_to_window(app: &AppHandle, urls: Vec<Url>) {
    for url in urls {
        if let Ok(route) = sanitize_deep_link(url.as_str()) {
            let payload = DeepLinkNavigationEvent {
                raw_url: url.to_string(),
                route,
            };
            let _ = app.emit("scribble://deep-link", payload);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let parsed_urls: Vec<Url> = args
                .iter()
                .filter_map(|arg| Url::parse(arg).ok())
                .filter(|u| u.scheme() == "scribbleit")
                .collect();
            if !parsed_urls.is_empty() {
                dispatch_deep_link_to_window(app, parsed_urls);
            } else if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .setup(|app| {
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                let urls = event.urls();
                if !urls.is_empty() {
                    dispatch_deep_link_to_window(&handle, urls);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            vault_set_secret,
            vault_get_secret,
            vault_delete_secret,
            vault_clear_session_tokens,
            get_api_base_url,
            set_api_base_url,
            get_desktop_runtime_info,
            open_external_url,
            pick_incident_attachment,
            validate_and_sanitize_deep_link
        ])
        .run(tauri::generate_context!())
        .expect("error while running SCRIBBLE-IT desktop application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_api_base_url() {
        assert_eq!(
            validate_api_base_url("https://api.njuretech.in/").unwrap(),
            "https://api.njuretech.in"
        );
        assert_eq!(
            validate_api_base_url("http://localhost:8000").unwrap(),
            "http://localhost:8000"
        );
        assert!(validate_api_base_url("http://remote.example.com").is_err());
        assert!(validate_api_base_url("https://user:pass@api.example.com").is_err());
        assert!(validate_api_base_url("javascript:alert(1)").is_err());
        assert!(validate_api_base_url("https://api.example.com?foo=bar").is_err());
    }

    #[test]
    fn test_sanitize_deep_link_blocks_auth_bypass() {
        assert_eq!(sanitize_deep_link("scribbleit://incidents").unwrap(), "/incidents");
        assert_eq!(
            sanitize_deep_link("scribbleit://incidents/new").unwrap(),
            "/incidents/new"
        );
        assert_eq!(sanitize_deep_link("scribbleit://watchtower").unwrap(), "/watchtower");
        assert!(sanitize_deep_link("scribbleit://incidents?token=stolen").is_err());
        assert!(sanitize_deep_link("scribbleit://iam?role=super_admin").is_err());
        assert!(sanitize_deep_link("https://evil.example.com").is_err());
    }

    #[test]
    fn test_validate_external_url() {
        assert!(validate_external_url("https://scribbleit.njuregroup.in").is_ok());
        assert!(validate_external_url("http://127.0.0.1:3000").is_ok());
        assert!(validate_external_url("file:///C:/Windows/System32/cmd.exe").is_err());
        assert!(validate_external_url("javascript:alert(1)").is_err());
    }

    #[test]
    fn test_sanitize_attachment_filename() {
        assert_eq!(
            sanitize_attachment_filename("../../etc/passwd.txt"),
            "____etc_passwd.txt"
        );
        assert_eq!(sanitize_attachment_filename("logs 2026.txt"), "logs_2026.txt");
    }

    #[test]
    fn test_platform_runtime_constants() {
        assert!(!KEYRING_SERVICE.is_empty());
        assert!(KEYRING_SERVICE.starts_with("in.njuretech.scribbleit"));
        assert!(!CREDENTIAL_BACKEND_LABEL.is_empty());
        assert!(matches!(CLIENT_PLATFORM, "windows" | "macos" | "linux"));
        let os_label = detect_os_version_label();
        assert!(!os_label.is_empty());
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn test_parse_linux_os_release_name() {
        let sample = "NAME=\"Ubuntu\"\nVERSION_ID=\"22.04\"\nPRETTY_NAME=\"Ubuntu 22.04.5 LTS\"\n";
        assert_eq!(
            parse_linux_os_release_name(sample).as_deref(),
            Some("Ubuntu 22.04.5 LTS")
        );
        assert_eq!(parse_linux_os_release_name("PRETTY_NAME=\"\"\n"), None);
    }
}
