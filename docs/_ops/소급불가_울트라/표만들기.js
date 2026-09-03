/* 후보 194건 → 유호님이 읽는 표 둘(날짜가 박힌 것 · 사건에 걸린 것) */
const fs = require('fs');
const a = JSON.parse(fs.readFileSync('docs/_ops/소급불가_울트라/전량.json', 'utf8'));
const esc = s => String(s || '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
const own = { machine: '내가', yuho: '유호님', person: '사람 손' };

const dated = [], ev = [];
for (const x of a) {
  const m = (x.deadline_event || '').match(/20\d\d-\d\d(-\d\d)?/);
  (m ? dated : ev).push(Object.assign({ _d: m ? m[0] : '' }, x));
}
dated.sort((p, q) => p._d.localeCompare(q._d));

let md = '| 마감 | 임자 | 무엇이 사라지나 |\n|---|---|---|\n';
for (const x of dated) md += '| **' + x._d + '** | ' + (own[x.owner] || x.owner) + ' | ' + esc(x.title) + ' |\n';
fs.writeFileSync('docs/_ops/소급불가_울트라/표_날짜.md', md);

// 사건을 큰 갈래로 묶는다 — 문구가 제각각이라 낱말로 가른다
const 갈래 = [
  ['목소리·발음', /음성|녹음|목소리|발음|낭독|전사|말하기/],
  ['동의·권리', /동의|철회|약관|초상|계약서|보험/],
  ['학생 번호·명부', /명부|번호|등록|인제스트|프로필|학생 ?ID|로스터/],
  ['수업·출석·강사', /수업|출석|강사|교실|관찰|서클|차시|휴강|채점|첨삭/],
  ['과제·퀴즈·AI', /과제|숙제|퀴즈|생성|AI|프롬프트|교정|지식|모델/],
  ['나침반·회고·성향', /나침반|회고|성향|선언|고르기|목표|장면|무대/],
  ['라디오·송출', /송출|라디오|채팅|곡|스트림|방송/],
  ['졸업·이탈·진로', /졸업|이탈|퇴소|진로|궤적|선배|근황/],
  ['접수·사전등록·마케팅', /사전등록|접수|유입|추천인|크루카드|캠페인|광고|게시물|명단|구독/],
  ['파일럿 측정', /파일럿|측정|기준선|출발선|맨몸|블라인드|A\/B|전환/],
  ['종이·사진·기록물', /사진|종이|인쇄|이름표|포트폴리오|순간|저장 ?공간/],
];
const g = {};
for (const x of ev) {
  const hay = (x.title || '') + ' ' + (x.deadline_event || '') + ' ' + (x.what_is_lost || '');
  const hit = 갈래.find(([, re]) => re.test(hay));
  const k = hit ? hit[0] : '그 밖';
  (g[k] = g[k] || []).push(x);
}
let md2 = '';
for (const [k, v] of Object.entries(g).sort((p, q) => q[1].length - p[1].length)) {
  md2 += '\n### ' + k + ' — ' + v.length + '건\n\n| 마감 사건 | 임자 | 무엇이 사라지나 |\n|---|---|---|\n';
  v.sort((p, q) => (own[p.owner] || '').localeCompare(own[q.owner] || ''));
  for (const x of v) md2 += '| ' + esc(x.deadline_event).slice(0, 30) + ' | ' + (own[x.owner] || x.owner) + ' | ' + esc(x.title) + ' |\n';
}
fs.writeFileSync('docs/_ops/소급불가_울트라/표_사건.md', md2);

const cnt = {};
for (const [k, v] of Object.entries(g)) cnt[k] = v.length;
console.log('날짜가 박힌 것', dated.length, '· 사건에 걸린 것', ev.length);
console.log(JSON.stringify(cnt, null, 1));
