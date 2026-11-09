// 낫표 공개 재료(낫표_공개묶음.cjs)를 실제로 돌린다 — 앵커 대조만으로는 끼운 줄이 도는지 모른다(현장 노트 배포 · 공개).
//   ① 엔진 사본마다 묶음 안의 atlas/vellum.js 모듈을 떼어 돌려, 항목 이름 × 여섯 꼴(+ 고른 목표)의 문장이 원천(작업본 atlas/vellum.js)과
//      글자까지 같은지 본다. 공개본(base)은 같은 일에서 옛 꼴(낫표 없음)이어야 한다 — 시험이 차이를 볼 수 있다는 대조.
//   ② WORLD 계정 · 생활 묶음의 숙제 문장 둘이 낫표 꼴이고 옛 꼴이 0인지.
//   ③ 끼운 world-strings.mjs는 여덟 키의 한국어만 바뀌었고(나머지 키 · 언어는 공개본 그대로), 새 world-lang.mjs와 함께 불러
//      엔진 문장 · 숙제 문장이 영어 · 몽골어로 바뀌고(한글 0, 빠진 말 0) 한국어 화면은 문장 그대로인지.
//   node docs/_ops/qa/atlas-world-engine-20261108/낫표_공개검사.mjs <공개 재료 폴더>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const dir = path.resolve(process.argv[2] || '');
if (!fs.existsSync(path.join(dir, '목록.json'))) throw Error(`공개 재료 폴더가 아니다: ${dir}`);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const require = createRequire(import.meta.url);
const { 공용작업본 } = require(path.join(ROOT, 'tools/lib/공용작업본.js'));
const acorn = require(path.join(공용작업본(ROOT), 'node_modules', 'acorn'));
const canon = require(path.join(ROOT, 'atlas/vellum.js'));
const { MSG_KEYS } = require(path.join(ROOT, 'docs/_ops/qa/atlas-world-engine-20261108/낫표_공개묶음.cjs'));
const manifest = JSON.parse(fs.readFileSync(path.join(dir, '목록.json'), 'utf8'));
const STATUSES = ['unseen', 'checking', 'practice', 'supported', 'recent-independent', 'review'];
const strata = name => JSON.parse(fs.readFileSync(path.join(ROOT, `strata/maps/${name}.json`), 'utf8')).nodes.filter(node => node.kind === 'skill').map(node => node.label_ko);
// TOPIK I 16 · 한글 만나기 2 + 받침으로 끝나는 이름 · 괄호 · 줄표가 든 이름(게임 지도의 꼴).
const LABELS = [...strata('topik-i'), ...strata('hangul'), '어휘 — 반대말', '어휘 — 동사 짝(입다·신다)', '조사 — 은/는·이/가', '낱말 소리 익힘'];
assert.equal(LABELS.length, 22);
let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };
const same = (a, b, message) => { assert.equal(a, b, message); checks += 1; };

// 묶음 안 __commonJS("atlas/vellum.js") 모듈 값(메서드)을 떼어 돌린다. 다른 모듈을 부르지 않는 모듈이라 그것만으로 돈다.
function vellumOf(text, sourceType, label) {
  const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType, allowHashBang: true, allowReturnOutsideFunction: true }), found = [];
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.type === 'CallExpression' && /__commonJS/.test(n.callee?.name || '') && n.arguments[0]?.type === 'ObjectExpression') {
      const p = n.arguments[0].properties[0], key = p?.key?.value ?? p?.key?.name;
      if (key === 'atlas/vellum.js') found.push(p.value);
    }
    for (const k of Object.keys(n)) { if (k === 'type' || k === 'start' || k === 'end') continue; const v = n[k]; if (v && typeof v === 'object') walk(v); }
  })(ast);
  if (found.length !== 1) throw Error(`${label}: atlas/vellum.js 모듈이 하나가 아니다(${found.length})`);
  const body = text.slice(found[0].start, found[0].end), context = vm.createContext({ __name: (fn, value) => Object.defineProperty(fn, 'name', { value, configurable: true }) });
  const holder = vm.runInContext(`({m${body}})`, context), module = { exports: {} };
  holder.m(module.exports, module);
  return module.exports;
}
const sentences = V => LABELS.flatMap(label => [
  ...STATUSES.map(status => V.learningReason({ status, label })),
  ...STATUSES.filter(status => status !== 'unseen').map(state => V.activityReason({ reasons: [`practice.${state}`, 'goal.declared'], state, label })),
]);
const want = sentences(canon);
ok(want.every(text => /「[^」]+」(?:은|는|을|를) /.test(text)), '원천 문장은 모두 낫표 + 조사');

// ① 엔진 사본
const engine = manifest.items.filter(pub => !pub.endsWith('world-strings.mjs') && !pub.endsWith('world-lang.mjs'));
assert.equal(engine.length, 25, `엔진 사본 수 ${engine.length}`);
for (const pub of engine) {
  const type = pub.endsWith('.mjs') ? 'module' : 'script';
  const fresh = vellumOf(fs.readFileSync(path.join(dir, 'new', pub), 'utf8'), type, `new ${pub}`);
  const old = vellumOf(fs.readFileSync(path.join(dir, 'base', pub), 'utf8'), type, `base ${pub}`);
  const got = sentences(fresh), was = sentences(old);
  for (let i = 0; i < want.length; i++) same(got[i], want[i], `${pub}: ${want[i]}`);
  ok(was.every(text => !text.includes('「')), `${pub}: 공개본은 옛 꼴이어야 한다(대조가 차이를 본다)`);
  ok(was.every((text, i) => text === want[i].replace(/[「」]/g, '')), `${pub}: 낫표만 다르다`);
}

