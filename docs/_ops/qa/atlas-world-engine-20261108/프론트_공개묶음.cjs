'use strict';
// 개인화 화면 프론트 다시 검수(2026-11-08, 검수 world-life-front-20261108)의 synk.im/world 공개 재료 — 공개본(synk-policy-publish origin/main) 위에
// 이번 고침만 얹은 두 폴더를 만든다. 방식은 D_공개묶음.cjs와 같다(현장 노트 배포_공개 「master에 미공개 게임이 있는데 계정 · 생활 묶음을 고쳐야 하면」):
//  · 원천 모듈 다섯(생활 화면 · 배우기 화면 · 문자열 · 생활 화면 CSS · 홈 튜터 대사): 공개본 + (바탕 → 내 판) 3방향을 git merge-file로(충돌이면 멈춤), base에 공개본 · new에 결과.
//  · 계정 묶음(world-account.bundle.mjs): 공개본은 덧댄 판(D 생활 거울 · 1단계 A 재확인 짝 판 2)이라 master로 다시 짓지 않고 앵커 다섯 곳만 고친다 —
//    시험 계획 시작점(examEvidenceSkills · examSkills · start) · 그 내보내기 · 이번 주 계획의 계획 밖 영역(「N번 함」) · 홈 이유 문장. 앵커는 하나만 맞아야 한다.
//  · 생활 묶음(brand-opening/content/life-standalone.mjs)은 싣지 않는다(앱 셸이 없을 때만 읽는 예비 길 — D와 같다).
//  · 끼운 줄을 실제로 돌린다: check/ 폴더에서 프론트_공개검사.mjs가 고친 묶음을 import해 내 판 원천과 결과를 견준다.
//   node docs/_ops/qa/atlas-world-engine-20261108/프론트_공개묶음.cjs [바탕=HEAD] [내 판=작업본] [--후보=candidate-b](검수 뒤 고친 판의 새 후보 폴더 이름)
//   → 공용 작업본 .tmp/world-life-front-pub-20261108/{base,new,check}/…, 목록 · 미리 보기 명령을 찍는다
const path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../../..');
const [BASE = 'HEAD', NEW = '작업본'] = process.argv.slice(2).filter(x => !x.startsWith('--'));
const TMP = path.join(공용작업본(ROOT), '.tmp'), OUT = path.join(TMP, 'world-life-front-pub-20261108');
if (path.dirname(path.resolve(OUT)) !== path.resolve(TMP)) throw Error(`지울 폴더가 .tmp 바로 아래가 아니다: ${OUT}`);
const LIVE = path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'synk-vendor', 'synk-policy-publish.git');
const show = (rev, file) => { try { return execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', 'show', `${rev}:${file}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const read = (rev, file) => rev === '작업본' ? (fs.existsSync(path.join(ROOT, file)) ? fs.readFileSync(path.join(ROOT, file)) : null) : show(rev, file);
// 공개본은 이 사본의 origin/main으로 읽는다 — 받아 오지 않으면 그사이 남이 올린 공개(11-08 3cdfb18e)를 모른 채 낡은 바탕으로 재료를 만든다. 먼저 받는다.
{ const r = spawnSync('git', ['-C', LIVE, 'fetch', '-q', 'origin', 'main'], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 120000 });
  if (r.status !== 0) throw Error(`공개 저장소 사본을 받지 못했다(낡은 공개본으로 재료를 만들지 않는다): ${String(r.stderr || r.error || '').trim().slice(0, 200)}`); }
const live = pub => { try { return execFileSync('git', ['-C', LIVE, 'cat-file', '-p', `origin/main:${pub}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const config = JSON.parse(live('world/world-config.json')?.toString('utf8') || 'null');
if (!config?.account?.learningUrl || config.basePath !== '/world/') throw Error('공개본 world-config.json을 못 읽었다 — 공개 저장소 사본을 먼저 fetch한다');
// build-world-app-public.mjs rewrite()와 같은 글(D_공개묶음.cjs와 같다). relative는 공개 묶음 안 경로(world/ 뒤).
function rewrite(text, relative) {
  text = text.replaceAll('../synk-world-home/', relative.startsWith('brand-opening/') ? '../' : './').replaceAll('href="../learning-hub/"', `href="${config.account.learningUrl}"`);
  if (!relative.includes('/')) text = text.replaceAll('../brand-opening/', './brand-opening/');
  return text.replace(/(["'`])\/(scene-assets|[a-zA-Z0-9_-]+\.mjs|engine|korean-runner|korean-rhythm|hangul-stage|brand-opening|world-town-client\.mjs)(?=[/"'`])/g, (_, quote, folder) => quote + config.basePath + folder);
}
const lf = buffer => buffer.toString('utf8').replace(/\r\n/g, '\n');
// esbuild 묶음의 글자 꼴(ASCII 밖은 \xHH · \uHHHH 대문자) — 묶음 안 한국어 글을 앵커로 찾을 때.
const esc = text => text.replace(/[^\x00-\x7f]/g, c => { const n = c.codePointAt(0); return n < 0x100 ? `\\x${n.toString(16).toUpperCase().padStart(2, '0')}` : `\\u${n.toString(16).toUpperCase().padStart(4, '0')}`; });

// 다시 만들 때 base · new · check만 비운다 — candidate* 폴더는 검수 사슬이 묶은 공개 후보(증거)라 지우지 않는다. 고친 판은 새 이름(candidate-b …)으로.
for (const dir of ['base', 'new', 'check']) fs.rmSync(path.join(OUT, dir), { recursive: true, force: true });
const CANDIDATE = process.argv.find(x => x.startsWith('--후보='))?.slice('--후보='.length) || 'candidate';
const write =(dir, pub, text) => { const target = path.join(OUT, dir, pub); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text); };
const items = [];

// ① 원천 모듈 다섯: 공개본 + (바탕 → 내 판).
const RAW = [
  ['experiences/synk-world-app/life-ui.mjs', 'life-ui.mjs'],
  ['experiences/synk-world-app/world-learning-ui.mjs', 'world-learning-ui.mjs'],
  ['experiences/brand-opening/world-strings.mjs', 'brand-opening/world-strings.mjs'],
  ['experiences/synk-world-app/life-ui.css', 'life-ui.css'],
  ['experiences/brand-opening/home-tutor-lines.mjs', 'brand-opening/home-tutor-lines.mjs'],
];
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'front-pub-'));
const merges = [];
for (const [src, relative] of RAW) {
  const pub = `world/${relative}`, now = live(pub), base = show(BASE, src), mine = read(NEW, src);
  if (!now || !base || !mine) throw Error(`파일이 없다: ${pub}`);
  const [l, b, m] = [lf(now), rewrite(lf(base), relative), rewrite(lf(mine), relative)];
  if (b === m) continue;
  const files = ['live', 'base', 'mine'].map(name => path.join(scratch, name));
  [l, b, m].forEach((text, i) => fs.writeFileSync(files[i], text));
  const r = spawnSync('git', ['merge-file', '-p', '-L', '공개본', '-L', '바탕', '-L', '내 판', ...files], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw Error(`3방향 충돌 ${r.status}곳: ${pub} — 공개본에서 내 줄을 손으로 다시 맞춘다`);
  write('base', pub, l); write('new', pub, r.stdout);
  merges.push({ pub, liveEqualsBase: l === b });
  items.push(pub);
}

// ② 공개본 계정 묶음에 이번 고침을 끼운다.
const BUNDLE = 'world/world-account.bundle.mjs', liveBundle = lf(live(BUNDLE));
if (liveBundle.includes('examEvidenceSkills') || liveBundle.includes('plan.area.extra')) throw Error('공개본 계정 묶음에 이미 이번 고침이 있다 — 끼우지 않는다');
const SIGNATURE = 'function buildExamPlan({exam,summary=null,now=Date.now(),done=null,available={},classwork=[],audioAvailable=!0,lastCheckAt=null,speakingNeeds=null}={}){';
// world-exam-plan.mjs examEvidenceSkills와 같은 일(생활 거울 world-life가 아닌 연습에서 답이 있는 항목).
const HELPER = 'function examEvidenceSkills(events=[]){const decisions=new Map,shown=new Map,skills=new Set;for(const event of Array.isArray(events)?events:[]){if(event?.type==="decision.made")decisions.set(event.id,event.experienceId);else if(event?.type==="practice.presented")shown.set(event.id,event)}for(const event of Array.isArray(events)?events:[]){if(event?.type!=="practice.attempted")continue;const presentation=shown.get(event.presentationId),skill=presentation?.measure?.skillId;if(typeof skill!=="string"||decisions.get(presentation.decisionId)==="world-life")continue;skills.add(skill)}return skills}';
const OLD_REASON = esc('생활 팩의 다음 레슨이에요. 진도 순서대로 이어서 배워요.'), NEW_REASON = esc('생활 팩의 다음 레슨이에요. 아직 기록이 없는 표현을 새로 만나요.');
const EDITS = [
  ['시험 계획: examEvidenceSkills · examSkills 인자', SIGNATURE, HELPER + SIGNATURE.replace('speakingNeeds=null}={}){', 'speakingNeeds=null,examSkills=null}={}){')],
  ['시험 계획: 시작점은 생활 거울 밖 근거로',
    'const start=complete&&!observed.length,cycle=',
    'const startSkills=examSkills instanceof Set?examSkills:Array.isArray(examSkills)?new Set(examSkills):null,start=complete&&!(startSkills?observed.filter(skill=>startSkills.has(skill.id)):observed).length,cycle='],
  ['시험 계획 내보내기', 'weekActivity:()=>weekActivity})', 'weekActivity:()=>weekActivity,examEvidenceSkills:()=>examEvidenceSkills})'],
  ['이번 주 계획: 계획 밖 영역은 「N번 함」',
    'posEscape(t("plan.area.count",{done:row.done,planned:row.planned}))',
    'posEscape(row.planned>0?t("plan.area.count",{done:row.done,planned:row.planned}):t(row.area==="life"?"plan.area.extraDays":"plan.area.extra",{done:row.done}))'],
  ['홈 이유 문장', `{reason:"${OLD_REASON}",reasons:["progress.next"]}`, `{reason:"${NEW_REASON}",reasons:["progress.next"]}`],
];
let patched = liveBundle;
for (const [name, from, to] of EDITS) {
  const count = patched.split(from).length - 1;
  if (count !== 1) throw Error(`앵커가 하나가 아니다(${count}): ${name}`);
  patched = patched.replace(from, () => to);
}
write('base', BUNDLE, liveBundle); write('new', BUNDLE, patched);
items.push(BUNDLE);

// ③ 끼운 줄을 돌릴 폴더: 새 묶음 · 끼우기 전 공개본 묶음 + 묶음이 부르는 공개본 원천(D 엔진 판 · 생활 원고 · 진도와 진도가 부르는 모듈).
write('check', 'world-account.bundle.mjs', patched);
write('check', 'live-account.bundle.mjs', liveBundle);
for (const name of ['world-life-engine.mjs', 'life-content.mjs', 'life-progress.mjs', 'cafe-activity.mjs', 'world-learning-profile.mjs', 'world-learning-profile-core.mjs', 'seoul-record.mjs']) {
  const bytes = live(`world/${name}`); if (!bytes) throw Error(`공개본에 없다: world/${name}`); write('check', name, lf(bytes));
}
fs.rmSync(scratch, { recursive: true, force: true });

const strings = fs.readFileSync(path.join(OUT, 'new', 'world/brand-opening/world-strings.mjs'), 'utf8');
for (const key of ['plan.area.extra', 'plan.area.extraDays', 'life.when.minutes', 'life.comingBack', 'msg.reasonNextLesson', 'followup.openLesson', 'followup.openReview', 'followup.step.due', 'followup.step.missed', 'followup.step.independent-correct', 'followup.step.invalidated', 'followup.step.unavailable']) if (!strings.includes(`'${key}'`)) throw Error(`문자열 3방향 결과에 ${key}가 없다`);
if (!strings.includes('아직 기록이 없는 표현을 새로 만나요')) throw Error('문자열의 이유 문장이 묶음과 다르다');
fs.writeFileSync(path.join(OUT, '목록.json'), JSON.stringify({ base: BASE, new: NEW, items, merges, bundleBytes: Buffer.byteLength(patched) }, null, 1) + '\n');
console.log(JSON.stringify({ out: OUT, items, merges }, null, 1));
console.log(`끼운 줄 돌리기: node docs/_ops/qa/atlas-world-engine-20261108/프론트_공개검사.mjs "${path.join(OUT, 'check')}"`);
console.log(`미리 보기: node tools/공개.js 올리기 --원본 "${path.join(OUT, 'new')}" --기준폴더 "${path.join(OUT, 'base')}" ${items.join(' ')} --후보폴더 "${path.join(OUT, CANDIDATE)}"`);
