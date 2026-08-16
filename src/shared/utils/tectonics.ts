import { Vec3 } from '../types';

export interface TectonicPoint {
  x: number; // Easting (meters)
  y: number; // Northing (meters)
  z: number; // Altitude (meters)
}

export interface TectonicAnalysisResult {
  isCollinear: boolean;
  /** Sklon po spádnici (Dip angle) v stupňoch 0° - 90° */
  dipAngle: number;
  /** Azimut spádnice (Dip direction / Azimut kolmice na priesečník) v stupňoch 0° - 360° */
  dipDirection: number;
  /** Svetová strana spádnice (napr. N, NE, E, SE, S, SW, W, NW) */
  cardinalDirection: string;
  /** Smer vrstvy / Priesečník s horizontálnou rovinou (Strike) napr. [45, 225] */
  strike: [number, number];
  /** Formátovaný reťazec pre geologický zápis (napr. "135° / 45°") */
  notation: string;
  /** Jednotkový vektor normály roviny v reálnych súradniciach [Nx (East), Ny (North), Nz (Up)] */
  normal: [number, number, number];
  /** Jednotkový 3D vektor spádnice smerom nadol [Dx, Dy, Dz] */
  dipVector: [number, number, number];
  /** Jednotkový horizontálny vektor smeru spádnice [Hx, Hy, 0] */
  horizontalDipVector: [number, number, number];
  /** Jednotkový horizontálny vektor priesečníka (Strike vector) [Sx, Sy, 0] */
  strikeVector: [number, number, number];
  /** Plocha trojuholníka v m² */
  area: number;
  /** Obvod trojuholníka v m */
  perimeter: number;
  /** Dĺžky strán trojuholníka [p1-p2, p2-p3, p3-p1] v m */
  sideLengths: [number, number, number];
  /** Ťažisko trojuholníka [Cx, Cy, Cz] */
  centroid: [number, number, number];
}

const CARDINALS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
];

export function getCardinalDirection(azimuth: number, lang: string = 'sk'): string {
  const normAz = ((azimuth % 360) + 360) % 360;
  const idx = Math.round(normAz / 22.5) % 16;
  const code = CARDINALS[idx];

  if (lang === 'sk') {
    const skMap: Record<string, string> = {
      'N': 'S', 'NNE': 'SSV', 'NE': 'SV', 'ENE': 'VSV',
      'E': 'V', 'ESE': 'VJV', 'SE': 'JV', 'SSE': 'JJV',
      'S': 'J', 'SSW': 'JJZ', 'SW': 'JZ', 'WSW': 'ZJZ',
      'W': 'Z', 'WNW': 'ZSZ', 'NW': 'SZ', 'NNW': 'SSZ'
    };
    return skMap[code] || code;
  }
  return code;
}

/**
 * Vypočíta tektonické parametre roviny definovanej 3 bodmi.
 * Súradnice bodov: x = Easting, y = Northing, z = Altitude.
 */
