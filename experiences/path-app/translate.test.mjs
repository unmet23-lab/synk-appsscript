// PATH 서류 번역 초안 시험. 이름 · 번호는 모두 지어낸 값이다(실제 학생 자료를 넣지 않는다).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  maskLines, serverMask, restoreTokens, sameTokens, tokensOf, digitSet, sameNumbers, stripOriginals, splitPasted, mongolianEnough,
  validateTranslateRequest, checkTranslationOutput, checkBackOutput, checkCompareOutput, validateTranslateReply, validateCheckReply,
  draftRows, token, SERVER_TOKEN, MAX_LINES, MAX_TOTAL_CHARS
} from './translate-shape.mjs';

const RID = '3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b';
const consent = { v: 1, age: 'adult', guardian: false, lang: 'mn' };
const SRC = ['БҮРЭН ДУНД БОЛОВСРОЛЫН ГЭРЧИЛГЭЭ', 'Овог нэр: Батын Тэмүүлэн', 'Регистрийн дугаар: УБ01234567', 'Төгссөн он: 2026 оны 6 сарын 15'];

test('가리기: 같은 번호는 같은 토큰, 빈칸 · 소문자 · Ө · 라틴 섞임도 찾는다', () => {
  const { lines, slots } = maskLines(['РД: УБ01234567, эцэг ӨВ 76543210', 'дахин уб-01234567', 'OCR: YБ11223344', 'утас 99112233']);
  assert.equal(lines[0], `РД: ${token(1)}, эцэг ${token(2)}`);
  assert.equal(lines[1], `дахин ${token(1)}`, '같은 번호(소문자 · 줄표)는 같은 토큰');
  assert.equal(lines[2], `OCR: ${token(3)}`, '라틴이 섞인 번호도 찾는다');
  assert.equal(lines[3], 'утас 99112233', '글자 없는 숫자 여덟 자는 그대로');
  assert.deepEqual(slots, ['УБ01234567', 'ӨВ 76543210', 'YБ11223344']);
  assert.equal(restoreTokens(`${token(2)} / ${token(1)} / ${SERVER_TOKEN} / ${token(9)}`, slots, '[가림]'), 'ӨВ 76543210 / УБ01234567 / [가림] / [가림]');
});

test('가리기: 낱말 속 우연한 일치와 이미 가린 토큰은 건드리지 않는다', () => {
  assert.deepEqual(maskLines(['АБВУБ01234567', 'УБ012345678']).lines, ['АБВУБ01234567', 'УБ012345678']);
  assert.deepEqual(serverMask([`${token(1)} ба УБ01234567`]), [`${token(1)} ба ${SERVER_TOKEN}`]);
  assert.ok(sameTokens(`${token(2)} a ${token(1)}`, `${token(1)} ${token(2)}`));
  assert.ok(!sameTokens(`${token(1)}`, 'none'));
  assert.deepEqual(tokensOf(`x ${token(3)} ${token(1)}`), [token(1), token(3)]);
});

test('숫자 대조: 앞의 0, 몽골어 서수, 로마 숫자, 차례를 견딘다', () => {
  assert.ok(sameNumbers('2026.06.15', '2026년 6월 15일'));
  assert.ok(sameNumbers('зургадугаар сарын 15', '6월 15일'));
  assert.ok(sameNumbers('арван хоёрдугаар анги', '12학년'));
  assert.ok(sameNumbers('XII анги', '12학년'));
  assert.ok(sameNumbers('15/06/2026', '2026년 6월 15일'));
  assert.ok(!sameNumbers('Математик 85', '수학 58'));
  assert.ok(!sameNumbers('Физик 92', '물리'));
  assert.ok(sameNumbers('хорин гуравдугаар сургууль', '제23학교'), '십 단위 + 서수');
  assert.ok(!sameNumbers('хорин гуравдугаар сургууль', '제3학교'));
  assert.ok(sameNumbers('зургаадугаар сар, долоодугаар анги', '6월, 7학년'), '긴 모음 표기');
  assert.deepEqual([...digitSet(`${token(1)} 7`)], ['7'], '토큰 번호는 세지 않는다');
});

test('괄호 속 키릴 원문을 역번역 전에 뺀다', () => {
  assert.equal(stripOriginals('성명: 바타인 테무렌(Батын Тэмүүлэн)'), '성명: 바타인 테무렌');
  assert.equal(stripOriginals('수학 (기초)'), '수학 (기초)');
});

