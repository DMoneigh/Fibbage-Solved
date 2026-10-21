import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const data = JSON.parse(fs.readFileSync(new URL('data.json', root), 'utf8'));
const template = fs.readFileSync(new URL('scripts/injector-runtime.js', root), 'utf8');
const records = data.questions.map(({ id, question, truth, alternateSpellings }) => ({ id, question, truth, alternateSpellings }));
const marker = '/* FIBBAGE_RECORDS */ []';
if (!template.includes(marker)) throw new Error('Injector data marker not found.');
fs.writeFileSync(new URL('fibbage-inject.js', root), template.replace(marker, () => JSON.stringify(records)));
console.log(`Built self-contained fibbage-inject.js with ${records.length} truths. No external requests required.`);
