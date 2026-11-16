#!/usr/bin/env node
// 대표 노트 채점기(2026-11-17 유호님 「이건 내가 직접하는게 아니라 클로드 api로 할게」, 결정 표 11-17 「대표 노트는 Claude API로」).
//
// 대표 노트는 학습자 말 한 줄에 「이 말에서 하나만 고친다면」을 적어 드라마 말하기 코치(tools/lib/드라마판정.mjs)의 노트와 맞대는 기준이다.
// 유호님이 줄마다 손으로 적지 않고, 대표가 세운 기준(docs/드라마말하기_기획.md 4-1 · 4-2 · 4-3, 3-5, 교정 원칙 넷)을 받은 채점 AI가 적는다.
//   1. 코치 판정은 이 PC에서 같은 규칙으로 다시 돌린다(받아 적은 글 + 대사 칸 명세 → judgeLine).
//   2. Claude(기본 claude-opus-5-5)가 코치 노트를 보지 않고 먼저 「하나만 고친다면」을 적는다.
//   3. 코치가 노트를 줬는데 채점과 다른 줄만, 같은 채점 AI에게 코치 노트를 보여 주고 「학생 말에 실제로 있는 문제를 짚었나」를 묻는다(오노트 판정).
//   4. 같은 AI끼리 점수가 부풀지 않게 다른 회사의 AI(카본, gemini-4-carbon)가 같은 기준으로 한 번 더 적는다(두 평가자 겹침).
//      줄 순서를 섞어 25줄씩 나눠 보내고, 입력 id 대신 순번만 쓴다.
//   5. 기획 4-3대로 일치 · 오노트(분모는 코치가 준 노트 수) · 노트를 안 준 비율 · 두 채점의 겹침과 차이를 함께 보인다.
//
// 쓰기: node tools/대표노트채점.mjs <입력.jsonl> [--밖 <폴더>] [--모델 claude-opus-5-5] [--노력 high] [--둘째 카본|없음] [--동시 4] [--몇 N] [--미리]
//   입력 첫 줄은 {"메타":{"출처":"합성"|"동의녹음", ...}}, 다음 줄부터 {"id","줄"(대사 id),"받아적은글","초"?,"말한초"?,"의도"?(합성만 — 채점기 점검용)}.
//   동의녹음은 메타에 「동의확인」(어느 동의서 · 날짜)과 「국외처리동의」(["Anthropic","Google"] 가운데 동의받은 곳)가 있어야 하고,
//   입력과 결과 폴더가 git 작업본 밖(비공개 보관함)이어야 한다. 카본은 국외처리동의에 Google이 있고 메타 「카본경로확인」(구독 경로의
//   데이터 처리와 18세 미만 약관을 확인한 근거)이 있을 때만 쓴다. 출처 칸은 스스로 적는 값이라, 실제 학생 말을 「합성」으로 적으면 이 관문이 모두 빠진다.
//   --미리: API를 부르지 않고 코치 판정과 보낼 글만 만들어 본다.
// 결과: <밖>/결과.json(줄마다 코치 · 채점 · 맞댐 · 확인, 셈, 합격선, 토큰), <밖>/보고.md. 채점 답은 <밖>/중간.jsonl에 하나씩 남아, 키가 바닥나 멈춘 뒤
//   같은 --밖으로 다시 돌리면 받은 답은 다시 사지 않는다(모델 · 노력 · 보낸 글이 같을 때만).
// 키: tools/lib/클로드키.js(키 값은 ~/SYNK_보안, 출력 · 기록하지 않음). 서버 쪽 대체 모델(fallbacks)은 이 통로가 베타 머리글을 넘기지 않아 쓰지 않고, 거절은 줄마다 「채점없음」으로 남긴다.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { judgeLine, minSyllablesOf, allowedEndings, DRAMA_JUDGE_VERSION } from './lib/드라마판정.mjs';
import { dramaLines, linesHash, readEpisodes } from './build-world-speaking-talk.mjs';
import { dramaReviewRows } from './lib/drama-spec-review-unit.mjs';
import { 코치결정, 채점결정, 맞대기, 세기, 합격선 } from './lib/대표노트비교.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..');
const 클로드 = createRequire(import.meta.url)('./lib/클로드키.js');

const 끝맺음말 = { polite: '해요체', formal: '합쇼체', plain: '반말' };
const 상대이름 = { professor: '교수님', senior: '선배', staff: '직원(조교 · 사서 · 안내)', stranger: '처음 보는 사람', group: '여러 사람(동아리 등)', friend: '친구' };
const 카본묶음 = 25;

