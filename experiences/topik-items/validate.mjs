// TOPIK 문항 묶음 검사(node 전용 — 도구와 시험이 쓴다. 화면은 bank.mjs만 읽는다).
// schema.json이 칸을 설명하고, 이 파일이 실제로 거른다. 문제를 모두 모아 돌려주고 고치지 않는다.
import { createHash } from 'node:crypto';

export const FILE_FIELDS = Object.freeze(['schema', 'batch', 'author', 'note', 'items']);
export const FILE_REQUIRED = Object.freeze(['schema', 'batch', 'author', 'items']);
export const ITEM_FIELDS = Object.freeze(['id', 'rev', 'family', 'exam', 'format', 'section', 'officialType', 'targetGrade', 'skillId', 'difficulty',
  'responseFormat', 'set', 'passage', 'script', 'question', 'choices', 'answer', 'explanation', 'choiceNotes', 'conceptIds', 'audio', 'origin',
  'reviewStatus', 'review']);
export const ITEM_REQUIRED = Object.freeze(['id', 'rev', 'family', 'exam', 'section', 'officialType', 'targetGrade', 'skillId', 'difficulty',
  'responseFormat', 'question', 'choices', 'answer', 'explanation', 'choiceNotes', 'origin', 'reviewStatus', 'review']);
export const REVIEW_STATUSES = Object.freeze(['draft', 'ai-reviewed', 'held', 'rejected']);
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HANGUL = /[가-힣]/, CYRILLIC = /[А-Яа-яӨөҮүЁё]/, LATIN = /[A-Za-z]/;
const GRADES = Object.freeze({ 'topik-i': [1, 2], 'topik-ii': [3, 4, 5, 6] });

const text = value => typeof value === 'string' && value.trim().length > 0;

// 검수가 본 내용의 지문. 이 칸들 가운데 하나라도 바뀌면 이전 검수 통과는 이 문항에 더는 걸리지 않는다.
export function contentHash(item) {
  const content = { officialType: item.officialType, skillId: item.skillId, difficulty: item.difficulty, targetGrade: item.targetGrade,
    passage: item.passage ?? null, script: item.script ?? null, question: item.question, choices: item.choices, answer: item.answer,
    explanation: item.explanation, choiceNotes: item.choiceNotes };
  return createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0, 16);
}
export const itemKeyOf = item => `topik-items.${item.id}.v${item.rev}`;
export const familyKeyOf = item => `topik-items.${item.family}`;

// 지금 내용에 걸린 검수만으로 통과를 판단한다: 같은 지문의 claude·argon이 모두 pass이거나, 그 뒤 판정(adjudication)이 pass.
export function reviewOutcome(item) {
  const hash = contentHash(item), current = (item.review || []).filter(entry => entry.hash === hash && entry.rev === item.rev);
  const last = stage => current.filter(entry => entry.stage === stage).at(-1) || null;
  const claude = last('claude'), argon = last('argon'), judge = last('adjudication');
  if (judge && claude && argon && Date.parse(judge.at) >= Math.max(Date.parse(claude.at), Date.parse(argon.at))) {
    return judge.verdict === 'pass' ? 'pass' : judge.verdict;
  }
  if (claude?.verdict === 'pass' && argon?.verdict === 'pass') return 'pass';
  if (claude && argon) return claude.verdict === argon.verdict ? claude.verdict : 'split';
  return 'incomplete';
}

