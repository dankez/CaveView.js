import { Vector3 } from 'three';
import { SurveyData, Station, Shot, Scrap, Lrud, Xsect } from '../types';
import { STATION_ENTRANCE, STATION_NORMAL, STATION_XSECT, LEG_CAVE, LEG_SPLAY, LEG_SURFACE, LEG_DUPLICATE } from '../core/constants';

export class LoxParser {
  static modelOffset = 100000;

  static parse(buffer: ArrayBuffer): SurveyData {
    const dataView = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const utf8Decoder = new TextDecoder('utf-8');

    let pos = 0;
    const l = buffer.byteLength;

    const stations: Station[] = [];
    const shash: Record<string, Station> = {};
    const shots: Shot[] = [];
    const xsects: Xsect[] = [];
    const scraps: Scrap[] = [];
    const limits = {
      min: new Vector3(Infinity, Infinity, Infinity),
      max: new Vector3(-Infinity, -Infinity, -Infinity)
    };

    let dataStart = 0;

    const readUint = () => {
      const i = dataView.getUint32(pos, true);
      pos += 4;
      return i;
    };

    const readFloat64 = () => {
      const f = dataView.getFloat64(pos, true);
      pos += 8;
      return f;
    };

    const readDataPtr = () => {
      const position = readUint();
      const size = readUint();
      return { position, size };
    };

    const readString = (ptr: { position: number, size: number }) => {
      if (ptr.size === 0) return '';
      const strBytes = new Uint8Array(buffer, dataStart + ptr.position, ptr.size - 1);
      return utf8Decoder.decode(strBytes);
    };

    const readLrudForward = (): Lrud => ({
      l: readFloat64(),
      r: readFloat64(),
      u: readFloat64(),
      d: readFloat64()
    });

    const readLrudReverse = (): Lrud => ({
      r: readFloat64(),
      l: readFloat64(),
      u: readFloat64(),
      d: readFloat64()
    });

    const expandLimits = (v: Vector3) => {
      limits.min.min(v);
      limits.max.max(v);
    };

    const readSurvey = () => {
      readUint();
      readDataPtr();
      readUint();
      readDataPtr();
    };

    const readStation = () => {
      const id = readUint();
      const surveyId = readUint();
      const namePtr = readDataPtr();
      const commentPtr = readDataPtr();

      const flags = readUint();

      const coords = new Vector3(
        readFloat64(),
        readFloat64(),
        readFloat64()
      );

      const type = (flags & 0x02) ? STATION_ENTRANCE : STATION_NORMAL;

      expandLimits(coords);

      const station: Station = {
        id,
        surveyId: surveyId + LoxParser.modelOffset,
        name: namePtr.size === 0 ? `[${id}]` : readString(namePtr),
        coords,
        type,
        comment: commentPtr.size > 0 ? readString(commentPtr) : null
      };

      stations[id] = station;
    };

    const readShot = () => {
      const fromR = readUint();
      const toR = readUint();

      let fromIdx, toIdx, fromLRUD, toLRUD;

      if (toR > fromR) {
        fromIdx = fromR;
        toIdx = toR;
        fromLRUD = readLrudForward();
        toLRUD = readLrudForward();
      } else {
        fromIdx = toR;
        toIdx = fromR;
        toLRUD = readLrudReverse();
        fromLRUD = readLrudReverse();
      }

      const flags = readUint();
      const sectionType = readUint();
      const surveyId = readUint();

      pos += 8;

      let type;
      if (flags === 0) type = LEG_CAVE;
      else if (flags & 0x08 || flags & 0x16) type = LEG_SPLAY;
      else if (flags & 0x01) type = LEG_SURFACE;
      else if (flags & 0x02) type = LEG_DUPLICATE;
      else return;

      const fromStation = stations[fromIdx];
      const toStation = stations[toIdx];

      if (!fromStation || !toStation) return;

      if (sectionType !== 0x00 && type === LEG_CAVE) {
        toStation.type |= STATION_XSECT;
        xsects.push({
          fromId: fromIdx,
          toId: toIdx,
          start: fromStation,
          end: toStation,
          fromLRUD,
          lrud: toLRUD,
          survey: surveyId + LoxParser.modelOffset,
          type: sectionType
        });
      }

      shots.push({
        from: fromStation,
        to: toStation,
        type,
        surveyId: surveyId + LoxParser.modelOffset
      });
    };

    const readScrap = () => {
      readUint();
      const surveyId = readUint();
      const numPoints = readUint();
      const pointsPtr = readDataPtr();
      const num3Angles = readUint();
      const facesPtr = readDataPtr();

      const scrap: Scrap = { vertices: [], faces: [], survey: surveyId + LoxParser.modelOffset };

      const vDV = new DataView(buffer, dataStart + pointsPtr.position);
      for (let i = 0; i < numPoints; i++) {
        const offset = i * 24;
        scrap.vertices.push(new Vector3(
          vDV.getFloat64(offset, true),
          vDV.getFloat64(offset + 8, true),
          vDV.getFloat64(offset + 16, true)
        ));
      }

      const fDV = new DataView(buffer, dataStart + facesPtr.position);
      for (let i = 0; i < num3Angles; i++) {
        const offset = i * 12;
        scrap.faces.push([
          fDV.getUint32(offset, true),
          fDV.getUint32(offset + 4, true),
          fDV.getUint32(offset + 8, true)
        ]);
      }

      scraps.push(scrap);
    };

    const readSurface = () => {
      readUint();
      readUint();
      readUint();
      readDataPtr();
      pos += 48;
    };

    const readSurfaceBMP = () => {
      readUint();
      readUint();
      readDataPtr();
      pos += 48;
    };

    while (pos < l) {
      const m_type = readUint();
      const m_recSize = readUint();
      const m_recCount = readUint();
      const m_dataSize = readUint();

      dataStart = pos + m_recSize;

      let doFunction;
      switch (m_type) {
        case 1: doFunction = readSurvey; break;
        case 2: doFunction = readStation; break;
        case 3: doFunction = readShot; break;
        case 4: doFunction = readScrap; break;
        case 5: doFunction = readSurface; break;
        case 6: doFunction = readSurfaceBMP; break;
        default: throw new Error(`Unknown chunk header type: ${m_type}`);
      }

      for (let i = 0; i < m_recCount; i++) doFunction();

      pos += m_dataSize;
    }

    return {
      stations: stations.filter(s => s !== undefined),
      shots,
      xsects,
      scraps,
      limits
    };
  }
}