export function calculateTectonics(
  p1: TectonicPoint,
  p2: TectonicPoint,
  p3: TectonicPoint,
  lang: string = 'sk'
): TectonicAnalysisResult {
  // Vektory v rovine
  const v1x = p2.x - p1.x;
  const v1y = p2.y - p1.y;
  const v1z = p2.z - p1.z;

  const v2x = p3.x - p1.x;
  const v2y = p3.y - p1.y;
  const v2z = p3.z - p1.z;

  // Dĺžky strán
  const d12 = Math.hypot(v1x, v1y, v1z);
  const d23 = Math.hypot(p3.x - p2.x, p3.y - p2.y, p3.z - p2.z);
  const d31 = Math.hypot(p1.x - p3.x, p1.y - p3.y, p1.z - p3.z);
  const perimeter = d12 + d23 + d31;

  // Vektorový súčin v1 x v2 = normála
  const rawNx = v1y * v2z - v1z * v2y;
  const rawNy = v1z * v2x - v1x * v2z;
  const rawNz = v1x * v2y - v1y * v2x;

  const rawLength = Math.hypot(rawNx, rawNy, rawNz);
  const area = 0.5 * rawLength;

  const centroid: [number, number, number] = [
    (p1.x + p2.x + p3.x) / 3,
    (p1.y + p2.y + p3.y) / 3,
    (p1.z + p2.z + p3.z) / 3,
  ];

  // Kolinearita alebo nulová plocha
  if (rawLength < 1e-7) {
    return {
      isCollinear: true,
      dipAngle: 0,
      dipDirection: 0,
      cardinalDirection: '-',
      strike: [0, 180],
      notation: 'N/A',
      normal: [0, 0, 1],
      dipVector: [0, 0, 0],
      horizontalDipVector: [0, 0, 0],
      strikeVector: [1, 0, 0],
      area: 0,
      perimeter,
      sideLengths: [d12, d23, d31],
      centroid,
    };
  }

  // Normalizácia normály
  let nx = rawNx / rawLength;
  let ny = rawNy / rawLength;
  let nz = rawNz / rawLength;

  // Zabezpečíme, aby normála smerovala do hornej polgule (nz >= 0)
  if (nz < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }

  // Sklon po spádnici (Dip angle): uhol normály s osou Z (zvislicou)
  const clampedNz = Math.min(Math.max(nz, 0), 1);
  const dipAngleRad = Math.acos(clampedNz);
  const dipAngle = (dipAngleRad * 180) / Math.PI;

  // Horizontálna zložka normály
  const horizLen = Math.hypot(nx, ny);

  let dipDirection = 0;
  let strike1 = 0;
  let strike2 = 180;
  let horizontalDipVector: [number, number, number] = [0, 0, 0];
  let strikeVector: [number, number, number] = [1, 0, 0];
  let dipVector: [number, number, number] = [0, 0, -1];

  if (horizLen > 1e-7) {
    const hx = nx / horizLen;
    const hy = ny / horizLen;

    // Azimut spádnice (smer najstrmšieho spádu / kolmica na priesečník v H-rovine)
    // atan2(Easting, Northing)
    dipDirection = ((Math.atan2(hx, hy) * 180) / Math.PI + 360) % 360;

    horizontalDipVector = [hx, hy, 0];

    // Vektor spádnice (3D smer spádu v rovine nadol)
    // d3d = normalize(nx * nz, ny * nz, -horizLen^2)
    const d3dx = hx * Math.cos(dipAngleRad);
    const d3dy = hy * Math.cos(dipAngleRad);
    const d3dz = -Math.sin(dipAngleRad);
    dipVector = [d3dx, d3dy, d3dz];

    // Smer vrstvy (Strike) - priesečník s horizontálnou rovinou (kolmý na dipDirection)
    strike1 = (dipDirection - 90 + 360) % 360;
    strike2 = (dipDirection + 90) % 360;
    if (strike1 > strike2) {
      const temp = strike1;
      strike1 = strike2;
      strike2 = temp;
    }

    // Horizontálny vektor priesečníka (strike line)
    // Kolmý na (hx, hy) -> (-hy, hx, 0)
    strikeVector = [-hy, hx, 0];
  } else {
    // Vodorovná rovina (dip = 0)
    dipDirection = 0;
    strike1 = 0;
    strike2 = 180;
    dipVector = [0, 0, 0];
  }

  const cardinalDirection = horizLen > 1e-7 ? getCardinalDirection(dipDirection, lang) : '-';
  const notation = `${Math.round(dipDirection).toString().padStart(3, '0')}° / ${Math.round(dipAngle)}°`;

  return {
    isCollinear: false,
    dipAngle,
    dipDirection,
    cardinalDirection,
    strike: [strike1, strike2],
    notation,
    normal: [nx, ny, nz],
    dipVector,
    horizontalDipVector,
    strikeVector,
    area,
    perimeter,
    sideLengths: [d12, d23, d31],
    centroid,
  };
}
