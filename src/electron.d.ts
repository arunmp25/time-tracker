import type { Store } from './domain';

export {};

declare global {
  interface Window {
    tempo?: {
      getSystemUsername: () => Promise<string>;
      getDataDirectory: () => Promise<string>;
      openDataDirectory: () => Promise<string>;
      loadStore: () => Promise<Partial<Store> | null>;
      saveStore: (store: Store) => Promise<void>;
      clearStore: () => Promise<void>;
    };
  }
}
