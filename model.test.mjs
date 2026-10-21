import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { filterQuestions, normalizeSnapshot } from './model.mjs';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url), 'utf8'));
const ids = new Set(data.questions.map(q => q.id));
test('archive contains all question records and suggestions', () => {
  assert.equal(data.questions.length, 331);
  assert.equal(ids.size, 331);
  assert.equal(data.questions.reduce((n,q) => n + q.suggestions.length, 0), 5966);
  assert.equal(data.questions.filter(q => q.round === 'Final Fibbage').length, 49);
  assert.ok(data.questions.every(q => q.truth && q.question && q.source));
});
test('search covers truths, suggestions, IDs, and round', () => {
  assert.ok(filterQuestions(data.questions, 'ATHEISTS').some(q => q.id === 14263));
  assert.ok(filterQuestions(data.questions, 'puppeteers').some(q => q.id === 14263));
  assert.equal(filterQuestions(data.questions, '14263')[0].id, 14263);
  assert.equal(filterQuestions(data.questions, '', 'Final Fibbage').length, 49);
  assert.equal(filterQuestions(data.questions, 'no-such-phrase-12345').length, 0);
});
test('snapshot retains only explicitly allowed gameplay fields', () => {
  const s = normalizeSnapshot({ players: [{ id: 1, name: 'Dez', score: 100, connected: true, privateData: 'omit' }], questionId: 14263, lies: [{ text: 'mimes', playerId: 1 }] }, ids);
  assert.equal(s.players[0].id, '1');
  assert.equal(s.players[0].privateData, undefined);
  assert.equal(s.lies[0].playerId, '1');
  assert.equal(s.questionId, 14263);
});
test('missing connection state and score are not fabricated', () => {
  const s = normalizeSnapshot({ players: [{ id: '1', name: 'Dez' }] }, ids);
  assert.equal(s.players[0].connected, null);
  assert.equal(s.players[0].score, null);
});
test('invalid snapshots are rejected explicitly', () => {
  const p = { id: '1', name: 'Dez' };
  for (const value of [
    {}, null, { players: [p, p] }, { players: [p], questionId: 999999 },
    { players: [p], lies: [{ text: 'lie', playerId: 'unknown' }] },
    { players: [{ ...p, connected: 'yes' }] }, { players: [{ ...p, score: -1 }] },
    { players: [null] }, { players: [p], lies: ['invalid'] },
    { players: Array.from({ length: 9 }, (_,i) => ({ id: i, name: 'P' })) },
  ]) assert.throws(() => normalizeSnapshot(value, ids));
});
