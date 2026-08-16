import { buildLidarPlanMapData, type BuildLidarPlanMapOptions, type LidarPlanMapData } from '@shared/utils/lidarPlanMap';

type LidarPlanMapWorkerRequest = {
  type: 'build-lidar-plan-map';
  requestId: number;
  points: Float32Array;
  pointCount: number;
  pointClassification: Uint8Array | null;
  options?: BuildLidarPlanMapOptions;
};

type LidarPlanMapWorkerResponse =
  | { type: 'done'; requestId: number; data: LidarPlanMapData }
  | { type: 'error'; requestId: number; error: string };

function post(message: LidarPlanMapWorkerResponse, transfer?: Transferable[]) {
  (self as any).postMessage(message, transfer || []);
}

self.onmessage = (event: MessageEvent<LidarPlanMapWorkerRequest>) => {
  const data = event.data;
  if (!data || data.type !== 'build-lidar-plan-map') return;

  try {
    const result = buildLidarPlanMapData(
      data.points,
      data.pointCount,
      data.pointClassification,
      data.options || {}
    );

    post({ type: 'done', requestId: data.requestId, data: result }, [
      result.heights.buffer,
      result.contourHeights.buffer,
      result.occupancy.buffer,
    ]);
  } catch (error) {
    post({
      type: 'error',
      requestId: data.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
