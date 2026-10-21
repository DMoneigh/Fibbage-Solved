import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('./fibbage-inject.js', import.meta.url), 'utf8');
const context = { window: {}, module: { exports: {} } };
vm.runInNewContext(code, context);
const { findQuestion, normalize, records } = context.module.exports;

test('self-contained injector includes every archived truth', () => {
  assert.equal(records.length, 331);
  assert.ok(records.every(q => q.truth && Array.isArray(q.alternateSpellings)));
});
test('all archive question templates match with a visible blank', () => {
  for (const question of records) {
    const text = question.question.replace(/<blank>/gi, '________').replace(/<[^>]*>/g, '');
    assert.equal(findQuestion(text).question?.id, question.id, `Question ${question.id}`);
  }
});
test('question normalization tolerates punctuation, case, smart quotes and HTML formatting', () => {
  assert.equal(findQuestion('Kevin Spacey’s older brother is a ______ impersonator.').question?.id, 14264);
  assert.equal(findQuestion('KEVIN SPACEYS OLDER BROTHER IS A [blank] IMPERSONATOR').question?.id, 14264);
  assert.equal(normalize('“Rod  Stewart!”'), 'rod stewart');
});
test('unknown, partial, and multiple questions do not produce a confident match', () => {
  assert.equal(findQuestion('Kevin Spacey').question, null);
  assert.equal(findQuestion('Pick your category').question, null);
  const text = records.slice(0,2).map(q=>q.question.replace(/<blank>/gi, '____')).join('\n');
  assert.equal(findQuestion(text).question, null);
  assert.equal(findQuestion(text).matches, 2);
});