// 기준 글 — 괄호 안은 원문 자리(docs/드라마말하기_기획.md). 끝의 「적는 꼴 약속」은 기준이 아니라 맞대기를 위해 더한 것이다.
export const 기준글 = `너는 몽골 학생이 쓰는 한국어 말하기 연습 앱의 「대표 노트」를 적는 채점자다.
대표 노트는 학생이 드라마 장면에서 말한 대사 한 줄을 보고, 대표가 세운 기준대로 「이 말에서 딱 하나만 고친다면」을 고르는 것이다. 아무것도 고치지 않아도 되면 「없음」이다.

대표가 세운 기준:
1. 교정 원칙 넷(4-3 1번). 장면 중에는 끼어들지 않는다. 장면이 끝난 뒤 고칠 것 하나만 노트로 짚는다. 학생이 그 줄을 스스로 다시 말하게 한다. 확신이 없으면 노트를 주지 않는다.
2. 노트 종류는 셋뿐이다(4-1 표).
 - 끝맺음 · 높임: 상대에게 맞는 말투로 끝내지 않았다. 줄마다 「이 대사에 맞는 끝맺음」을 준다. 그 가운데 어느 것으로 끝내도 맞고(해요체와 합쇼체는 둘 다 맞다), 맞지 않는 꼴(예: 교수님께 반말)로 끝냈으면 노트다. 바랄 것은 맞는 끝맺음 가운데 하나를 적는다.
 - 길이: 한 낱말로 끝내는 것처럼 대사를 짧게 끝냈다. 얼마나 짧아야 짧은지는 대사 칸 명세의 최소 길이가 정하고, 줄마다 「짧게 끝난 것으로 볼 선」으로 준다. 학생 말이 그 음절 수보다 적을 때만 이 노트다(같으면 짧지 않다).
 - 빠진말: 대사의 핵심 말이 말에 없거나 뜻이 다른 말로 바뀌었다(예: 「도서관」을 「식당」으로). 핵심 말의 허용 표현으로 말했으면 빠진 것이 아니다. 2음절 이하인 핵심 말은 빠졌다고 단정하지 않는다(확신 낮음).
3. 노트 고르기(4-2). 확신이 높은 것부터 하나만 고른다: 끝맺음 · 높임 → 길이 → 빠진말. 고를 게 없거나 확신이 없으면 노트 없이 둔다. 억지로 만들지 않는다.
4. 하지 않는 것(4-1). 점수나 등급을 매기지 않는다. 억양이나 감정을 판정하지 않는다. 받아 적은 글만으로 발음 오류를 단정하지 않는다(받아 적기는 소리 나는 대로 적을 수 있다 — 「있어서」와 「이써서」, 「도서관에」와 「도서과네」는 같은 말이다). 사람 이름처럼 소리만 비슷한 차이를 오류로 고르지 않는다.
5. 명세 밖 표현(3-5). 말은 했지만 허용 표현과 정보 명세만으로 맞고 틀림을 확신하지 못하면 판정을 보류한다(노트 없음). 「처음 보는 대사」는 학생이 스스로 만드는 말이라 핵심 말이 없어도 다른 말로 했을 수 있으니 빠진말 노트를 주지 않는다(끝맺음 · 높임과 길이만 본다).
6. 노트 종류 밖의 문제(조사, 시제, 어순, 낱말을 잘못 고름 등)는 노트로 고르지 않는다. 「기준밖」 칸에 한 문장으로만 적는다. 없으면 빈 글로 둔다.
7. 확신: 받아 적은 글만으로 그 문제가 분명하면 「높음」, 받아 적기가 놓쳤을 수도 있어 애매하면 「낮음」이다. 낮으면 노트를 주지 않는 것과 같다.

적는 꼴 약속(맞대기를 위한 것): 「빠진말」 칸에는 빠진 핵심 말 하나를 주어진 핵심 말 표기 그대로 낱말로만 적는다(문장으로 쓰지 않는다). 둘 이상 빠졌으면 2음절 이하인 것을 뺀 나머지 가운데 핵심 말 목록에서 앞에 있는 것을 적는다.
입력은 소리가 아니라 받아 적은 글이다. 답은 정해진 JSON 하나로만 한다. 「까닭」은 학생 말의 어느 부분 때문인지 한 문장으로 쓴다.`;

export const 답꼴 = {
  type: 'object',
  properties: {
    노트: { type: 'string', enum: ['없음', '끝맺음', '길이', '빠진말'] },
    끝맺음_바랄것: { type: 'string', enum: ['해요체', '합쇼체', '반말', '해당없음'] },
    빠진말: { type: 'string', description: '빠진 핵심 말 하나를 주어진 표기 그대로 낱말로만. 빠진말 노트가 아니면 빈 글.' },
    확신: { type: 'string', enum: ['높음', '낮음'] },
    까닭: { type: 'string' },
    기준밖: { type: 'string' },
  },
  required: ['노트', '끝맺음_바랄것', '빠진말', '확신', '까닭', '기준밖'],
  additionalProperties: false,
};

const 확인꼴 = {
  type: 'object',
  properties: { 판정: { type: 'string', enum: ['맞는 지적', '틀린 지적', '애매'] }, 까닭: { type: 'string' } },
  required: ['판정', '까닭'],
  additionalProperties: false,
};

