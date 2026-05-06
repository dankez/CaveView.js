import { parseLox, parsePly, parseSvx, parsePlt } from './caveParser';

self.onmessage = async (e: MessageEvent) => {
  const { buffer, ext } = e.data;
  if (!buffer) return;

  try {
    let cave;
    const progress = (msg: string) => {
      self.postMessage({ type: 'progress', message: msg });
    };

    if (ext === '.ply') {
      cave = parsePly(buffer, progress);
      // POZOR: classifyLiDAR() sa NESMIE volať pre jaskynné PLY skeny!
      // Jej heuristika ("body nad priemerom = vegetácia") odreže horné steny jaskyne.
      // Klasifikácia sa používa LEN ak PLY súbor obsahuje natívnu 'class' vlastnosť.
      // Ak nie je natívna klasifikácia, všetky body ostanú class=0 (unclassified)
      // a OrganicShell ich všetky zahrnie do rekonštrukcie.
    } else if (ext === '.lox') {
      cave = parseLox(buffer, progress);
    } else if (ext === '.plt') {
      const text = new TextDecoder().decode(buffer);
      cave = parsePlt(text, progress);
    } else {
      // Default k SVX pre neznáme prípony
      cave = parseSvx(buffer, progress);
    }

    // Všetky body sa posielajú bez filtrácie.
    // Filtrovanie podľa klasifikácie robí OrganicShell v CaveViewer3D.tsx.

    // Vrátime výsledok hlavnému vláknu
    // Ak je to veľký point cloud, môžeme preniesť typed arrays (transferables) pre výkon
    const transferables = [];
    if (cave.points) transferables.push(cave.points.buffer);
    if (cave.pointColors) transferables.push(cave.pointColors.buffer);
    if (cave.pointNormals) transferables.push(cave.pointNormals.buffer);
    if (cave.pointIntensity) transferables.push(cave.pointIntensity.buffer);
    if (cave.pointClassification) transferables.push(cave.pointClassification.buffer);

    self.postMessage({ type: 'done', cave }, transferables as any);
  } catch (err: any) {
    console.error('Worker error:', err);
    self.postMessage({ type: 'error', error: err.message || 'Unknown parsing error' });
  }
};
