#!/usr/bin/env node
// 셋째 판(2026-11-26): 질문창 답(knowledge.json 한 · 영)과 llms.txt의 PATH 글을 PATH 앱에 맞춘다(유호님 11-26 「네, 고쳐줘」).
//   node patch-live-3.mjs <공개본 폴더> <후보 폴더>
// 답 문단을 바꾸면 같은 문단을 담은 path 문서의 문단도 같은 자리에서 바꾼다(답 문단은 문서 문단과 글자 그대로 같아야 한다).
// 단언: 바꿀 문단이 한 번만 있고, 다른 답이 같은 문단을 쓰지 않고, 바꾼 뒤 모든 답 문단이 제 문서에 있다. 파일은 공개본과 같은 꼴(들여쓰기 2, 끝 줄바꿈)로 쓴다.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const [live, out] = process.argv.slice(2);
if (!out) { console.error('쓰기: node patch-live-3.mjs <공개본 폴더> <후보 폴더>'); process.exit(2); }
const APP = '/path/app/';

const KO = {
  'path-intro': {
    swap: [
      ['면접과 생활을 순서대로 함께 짚어 가는 일을 준비하고 있습니다.', '면접과 생활을 순서대로 함께 짚어 갑니다. 유학 준비는 지금 PATH 앱에서 할 수 있습니다.'],
      ['지금 쓸 수 있는 것 — 서울 하루 일정(무료, 가입 없이)과 요양보호사 면접 연습(60~90초)입니다.', '지금 쓸 수 있는 것 — PATH 앱(대학 비교 · 서류 준비 · 입학 면접 연습), 서울 하루 일정(무료, 가입 없이), 요양보호사 면접 연습(60~90초)입니다.'],
      ['준비하고 있는 것 — 전공과 진로에 맞춘 유학 준비(계획 · 지원 서류와 면접 · 포트폴리오),', '준비하고 있는 것 — 상담과 함께하는 유학 지원(지원 서류 다듬기 · 포트폴리오),'],
    ],
  },
  'path-personal': {
    swap: [
      ['희망 전공과 졸업 후 진로를 바탕으로 학교별 조건을 비교하고, 지금의 한국어 수준과 남은 시간에 맞는 준비 일정을 세웁니다. 한국어 공부부터 지원 서류, 면접 연습까지 단계별로 돕는 서비스를 준비하고 있습니다.', 'PATH 앱에 내 한국어와 성적, 준비한 돈을 넣으면 대학이 공개한 모집 요강의 조건과 나란히 견줘 볼 수 있습니다. 고른 과정에 낼 서류와 마감일을 모아 보고, 학부 과정은 그 대학의 입학 면접도 미리 연습할 수 있습니다.'],
      ['유학 준비 계획 — 목표와 예산, 한국어 수준과 지원 시기를 정리해 학교 후보를 비교하고 준비 일정을 짭니다.', '지금 있는 과정 — 전북대학교 학부 · 한국어학당, 원광대학교 학부 · 한국문화교육센터, 전주대학교 학부입니다. SYNK와 협약한 대학이 아니고, 대학이 공개한 모집 요강을 옮겼습니다.'],
      ['입학 지원 준비 — 본인이 쓴 지원 서류를 함께 다듬고 면접을 연습합니다. 제출 일정과 서류, 출국 전 준비도 확인합니다.', '상담과 함께하는 지원(준비 중) — 본인이 쓴 지원 서류를 함께 다듬고, 목표와 예산에 맞춰 출국 전까지의 준비 일정을 짭니다.'],
    ],
    action: { label: 'PATH 앱 열기', href: APP },
  },
  'path-vision': {
    swap: [['처음 마주할 면접을 미리 치러 보고, 서울에서 보낼 하루를 미리 짜 봅니다. 유학과 일자리 준비는 차례로 엽니다.', '처음 마주할 면접을 미리 치러 보고, 서울에서 보낼 하루를 미리 짜 봅니다. 유학 준비는 PATH 앱에서 합니다. 일자리 준비는 이어서 엽니다.']],
  },
  'path-support': {
    swap: [['희망 전공과 진로에 맞춘 유학 계획, 지원 서류와 면접 준비, 포트폴리오, 일하고 싶은 분야의 비자·자격증·한국어 조건 알아보기, 한국 생활 정착을 준비하고 있습니다. 요양보호사 면접 연습은 지금 할 수 있습니다.', 'PATH 앱에서 대학 비교, 서류 준비, 입학 면접 연습을 지금 할 수 있고, 요양보호사 면접 연습도 할 수 있습니다. 상담과 함께하는 유학 지원(지원 서류 다듬기 · 포트폴리오), 일하고 싶은 분야의 비자·자격증·한국어 조건 알아보기, 한국 생활 정착은 준비하고 있습니다.']],
  },
};
const EN = {
  'path-intro': {
    swap: [
      ['we are preparing to work through the Korean you need, the requirements, interviews and daily life with you, one step at a time.', 'we work through the Korean you need, the requirements, interviews and daily life with you, one step at a time. You can prepare to study in the PATH app now.'],
      ['Available now — “A day in Seoul” (free, no sign-up) and caregiver interview practice (60–90 seconds).', 'Available now — the PATH app (compare universities, prepare documents, practise admission interviews), “A day in Seoul” (free, no sign-up) and caregiver interview practice (60–90 seconds).'],
      ['In preparation — preparing to study around your major and career (a study plan, applications and interviews, a portfolio),', 'In preparation — study support with a consultation (polishing your application documents, a portfolio),'],
    ],
  },
  'path-personal': {
    swap: [
      ['We compare schools by the conditions that matter for your major and career after graduation, and set a timeline that fits your Korean level and the time you have. Step-by-step help from Korean study to applications and interviews is in preparation.', 'In the PATH app you enter your Korean level, grades and the money you have prepared, and see them side by side with the requirements in each university’s published admission guide. You also see the documents and deadlines for the program you choose, and for undergraduate programs you can practise that university’s admission interview.'],
      ['Study plan — organize goals, budget, Korean level and application timing, compare schools and set a timeline.', 'Programs now — Jeonbuk National University (undergraduate and Korean Language Institute), Wonkwang University (undergraduate and Korean Culture Education Center) and Jeonju University (undergraduate). They are not SYNK partner universities; the details come from their published admission guides.'],
      ['Application support — polish the documents you wrote and practise interviews, and check deadlines, paperwork and what to do before departure.', 'Support with a consultation (in preparation) — polish the application documents you wrote, and set a timeline to departure that fits your goals and budget.'],
    ],
    action: { label: 'Open the PATH app', href: APP },
  },
  'path-vision': {
    swap: [['Rehearse your first interview and plan a day in Seoul. Study-abroad and job preparation open next, one at a time.', 'Rehearse your first interview and plan a day in Seoul. Prepare to study in the PATH app; job preparation opens next.']],
  },
  'path-support': {
    swap: [['Study plans based on your major and career, help with applications and interviews, portfolios, finding out the visa, qualification and Korean requirements of the field you want to work in, and settling into life in Korea are in preparation. Caregiver interview practice is available now.', 'The PATH app lets you compare universities, prepare documents and practise admission interviews now, and caregiver interview practice is available too. Study support with a consultation (polishing application documents, portfolios), finding out the visa, qualification and Korean requirements of the field you want to work in, and settling into life in Korea are in preparation.']],
  },
};