export function validateFile(file, { name, types, skillIds, pending = new Set() }) {
  const problems = [], add = (where, message) => problems.push(`${name}${where ? ` ${where}` : ''}: ${message}`);
  if (!file || typeof file !== 'object' || Array.isArray(file)) { add('', '파일이 객체가 아니다'); return problems; }
  for (const key of Object.keys(file)) if (!FILE_FIELDS.includes(key)) add('', `모르는 칸 ${key}`);
  for (const key of FILE_REQUIRED) if (file[key] === undefined) add('', `${key} 칸이 없다`);
  if (file.schema !== 'topik-item-1') add('', 'schema가 topik-item-1이 아니다');
  if (!SLUG.test(file.batch || '')) add('', 'batch 이름 꼴');
  if (!Array.isArray(file.items)) return problems;
  const typeById = new Map(types.map(type => [type.id, type]));
  const sets = new Map();
  for (const [index, item] of file.items.entries()) {
    const at = `#${index + 1}${item?.id ? ` ${item.id}` : ''}`, bad = message => add(at, message);
    if (!item || typeof item !== 'object') { bad('문항이 객체가 아니다'); continue; }
    for (const key of Object.keys(item)) if (!ITEM_FIELDS.includes(key)) bad(`모르는 칸 ${key}`);
    for (const key of ITEM_REQUIRED) if (item[key] === undefined) bad(`${key} 칸이 없다`);
    if (!new RegExp(`^${file.batch}-\\d{3}$`).test(item.id || '')) bad(`id는 ${file.batch}-<세 자리>`);
    if (!Number.isInteger(item.rev) || item.rev < 1) bad('rev는 1 이상 정수');
    if (!SLUG.test(item.family || '')) bad('family 꼴');
    if (!['topik-i', 'topik-ii'].includes(item.exam)) bad(`exam ${item.exam}`);
    if (item.format !== undefined && item.format !== 'pbt') bad('format은 pbt만');
    if (!['listening', 'reading'].includes(item.section)) bad(`section ${item.section}`);
    const type = typeById.get(item.officialType);
    if (!type) bad(`모르는 공식 유형 ${item.officialType}`);
    else {
      if (type.exam !== item.exam || type.section !== item.section) bad(`${type.id}은 ${type.exam}/${type.section} 자리다`);
      if (type.produce === false) bad(`${type.id}은 그림이 필요해 지금 만들지 않는 유형이다`);
      if (!type.skills.includes(item.skillId)) bad(`${item.skillId}는 ${type.id}의 능력(${type.skills.join(', ')})이 아니다`);
    }
    if (!(skillIds[item.exam]?.has(item.skillId) || pending.has(item.skillId))) bad(`지도에 없는 능력 ${item.skillId}`);
    if (!GRADES[item.exam]?.includes(item.targetGrade)) bad(`targetGrade ${item.targetGrade}은 ${item.exam} 급이 아니다`);
    if (![1, 2, 3].includes(item.difficulty)) bad('difficulty는 1~3');
    if (item.responseFormat !== 'single-choice') bad('responseFormat은 single-choice');
    if (item.section === 'reading') {
      if (!text(item.passage)) bad('읽기 문항에 passage가 없다');
      if (item.script != null) bad('읽기 문항에 script가 있다');
      if (item.audio != null) bad('읽기 문항에 audio가 있다');
    }
    if (item.section === 'listening') {
      if (item.passage != null) bad('듣기 문항에 passage가 있다');
      if (!Array.isArray(item.script) || !item.script.length) bad('듣기 문항에 script가 없다');
      else for (const line of item.script) {
        if (!line || !['남자', '여자'].includes(line.speaker) || !text(line.text) || Object.keys(line).some(key => !['speaker', 'text'].includes(key))) bad('script 줄 꼴(speaker 남자/여자 · text)');
      }
      if (!item.audio || typeof item.audio !== 'object') bad('듣기 문항에 audio가 없다');
      else {
        if (!/^audio\/[a-z0-9-]+\.mp3$/.test(item.audio.file || '')) bad('audio.file은 audio/<이름>.mp3');
        if (type && item.audio.plays !== type.plays) bad(`audio.plays ${item.audio.plays} ≠ 공식 재생 ${type.plays}`);
        if (!['pending', 'ready'].includes(item.audio.status)) bad('audio.status');
        if (Object.keys(item.audio).some(key => !['file', 'plays', 'status', 'voices', 'seconds'].includes(key))) bad('audio 칸');
      }
      if (type?.speakers && Array.isArray(item.script)) {
        const speakers = new Set(item.script.map(line => line.speaker));
        if (speakers.size > type.speakers) bad(`${type.id}은 말하는 사람 ${type.speakers}명 자리다`);
      }
    }
    if (!text(item.question) || !HANGUL.test(item.question)) bad('question');
    if (!Array.isArray(item.choices) || item.choices.length !== 4 || !item.choices.every(text)) bad('choices는 글 넷');
    else if (new Set(item.choices.map(choice => choice.trim())).size !== 4) bad('보기가 겹친다');
    if (![0, 1, 2, 3].includes(item.answer)) bad('answer는 0~3');
    const ex = item.explanation;
    if (!ex || typeof ex !== 'object' || Object.keys(ex).some(key => !['ko', 'en', 'mn'].includes(key))) bad('explanation은 ko·en·mn');
    else {
      if (!text(ex.ko) || !HANGUL.test(ex.ko)) bad('explanation.ko');
      if (!text(ex.en) || !LATIN.test(ex.en)) bad('explanation.en');
      if (!text(ex.mn) || !CYRILLIC.test(ex.mn)) bad('explanation.mn(키릴 문자)');
    }
    if (!Array.isArray(item.choiceNotes) || item.choiceNotes.length !== 4 || !item.choiceNotes.every(text)) bad('choiceNotes는 글 넷');
    if (item.conceptIds !== undefined && (!Array.isArray(item.conceptIds) || !item.conceptIds.every(text))) bad('conceptIds');
    if (item.origin !== 'synk-original') bad('origin은 synk-original');
    if (!REVIEW_STATUSES.includes(item.reviewStatus)) bad(`reviewStatus ${item.reviewStatus}`);
    if (!Array.isArray(item.review)) bad('review는 목록');
    else {
      for (const entry of item.review) {
        if (!entry || !['claude', 'argon', 'adjudication', 'author-fix'].includes(entry.stage) || !text(entry.model) || !text(entry.rubric)
          || !Number.isFinite(Date.parse(entry.at)) || !['pass', 'fix', 'drop'].includes(entry.verdict) || !Number.isInteger(entry.rev)
          || !/^[a-f0-9]{16}$/.test(entry.hash || '')) bad('review 줄 꼴');
      }
      // 통과 표시는 지금 내용에 걸린 두 검수(또는 판정)가 있을 때만.
      if (item.reviewStatus === 'ai-reviewed' && reviewOutcome(item) !== 'pass') bad('ai-reviewed인데 지금 내용에 걸린 통과 검수가 없다(검수 뒤 내용이 바뀌었거나 판정이 빠짐)');
    }
    if (item.set != null) {
      if (typeof item.set !== 'object' || !text(item.set.id) || !Number.isInteger(item.set.order)) bad('set 꼴');
      else {
        if (!sets.has(item.set.id)) sets.set(item.set.id, []);
        sets.get(item.set.id).push(item);
      }
    } else if (type?.set) bad(`${type.id}은 세트 자리(${type.set})라 set이 있어야 한다`);
  }
  for (const [id, members] of sets) {
    if (members.length < 2) add(`set ${id}`, '세트 문항이 하나뿐이다');
    if (new Set(members.map(m => m.set.order)).size !== members.length) add(`set ${id}`, 'order가 겹친다');
    const same = key => new Set(members.map(m => JSON.stringify(m[key] ?? null))).size === 1;
    if (!same('passage') || !same('script')) add(`set ${id}`, '세트끼리 글·대본이 다르다');
    const typeSets = new Set(members.map(m => typeById.get(m.officialType)?.set));
    if (typeSets.size !== 1 || typeSets.has(undefined)) add(`set ${id}`, '세트 문항의 공식 유형이 한 세트 자리가 아니다');
  }
  return problems;
}

// 여러 파일 사이: id·itemKey·계열이 겹치지 않는가, 정답 자리가 한쪽에 쏠리지 않았는가.
export function validateBank(files, context) {
  const problems = [], ids = new Map();
  for (const { name, data } of files) {
    problems.push(...validateFile(data, { ...context, name }));
    for (const item of data?.items || []) {
      if (ids.has(item.id)) problems.push(`${name}: id ${item.id}가 ${ids.get(item.id)}에도 있다`);
      ids.set(item.id, name);
    }
  }
  return problems;
}

// 정답 자리 치우침(보기 넷 가운데 한 자리가 절반을 넘으면) — 위치로 답이 드러나지 않게(학습기준 §4-2).
export function answerSpread(items) {
  const counts = [0, 0, 0, 0];
  for (const item of items) if ([0, 1, 2, 3].includes(item.answer)) counts[item.answer] += 1;
  const total = counts.reduce((a, b) => a + b, 0);
  return { counts, skewed: total >= 8 && Math.max(...counts) / total > 0.5 };
}