function 양의정수(이름, v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${이름}에는 1 이상의 정수를 준다(받은 값: ${v})`);
  return n;
}

function 인자(argv) {
  const o = { 입력: null, 밖: null, 모델: 'claude-opus-5-5', 노력: 'high', 둘째: '카본', 동시: 4, 몇: null, 미리: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], 값 = () => { const v = argv[++i]; if (v == null) throw new Error(`${a} 뒤에 값이 없다`); return v; };
    if (a === '--밖') o.밖 = 값();
    else if (a === '--모델') o.모델 = 값();
    else if (a === '--노력') o.노력 = 값();
    else if (a === '--둘째') o.둘째 = 값();
    else if (a === '--동시') o.동시 = 양의정수(a, 값());
    else if (a === '--몇') o.몇 = 양의정수(a, 값());
    else if (a === '--미리') o.미리 = true;
    else if (a.startsWith('--')) throw new Error(`모르는 인자 ${a}`);
    else if (!o.입력) o.입력 = a;
    else throw new Error(`입력은 하나만 받는다: ${a}`);
  }
  if (!o.입력) throw new Error('쓰기: node tools/대표노트채점.mjs <입력.jsonl> [--밖 <폴더>] [--모델 …] [--노력 high] [--둘째 카본|없음] [--미리]');
  if (!['카본', '없음'].includes(o.둘째)) throw new Error('--둘째는 카본이나 없음');
  return o;
}

/** 실제 경로 — 아직 없는 결과 폴더는 있는 조상까지 올라가 realpath를 잡고 나머지를 붙인다(정션 · 심볼릭 링크로 저장소 안을 가리키는 경로를 잡는다). */
function 실제경로(p) {
  let 위 = path.resolve(p);
  const 남은 = [];
  while (!fs.existsSync(위)) { const 부모 = path.dirname(위); if (부모 === 위) break; 남은.unshift(path.basename(위)); 위 = 부모; }
  return path.join(fs.existsSync(위) ? fs.realpathSync.native(위) : 위, ...남은);
}
/**
 * git 작업본 안인가 — 이 작업본(기준) 안이거나, 경로의 조상 가운데 하나라도 .git(폴더나 파일)을 가지면 안으로 본다.
 * 이 저장소는 공개이고 워크트리 · 운영 사본이 여럿이라 「이 작업본 밖」만으로는 다른 작업본을 막지 못한다(Fable 11-17). 비공개 보관함은 git 작업본이 아니다.
 * 「..비공개」처럼 점 둘로 시작하는 이름을 밖으로 잘못 보지 않는다.
 */
export function 저장소안(p, 기준 = 뿌리) {
  const 실 = 실제경로(p);
  const r = path.relative(실제경로(기준), 실);
  if (!(r === '..' || r.startsWith(`..${path.sep}`) || path.isAbsolute(r))) return true;
  for (let 위 = 실; ; 위 = path.dirname(위)) {
    if (fs.existsSync(path.join(위, '.git'))) return true;
    if (path.dirname(위) === 위) return false;
  }
}

export function 입력읽기(글) {
  const 줄들 = 글.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l, i) => {
    let v; try { v = JSON.parse(l); } catch { throw new Error(`입력 ${i + 1}째 줄이 JSON이 아니다`); }
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`입력 ${i + 1}째 줄이 객체가 아니다`);
    return v;
  });
  const 메타 = 줄들[0]?.메타;
  if (!메타 || !['합성', '동의녹음'].includes(메타.출처)) throw new Error('입력 첫 줄은 {"메타":{"출처":"합성"|"동의녹음"}}이어야 한다');
  if (메타.출처 === '동의녹음') {
    if (typeof 메타.동의확인 !== 'string' || !메타.동의확인.trim()) throw new Error('동의녹음은 메타에 동의확인(어느 동의서 · 날짜, 글)이 있어야 한다');
    if (!Array.isArray(메타.국외처리동의) || !메타.국외처리동의.includes('Anthropic')) throw new Error('동의녹음은 메타 국외처리동의에 Anthropic이 있어야 Claude로 채점할 수 있다');
  }
  const 항목 = 줄들.slice(1).map((h, i) => {
    if (!['string', 'number'].includes(typeof h.id) || String(h.id).trim() === '' || !h.줄 || typeof h.받아적은글 !== 'string') throw new Error(`입력 ${i + 2}째 줄에 id · 줄 · 받아적은글이 없다`);
    if (메타.출처 === '동의녹음' && Object.hasOwn(h, '의도')) throw new Error(`동의녹음에 의도 칸을 두지 않는다(${h.id}) — 합성 점검용 칸이다`);
    return { ...h, id: String(h.id).trim() };
  });
  const id들 = new Set();
  for (const h of 항목) { if (id들.has(h.id)) throw new Error(`id가 겹친다: ${h.id}`); id들.add(h.id); }
  return { 메타, 항목 };
}

/** 대사 은행(talk 빌더와 같은 함수)과 장면 맥락(앞 대사 · 촬영일 · 상황). 검수를 통과한(passed) 줄만 채점한다. */
export async function 은행읽기() {
  const 에피소드 = await readEpisodes();
  const 은행 = dramaLines(에피소드);
  const 맥락 = new Map();
  for (const ep of 에피소드) for (const { row, kind, day, before } of dramaReviewRows(ep)) {
    맥락.set(row.id, { kind, 장면: day ? [day.이름, day.장소].filter(Boolean).join(' · ') : '', 앞대사: before ? `${before.누가}: ${before.말}` : '', 상황: row.상황 ?? '', 뜻: row.뜻 ?? '' });
  }
  return { 은행, 맥락, 지문: linesHash(은행) };
}

export function 줄글(spec, 맥, 받아적은글) {
  const 키 = (spec.keys || []).map((k) => (k.alts?.length ? `${k.word}(허용 표현: ${k.alts.join(' / ')})` : k.word)).join('; ');
  return [
    맥.장면 && `장면: ${맥.장면}`,
    `상대: ${상대이름[spec.to] ?? spec.to}`,
    맥.앞대사 ? `바로 앞 상대 대사 — ${맥.앞대사}` : 맥.상황 && `상황: ${맥.상황}`,
    `대사 종류: ${spec.free ? '처음 보는 대사(학생이 스스로 만드는 말)' : '장면 대사(카드에 대본이 보임)'}`,
    `이 대사에 맞는 끝맺음: ${allowedEndings(spec).map((e) => 끝맺음말[e] ?? e).join(' · ')}`,
    `모범 대사: 「${spec.line}」${맥.뜻 ? ` (뜻: ${맥.뜻})` : ''}`,
    spec.variants?.length && `허용 변형: ${spec.variants.map((v) => `「${v}」`).join(', ')}`,
    키 && `핵심 말(앞에서부터): ${키}`,
    `짧게 끝난 것으로 볼 선: ${minSyllablesOf(spec)}음절보다 적으면(${minSyllablesOf(spec)}음절이면 짧지 않다)`,
    spec.names?.length && `장면에 나오는 이름(소리가 달라도 오류로 고르지 않음): ${spec.names.join(', ')}`,
    `학생이 말한 것(받아 적은 글): 「${받아적은글}」`,
  ].filter(Boolean).join('\n');
}

function 노트말(노트, { 끝맺음, 빠진말 } = {}, spec) {
  if (노트 === '끝맺음') return `끝맺음 — 대사 끝을 상대에게 맞는 말투(${끝맺음 ?? '해요체 · 합쇼체'})로 끝내라는 노트`;
  if (노트 === '길이') return `길이 — 대사가 짧게 끝났으니 한 줄을 끝까지 말하라는 노트(${minSyllablesOf(spec)}음절보다 적으면 짧다고 본다)`;
  if (노트 === '빠진말') return `빠진말 — 핵심 말 「${빠진말}」이 말에 없다는 노트`;
  return '노트 없음(고칠 것 없음)';
}

/** 확인 요청 — 첫 채점이 고른 것을 함께 보여 주고, 코치 노트가 학생 말에 실제로 있는 문제를 짚었는지 묻는다. */
export function 확인글(r) {
  return `${r.글}\n\n첫 채점에서는 이 줄에 「${노트말(r.채점.노트, r.채점, r.spec)}」를 골랐다.\n코치가 준 노트: ${노트말(r.코치.노트, r.코치, r.spec)}\n\n`
    + '코치 노트가 학생 말에 실제로 있는 문제를 짚었는지 판정한다. 「맞는 지적」은 학생 말에 그 문제가 정말 있어 노트를 따르면 고칠 곳이 맞는 경우다(첫 채점이 고른 것보다 덜 급해도 맞는 지적이다). '
    + '「틀린 지적」은 학생이 맞게 한 것을 틀렸다고 짚은 경우다. 받아 적은 글만으로 알 수 없으면 「애매」다. 노트 종류 셋, 확신 순서, 하지 않는 것은 위 기준을 따른다.';
}

const 본문 = (o, 글, 꼴) => ({
  model: o.모델, max_tokens: 16000,
  system: [{ type: 'text', text: 기준글, cache_control: { type: 'ephemeral' } }],
  thinking: { type: 'adaptive' },
  output_config: { effort: o.노력, format: { type: 'json_schema', schema: 꼴 } },
  messages: [{ role: 'user', content: 글 }],
});

function 답꺼내기(응답) {
  if (!응답) return { 오류: '응답 없음' };
  if (응답.stop_reason === 'refusal') return { 오류: `거절(${응답.stop_details?.category ?? '분류 없음'})` };
  if (응답.stop_reason === 'max_tokens') return { 오류: '잘림(max_tokens)' };
  const 글 = (응답.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  try { return { 답: JSON.parse(글) }; } catch { return { 오류: 'JSON이 아님' }; }
}

const 토큰 = { 입력: 0, 캐시읽기: 0, 캐시쓰기: 0, 출력: 0, 호출: 0, 다시씀: 0, 어림USD: 0 };
function 토큰더하기(model, u) {
  if (!u) return;
  토큰.입력 += u.input_tokens || 0; 토큰.캐시읽기 += u.cache_read_input_tokens || 0; 토큰.캐시쓰기 += u.cache_creation_input_tokens || 0; 토큰.출력 += u.output_tokens || 0; 토큰.호출 += 1;
  토큰.어림USD += 클로드.추정USD(model, u) ?? 0;
}

/** 중간 저장 — 쓸 수 있는 답만 하나씩 남기고, 같은 모델 · 노력 · 기준글 · 답 꼴 · 보낸 글이면 다시 사지 않는다. 오류 답과 꼴이 틀린 답은 남기지 않는다(다시 돌리면 다시 묻는다). */
function 중간장부(밖) {
  const 경로 = path.join(밖, '중간.jsonl'), 표 = new Map();
  if (fs.existsSync(경로)) for (const l of fs.readFileSync(경로, 'utf8').split('\n')) { try { const v = JSON.parse(l); 표.set(v.열쇠, v.답); } catch { /* 끊긴 줄 */ } }
  return {
    열쇠: (o, 단계, 꼴, 글) => createHash('sha256').update(JSON.stringify([o.모델, o.노력, 단계, 기준글, 꼴, 글])).digest('hex').slice(0, 24),
    찾기: (k) => 표.get(k),
    남기기: (k, 답) => { 표.set(k, 답); fs.appendFileSync(경로, JSON.stringify({ 열쇠: k, 답 }) + '\n'); },
  };
}

async function 묻기(o, 장부, 글, 꼴, 용도, 쓸만한가 = () => true) {
  const k = 장부.열쇠(o, 용도, 꼴, 글), 있던 = 장부.찾기(k);
  if (있던) { 토큰.다시씀 += 1; return { 답: 있던 }; }
  try {
    const { 응답 } = await 클로드.보내기(본문(o, 글, 꼴), { 용도 });
    토큰더하기(o.모델, 응답?.usage);
    const 꺼냄 = 답꺼내기(응답);
    if (꺼냄.답 && 쓸만한가(꺼냄.답)) 장부.남기기(k, 꺼냄.답);
    return 꺼냄;
  } catch (e) {
    if (e?.code === '클로드키_모두소진') throw Object.assign(new Error(`${e.message} — 받은 답은 중간.jsonl에 있으니 같은 --밖으로 다시 돌리면 이어서 한다`), { code: e.code });
    return { 오류: String(e?.message ?? e).slice(0, 300) };
  }
}

async function 나눠돌리기(목록, 동시, 일) {
  const 결과 = new Array(목록.length);
  let 다음 = 0;
  await Promise.all(Array.from({ length: Math.min(동시, 목록.length) }, async () => {
    while (다음 < 목록.length) { const i = 다음++; 결과[i] = await 일(목록[i], i); }
  }));
  return 결과;
}

/** 정해진 순서로 섞기 — id의 해시 순. 같은 대사의 맞는 말과 틀린 말이 나란히 놓이지 않게 한다(Fable 11-17). */
export const 섞기 = (줄들) => [...줄들].sort((a, b) => (createHash('sha256').update(String(a.id)).digest('hex') < createHash('sha256').update(String(b.id)).digest('hex') ? -1 : 1));

/** 카본 요청 글 — 입력 id는 보내지 않고 순번(k1, k2, …)만 쓴다(id에 만든 의도가 들어 있어도 새지 않게). 돌려주는 것: {요청, 순번표(순번 → 입력 id)}. */
export function 카본요청글(줄들) {
  const 순번표 = new Map(줄들.map((r, i) => [`k${i + 1}`, String(r.id)]));
  const 요청 = `${기준글}\n\n아래 ${줄들.length}개 줄을 줄마다 따로 채점한다(앞뒤 줄과 견주지 않는다). 답은 JSON 배열 하나로만 하고(앞뒤 설명 없이), 원소마다 {"번호","노트","끝맺음_바랄것","빠진말","확신","까닭","기준밖"}을 둔다(번호: 줄 머리의 k1 · k2 … 그대로, 노트: 없음 · 끝맺음 · 길이 · 빠진말, 끝맺음_바랄것: 해요체 · 합쇼체 · 반말 · 해당없음, 확신: 높음 · 낮음).\n\n`
    + 줄들.map((r, i) => `### k${i + 1}\n${r.글}`).join('\n\n');
  return { 요청, 순번표 };
}

