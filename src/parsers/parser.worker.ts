import { parseLox } from './caveParser';

self.onmessage = async (e: MessageEvent) => {
  const { buffer } = e.data;
  if (!buffer) return;

  try {
    const cave = parseLox(buffer);
    // Vrátime výsledok hlavnému vláknu
    self.postMessage({ type: 'done', cave });
  } catch (err: any) {
    self.postMessage({ type: 'error', error: err.message || 'Unknown parsing error' });
  }
};
