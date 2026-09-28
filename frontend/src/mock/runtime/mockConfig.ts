import { MOCK_STORAGE_KEYS } from '../shared/mockStorageKeys';

export interface MockConfig {
  enabled: boolean;
  storageNamespace: string;
  storageKeys: typeof MOCK_STORAGE_KEYS;
  autoSeed: boolean;
}

export const mockConfig: MockConfig = {
  enabled: true,
  storageNamespace: 'nexus_mock_',
  storageKeys: MOCK_STORAGE_KEYS,
  autoSeed: true,
};