function patchKnowledge(file, plan) {
  const before = fs.readFileSync(path.join(live, file), 'utf8');
  const j = JSON.parse(before);
  assert.equal(JSON.stringify(j, null, 2) + '\n', before, `${file}: 공개본 꼴이 들여쓰기 2가 아니다`);
  const ids = Object.keys(plan);
  for (const id of ids) {
    const rec = j.records.find(r => r.id === id); assert.ok(rec, id);
    const doc = j.docs.find(d => d.id === rec.sourceId); assert.ok(doc, rec.sourceId);
    const paras = rec.answer.split('\n\n');
    for (const [a, b] of plan[id].swap) {
      const at = paras.findIndex(p => p.includes(a)); assert.ok(at >= 0 && paras.filter(p => p.includes(a)).length === 1, `${id}: ${a.slice(0, 40)}`);
      const oldPara = paras[at], newPara = oldPara.replace(a, b);
      const shared = j.records.filter(r => r !== rec && r.answer.split('\n\n').includes(oldPara)).map(r => r.id);
      assert.deepEqual(shared, [], `${id}: 다른 답이 같은 문단을 쓴다`);
      const di = doc.paragraphs.indexOf(oldPara); assert.ok(di >= 0 && doc.paragraphs.lastIndexOf(oldPara) === di, `${id}: 문서 문단`);
      paras[at] = newPara; doc.paragraphs[di] = newPara;
    }
    rec.answer = paras.join('\n\n');
    if (plan[id].action) rec.action = plan[id].action;
    rec.reviewedAt = '2026-11-26';
  }
  for (const r of j.records) { const d = j.docs.find(x => x.id === r.sourceId); if (d) for (const p of r.answer.split('\n\n')) assert.ok(d.paragraphs.includes(p), `${r.id}: 문서에 없는 문단`); }
  const text = JSON.stringify(j, null, 2) + '\n';
  fs.mkdirSync(path.dirname(path.join(out, file)), { recursive: true });
  fs.writeFileSync(path.join(out, file), text);
  console.log(file, before.length, '→', text.length);
}
patchKnowledge('knowledge.json', KO);
patchKnowledge('en/knowledge.json', EN);