/**
 * 카본 답 읽기 — 코드 울타리 안의 배열들을 먼저 보고, 다음으로 글 전체에서 「[」마다 이어지는 JSON 배열을 찾는다. 순번표에 닿는 원소가 하나라도 있는 첫 배열을 쓴다.
 * 번호는 숫자만 뽑아 맞춘다(k1 · K1 · k01 · 1 · 「### k1」). 겹친 번호는 둘 다 버린다. 돌려주는 것: {답(입력 id → 원소), 받은수, 겹침, 빠짐}.
 */
export function 카본답읽기(글, 순번표) {
  const 후보 = [];
  for (const m of String(글).matchAll(/```(?:json)?\s*([\s\S]*?)```/g)) 후보.push(m[1]);
  후보.push(String(글));
  const 번호로 = (a) => { const d = String(a?.번호 ?? a?.id ?? '').match(/\d+/); return d ? 순번표.get(`k${Number(d[0])}`) ?? null : null; };
  for (const c of 후보) {
    for (let i = c.indexOf('['); i !== -1; i = c.indexOf('[', i + 1)) {
      for (let j = c.lastIndexOf(']'); j > i; j = c.lastIndexOf(']', j - 1)) {
        let v; try { v = JSON.parse(c.slice(i, j + 1)); } catch { continue; }
        if (!Array.isArray(v)) continue;
        const 쌍 = v.filter((a) => a && typeof a === 'object').map((a) => [번호로(a), a]).filter(([k]) => k != null);
        if (!쌍.length) break;
        const 센 = new Map();
        for (const [k] of 쌍) 센.set(k, (센.get(k) || 0) + 1);
        const 답 = new Map(쌍.filter(([k]) => 센.get(k) === 1));
        return { 답, 받은수: 답.size, 겹침: [...센].filter(([, n]) => n > 1).map(([k]) => k), 빠짐: [...순번표.values()].filter((id) => !센.has(id)) };
      }
    }
  }
  throw new Error('카본 답에서 순번이 맞는 JSON 배열을 찾지 못했다');
}

