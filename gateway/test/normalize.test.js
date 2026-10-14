import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStudySet } from '../src/normalize.js';
import { generateCost } from '../src/plans.js';

test('normalize sanitizes theory and reshapes questions', () => {
  const out = normalizeStudySet({ title: 'T', lang: 'el', sections: [{
    title: 'Α', theory: '<h3>x</h3><script>alert(1)</script><img src=x onerror=alert(1)><p onclick="y">ok $a^2$</p>',
    tf: [{ q: 'q?', answer: true, feedback: 'f' }, { q: 'bad' }],
    mcq: [{ q: 'm', options: ['a', 'b', 'c'], answer_index: 1, feedback: 'f' }, { q: 'oob', options: ['a', 'b'], answer_index: 5 }],
    fill: [{ q: 'x ___', pool: ['a', 'b'], answer: 'c', feedback: '' }],
    cloze: [{ q: 'c', text: 'A [0] B [1]', answers: ['x', 'y'] }],
    free: [{ q: 'f', model_answer: 'm' }],
  }] });
  const s = out.sections[0];
  assert.ok(!/script|onerror|onclick|<img/.test(s.theory));
  assert.match(s.theory, /\$a\^2\$/);
  assert.equal(s.questions.tf.length, 1);
  assert.equal(s.questions.tf[0].ans, 'true');
  assert.equal(s.questions.mcq.length, 1);
  assert.equal(s.questions.mcq[0].correctDisplay, 'b');
  assert.ok(s.questions.fill[0].pool.includes('c'));
  assert.deepEqual(s.questions.cloze[0].ans, ['x', 'y']);
});

test('credit cost', () => {
  assert.equal(generateCost(10, false), 5);
  assert.equal(generateCost(11, false), 6);
  assert.equal(generateCost(10, true), 10);
});
