import fs from 'fs';

const buffer = fs.readFileSync('./public/zadiel.lox');
const f = new DataView(buffer.buffer);
let pos = 0;
const l = buffer.byteLength;

console.log('File size:', l);

while (pos < l) {
  const m_type = f.getUint32(pos, true); pos += 4;
  const m_totalRecSize = f.getUint32(pos, true); pos += 4;
  const m_recCount = f.getUint32(pos, true); pos += 4;
  const m_dataSize = f.getUint32(pos, true); pos += 4;

  console.log(`Chunk Type: ${m_type}, Recs: ${m_recCount}, RecSize: ${m_recCount > 0 ? m_totalRecSize / m_recCount : 0}, DataSize: ${m_dataSize}`);
  
  pos += m_totalRecSize + m_dataSize;
}