function 카본부르기(요청, 답경로) {
  return new Promise((풀림, 막힘) => {
    const p = spawn(process.execPath, [path.join(여기, 'lib/제미나이구독호출.js'), '--model', 'gemini-4-carbon', '--thinking', 'high', '-o', 답경로, '--timeout', '900000'], { stdio: ['pipe', 'ignore', 'pipe'] });
    let 오류글 = '';
    p.stderr.on('data', (d) => { 오류글 += d; });
    p.on('error', 막힘);
    p.on('close', (c) => (c === 0 ? 풀림() : 막힘(new Error(`카본 호출 실패(${c}): ${오류글.slice(-300)}`))));
    p.stdin.on('error', () => {}); // 자식이 바로 끝나면 EPIPE — close 쪽이 실패로 받는다.
    p.stdin.end(요청);
  });
}

/** 카본(다른 회사 AI)에게 같은 기준으로 맡긴다 — 섞은 순서로 25줄씩 나눠 따로 보낸다. 돌려주는 것: {답, 보낸수, 받은수, 겹침, 빠짐, 실패묶음}. */
async function 카본채점(줄들, 밖) {
  const 섞은 = 섞기(줄들), 묶음들 = [];
  for (let i = 0; i < 섞은.length; i += 카본묶음) 묶음들.push(섞은.slice(i, i + 카본묶음));
  const 모음 = { 답: new Map(), 보낸수: 줄들.length, 받은수: 0, 겹침: [], 빠짐: [], 실패묶음: [] };
  await Promise.all(묶음들.map(async (묶음, n) => {
    const { 요청, 순번표 } = 카본요청글(묶음);
    const 요청경로 = path.join(밖, `카본_요청_${n + 1}.txt`), 답경로 = path.join(밖, `카본_답_${n + 1}.json`);
    fs.writeFileSync(요청경로, 요청);
    try {
      await 카본부르기(요청, 답경로);
      const 읽음 = 카본답읽기(JSON.parse(fs.readFileSync(답경로, 'utf8')).text ?? '', 순번표);
      for (const [k, v] of 읽음.답) 모음.답.set(k, v);
      모음.받은수 += 읽음.받은수; 모음.겹침.push(...읽음.겹침); 모음.빠짐.push(...읽음.빠짐);
    } catch (e) { 모음.실패묶음.push(`${n + 1}: ${String(e.message).slice(0, 120)}`); 모음.빠짐.push(...순번표.values()); }
  }));
  return 모음;
}

