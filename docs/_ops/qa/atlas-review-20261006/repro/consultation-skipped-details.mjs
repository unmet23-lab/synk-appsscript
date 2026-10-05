// 검수 재현 스크립트(2026-10-06). 질문 가치 0으로 건너뛴 세부 답이 추천 사양을 바꾸는 사례.
// 저장소·네트워크·유료 호출을 건드리지 않는다. 실행: node <이 파일>
// Read-only, CURRENT working copy: deterministic cases with Ask result, completion status and what an unasked answer would change.
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = fileURLToPath(new URL('../../../../../', import.meta.url)).replace(/\\/g, '/');
const Ask = require(ROOT + 'atlas/ask.js');
const rules = require(ROOT + 'docs/마케팅/맞춤도구/computer/rules.js');
const content = require(ROOT + 'docs/마케팅/맞춤도구/computer/content.js');
const { createComputerConsultation } = await import(pathToFileURL(ROOT + 'experiences/atlas-lab/consultation.mjs').href);
const c = createComputerConsultation({ Ask, rules, content });
function show(name, answers, about, values) {
  const r = c.choose(answers), base = c.compute(answers), k = r.completion;
  console.log(`\n### ${name}\nanswers ${JSON.stringify(answers)}`);
  console.log(`Ask: ${r.status} ${r.question?.id ?? r.reason}`);
  console.log('ranked:', r.ranked.map(e => `${e.id}[impact ${e.impact}, value ${e.value.toFixed(3)}, ${e.reason}]`).join(' '));
  console.log(`completion: ${k.status} | path ${k.path} | unresolved ${JSON.stringify(k.unresolvedRequiredFields)} | assumptions ${JSON.stringify(k.assumptions.map(a => a.id))}`);
  console.log(`lab shows: ${base.headline.title} || ${base.headline.sub}`);
  for (const v of values) { const s = { ...answers, [about]: v }, full = c.compute(s); console.log(`  ${about}=${JSON.stringify(v)} -> ${full.headline.title} (ram value ${full.ram.value}, workable ${full.ram.workable}; storage ${full.storage.value}, min ${full.storage.min}) loss(current)=${c.evaluate({ decision: c.decision(answers), answers: s }).loss.toFixed(3)}`); }
}
show('A. 사진·디자인 / 맥 / 책상', { uses: ['photo'], owned: 'new', os: 'mac', place: 'home', budget: '100_150' }, 'photo', ['adobe', 'heavy', '3d']);
show('B. 코딩 / 맥 / 들고 다님', { uses: ['code'], owned: 'new', os: 'mac', place: 'carry', budget: '100_150' }, 'code', ['web', 'mobile', 'server']);
show('C. 프리미어 FHD / 윈도우 노트북, 필수 항목 모두 답함', { uses: ['video'], 'video.app': 'premiere', 'video.res': 'fhd', 'video.load': 'light', owned: 'new', os: 'win', place: 'carry', budget: '150_250' }, 'multitask', ['light', 'normal', 'heavy']);
show('D. 게임 / 윈도우, 필수 항목 모두 답함', { uses: ['game'], owned: 'new', os: 'win', place: 'home', budget: '150_250' }, 'multitask', ['light', 'normal', 'heavy']);
show('E. 웹 / 새로 구입, 예산만 남음', { uses: ['web'], owned: 'new', os: 'win', place: 'home' }, 'budget', ['lt100', 'gt250', 'unknown']);
show('F. 게임 / 예산 100만 원 미만', { uses: ['game'], owned: 'new', os: 'win', place: 'home', budget: 'lt100' }, 'budget', ['lt100', 'gt250']);