// ② WORLD 묶음의 숙제 문장
const esc = s => [...s].map(c => c.charCodeAt(0) > 127 ? `\\u${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}` : c).join('');
for (const pub of ['world/world-account.bundle.mjs', 'world/brand-opening/content/life-standalone.mjs']) {
  const text = fs.readFileSync(path.join(dir, 'new', pub), 'utf8'), before = fs.readFileSync(path.join(dir, 'base', pub), 'utf8');
  for (const [head, tail] of [['이번 주 숙제예요. ', ' 기록이 오래돼'], ['이번 주 숙제예요. ', '에서 놓친 답이 있어']]) {
    const forms = [[head, tail, '「', '」'], [esc(head), esc(tail), '\\u300C', '\\u300D']];
    const now = forms.reduce((n, [h, t, o, c]) => n + text.split(h).filter((part, i) => i > 0 && new RegExp(`^${o.replace(/\\/g, '\\\\')}\\$\\{[\\w$]+\\}${c.replace(/\\/g, '\\\\')}${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(part)).length, 0);
    const stale = forms.reduce((n, [h, t]) => n + text.split(h).filter((part, i) => i > 0 && new RegExp(`^\\$\\{[\\w$]+\\}${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(part)).length, 0);
    const had = forms.reduce((n, [h, t]) => n + before.split(h).filter((part, i) => i > 0 && new RegExp(`^\\$\\{[\\w$]+\\}${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(part)).length, 0);
    same(now, 1, `${pub}: 낫표 숙제 문장(${tail.trim()})`); same(stale, 0, `${pub}: 옛 숙제 문장(${tail.trim()})`); same(had, 1, `${pub}: 공개본의 옛 숙제 문장(${tail.trim()})`);
  }
}

// ③ 문자열 표 + 화면 언어 층
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'vellum-brackets-check-'));
try {
  const load = async (name, strings, lang) => {
    const folder = path.join(stage, name); fs.mkdirSync(folder);
    fs.copyFileSync(strings, path.join(folder, 'world-strings.mjs'));
    if (lang) fs.copyFileSync(lang, path.join(folder, 'world-lang.mjs'));
    return { strings: (await import(pathToFileURL(path.join(folder, 'world-strings.mjs')).href)).default, lang: lang ? await import(pathToFileURL(path.join(folder, 'world-lang.mjs')).href) : null };
  };
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.document = { documentElement: { lang: 'ko' } };
  globalThis.location = { search: '' };
  const fresh = await load('new', path.join(dir, 'new/world/brand-opening/world-strings.mjs'), path.join(dir, 'new/world/brand-opening/world-lang.mjs'));
  const live = await load('base', path.join(dir, 'base/world/brand-opening/world-strings.mjs'), null);
  const keys = new Set([...Object.keys(fresh.strings), ...Object.keys(live.strings)]);
  for (const key of keys) {
    const a = fresh.strings[key], b = live.strings[key];
    if (MSG_KEYS.includes(key)) { same(JSON.stringify({ ...a, ko: null }), JSON.stringify({ ...b, ko: null }), `${key}: 한국어 말고는 그대로`); ok(a.ko.includes('「{skill}」') && !b.ko.includes('「'), `${key}: 낫표 틀`); }
    else same(JSON.stringify(a), JSON.stringify(b), `${key}: 공개본 그대로`);
  }
  const { t, tMessage, missingStrings } = fresh.lang, before = missingStrings().length;
  const skillId = label => Object.keys(fresh.strings).find(key => key.startsWith('position.skill.') && fresh.strings[key].ko === label);
  for (const label of LABELS.slice(0, 18)) {
    const id = skillId(label); ok(id, `항목 이름 줄: ${label}`);
    for (const status of STATUSES) for (const goal of [false, true]) {
      if (goal && status === 'unseen') continue;
      const ko = goal ? canon.activityReason({ reasons: [`practice.${status}`, 'goal.declared'], state: status, label }) : canon.learningReason({ status, label });
      same(tMessage(ko, 'ko'), ko, `ko 그대로: ${ko}`);
      for (const code of ['en', 'mn']) {
        const got = tMessage(ko, code), wanted = t(`msg.vellum.${status}`, { skill: t(id, undefined, code) }, code) + (goal ? ` ${t('msg.vellum.goal', undefined, code)}` : '');
        same(got, wanted, `${code}: ${ko}`); ok(!/[가-힣]/.test(got), `${code} 한글 없음: ${got}`);
      }
    }
    for (const [key, ko] of [['msg.planHomework', `이번 주 숙제예요. 「${label}」에서 놓친 답이 있어 새 문항으로 다시 확인해요.`], ['msg.planHomeworkReview', `이번 주 숙제예요. 「${label}」 기록이 오래돼 새 문항으로 다시 확인해요.`]]) {
      same(tMessage(ko, 'ko'), ko, `ko 그대로: ${ko}`);
      for (const code of ['en', 'mn']) same(tMessage(ko, code), t(key, { skill: t(id, undefined, code) }, code), `${code}: ${ko}`);
    }
  }
  same(missingStrings().length, before, '바뀐 문장은 빠진 말로 남지 않는다');
} finally { fs.rmSync(stage, { recursive: true, force: true }); }
console.log(`낫표 공개 검사 통과 — 엔진 사본 ${engine.length} · 확인 ${checks}개`);