const 칸 = (v) => String(v ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '/');
const 퍼 = (v) => (v == null ? '-' : `${Math.round(v * 1000) / 10}%`);
export function 보고글(결과) {
  const s = 결과.셈, h = 결과.합격선;
  const 줄 = [];
  줄.push(`# 대표 노트 채점 보고 — ${결과.메타.출처} ${s.표본}개`, '');
  if (결과.메타.출처 === '합성') 줄.push('> 합성 말은 채점기가 제대로 도는지 보는 시험이다. 합성 말과 채점 AI가 같은 회사 AI라 숫자가 부풀 수 있어, 아래 합격선은 실제 학생 말의 합격으로 읽지 않는다.', '');
  줄.push(`- 만든 때: ${결과.만든때}. 채점 AI: ${결과.판.채점모델}(노력 ${결과.판.노력}), 둘째 채점: ${결과.판.둘째}. 코치 판정 ${결과.판.판정판}, 대사 판 ${결과.판.대사판}.`);
  줄.push(`- 세는 표본은 ${s.센표본}개다(소리 관문 ${s.관문}개, 채점하지 못한 줄 ${s.채점없음}개는 뺐다).`);
  줄.push(`- 일치: ${s.일치}개(${퍼(s.일치율)}). 합격선은 80%(50개 중 40개)이고 ${h.일치 ? '넘었다' : '넘지 못했다'}. 일치 가운데 ${s.둘다없음}개는 둘 다 노트 없음이고, ${s.노트일치}개는 같은 노트(끝맺음은 높임 · 반말 갈래까지, 빠진 말은 같은 핵심 말까지)다.`);
  줄.push(`- 노트 쪽으로 보면: 채점이 노트를 준 ${s.채점노트수}개 가운데 코치도 같은 노트를 준 줄은 ${s.노트일치}개(${퍼(s.채점노트중코치같음)})다. 코치가 준 노트 ${s.코치노트수}개 가운데 채점과 같은 것은 ${s.노트일치}개(${퍼(s.코치노트중일치)})다.`);
  const 오 = h.오노트 == null ? '확인하지 못한 노트가 있거나 센 표본이 없어 판정하지 않았다' : h.오노트 ? (h.오노트애매포함 ? '지켰다' : `지켰지만, 애매 ${s.애매}개를 모두 틀린 지적으로 보면 넘는다`) : '넘었다';
  줄.push(`- 코치가 준 노트는 ${s.코치노트수}개이고, 그 가운데 틀린 노트(오노트)는 ${s.오노트}개(${퍼(s.오노트율)})다. 애매는 ${s.애매}개다. 합격선은 50개 중 2개 이하이고 ${오}.`);
  if (s.확인못함) 줄.push(`- 코치 노트를 확인하지 못한 줄이 ${s.확인못함}개 있다(확인 호출 실패). 이 줄은 오노트인지 모른다.`);
  줄.push(`- 코치 노트도 맞는 지적이었던 줄: 채점이 다른 것을 먼저 고른 줄 ${s.순서만다름}개, 채점은 고칠 것이 없다고 본 줄 ${s.채점이놓침}개.`);
  줄.push(`- 코치가 노트를 주지 않은 줄은 ${s.센표본 - s.코치노트수}개(${퍼(s.노트안준비율)})이고, 그 가운데 채점은 고칠 것이 있다고 본 줄(놓침)이 ${s.놓침}개(센 표본의 ${퍼(s.놓침율)})다. 기획 4-3대로 숨기지 않는다.`);
  if (결과.카본) 줄.push(`- 둘째 채점(카본): 보낸 ${결과.카본.보낸수}줄 가운데 ${결과.카본.받은수}줄의 답을 받았고 ${결과.카본.쓸수있음 ?? 결과.카본.받은수}줄을 쓸 수 있었다${결과.카본.겹침.length ? `(번호가 겹쳐 버린 줄 ${결과.카본.겹침.length}개)` : ''}${결과.카본.실패묶음.length ? `. 실패한 묶음: ${결과.카본.실패묶음.join(' · ')}` : ''}.`);
  if (s.두채점) 줄.push(`- 두 채점(Claude · 카본)이 같은 노트를 고른 줄: ${s.두채점.견준줄}개 중 ${s.두채점.같음}개.`);
  if (s.의도견줌) 줄.push(`- 합성 말의 만든 의도와 Claude 채점이 같은 줄: ${s.의도견줌.견준줄}개 중 ${s.의도견줌.같음}개(채점기가 도는지 보는 점검이지 대표 기준과 맞는다는 근거가 아니다).`);
  if (h.표본모자람) 줄.push('- 표본이 50개보다 적어 합격선은 참고로만 본다.');
  줄.push(`- 토큰: 호출 ${결과.토큰.호출}번(중간 저장에서 다시 쓴 답 ${결과.토큰.다시씀}개), 입력 ${결과.토큰.입력}, 캐시 읽기 ${결과.토큰.캐시읽기}, 캐시 쓰기 ${결과.토큰.캐시쓰기}, 출력 ${결과.토큰.출력}. 어림 비용 약 ${결과.어림USD}달러.`, '');
  줄.push('## 코치와 Claude 채점이 일치하지 않은 줄', '', '| id | 학생 말 | 코치 | Claude 채점 | 맞댐 | 코치 노트 확인 | 카본 |', '|---|---|---|---|---|---|---|');
  for (const r of 결과.줄들.filter((r) => r.맞댐 !== '일치')) {
    줄.push(`| ${칸(r.id)} | ${칸(r.받아적은글)} | ${r.코치노트}${r.코치.빠진말 ? `(${칸(r.코치.빠진말)})` : ''}${r.코치.관문 ? `(${r.코치.관문})` : ''} | ${r.채점?.노트 ?? '-'}${r.채점?.빠진말 ? `(${칸(r.채점.빠진말)})` : ''} — ${칸(r.채점?.까닭 ?? r.채점오류)} | ${r.맞댐} | ${r.확인 ? `${r.확인} — ${칸(r.확인까닭)}` : r.확인까닭 ? `확인 못 함 — ${칸(r.확인까닭)}` : '-'} | ${r.카본노트 ?? '-'} |`);
  }
  const 갈린 = 결과.줄들.filter((r) => r.두채점같음 === false);
  if (갈린.length) {
    줄.push('', '## Claude와 카본이 다르게 고른 줄(기획 4-3 「차이를 남긴다」)', '', '| id | 학생 말 | 코치 | Claude | 카본 |', '|---|---|---|---|---|');
    for (const r of 갈린) 줄.push(`| ${칸(r.id)} | ${칸(r.받아적은글)} | ${r.코치노트} | ${r.채점?.노트 ?? '-'} — ${칸(r.채점?.까닭)} | ${r.카본노트 ?? '-'} — ${칸(r.카본까닭)} |`);
  }
  const 밖 = 결과.줄들.filter((r) => r.채점?.기준밖);
  if (밖.length) { 줄.push('', '## 기준 밖 문제(코치가 보지 않는 종류 — 노트로 세지 않음)', ''); for (const r of 밖) 줄.push(`- ${칸(r.id)} 「${칸(r.받아적은글)}」: ${칸(r.채점.기준밖)}`); }
  return 줄.join('\n') + '\n';
}

