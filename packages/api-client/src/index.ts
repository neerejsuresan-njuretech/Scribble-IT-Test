import { createAiApi } from './aiApi';
import { createAuthApi } from './authApi';
import { createCmdbApi } from './cmdbApi';
import { HttpClientConfig, ScribbleHttpClient } from './httpClient';
import { createIntegrationsApi } from './integrationsApi';
import { createItsmApi } from './itsmApi';
import { createOperationsApi } from './operationsApi';

export * from './storage';
export * from './httpClient';
export * from './authApi';
export * from './itsmApi';
export * from './cmdbApi';
export * from './operationsApi';
export * from './integrationsApi';
export * from './aiApi';

/**
 * Creates a fully isolated SCRIBBLE-IT FastAPI /api/v1 client bundle with custom
 * TokenStorageAdapter (e.g. OS Keychain / Keystore / SecureStore) and BaseUrlProvider.
 */
export function createScribbleApiClient(config: HttpClientConfig = {}) {
  const http = new ScribbleHttpClient(config);
  return {
    http,
    auth: createAuthApi(http),
    itsm: createItsmApi(http),
    cmdb: createCmdbApi(http),
    operations: createOperationsApi(http),
    integrations: createIntegrationsApi(http),
    ai: createAiApi(http),
  };
}

export type ScribbleApiClient = ReturnType<typeof createScribbleApiClient>;
