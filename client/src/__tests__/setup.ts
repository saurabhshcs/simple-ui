import '@testing-library/jest-dom';

// Stub crypto.randomUUID for jsdom which may not implement it
if (!globalThis.crypto?.randomUUID) {
  let counter = 0;
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      ...globalThis.crypto,
      randomUUID: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
    },
  });
}
