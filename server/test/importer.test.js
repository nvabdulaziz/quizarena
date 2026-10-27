import test from 'node:test';
import assert from 'node:assert/strict';
process.env.JWT_SECRET = 'x';
const { buildTemplate, parseImport } = await import('../src/importer.js');

test('the downloadable Excel template imports cleanly (round trip)', async () => {
  const { questions, errors } = await parseImport(await buildTemplate(), 'quiz-template.xlsx');
  assert.deepEqual(errors, []);
  assert.equal(questions.length, 3);
  assert.deepEqual(questions[2].answers.filter((a) => a.isCorrect).map((a) => a.text), ['2', '5']);
  assert.equal(questions[1].timeLimit, 20);
});

test('CSV: quoted commas, correct answer by text, and row-level errors', async () => {
  const csv = 'Question,Answer 1,Answer 2,Answer 3,Answer 4,Correct Answer,Time Limit,Points\n"Hi, there?",a,"b,c",,,2,10,500\nQ2,x,y,,,y,20,1000\nQ3,only,,,,1,20,1000\nQ4,a,b,,,3,7,1000\n';
  const { questions, errors } = await parseImport(Buffer.from(csv), 'q.csv');
  assert.equal(questions.length, 2);
  assert.equal(questions[0].text, 'Hi, there?'); assert.equal(questions[0].answers[1].text, 'b,c'); assert.equal(questions[0].timeLimit, 10);
  assert.equal(questions[1].answers[1].isCorrect, true);
  assert.deepEqual(errors.map((e) => [e.row, e.code]).sort(), [[4, 'NEED_2_ANSWERS'], [5, 'CORRECT_OUT_OF_RANGE'], [5, 'INVALID_TIME_LIMIT']].sort());
});

test('JSON in both shapes, and bad input', async () => {
  const a = await parseImport(Buffer.from(JSON.stringify([{ question: 'Q', answers: ['a', 'b'], correct: 1 }])), 'q.json');
  assert.equal(a.questions.length, 1);
  const b = await parseImport(Buffer.from(JSON.stringify({ questions: [{ text: 'Q', answers: [{ text: 'a', isCorrect: true }, { text: 'b', isCorrect: true }], timeLimit: 30, points: 100 }] })), 'q.json');
  assert.equal(b.questions[0].answers.every((x) => x.isCorrect), true);
  assert.equal((await parseImport(Buffer.from('{oops'), 'q.json')).errors[0].code, 'INVALID_JSON');
  assert.equal((await parseImport(Buffer.from('x'), 'q.pdf')).errors[0].code, 'UNSUPPORTED_FORMAT');
});
