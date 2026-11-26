import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { disable as disableAutostart, enable as enableAutostart, isEnabled as isAutostartEnabled } from '@tauri-apps/plugin-autostart';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { configureApiClient, setOnSessionExpired } from '../services/api';
import {
  buildDesktopClientMetadata,
  DeepLinkNavigationEvent,
  DesktopRuntimeInfo,
  isTauriDesktop,
  PickedAttachmentInfo,
  validateDesktopApiBaseUrl,
  validateDesktopDeepLink,
  validateExternalHttpsUrl,
} from './runtime';
import { WindowsCredentialTokenStorage } from './windowsTokenStorage';

let cachedRuntimeInfo: DesktopRuntimeInfo | null = null;
let cachedDesktopBaseUrl = '';
let tokenStorageSingleton: WindowsCredentialTokenStorage | null = null;
let initPromise: Promise<void> | null = null;

function readEnvApiBaseUrl(): string {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return (metaEnv?.VITE_API_BASE_URL || '').trim();
}

export function getCachedDesktopRuntimeInfo(): DesktopRuntimeInfo | null {
  return cachedRuntimeInfo;
}

export function getCachedDesktopBaseUrl(): string {
  return cachedDesktopBaseUrl || readEnvApiBaseUrl();
}

export async function initializeDesktopBridge(options?: {
  onSessionExpired?: (reason: 'refresh_failed' | 'unauthorized') => void;
}): Promise<void> {
  if (!isTauriDesktop()) return;
  if (initPromise) {
    await initPromise;
    if (options?.onSessionExpired) {
      setOnSessionExpired(options.onSessionExpired);
    }
    return;
  }

  initPromise = (async () => {
    const storage = new WindowsCredentialTokenStorage();
    tokenStorageSingleton = storage;

    const [runtimeInfo, savedBaseUrl] = await Promise.all([
      invoke<DesktopRuntimeInfo>('get_desktop_runtime_info').catch(() => null),
      invoke<string>('get_api_base_url').catch(() => ''),
      storage.hydrate().catch(() => undefined),
    ]);

    cachedRuntimeInfo = runtimeInfo;
    cachedDesktopBaseUrl = (savedBaseUrl || '').trim();

    configureApiClient({
      tokenStorage: storage,
      baseUrlProvider: () => cachedDesktopBaseUrl || readEnvApiBaseUrl(),
      clientMetadata: () => buildDesktopClientMetadata(cachedRuntimeInfo),
      onSessionExpired: options?.onSessionExpired,
    });

    try {
      await getCurrentWindow().setTitle('SCRIBBLE-IT');
    } catch {
      // Ignore if running outside active window context
    }
  })();

  await initPromise;
}

export async function saveDesktopApiBaseUrl(
  rawUrl: string,
): Promise<{ ok: true; normalized: string } | { ok: false; error: string }> {
  const checked = validateDesktopApiBaseUrl(rawUrl);
  if (!checked.ok) return checked;

  if (isTauriDesktop()) {
    try {
      const persisted = await invoke<string>('set_api_base_url', { url: checked.normalized });
      cachedDesktopBaseUrl = persisted;
      return { ok: true, normalized: persisted };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to save server URL.',
      };
    }
  }

  cachedDesktopBaseUrl = checked.normalized;
  return { ok: true, normalized: checked.normalized };
}

export async function sendWindowsNotification(
  title: string,
  body: string,
): Promise<{ sent: boolean; reason?: string }> {
  if (!isTauriDesktop()) {
    return { sent: false, reason: 'Not running in Windows desktop client.' };
  }
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const status = await requestPermission();
      granted = status === 'granted';
    }
    if (!granted) {
      return { sent: false, reason: 'Windows notification permission was denied.' };
    }
    sendNotification({ title, body });
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      reason: err instanceof Error ? err.message : 'Desktop notification failed.',
    };
  }
}

export async function pickDesktopAttachment(): Promise<PickedAttachmentInfo | null> {
  if (!isTauriDesktop()) return null;
  return invoke<PickedAttachmentInfo | null>('pick_incident_attachment');
}

export async function openDesktopExternalUrl(rawUrl: string): Promise<boolean> {
  const checked = validateExternalHttpsUrl(rawUrl);
  if (!checked.ok) return false;

  if (isTauriDesktop()) {
    try {
      await invoke<void>('open_external_url', { url: checked.url });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function getWindowsAutostartEnabled(): Promise<boolean> {
  if (!isTauriDesktop()) return false;
  try {
    return await isAutostartEnabled();
  } catch {
    return false;
  }
}

export async function setWindowsAutostartEnabled(enabled: boolean): Promise<boolean> {
  if (!isTauriDesktop()) return false;
  if (enabled) {
    await enableAutostart();
  } else {
    await disableAutostart();
  }
  return isAutostartEnabled();
}

export async function subscribeDesktopDeepLinks(
  onNavigate: (route: string) => void,
): Promise<UnlistenFn | null> {
  if (!isTauriDesktop()) return null;
  return listen<DeepLinkNavigationEvent>('scribble://deep-link', (event) => {
    const raw = event.payload?.raw_url || '';
    const checked = validateDesktopDeepLink(raw);
    if (checked.ok) {
      onNavigate(checked.route);
    }
  });
}

export function getWindowsVaultStorageInstance(): WindowsCredentialTokenStorage | null {
  return tokenStorageSingleton;
}