async function main() {
  const o = 인자(process.argv.slice(2));
  const { 메타, 항목: 전체 } = 입력읽기(fs.readFileSync(o.입력, 'utf8'));
  const 항목 = o.몇 ? 전체.slice(0, o.몇) : 전체;
  if (메타.출처 === '동의녹음') {
    if (저장소안(o.입력)) throw new Error('동의녹음 입력은 git 작업본 밖(비공개 보관함)에 둔다');
    if (!o.밖 || 저장소안(o.밖)) throw new Error('동의녹음 결과(--밖)는 git 작업본 밖(비공개 보관함)에 쓴다');
    if (o.둘째 === '카본' && !메타.국외처리동의.includes('Google')) { console.error('[대표노트] 국외처리동의에 Google이 없어 둘째 채점(카본)을 하지 않는다'); o.둘째 = '없음'; }
    if (o.둘째 === '카본' && !(typeof 메타.카본경로확인 === 'string' && 메타.카본경로확인.trim())) { console.error('[대표노트] 메타 카본경로확인(구독 경로의 데이터 처리와 18세 미만 약관을 확인한 근거)이 없어 둘째 채점(카본)을 하지 않는다'); o.둘째 = '없음'; }
  }
  const 지금 = new Date();
  const 밖 = path.resolve(o.밖 || path.join(뿌리, '.tmp', `대표노트-${지금.toISOString().slice(0, 16).replace(/[-:T]/g, '')}`));
  fs.mkdirSync(밖, { recursive: true });

  const { 은행, 맥락, 지문 } = await 은행읽기();
  const 줄들 = 항목.map((h) => {
    const 줄 = 은행.find((l) => l.id === h.줄);
    if (!줄) throw new Error(`대사 은행에 없는 대사 ${h.줄}(${h.id})`);
    if (줄.review?.status !== 'passed') throw new Error(`검수를 통과하지 않은 대사 ${h.줄}(${h.id}) — 채점하지 않는다`);
    const 코치판정 = judgeLine(줄.spec, { transcript: h.받아적은글, seconds: h.초, speechSeconds: h.말한초 });
    const 코치 = 코치결정(코치판정);
    return { id: h.id, 줄: h.줄, 받아적은글: h.받아적은글, 의도: h.의도 ?? null, spec: 줄.spec, 코치, 코치노트: 코치.노트, 코치판정: { status: 코치판정.status, verdict: 코치판정.verdict, note: 코치판정.note, sure: 코치판정.sure }, 글: 줄글(줄.spec, 맥락.get(h.줄) ?? {}, h.받아적은글) };
  });
  if (o.미리) {
    fs.writeFileSync(path.join(밖, '미리.json'), JSON.stringify(줄들.map(({ spec, ...r }) => r), null, 1));
    console.log(`[대표노트] 미리 보기 ${줄들.length}줄 → ${path.join(밖, '미리.json')}`);
    return;
  }
  const 장부 = 중간장부(밖);

  // 2. 눈가림 채점 — 코치 노트를 보지 않는다. 소리 관문에 걸린 줄은 세지 않으므로 채점 AI에 보내지 않는다(실제 학생 말을 쓸데없이 내보내지 않는다).
  for (const r of 줄들) if (r.코치.갈래 === '관문') r.맞댐 = '관문';
  const 채점할 = 줄들.filter((r) => r.맞댐 !== '관문');
  await 나눠돌리기(채점할, o.동시, async (r) => {
    const { 답, 오류 } = await 묻기(o, 장부, r.글, 답꼴, '대표노트-채점', (a) => !!채점결정(a));
    r.채점 = 답 ? 채점결정(답) : null;
    if (!r.채점) r.채점오류 = 오류 ?? '답 꼴이 다름';
    r.맞댐 = 맞대기(r.코치, r.채점, r.spec);
  });
  // 3. 코치가 노트를 줬는데 채점과 다른 줄만 — 첫 채점과 코치 노트를 보여 주고 학생 말에 실제로 있는 문제인지 묻는다.
  const 확인할 = 줄들.filter((r) => ['다른노트', '코치만노트'].includes(r.맞댐));
  await 나눠돌리기(확인할, o.동시, async (r) => {
    const 판정들 = 확인꼴.properties.판정.enum;
    const { 답, 오류 } = await 묻기(o, 장부, 확인글(r), 확인꼴, '대표노트-확인', (a) => 판정들.includes(a?.판정));
    r.확인 = 판정들.includes(답?.판정) ? 답.판정 : null; r.확인까닭 = 답?.까닭 ?? 오류 ?? null;
  });
  // 4. 둘째 채점(카본) — 같은 기준, 다른 회사. 답을 하나도 받지 못하면 실패로 적는다.
  let 카본판 = null;
  if (o.둘째 === '카본') {
    카본판 = await 카본채점(채점할, 밖);
    카본판.쓸수있음 = 0;
    for (const r of 채점할) {
      const 원 = 카본판.답.get(String(r.id)), c = 채점결정(원);
      if (c) 카본판.쓸수있음 += 1;
      r.카본노트 = c?.노트 ?? null; r.카본까닭 = c?.까닭 ?? null;
      if (r.채점 && c) r.두채점같음 = 맞대기({ 갈래: '노트', 노트: r.채점.노트, 끝맺음: r.채점.끝맺음, 빠진말: r.채점.빠진말 }, c, r.spec) === '일치';
    }
    o.둘째 = 카본판.쓸수있음 ? `카본(${카본판.쓸수있음}/${카본판.보낸수}줄)` : `카본 실패(쓸 수 있는 답 0/${카본판.보낸수}줄)`;
    if (카본판.쓸수있음 < 카본판.보낸수) console.error(`[대표노트] 카본 답이 ${카본판.보낸수}줄 가운데 ${카본판.쓸수있음}줄만 쓸 수 있었다 — 보고에 적는다`);
  }
  for (const r of 줄들) r.채점노트 = r.채점?.노트 ?? null;

  const 셈 = 세기(줄들);
  const 어림USD = Math.round(토큰.어림USD * 100) / 100;
  const 결과 = {
    만든때: 지금.toISOString(), 메타: { ...메타, 입력: path.basename(o.입력) },
    판: { 채점모델: o.모델, 노력: o.노력, 둘째: o.둘째, 판정판: DRAMA_JUDGE_VERSION, 대사판: 지문 },
    셈, 합격선: 합격선(셈), 토큰, 어림USD,
    카본: 카본판 && { 보낸수: 카본판.보낸수, 받은수: 카본판.받은수, 쓸수있음: 카본판.쓸수있음, 겹침: 카본판.겹침, 빠짐: 카본판.빠짐, 실패묶음: 카본판.실패묶음 },
    줄들: 줄들.map(({ spec, 글, ...r }) => r),
  };
  fs.writeFileSync(path.join(밖, '결과.json'), JSON.stringify(결과, null, 1));
  fs.writeFileSync(path.join(밖, '보고.md'), 보고글(결과));
  console.log(`[대표노트] ${셈.센표본}개 · 일치 ${셈.일치}(${Math.round((셈.일치율 ?? 0) * 100)}%, 둘 다 없음 ${셈.둘다없음}) · 채점 노트 ${셈.채점노트수} 중 코치 같음 ${셈.노트일치} · 코치 노트 ${셈.코치노트수} · 오노트 ${셈.오노트} · 애매 ${셈.애매} · 놓침 ${셈.놓침}${셈.두채점 ? ` · 두 채점 같음 ${셈.두채점.같음}/${셈.두채점.견준줄}` : ''}${셈.의도견줌 ? ` · 의도와 같음 ${셈.의도견줌.같음}/${셈.의도견줌.견준줄}` : ''} · 약 $${어림USD}`);
  console.log(`[대표노트] → ${path.join(밖, '보고.md')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`[대표노트] ${e.message}`); process.exit(1); });
}
