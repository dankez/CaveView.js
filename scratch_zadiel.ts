import fs from 'fs';
import { parseLox } from './src/parsers/caveParser.ts';

const buffer = fs.readFileSync('./public/zadiel.lox');
const cave = parseLox(buffer.buffer);

let numVertices = 0;
let numFaces = 0;
if (cave.scraps) {
  for (const sc of cave.scraps) {
    numVertices += sc.vertices.length;
    numFaces += sc.faces.length;
  }
}

console.log('Vertices:', numVertices);
console.log('Faces:', numFaces);
console.log('numVertices * 3:', numVertices * 3);
console.log('Stations:', cave.stations.length);
console.log('Segments:', cave.segments.length);

if (cave.surfaces && cave.surfaces.length > 0) {
  cave.surfaces.forEach((s, i) => {
    console.log(`Surface ${i}:`, s.dtm.samples, 'x', s.dtm.lines, '=', s.dtm.samples * s.dtm.lines);
    console.log(`Surface ${i} total elements for positions:`, s.dtm.samples * s.dtm.lines * 3);
  });
} else {
  console.log('No surfaces found.');
}