test('붙여 넣기: 빈 줄 · 공백 정리, 한도와 언어', () => {
  const ok = splitPasted('  Овог нэр:   Батын Тэмүүлэн \r\n\r\n Математик​ 85 \n');
  assert.equal(ok.error, null);
  assert.deepEqual(ok.lines, ['Овог нэр: Батын Тэмүүлэн', 'Математик 85']);
  assert.equal(splitPasted('   ').error, 'empty');
  assert.equal(splitPasted('Монгол').error, 'short');
  assert.equal(splitPasted('This is an English certificate of graduation').error, 'language');
  assert.equal(splitPasted(Array.from({ length: MAX_LINES + 1 }, () => 'Математик 85').join('\n')).error, 'lines');
  assert.equal(splitPasted('Математик '.repeat(40)).error, 'line');
  assert.equal(splitPasted(Array.from({ length: 30 }, () => 'Монгол хэл ба уран зохиол '.repeat(6)).join('\n')).error, 'total');
  assert.ok(mongolianEnough(['Математик 85 A']));
  assert.deepEqual(splitPasted('ДҮНГИЙН ХУУДАС\nМатематик\t72\t96\tА').lines, ['ДҮНГИЙН ХУУДАС', 'Математик 72 96 А'], '표의 탭은 빈칸이 된다');
  assert.equal(splitPasted('Овог: Бат\nРД: УБ 01234567').error, 'short', '길이는 등록번호를 가린 꼴로 잰다(서버와 같게)');
});

test('요청 몸: 정한 꼴만, 동의 · 나이 · 보호자', () => {
  const body = { action: 'translate', request_id: RID, kind: 'grad', lines: SRC, consent };
  assert.equal(validateTranslateRequest(body).kind, 'grad');
  const bad = (patch, code = 'INVALID_TRANSLATE_REQUEST') => assert.throws(() => validateTranslateRequest({ ...body, ...patch }), { code });
  bad({ extra: 1 });
  bad({ kind: 'family' });
  bad({ request_id: 'x' });
  bad({ consent: { ...consent, age: 'teen' } }, 'INVALID_TRANSLATE_REQUEST');
  assert.equal(validateTranslateRequest({ ...body, consent: { ...consent, age: 'teen', guardian: true } }).consent.guardian, true);
  bad({ consent: { ...consent, guardian: true } });
  bad({ consent: { ...consent, v: 2 } });
  bad({ lines: [' Математик 85 ', 'Физик 90 ба бусад'] });
  bad({ lines: ['Математик‮ 85 бусад хичээл'] });
  bad({ lines: ['Монгол'] });
  bad({ lines: ['Graduation certificate of the school'] }, 'NOT_MONGOLIAN');
  bad({ lines: Array.from({ length: 11 }, () => 'Монгол хэл ба уран зохиол '.repeat(14).trim()) });
  const check = { ...body, action: 'check', drafts: SRC.map(() => '초안 줄') };
  assert.equal(validateTranslateRequest(check).drafts.length, SRC.length);
  assert.throws(() => validateTranslateRequest({ ...check, drafts: ['하나'] }), { code: 'INVALID_TRANSLATE_REQUEST' });
  assert.throws(() => validateTranslateRequest({ ...body, drafts: [] }), { code: 'INVALID_TRANSLATE_REQUEST' }, 'translate에는 drafts가 없다');
  assert.ok(MAX_TOTAL_CHARS >= 4000);
});

test('모델 출력 검사: 줄 수 · 차례 · 길이 · 값', () => {
  const ok = { lines: SRC.map((_, i) => ({ i, ko: '줄 ' + i, flag: i === 1 ? 'name' : 'none' })) };
  assert.equal(checkTranslationOutput(ok, SRC).length, SRC.length);
  assert.equal(checkTranslationOutput({ lines: ok.lines.slice(1) }, SRC), null);
  assert.equal(checkTranslationOutput({ lines: ok.lines.map((l, i) => ({ ...l, i: i ? i : 3 })) }, SRC), null);
  assert.equal(checkTranslationOutput({ lines: ok.lines.map((l) => ({ ...l, ko: '가'.repeat(500) })) }, SRC), null);
  assert.equal(checkTranslationOutput({ lines: ok.lines.map((l) => ({ ...l, flag: 'verified' })) }, SRC), null);
  assert.deepEqual(checkTranslationOutput({ lines: [{ i: 0, ko: '수학\t72\t96\tA', flag: 'none' }] }, ['Математик 72 96 А']), [{ i: 0, ko: '수학 72 96 A', flag: 'none' }], '모델 출력의 탭은 빈칸');
  assert.deepEqual(checkBackOutput({ lines: [{ i: 0, mn: 'Математик\t72\t96' }] }, ['수학 72 96']), [{ i: 0, mn: 'Математик 72 96' }]);
  assert.equal(splitPasted('Төгссөн он: 2026, Е​̈ үсэг\tбүхий нэр').lines[0], 'Төгссөн он: 2026, Ё үсэг бүхий нэр', '숨은 글자를 지운 뒤 NFC');
  assert.equal(checkTranslationOutput({ lines: ok.lines.map((l) => ({ ...l, extra: 1 })) }, SRC), null);
  assert.equal(checkBackOutput({ lines: [{ i: 0, mn: 'Тест' }] }, ['테스트']).length, 1);
  assert.equal(checkBackOutput({ lines: [{ i: 0, mn: '' }] }, ['테스트']), null);
  assert.deepEqual(checkCompareOutput({ lines: [{ i: 0, verdict: 'same', reason: 'meaning' }] }, 1), [{ i: 0, verdict: 'same', reason: 'none' }]);
  assert.equal(checkCompareOutput({ lines: [{ i: 0, verdict: 'ok', reason: 'none' }] }, 1), null);
});

