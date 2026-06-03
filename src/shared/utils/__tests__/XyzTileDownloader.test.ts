import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadTiledXyz, downloadWmsImage, type Progress } from '../XyzTileDownloader';

describe('XyzTileDownloader', () => {
  const originalCreateElement = document.createElement.bind(document);
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.spyOn(document, 'createElement').mockImplementation((tagName: any, options?: any) => {
      const element = originalCreateElement(tagName, options);
      if (String(tagName).toLowerCase() === 'canvas') {
        const context = {
          fillStyle: '',
          fillRect: vi.fn(),
          drawImage: vi.fn(),
        };
        (element as HTMLCanvasElement).getContext = vi.fn(() => context as any);
        (element as HTMLCanvasElement).toDataURL = vi.fn((format?: string) => `data:${format || 'image/png'};base64,test`);
      }
      return element;
    });

    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({})));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function imageResponse() {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      blob: async () => new Blob(['image'], { type: 'image/jpeg' }),
    };
  }

  it('rejects when every XYZ tile fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      blob: async () => new Blob(),
    });

    await expect(
      downloadTiledXyz('/tiles/{z}/{x}/{y}.jpg', '-500100,-1200100,-500000,-1200000', 'image/jpeg', undefined, 15)
    ).rejects.toThrow(/No map tiles downloaded/);

    expect(fetchMock).toHaveBeenCalled();
  });

  it('returns stitched XYZ data and progress when tiles load', async () => {
    const progress: Progress[] = [];
    fetchMock.mockResolvedValue(imageResponse());

    const result = await downloadTiledXyz(
      '/tiles/{z}/{x}/{y}.jpg',
      '-500100,-1200100,-500000,-1200000',
      'image/jpeg',
      p => progress.push(p),
      15
    );

    expect(result.dataUrl).toBe('data:image/jpeg;base64,test');
    expect(result.successfulTiles).toBe(result.totalTiles);
    expect(result.failedTiles).toEqual([]);
    expect(progress.at(-1)).toEqual({ current: result.totalTiles, total: result.totalTiles });
  });

  it('requests WMS images in EPSG:5514 when requested', async () => {
    let requestedUrl = '';
    fetchMock.mockImplementation((url: string) => {
      requestedUrl = url;
      return Promise.resolve(imageResponse());
    });

    const result = await downloadWmsImage(
      '/wms?bbox={bbox}&width={width}&height={height}&crs={crs}',
      '-500100,-1200100,-500000,-1200000',
      512,
      256,
      'image/jpeg',
      undefined,
      'EPSG:5514'
    );

    expect(requestedUrl).toContain('bbox=-500250,-1200250,-499850,-1199850');
    expect(requestedUrl).toContain('width=512');
    expect(requestedUrl).toContain('height=256');
    expect(decodeURIComponent(requestedUrl)).toContain('crs=EPSG:5514');
    expect(result.successfulTiles).toBe(1);
  });
});
