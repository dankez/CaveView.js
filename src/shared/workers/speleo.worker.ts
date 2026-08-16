import type { ParsedCave, Segment } from '@shared/types';
import { analyzeLiDARAnomalies, type LiDARAnomaly } from '@shared/utils/speleoAnalysis';

type SpeleoWorkerRequest = {
  type: 'analyze-lidar';
  requestId: number;
  points: Float32Array;
  pointNormals: Float32Array | null;
  pointCount: number;
  segments: Segment[];
};

type SpeleoWorkerResponse =
  | { type: 'status'; requestId: number; message: string | null }
  | { type: 'done'; requestId: number; anomalies: LiDARAnomaly[] }
  | { type: 'error'; requestId: number; error: string };

function post(message: SpeleoWorkerResponse) {
  self.postMessage(message);
}

self.onmessage = (event: MessageEvent<SpeleoWorkerRequest>) => {
  const data = event.data;
  if (!data || data.type !== 'analyze-lidar') return;

  try {
    const cave = {
      points: data.points,
      pointNormals: data.pointNormals || undefined,
      pointCount: data.pointCount,
      segments: data.segments,
    } as unknown as ParsedCave;

    const anomalies = analyzeLiDARAnomalies(cave, (message) => {
      post({ type: 'status', requestId: data.requestId, message: message || null });
    });

    post({ type: 'done', requestId: data.requestId, anomalies });
  } catch (error) {
    post({
      type: 'error',
      requestId: data.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