test('답 검사와 화면 줄: 걸린 줄의 까닭, 토큰이 어긋난 줄은 되돌리지 않는다', () => {
  const { lines: masked, slots } = maskLines(SRC);
  const reply = validateTranslateReply({ ok: true, scope: 'synk-path', action: 'translate', prompt: 'path-translate-v1', status: 'done', remaining: 9,
    lines: [{ i: 0, ko: '완전 중등교육 증서', flag: 'term' }, { i: 1, ko: '성명: 바타인 테무렌(Батын Тэмүүлэн)', flag: 'name' },
      { i: 2, ko: '등록번호: 없음', flag: 'none' }, { i: 3, ko: '졸업 연도: 2026년 6월 16일', flag: 'none' }] }, masked.length);
  const check = validateCheckReply({ ok: true, scope: 'synk-path', action: 'check', prompt: 'path-translate-v1', status: 'done', remaining: 8, compared: true,
    lines: masked.map((_, i) => ({ i, back: i === 3 ? 'Төгссөн он: 2026 оны 6 сарын 16' : 'Тест', verdict: i === 3 ? 'differs' : 'same', reason: i === 3 ? 'meaning' : 'none' })) }, masked.length);
  const rows = draftRows(masked, reply.lines, check.lines, slots, '[가림]');
  assert.deepEqual(rows[0].reasons, ['term']);
  assert.deepEqual(rows[1].reasons, ['name']);
  assert.deepEqual(rows[2].reasons, ['id'], '토큰이 빠진 줄(토큰 번호는 숫자로 세지 않는다)');
  assert.equal(rows[2].source, 'Регистрийн дугаар: УБ01234567', '원문 칸은 되돌린다');
  assert.deepEqual(rows[3].reasons, ['numbers', 'differs']);
  assert.throws(() => validateTranslateReply({ ok: true, scope: 'synk-path', action: 'translate', prompt: 'x', status: 'limit', remaining: 0, lines: [{ i: 0, ko: 'a', flag: 'none' }] }, 1), { code: 'INVALID_TRANSLATE_REPLY' });
  assert.equal(validateTranslateReply({ ok: true, scope: 'synk-path', action: 'translate', prompt: 'x', status: 'limit', remaining: 0, lines: [] }, 4).status, 'limit');
  assert.throws(() => validateCheckReply({ ok: true, scope: 'synk-path', action: 'translate', prompt: 'x', status: 'done', remaining: 0, lines: [] }, 0), { code: 'INVALID_TRANSLATE_REPLY' });
  const noCheck = draftRows(masked, reply.lines, null, slots, '[가림]');
  assert.equal(noCheck[3].back, null);
  assert.deepEqual(noCheck[3].reasons, ['numbers']);
  const two = maskLines(['РД: УБ01234567', 'Эцгийн РД: УБ76543210']);
  const swapped = draftRows(two.lines, [{ i: 0, ko: `등록번호: ${token(1)}`, flag: 'none' }, { i: 1, ko: `부의 등록번호: ${token(2)}`, flag: 'none' }],
    [{ i: 0, back: `РД: ${token(2)}`, verdict: 'same', reason: 'none' }, { i: 1, back: `Эцгийн РД: ${token(2)}`, verdict: 'same', reason: 'none' }], two.slots, '[가림]');
  assert.equal(swapped[0].back, 'РД: [가림]', '역번역의 토큰이 원문과 어긋나면 다른 줄의 번호를 되돌리지 않는다');
  assert.equal(swapped[1].back, 'Эцгийн РД: УБ76543210');
});