// llms.txt: 같은 쪽 설명을 PATH 앱에 맞춘다.
const llmsBefore = fs.readFileSync(path.join(live, 'llms.txt'), 'utf8');
let llms = llmsBefore;
for (const [a, b] of [
  ['처음 마주할 면접을 미리 치러 보고, 서울에서 보낼 하루를 미리 짜 봅니다. 유학과 일자리 준비는 차례로 엽니다.', '처음 마주할 면접을 미리 치러 보고, 서울에서 보낼 하루를 미리 짜 봅니다. 유학 준비는 PATH 앱에서 합니다. 일자리 준비는 이어서 엽니다.'],
  ['서울 하루 일정과 요양보호사 면접 연습은 지금 써 볼 수 있고, 유학 준비와 일자리 조건 알아보기, 한국 생활 정착을 준비하고 있습니다.', 'PATH 앱(대학 비교 · 서류 준비 · 입학 면접 연습), 서울 하루 일정, 요양보호사 면접 연습은 지금 써 볼 수 있고, 일자리 조건 알아보기와 한국 생활 정착을 준비하고 있습니다.'],
  ['- 서울 하루 일정 · 무료, 가입 없이', '- PATH 앱 · 대학 비교, 서류 준비, 입학 면접 연습(https://synk.im/path/app/)\n- 서울 하루 일정 · 무료, 가입 없이'],
  ['- 유학 준비와 일자리 조건 알아보기(준비 중)', '- 일자리 조건 알아보기(준비 중)'],
  ['Study-abroad and job preparation open next, one at a time. “A day in Seoul” and caregiver interview practice are available now; help with preparing to study, finding out job requirements', 'Prepare to study in the PATH app (https://synk.im/path/app/); job preparation opens next. The PATH app, “A day in Seoul” and caregiver interview practice are available now; finding out job requirements'],
]) { assert.equal(llms.split(a).length, 2, a.slice(0, 40)); llms = llms.replace(a, () => b); }
fs.writeFileSync(path.join(out, 'llms.txt'), llms);
console.log('llms.txt', llmsBefore.length, '→', llms.length);
