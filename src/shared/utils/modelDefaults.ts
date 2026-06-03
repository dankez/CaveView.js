export type ViewerEngine = 'v1' | 'v2';

const LARGE_POINT_CLOUD_BYTES = 50 * 1024 * 1024;

export function getPreferredEngineForFile(ext: string): ViewerEngine {
  return ext.toLowerCase() === '.ply' ? 'v2' : 'v1';
}

export function getDefaultPointCloudSize(ext: string, byteLength: number): number {
  return ext.toLowerCase() === '.ply' && byteLength > LARGE_POINT_CLOUD_BYTES ? 0.3 : 0.5;
}
