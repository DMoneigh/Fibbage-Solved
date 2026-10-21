import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
const archive = fs.readFileSync(path.join(root, 'uploads', '2859ba1a-41ee-46c1-96b6-342c99c529c3.zip'));
let end = archive.length - 22;
while (end >= Math.max(0, archive.length - 65557) && archive.readUInt32LE(end) !== 0x06054b50) end--;
if (end < 0 || archive.readUInt32LE(end) !== 0x06054b50) throw new Error('ZIP directory not found');
let cursor = archive.readUInt32LE(end + 16);
const entries = [];
for (let i = 0; i < archive.readUInt16LE(end + 10); i++) {
  if (archive.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid ZIP directory');
  const nameLength = archive.readUInt16LE(cursor + 28);
  entries.push({
    name: archive.toString('utf8', cursor + 46, cursor + 46 + nameLength),
    method: archive.readUInt16LE(cursor + 10),
    size: archive.readUInt32LE(cursor + 20),
    offset: archive.readUInt32LE(cursor + 42),
  });
  cursor += 46 + nameLength + archive.readUInt16LE(cursor + 30) + archive.readUInt16LE(cursor + 32);
}
function read(entry) {
  const start = entry.offset + 30 + archive.readUInt16LE(entry.offset + 26) + archive.readUInt16LE(entry.offset + 28);
  const bytes = archive.subarray(start, start + entry.size);
  if (entry.method === 0) return bytes;
  if (entry.method === 8) return zlib.inflateRawSync(bytes);
  throw new Error(`Unsupported compression for ${entry.name}`);
}
const questions = [];
for (const entry of entries) {
  const match = entry.name.match(/content\/(fibbageshortie|finalfibbage)\/(\d+)\/data\.jet$/);
  if (!match) continue;
  const record = JSON.parse(read(entry).toString('utf8'));
  const fields = Object.fromEntries(record.fields.map(field => [field.n, field.v ?? '']));
  questions.push({
    id: Number(match[2]),
    round: match[1] === 'finalfibbage' ? 'Final Fibbage' : 'Fibbage',
    category: fields.Category?.trim() || 'Uncategorized',
    question: fields.QuestionText || '',
    truth: fields.CorrectText || '',
    suggestions: (fields.Suggestions || '').split(',').map(s => s.trim()).filter(Boolean),
    alternateSpellings: (fields.AlternateSpellings || '').split(',').map(s => s.trim()).filter(Boolean),
    source: entry.name,
  });
}
questions.sort((a, b) => a.id - b.id);
const evidence = [];
for (const entry of entries.filter(e => /(?:FibbageXL|448[3-8])\.swf$/.test(e.name) && !e.name.includes('SaveConverter'))) {
  const raw = read(entry);
  const signature = raw.toString('ascii', 0, 3);
  const body = signature === 'CWS' ? zlib.inflateSync(raw.subarray(8)) : signature === 'FWS' ? raw.subarray(8) : null;
  if (!body) throw new Error(`Unsupported SWF: ${entry.name}`);
  const strings = [...new Set((body.toString('latin1').match(/[A-Za-z_$][A-Za-z0-9_$.: /-]{3,110}/g) || []).map(s => s.trim()))];
  const matches = strings.filter(s => /player|correct|suggestion|lie\b|lies|room|ecast|jackbox|answer|score|client|socket/i.test(s));
  evidence.push({ source: entry.name, symbols: matches.slice(0, 180) });
}
const data = {
  game: 'Fibbage XL',
  archive: 'Fibbage XL.zip',
  totalFiles: entries.filter(e => !e.name.endsWith('/')).length,
  questions,
  evidence,
  limitations: [
    'The archive contains question answers and built-in lie suggestions, not a live room or connected-player roster.',
    'Player-written lies, scores, and connected users require an authorized runtime snapshot from the host. This companion does not attach to or modify the native game.',
    'SWF strings are static symbol evidence, not a verified network protocol or a working runtime integration.',
  ],
};
fs.writeFileSync(path.join(root, 'data.json'), JSON.stringify(data));
console.log(JSON.stringify({
  questions: questions.length,
  suggestions: questions.reduce((n, q) => n + q.suggestions.length, 0),
  rounds: Object.fromEntries([...new Set(questions.map(q => q.round))].map(r => [r, questions.filter(q => q.round === r).length])),
  evidence: evidence.map(e => ({ source: e.source, symbols: e.symbols.filter(s => /player|correct|lie|room|score|socket/i.test(s)).slice(0, 35) })),
}, null, 2));
