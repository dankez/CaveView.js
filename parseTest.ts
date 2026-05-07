import * as fs from 'fs';
import { parseLox } from './src/parsers/loxParser';
const buf = fs.readFileSync('test_model/model-simple.lox');
parseLox(buf.buffer as any).then((c: any) => {
  console.log('Center offset:', c.centerOffset);
  console.log('GPS labels:', c.stationLabels.filter((l: any) => l.gps).length);
}).catch(console.error);
