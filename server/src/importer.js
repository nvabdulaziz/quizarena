import ExcelJS from 'exceljs';
import { config } from './config.js';

const HEADERS = ['Question', 'Answer 1', 'Answer 2', 'Answer 3', 'Answer 4', 'Correct Answer', 'Time Limit', 'Points'];

export async function buildTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Questions');
  ws.addRow(HEADERS);
  ws.addRow(['What is 2 + 2?', '3', '4', '5', '6', '2', 20, 1000]);
  ws.addRow(['Capital of Uzbekistan?', 'Samarkand', 'Tashkent', 'Bukhara', 'Namangan', '2', 20, 1000]);
  ws.addRow(['Which are prime numbers? (multiple)', '2', '4', '5', '9', '1,3', 30, 1000]);
  ws.getRow(1).font = { bold: true };
  ws.columns = [{ width: 44 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 12 }, { width: 10 }];
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

const norm = (s) => String(s ?? '').trim();

/** Normalise one raw row into the internal question shape, collecting errors with 1-based row numbers. */
function rowToQuestion(raw, rowNumber, errors) {
  const text = norm(raw.question);
  const answerTexts = (raw.answers || []).map(norm).filter(Boolean);
  const rowErrors = [];

  if (!text) rowErrors.push('QUESTION_EMPTY');
  if (answerTexts.length < 2) rowErrors.push('NEED_2_ANSWERS');
  if (answerTexts.length > 6) rowErrors.push('MAX_6_ANSWERS');

  // Correct answer: 1-based indexes "1" or "1,3", or the exact answer text.
  const correctRaw = norm(raw.correct);
  const correctIdx = new Set();
  if (!correctRaw) {
    rowErrors.push('CORRECT_EMPTY');
  } else {
    for (const part of correctRaw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean)) {
      if (/^\d+$/.test(part)) {
        const n = Number(part);
        if (n >= 1 && n <= answerTexts.length) correctIdx.add(n - 1);
        else rowErrors.push('CORRECT_OUT_OF_RANGE');
      } else {
        const i = answerTexts.findIndex((a) => a.toLowerCase() === part.toLowerCase());
        if (i >= 0) correctIdx.add(i);
        else rowErrors.push('CORRECT_NOT_FOUND');
      }
    }
    if (correctIdx.size === 0 && !rowErrors.includes('CORRECT_OUT_OF_RANGE') && !rowErrors.includes('CORRECT_NOT_FOUND')) {
      rowErrors.push('CORRECT_EMPTY');
    }
  }

  const timeLimit = raw.timeLimit === '' || raw.timeLimit == null ? 20 : Number(raw.timeLimit);
  if (!config.allowedTimeLimits.includes(timeLimit)) rowErrors.push('INVALID_TIME_LIMIT');
  const points = raw.points === '' || raw.points == null ? 1000 : Number(raw.points);
  if (!Number.isInteger(points) || points < 0 || points > 10000) rowErrors.push('INVALID_POINTS');
  if (text.length > 300) rowErrors.push('QUESTION_TOO_LONG');
  if (answerTexts.some((a) => a.length > 120)) rowErrors.push('ANSWER_TOO_LONG');

  if (rowErrors.length) {
    for (const code of [...new Set(rowErrors)]) errors.push({ row: rowNumber, code });
    return null;
  }
  return {
    text,
    imageUrl: null,
    timeLimit,
    points,
    answers: answerTexts.map((t, i) => ({ text: t, isCorrect: correctIdx.has(i) })),
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const delim = text.split('\n', 1)[0].includes(';') && !text.split('\n', 1)[0].includes(',') ? ';' : ',';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => norm(c) !== ''));
}

function tableToQuestions(rows, errors) {
  if (rows.length < 2) { errors.push({ row: 0, code: 'FILE_EMPTY' }); return []; }
  const questions = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const q = rowToQuestion(
      { question: r[0], answers: [r[1], r[2], r[3], r[4]], correct: r[5], timeLimit: r[6], points: r[7] },
      i + 1,
      errors,
    );
    if (q) questions.push(q);
  }
  return questions;
}

export async function parseImport(buffer, filename) {
  const errors = [];
  const ext = (filename.split('.').pop() || '').toLowerCase();
  let questions = [];

  if (ext === 'xlsx') {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    if (!ws) return { questions: [], errors: [{ row: 0, code: 'FILE_EMPTY' }] };
    const rows = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals = [];
      for (let c = 1; c <= 8; c++) {
        const v = row.getCell(c).value;
        vals.push(v && typeof v === 'object' && 'text' in v ? v.text : v && typeof v === 'object' && 'result' in v ? v.result : v);
      }
      rows.push(vals);
    });
    questions = tableToQuestions(rows, errors);
  } else if (ext === 'csv') {
    questions = tableToQuestions(parseCsv(buffer.toString('utf8').replace(/^﻿/, '')), errors);
  } else if (ext === 'json') {
    let data;
    try { data = JSON.parse(buffer.toString('utf8')); } catch { return { questions: [], errors: [{ row: 0, code: 'INVALID_JSON' }] }; }
    const list = Array.isArray(data) ? data : data.questions;
    if (!Array.isArray(list) || list.length === 0) return { questions: [], errors: [{ row: 0, code: 'FILE_EMPTY' }] };
    list.forEach((item, i) => {
      // Accept either {question, answers:[..], correct, timeLimit, points} or {text, answers:[{text,isCorrect}]}
      let answers = item.answers || [];
      let correct = item.correct ?? item.correctAnswer;
      if (answers.length && typeof answers[0] === 'object') {
        correct = answers.map((a, idx) => (a.isCorrect ? idx + 1 : null)).filter(Boolean).join(',');
        answers = answers.map((a) => a.text);
      }
      const q = rowToQuestion(
        { question: item.question ?? item.text, answers, correct: Array.isArray(correct) ? correct.join(',') : correct, timeLimit: item.timeLimit, points: item.points },
        i + 1,
        errors,
      );
      if (q) questions.push(q);
    });
  } else {
    return { questions: [], errors: [{ row: 0, code: 'UNSUPPORTED_FORMAT' }] };
  }
  return { questions, errors };
}
