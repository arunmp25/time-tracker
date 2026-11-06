export {};

declare global {
  interface Window {
    tempo?: {
      getSystemUsername: () => Promise<string>;
    };
  }
}
