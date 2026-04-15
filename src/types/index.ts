import { Vector3 } from 'three';

export interface Station {
  id: number;
  surveyId: number;
  name: string;
  coords: Vector3;
  type: number;
  comment?: string | null;
}

export interface Shot {
  from: Station;
  to: Station;
  type: number;
  surveyId: number;
}

export interface Lrud {
  l: number;
  r: number;
  u: number;
  d: number;
}

export interface Xsect {
  fromId: number;
  toId: number;
  start: Station;
  end: Station;
  fromLRUD: Lrud;
  lrud: Lrud;
  survey: number;
  type: number;
}

export interface Scrap {
  vertices: Vector3[];
  faces: number[][];
  survey: number;
}

export interface SurveyData {
  stations: Station[];
  shots: Shot[];
  xsects: Xsect[];
  scraps: Scrap[];
  limits: {
    min: Vector3;
    max: Vector3;
  };
}
