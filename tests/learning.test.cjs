const assert = require('node:assert/strict');
const { validate, hydrate, summarize } = require('../learning-bank.js');

const question = {
  id: 'N01', group: 'normal', prompt: '识别目标', explanation: '示例解析',
  options: ['A', 'B', 'C', 'D'].map(id => ({ id, text: '选项 ' + id })),
  answer: 'A', image: 'images/N01.png', answerImage: 'answers/N01.png',
  imageSize: [1100, 620],
  panels: [
    { bounds: [25, 100, 525, 600], aspect: 1 },
    { bounds: [575, 100, 1075, 600], aspect: 1.15 },
  ],
};
const bank = { version: 'test', questions: [question] };
assert.equal(validate(bank), bank);
const singlePanel = { ...question, imageSize: [396, 354], panels: [{ bounds: [0, 0, 396, 354], aspect: 396 / 354 }] };
assert.equal(validate({ version: 'single', questions: [singlePanel] }).questions[0], singlePanel);
assert.throws(() => validate({ ...bank, questions: [{ ...question, answer: 'Z' }] }));
assert.throws(() => validate({ ...bank, questions: [{ ...question, image: '../private.png' }] }));
assert.throws(() => validate({ ...bank, questions: [question, question] }));
assert.throws(() => validate({ ...bank, questions: [{ ...question, panels: [{ bounds: [0, 0, 0, 1], aspect: 1 }] }] }));

// Stored option IDs keep their meaning when displayed letters are reordered.
const state = hydrate(bank, {
  answers: { N01: 'A', obsolete: 'C' },
  optionOrder: { N01: ['D', 'C', 'B', 'A'] },
  viewed: ['normal', 'obsolete'],
});
assert.deepEqual(state.optionOrder.N01, ['D', 'C', 'B', 'A']);
assert.deepEqual(state.answers, { N01: 'A' });
assert.deepEqual(state.viewed, ['normal']);
assert.equal(summarize(bank.questions, state.answers).correct, 1);
assert.deepEqual(summarize(bank.questions, { N01: 'D' }).wrong, ['N01']);
assert.equal(summarize(bank.questions, { N01: 'invalid' }).answered, 0);

// Placeholder images cannot create or restore scored attempts.
const placeholderBank = { version: 'placeholder', questions: [{ ...question, imagePlaceholder: true }] };
assert.deepEqual(hydrate(placeholderBank, { answers: { N01: 'A' } }).answers, {});
assert.deepEqual(summarize(placeholderBank.questions, { N01: 'A' }), {
  total: 1, answered: 0, correct: 0, wrong: [],
});

const repaired = hydrate(bank, {
  answers: { N01: 'invalid' }, optionOrder: { N01: ['A', 'A', 'B', 'C'] }, viewed: 123,
});
assert.deepEqual(repaired.answers, {});
assert.deepEqual(new Set(repaired.optionOrder.N01), new Set(['A', 'B', 'C', 'D']));
assert.deepEqual(repaired.viewed, []);
console.log('PASS: stable answer IDs, progress repair, grading and local image geometry validation');
