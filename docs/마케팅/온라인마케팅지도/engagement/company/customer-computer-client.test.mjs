import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCompanyApp } from './server.mjs';
import * as V from './public/customer-computer-view.mjs';
import content from '../../../맞춤도구/computer/content.js';

// 고객 상담(/consultation/) 시그널 한 장 상담 판(2026-10-20): 화면 계약, 보이는 글, 글 모듈 계산, 서버가 내주는 파일.
const here = dirname(fileURLToPath(import.meta.url));
const read = name => readFile(join(here, 'public', name), 'utf8');
const visible = html => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
const C = V.COPY;
const allWords = () => Object.values(C).map(value => typeof value === 'function' ? value('N') : value).flat().join('\n');

test('the consultation page keeps the script contract and has no felt scrapbook or inline styles', async () => {
  const [html, js, css] = await Promise.all([read('customer-computer.html'), read('customer-computer.js'), read('customer-computer.css')]);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  const drawn = new Set([...js.matchAll(/\bid:'([^']+)'/g)].map(match => match[1]));
  for (const id of [...new Set([...js.matchAll(/(?:\$|\bput)\('([^']+)'/g)].map(match => match[1]))]) assert.ok(ids.includes(id) || drawn.has(id), `script element #${id} exists in the page or is drawn by the script`);
  for (const id of ['source-text', 'local-extract', 'ai-extract', 'login', 'logout', 'save-draft', 'load-draft', 'delete-draft', 'delete-ai', 'reset-local', 'copy-summary', 'shopping-summary']) assert.ok(ids.includes(id), id);
  assert.doesNotMatch(html, /\sstyle=|<style/i, 'CSP style-src self: no inline styles in the page');
  assert.doesNotMatch(js, /setAttribute\(\s*'style'|cssText|innerHTML|insertAdjacentHTML/, 'script builds nodes without markup styles or HTML strings');
  for (const old of ['scrapbook', 'felt-v2', 'fb-tile', 'fb-slab', 'laptop-felt', 'sb-eyebrow', 'class="felt']) assert.ok(!html.includes(old) && !css.includes(old) && !js.includes(old), old);
  for (const match of css.replace(/url\("data:[^"]*"\)/g, '').matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) assert.match(match[1], /^\/consultation\/assets\//, match[1]);
  // AI 제공자·모델 이름은 고객 화면에 보이지 않는다(AI 도구 이름 표기 금지). 서버 상태값은 그대로 받는다.
  assert.doesNotMatch(js, /providerLabel|modelLabel/);
  assert.doesNotMatch(html + allWords(), /OpenAI|GPT|Gemini 4|Claude/);
  assert.match(html, /<link rel="stylesheet" href="\/consultation\/customer-computer.css">/);
  assert.equal([...html.matchAll(/rel="stylesheet"/g)].length, 1, 'one stylesheet');
});

test('static words in the page come from the words module', async () => {
  const text = visible(await read('customer-computer.html'));
  for (const key of ['skip', 'eyebrow', 'lead', 'posterLabel', 'posterChip', 'login', 'logout', 'usesTitle', 'usesSub', 'startHere', 'textTitle', 'optional', 'textSub', 'textLabel',
    'findLocal', 'findAI', 'cancelAI', 'askTitle', 'editAnswers', 'saveTitle', 'save', 'load', 'remove', 'resumeLoad', 'privacyTitle', 'privacyNote', 'removeAI', 'reset', 'waiting',
    'summaryLabel', 'copy', 'copyPeek', 'disclaimer', 'dockOpen', 'foot', 'noscript', 'checkingLogin']) assert.ok(text.includes(C[key]), `${key}: ${C[key]}`);
  for (const line of [...C.heading, ...C.meta]) assert.ok(text.includes(line), line);
  assert.ok((await read('customer-computer.html')).includes(`<title>${C.title}</title>`));
  assert.ok((await read('customer-computer.html')).includes(`placeholder="${C.textPlaceholder}"`));
  assert.ok((await read('customer-computer.html')).includes(`data-word="${C.posterWord}"`));
  assert.ok((await read('customer-computer.html')).includes(`aria-label="${C.copyText}"`), 'the copy text box has a name');
});

// 옛 GPT 판 글 → 새 글(고객 관리 11판과 같은 방식). 옛 글은 어디에도 남지 않고 새 글은 화면이나 글 모듈에 있다.
const PAIRS = [
  ['내 작업에서 시작하는 사양 가이드', 'SYNK · COMPUTER CONSULT'],
  ['어떤 일을 하는지 적거나 골라 주세요.', '하는 일을 고르면 꼭 필요한 것만 하나씩 물어볼게요.'],
  ['확인한 조건으로 필요한 사양을 함께 좁혀 가요.', '답할 때마다 필요한 사양이 바로 계산돼요.'],
  ['내 조건부터 살펴보기', '여기부터 골라요'],
  ['SYNK ID로 이어서 상담하기', 'SYNK ID로 로그인하면 이 상담을 내 계정에 저장해 두고, 다른 기기에서도 이어 볼 수 있어요.'],
  ['로그인 전에도 조건을 고를 수 있어요. 서버 저장은 직접 저장을 누를 때만 해요.', 'SYNK ID 로그인을 준비하고 있어요. 상담은 지금 바로 할 수 있어요.'],
  ['01 · 나의 조건', '내 상황 글로 쓰기'],
  ['지금 하는 일을 알려 주세요', '쓰는 프로그램, 지금 컴퓨터, 예산처럼 떠오르는 대로 써 주세요.'],
  ['사용하는 프로그램, 지금 컴퓨터, 예산 등', '내 상황'],
  ['확실하지 않은 내용은 보류해요. 다른 사람의 상황이나 예전 일은 내 현재 조건으로 반영하지 않아요.', '지금 내 조건인지 확실하지 않아서 바로 반영하지 않았어요.'],
  ['이 기기에서 조건 정리', '이 기기에서 찾기'],
  ['AI로 정리하기', 'AI로 찾기'],
  ['AI 요청 취소', '그만두기'],
  ['버튼을 누르면 원문을 연결된 AI 제공자에게 보내며', 'AI로 찾기를 누르면 쓴 글을 외부 AI 서비스에 보내 조건을 찾고, 받은 답은 암호화해 최대 24시간 보관해요.'],
  ['아직 확인이 필요한 문장', '확인이 더 필요한 문장 N개'],
  ['여러 일을 하면 모두 골라 주세요. 직접 고른 조건이 우선해요.', '하는 일을 모두 골라 주세요.'],
  ['02 · 필요한 것만 하나씩', '필요한 질문'],
  ['추천을 위한 조건 확인', '확인한 조건 다시 고르기'],
  ['03 · 내 상담 요약', 'MY CONSULT'],
  ['먼저 용도를 골라 주세요', '하는 일을 고르면 여기에 필요한 사양이 바로 나와요.'],
  ['구매 상담에 쓸 조건 보기', '복사할 글 보기'],
  ['요약 복사', '구매 상담 글 복사'],
  ['사양 가이드이며 특정 판매 상품을 선정하지 않아요.', '특정 상품이 아니라 사양을 안내하는 상담이니, 살 때는 가격·재고와 프로그램 지원 조건을 판매처에서 확인해 주세요.'],
  ['다음에도 이어 보기', '내 상담 저장'],
  ['원문과 확인한 조건 한 건을 내 계정에 저장해요.', '쓴 글과 고른 조건을 내 계정에 저장해 둬요.'],
  ['로그인하면 저장·불러오기·삭제를 할 수 있어요.', '로그인하면 보관 상태를 볼 수 있어요.'],
  ['서버 상담 삭제', '저장한 상담 지우기'],
  ['AI 응답 보관과 삭제', 'AI 답 보관과 지우기'],
  ['AI 응답 보관과 저장한 상담은 별개예요.', '저장한 상담과 AI 답은 따로 보관돼서, 상담을 지워도 AI 답은 남을 수 있어요.'],
  ['보관된 내 AI 응답 삭제', '보관된 AI 답 지우기'],
  ['현재 화면 비우기', '이 화면 비우기'],
  ['내가 확인한 조건으로 · SYNK', 'SYNK · 컴퓨터 상담'],
  ['상담을 진행하려면 브라우저의 자바스크립트를 켜 주세요.', '상담을 하려면 브라우저에서 자바스크립트를 켜 주세요.'],
  ['로그인 계정이 바뀌어 현재 화면의 상담을 비웠어요.', '다른 계정으로 바뀌어서 화면의 상담을 비웠어요.'],
  ['서버 상담 상태를 확인하지 못했어요. 현재 입력은 그대로예요.', '저장한 상담을 확인하지 못했어요. 쓰던 내용은 그대로예요.'],
  ['현재 입력을 유지했어요. 연결이 돌아오면 이 창을 다시 선택해 주세요.', '쓰던 내용은 그대로 두었어요. 연결이 돌아오면 이 창을 다시 눌러 주세요.'],
  ['SYNK ID로 로그인하면 내 계정에 상담을 저장할 수 있어요.', 'SYNK ID로 로그인하면 이 상담을 내 계정에 저장해 두고, 다른 기기에서도 이어 볼 수 있어요.'],
  ['SYNK ID 연결을 준비 중이에요.', 'SYNK ID 로그인을 준비하고 있어요.'],
  ['AI 요청 다시 확인', 'AI 답 다시 받기'],
  ['AI가 원문을 정리하고 있어요. 확인한 조건은 그대로 유지해요.', 'AI가 글을 읽고 있어요. 고른 조건은 그대로 둬요.'],
  ['로 원문을 정리할 수 있어요.', 'AI로 찾기를 누르면 쓴 글을 외부 AI 서비스에 보내 조건을 찾고'],
  ['AI 정리는 SYNK ID 로그인 후 사용할 수 있어요.', 'AI로 찾기는 SYNK ID로 로그인하면 쓸 수 있어요.'],
  ['AI 정리를 지금 사용할 수 없어요. 이 기기에서 정리하거나 직접 골라 주세요.', '지금은 AI로 찾기를 쓸 수 없어요. 이 기기에서 찾거나 직접 골라 주세요.'],
  ['오늘 AI 요청', '번 더 쓸 수 있어요.'],
  ['서버 AI 응답', '보관 중인 AI 답'],
  ['저장된 상담이 있어요.', '저장한 상담이 있어요'],
  ['현재 화면에는 아직 저장하지 않은 변경이 있어요.', '바꾼 내용은 아직 저장하지 않았어요.'],
  ['현재 입력한 내용은 아직 서버에 저장하지 않았어요.', '지금 쓴 내용은 저장 전이에요.'],
  ['저장된 상담이 없어요.', '아직 저장한 상담이 없어요'],
  ['제안을 반영하지 못했어요. 원문을 다시 정리하거나 직접 골라 주세요.', '찾은 조건을 반영하지 못했어요. 다시 찾거나 직접 골라 주세요.'],
  ['정리한 제안', '찾은 조건 N개'],
  ['원문을 정리하면 근거 문장과 확인할 조건을 보여 드려요.', '찾기를 누르면 근거가 된 문장과 함께 조건을 보여 드려요.'],
  ['직접 고른 조건이 우선 적용돼요.', '직접 고른 답이 먼저예요'],
  ['확인한 조건으로 반영했어요.', '반영했어요'],
  ['추천에서 제외했어요.', '뺐어요'],
  ['아직 추천에 반영하지 않았어요.', '확인해 주세요'],
  ['확인 취소', '빼기'],
  ['내 조건이 맞아요', '맞아요'],
  ['이 값으로 수정', '이 값으로 바꾸기'],
  ['선택한 조건 확인', '다 골랐어요'],
  ['위에서 하고 싶은 일을 고르면 필요한 질문부터 이어 갈게요.', '하는 일을 고르면 여기서 질문이 시작돼요.'],
  ['마무리 전에 필요한 기본 조건을 확인해요.', '꼭 필요한 조건'],
  ['필요한 사양을 좁히는 데 도움이 되는 질문이에요.', '알아 두면 좋은 팁'],
  ['필수 조건을 확인했어요. 아래에서 상담 요약을 볼 수 있어요.', '필요한 조건을 모두 확인했어요'],
  ['모르는 항목은 임시 조건으로 남겨 두었어요. 확인되면 아래에서 다시 골라 주세요.', '모르는 항목은 임시로 두고 계산했어요'],
  ['필수 확인 완료', '필요한 확인 끝'],
  ['아직 임시 조건이 포함된 사양 안내예요', '임시 조건 포함'],
  ['미확인: ', '아직 묻지 않았어요.'],
  ['로그인 상태가 바뀌었어요. 다시 확인해 주세요.', '로그인 상태가 바뀌었어요. 확인한 뒤 다시 해 주세요.'],
  ['다른 화면에서 상담이 바뀌었어요.', '다른 기기나 창에서 상담이 먼저 저장됐어요.'],
  ['요청을 완료하지 못했어요. 현재 입력을 유지했으니 다시 시도해 주세요.', '처리하지 못했어요. 쓰던 내용은 그대로 두었으니 다시 해 주세요.'],
  ['원문 인용을 보고 맞는 조건을 확인해 주세요.', '찾은 조건을 근거 문장과 함께 보여 드려요. 맞는 것만 골라 주세요.'],
  ['조건을 정리하지 못했어요. 아래에서 직접 골라 주세요.', '조건을 찾지 못했어요. 직접 골라 주세요.'],
  ['이 화면에는 AI 응답을 반영하지 않아요.', 'AI로 찾기를 그만뒀어요.'],
  ['AI 요청을 준비하지 못했어요.', 'AI로 찾을 글을 준비하지 못했어요. 다시 해 주세요.'],
  ['AI 제안을 확인해 주세요. 확인 전에는 추천에 반영하지 않아요.', 'AI가 찾은 조건이에요. 맞는 것만 골라 주세요.'],
  ['AI 응답을 받지 못했어요. 같은 요청을 다시 확인하거나 직접 조건을 골라 주세요.', 'AI 답을 받지 못했어요.'],
  ['로그인 화면으로 이동하면 저장하지 않은 입력은 사라져요. 계속할까요?', '로그인 화면으로 가면 저장하지 않은 내용이 사라져요. 계속할까요?'],
  ['저장하지 않은 입력을 비우고 로그아웃할까요?', '저장하지 않은 내용을 비우고 로그아웃할까요?'],
  ['로그아웃했어요. 현재 화면의 상담 내용도 비웠어요.', '로그아웃했어요. 화면의 상담도 비웠어요.'],
  ['내 계정에 상담을 저장했어요.', '내 계정에 저장했어요.'],
  ['현재 입력 대신 서버에 저장한 상담을 불러올까요?', '지금 화면 대신 저장한 상담을 불러올까요?'],
  ['서버에 저장된 상담이 없어요. 현재 입력은 유지했어요.', '저장한 상담이 없어요. 쓰던 내용은 그대로 두었어요.'],
  ['저장한 원문과 확인 조건을 불러왔어요.', '저장한 상담을 불러왔어요.'],
  ['서버에 저장한 상담 한 건과 현재 화면의 입력을 삭제할까요?', '저장한 상담과 지금 화면의 내용을 지울까요?'],
  ['서버 상담과 현재 화면의 입력을 삭제했어요.', '저장한 상담과 화면의 내용을 지웠어요.'],
  ['서버에 보관된 내 AI 응답을 삭제할까요? 저장한 상담은 유지돼요.', '보관된 내 AI 답을 지울까요? 저장한 상담은 그대로 둬요.'],
  ['서버에 보관된 내 AI 응답을 삭제했어요.', '보관된 AI 답을 지웠어요.'],
  ['현재 화면의 입력을 비울까요? 서버에 저장한 상담은 유지돼요.', '지금 화면의 내용을 비울까요? 저장한 상담은 그대로 둬요.'],
  ['현재 화면을 비웠어요.', '화면을 비웠어요.'],
  ['구매 상담에 쓸 요약을 복사했어요.', '복사했어요. AI 검색이나 판매처 상담에 붙여 넣어 쓰세요.'],
  ['자동 복사를 하지 못했어요. 위 요약을 선택해 복사해 주세요.', '자동 복사가 막혔어요. 펼쳐 둔 글을 직접 복사해 주세요.'],
];
test('GPT-era sentences are rewritten through old → new pairs', async () => {
  const [html, js, view] = await Promise.all([read('customer-computer.html'), read('customer-computer.js'), read('customer-computer-view.mjs')]);
  // 새 글은 화면, 글 모듈의 낱말, 글 모듈이 만드는 문장(횟수·보관 상태 같은 틀) 가운데 하나에 있다.
  const now = visible(html) + '\n' + allWords() + '\n' + view;
  for (const [old, fresh] of PAIRS) {
    assert.ok(!html.includes(old) && !js.includes(old) && !view.includes(old), `old sentence stays out: ${old}`);
    assert.ok(now.includes(fresh), `new sentence is on the page or in the words module: ${fresh}`);
  }
  // 한 화면 한 말투: 합니다체로 끝나는 문장이 없다.
  assert.doesNotMatch(now, /(?:습니다|합니다|됩니다|입니다)[.!?]?(?:\s|$)/);
});

test('words module: headline lines, notes, readout and status lines', () => {
  assert.deepEqual(V.headlineParts('데스크톱(윈도우 PC·맥 미니) · 램 32GB · 그래픽 8GB'), [{ main: '데스크톱', aside: '윈도우 PC·맥 미니' }, { main: '램 32GB', aside: '' }, { main: '그래픽 8GB', aside: '' }]);
  assert.equal(V.dockLine({ headline: { title: '데스크톱(윈도우 PC·맥 미니) · 램 32GB · 그래픽 8GB' } }), '데스크톱 · 램 32GB · 그래픽 8GB');
  const result = { headline: { sub: '프리미어 프로 4K 편집 기준 가성비 추천이에요. 지금 노트북은 밖에서 계속 쓰고, 이 데스크톱을 더하세요.' },
    current: { actions: [{ code: 'keep-laptop', t: '작업이 무거우니 지금 노트북은 밖에서 계속 쓰고, 무거운 작업용 데스크톱을 더하세요.' }, { code: 'monitor-memory-usage', t: '메모리를 지켜보세요.' }, { code: 'check-storage', t: '저장공간이 거의 찼는지 확인해 보세요.' }] },
    os: { conflicts: [{ code: 'fcp-mac', t: '파이널 컷 프로는 맥에서만 돼요.' }] }, budget: { warn: true, alternatives: [{ t: '예산이 빠듯하면 램을 먼저 채우세요.' }], tips: [{ t: '쓰지 않아요.' }] } };
  assert.deepEqual(V.summaryItems(result), ['저장공간이 거의 찼는지 확인해 보세요.', '파이널 컷 프로는 맥에서만 돼요.', '예산이 빠듯하면 램을 먼저 채우세요.'], 'same advice as the headline line and the memory monitor note are left out');
  const cells = gpu => V.readout({ ram: { value: 16, roomy: 32 }, storage: { valueText: '512GB' }, gpu }).at(-1);
  assert.deepEqual(cells({ kind: 'unified', vram: 0, short: '통합 메모리' }), { label: '그래픽', value: '통합', sub: '맥 통합 메모리' });
  assert.deepEqual(cells({ kind: 'integrated', vram: 0, short: '내장 그래픽' }), { label: '그래픽', value: '내장', sub: '내장 그래픽으로 충분' });
  assert.deepEqual(cells({ kind: 'either', vram: 8 }), { label: '그래픽', value: '8GB', sub: '윈도우 기준' });
  assert.deepEqual(cells({ kind: 'dedicated', vram: 12 }), { label: '그래픽', value: '12GB', sub: '외장 그래픽' });
  assert.deepEqual(V.readout({ ram: { value: 32, roomy: 32 }, storage: { valueText: '1TB' }, gpu: { kind: 'dedicated', vram: 8 } })[0], { label: '램', value: '32GB', sub: '' });
  assert.equal(V.readout(null).every(cell => cell.value === '—'), true);
  assert.equal(V.unresolvedText(['owned', 'os']), '지금 쓰는 컴퓨터, 편한 운영체제는 아직 묻지 않았어요.');
  assert.equal(V.unresolvedText(['current.ram']), '지금 컴퓨터 램은 아직 묻지 않았어요.');
  assert.equal(V.unresolvedText([]), '');
  assert.equal(V.assumptionText({ id: 'multitask', text: '동시에 켜 두는 양은 보통(탭 10~20개와 메신저)으로 가정했어요.' }), '탭 10~20개와 메신저 정도를 동시에 켜 둔다고 가정했어요.');
  assert.equal(V.assumptionText({ id: 'other', text: '그대로 둬요.' }), '그대로 둬요.');
});

test('words module: account, draft, AI usage and proposal states', () => {
  const now = Date.parse('2026-10-20T13:00:00Z');
  assert.equal(V.dateText('2026-10-20T12:31:00Z', now), '10월 20일 오후 9:31');
  assert.equal(V.dateText('2025-10-20T12:31:00Z', now), '2025년 10월 20일 오후 9:31');
  assert.equal(V.dateText('not a date', now), '');
  assert.deepEqual(V.draftStatus({ authenticated: false }), { head: null, line: C.saveLoggedOut, state: 'off' });
  assert.equal(V.draftStatus({ authenticated: false, checking: true }).line, C.checkingLogin);
  assert.equal(V.draftStatus({ authenticated: true, revision: null }).head, C.saveUnknown);
  assert.deepEqual(V.draftStatus({ authenticated: true, revision: 2, status: 'active', updatedAt: '2026-10-20T12:31:00Z', dirty: true }, now),
    { head: C.saveHasDraft, line: '10월 20일 오후 9:31에 저장했어요. 바꾼 내용은 아직 저장하지 않았어요.', state: 'check' });
  assert.deepEqual(V.draftStatus({ authenticated: true, revision: 0, status: 'empty', dirty: false }), { head: C.saveNoDraft, line: C.saveNote, state: 'off' });
  assert.equal(V.usageText({ requestsUsed: 1, requestLimit: 5, requestsRemaining: 4, resetsAt: '2026-10-21T00:00:00Z' }, now), '오늘 4번 더 쓸 수 있어요. 10월 21일 오전 9:00에 다시 채워져요.');
  assert.equal(V.usageText({ requestsUsed: 5, requestLimit: 5, requestsRemaining: 0 }, now), '오늘 쓸 수 있는 횟수를 다 썼어요.');
  assert.equal(V.usageText({ requestsUsed: '1' }), '');
  assert.equal(V.aiExhausted({ requestsUsed: 5, requestLimit: 5, requestsRemaining: 0 }), true);
  assert.equal(V.aiExhausted({ requestsUsed: 1, requestLimit: 5, requestsRemaining: 4 }), false);
  assert.equal(V.aiExhausted(null), false, 'unknown usage does not block the button');
  assert.equal(V.privacyText({ canDelete: true, storedResponses: 2, pendingResponses: 0, retentionHours: 24 }), '보관 중인 AI 답 2개 · 최대 24시간 보관해요.');
  assert.equal(V.privacyText({ canDelete: true, storedResponses: 0, pendingResponses: 1, retentionHours: 24 }), '보관 중인 AI 답 0개 · 처리 중 1개 · 최대 24시간 보관해요.');
  assert.equal(V.privacyText({ canDelete: false, reason: 'session-required' }), C.privacyLoggedOut);
  assert.equal(V.privacyText({ canDelete: false, reason: 'host-unavailable' }), C.privacyUnknown, 'logged in but no privacy state: not the logged-out sentence');
  assert.equal(V.privacyCount({ canDelete: true, storedResponses: 2 }), '2개 보관 중');
  assert.equal(V.privacyCount({ canDelete: true, storedResponses: 0 }), '');
  assert.equal(V.privacyCount({ canDelete: false }), '');
  assert.deepEqual(V.proposalStatus({ manual: true }), { text: C.proposalManual, state: 'info' });
  assert.deepEqual(V.proposalStatus({ active: true }), { text: C.proposalActive, state: 'ok' });
  assert.deepEqual(V.proposalStatus({ action: 'reject' }), { text: C.proposalExcluded, state: 'off' });
  assert.deepEqual(V.proposalStatus({}), { text: C.proposalPending, state: 'check' });
  assert.deepEqual(V.proposalDisplay({ kind: 'boolean', about: 'uses', member: 'video', label: '하고 싶은 일 · 영상 편집' }, true), { label: '하는 일', value: '영상 편집' });
  assert.deepEqual(V.proposalDisplay({ kind: 'boolean', about: 'uses', member: 'video', label: '하고 싶은 일 · 영상 편집' }, false), { label: '하는 일', value: '영상 편집 안 함' });
  assert.deepEqual(V.proposalDisplay({ id: 'video.app', kind: 'enum', label: '영상 편집 · 쓸 프로그램', options: [{ id: 'premiere', label: '프리미어 프로' }] }, 'premiere'), { label: '편집 프로그램', value: '프리미어 프로' });
  const groups = V.groupByQuote([{ id: 'a', evidence: [{ quote: '하나' }] }, { id: 'b', evidence: [{ quote: '둘' }] }, { id: 'c', evidence: [{ quote: '하나' }] }]);
  assert.deepEqual(groups.map(group => [group.quote, group.items.map(item => item.id)]), [['하나', ['a', 'c']], ['둘', ['b']]]);
  assert.deepEqual(V.progressCount({ fields: [{ required: true, state: 'known' }, { required: true, state: 'missing' }, { required: false, state: 'known' }] }), { known: 1, total: 2 });
  assert.equal(V.textCount(66), '66 / 4000');
  assert.equal(V.topic('예산'), '예산은');
  assert.equal(V.topic('편한 운영체제'), '편한 운영체제는');
});

test('every question has a sentence, a short label and the same felt object as the synk.im tool', () => {
  const groupFields = content.steps.filter(step => step.type === 'group').flatMap(step => step.fields.map(field => `${step.id}.${field.id}`));
  assert.deepEqual(Object.keys(V.FIELD_QUESTIONS).sort(), groupFields.sort(), 'each group field is asked as its own sentence');
  for (const step of content.steps) {
    if (step.type === 'group') for (const field of step.fields) assert.ok(V.FIELD_LABELS[`${step.id}.${field.id}`], `${step.id}.${field.id} label`);
    else assert.ok(V.FIELD_LABELS[step.id], `${step.id} label`);
    assert.deepEqual(V.questionArt({ about: step.id }), { src: `/consultation/assets/computer-art-${step.id}.webp`, width: V.QUESTION_ART[step.id][0], height: V.QUESTION_ART[step.id][1] });
    if (step.type !== 'group') assert.equal(V.questionText(content, { about: step.id, title: step.short || '' }), step.title);
  }
  assert.equal(V.questionText(content, { about: 'current.ram', title: '지금 컴퓨터 사양 · 램 용량' }), '지금 컴퓨터의 램은 얼마인가요?');
  assert.equal(V.questionLead(content, { about: 'current.ram' }), content.steps.find(step => step.id === 'current').sub);
  assert.equal(V.questionTip(content, { about: 'owned' }).title, content.steps.find(step => step.id === 'owned').tip.title);
  assert.equal(V.fieldLabel('owned'), '지금 쓰는 컴퓨터');
});

test('the company server serves every file the consultation page asks for, and not the old scrapbook files', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'synk-consultation-assets-'));
  const app = createCompanyApp({ dataDir: directory, port: 0, allowTestHost: true, schedule: false, backgroundJobsEnabled: false, synkIdentityConfig: null, synkCustomerIdentityConfig: null });
  const address = await app.start(), base = 'http://127.0.0.1:' + address.port;
  t.after(async () => { await app.stop(); assert.equal(dirname(resolve(directory)), resolve(tmpdir())); await rm(directory, { recursive: true, force: true }); });
  const [html, css, js] = await Promise.all([read('customer-computer.html'), read('customer-computer.css'), read('customer-computer.js')]);
  const paths = new Set(['/consultation/']);
  for (const match of html.matchAll(/(?:src|href)="(\/[^"#?]+)"/g)) paths.add(match[1]);
  for (const match of css.matchAll(/url\(\s*'(\/[^']+)'\s*\)/g)) paths.add(match[1]);
  for (const match of js.matchAll(/from '\.\/([^']+)'/g)) paths.add('/consultation/' + match[1]);
  for (const id of Object.keys(V.QUESTION_ART)) paths.add(V.questionArt({ about: id }).src);
  const types = { '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
  for (const path of paths) {
    const response = await fetch(base + path), body = await response.arrayBuffer();
    assert.equal(response.status, 200, path);
    assert.ok(body.byteLength > 0, path);
    const type = Object.entries(types).find(([ext]) => path.endsWith(ext))?.[1] || 'text/html';
    assert.ok(response.headers.get('content-type').startsWith(type), `${path}: ${response.headers.get('content-type')}`);
  }
  assert.ok(paths.size >= 30, `asked files: ${paths.size}`);
  for (const old of ['/consultation/assets/scrapbook.css', '/consultation/assets/laptop-felt.webp', '/consultation/assets/fb-tile-cream-long.webp']) assert.equal((await fetch(base + old)).status, 404, old);
});
