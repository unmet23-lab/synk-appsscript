// 워크플로 저널 → 재료 파일.
// 용법: node docs/_ops/판정28_울트라/scripts/분배.js <journal.jsonl[,journal2.jsonl]> <단계: A|B>
//
// 왜 저널을 읽나: 워크플로 결과를 본세션 대화로 통째로 받으면 컨텍스트를 태운다.
// 저널의 {"type":"result"} 줄이 각 에이전트의 «실제» 반환값이다(진행 화면은 자가 아니다).
const fs = require('fs');
const path = require('path');

const [J, STAGE] = process.argv.slice(2);
if (!J || !STAGE) {
  console.error('용법: node 분배.js <journal.jsonl[,...]> <A|B>');
  process.exit(1);
}

const OUT = path.join(__dirname, '..', '재료');
fs.mkdirSync(OUT, { recursive: true });

const rows = J.split(',')
  .flatMap((j) => fs.readFileSync(j.trim(), 'utf8').split('\n'))
  .filter(Boolean)
  .map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  })
  .filter((l) => l && l.type === 'result' && l.result && typeof l.result === 'object');

// 옛글자 가드(유호 확정 — 쓰는 문자는 한글·몽골어·영어 셋뿐)가 커밋을 막으므로 «쓸 때» 지운다.
// 저널에서 다시 뽑을 때마다 되살아나니 손으로 고치면 안 되고 이 자리에서 막아야 한다.
// 🔴 한자를 «지우기»만 하면 뜻이 죽는 자리가 있다. 09-03 실례 — 「일할」에 붙은 옛글자 괄호만 걷으면
//    남는 「일할」이 «일을 할»로 읽혀 뜻이 정반대가 된다(반박 에이전트가 스스로 지적했다).
//    그래서 낱말째 푸는 표를 먼저 걸고, 남는 낱글자만 아래 한자표로 바꾼다.
const 낱말표 = [
  [[0xc77c, 0xd560, 0x28, 0x65e5, 0x5272, 0x29], '날수로 나눠 셈하기'], // 일할 + U+65E5 U+5272
  [[0xc7ac, 0xc6d0, 0x28, 0x8ca1, 0x6e90, 0x29], '재원'], //               재원 + U+8CA1 U+6E90
];
const 한자표 = { [String.fromCodePoint(0x5206)]: '분' }; // U+5206 = 시간 단위 「분」 · 🔑 옛글자는 이 파일 「안」에도 글자로 못 쓴다(가드가 소스도 본다)
const 범위 = [[0x3040, 0x30ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xf900, 0xfaff]];
const 옛글자 = new RegExp('[' + 범위.map(([a, b]) => String.fromCodePoint(a) + '-' + String.fromCodePoint(b)).join('') + ']', 'g');
const 씻는다 = (s0) => {
  let 남은 = 0;
  let s = s0;
  for (const [cps, 풀이] of 낱말표) s = s.split(cps.map((c) => String.fromCodePoint(c)).join('')).join(풀이);
  const out = s.replace(옛글자, (c) => {
    if (한자표[c]) return 한자표[c];
    남은 += 1;
    return c;
  });
  if (남은) console.warn('⚠ 표에 없는 옛글자', 남은, '자 — 커밋이 막힌다. 한자표에 뜻을 더해라');
  return out;
};

const write = (name, v) => {
  fs.writeFileSync(path.join(OUT, name), 씻는다(JSON.stringify(v, null, 1)));
  return name;
};

// items[0].id 의 접두("space-1" → "space")가 문서키다. doc 칸은 자유 문자열이라 자로 안 쓴다.
// 앞머리의 id(예: "ending-2")만 뽑는다. 못 뽑으면 파일 이름에 못 쓰는 글자를 지운다.
const 안전이름 = (s) => {
  const m = String(s).match(/^[a-z]+-[0-9a-z-]+/i);
  return m ? m[0] : String(s).replace(/[\\/:*?"<>|]/g, '_').slice(0, 60).trim();
};

const docKey = (v) => {
  const first = (v.items || [])[0];
  return first && typeof first.id === 'string' ? first.id.split('-')[0] : 'unknown';
};

if (STAGE === 'A') {
  let sorted = 0;
  for (const l of rows) {
    const v = l.result;
    if (v.by_owner) {
      console.log(write('비평_A.json', v), '· 총계', v.total, '· 오분류', (v.misclassified || []).length, '· 빠짐', (v.missing || []).length, '· 겹침', (v.duplicates || []).length);
      continue;
    }
    if (Array.isArray(v.items)) {
      const k = docKey(v);
      console.log(write(`가르기_${k}.json`, v), '·', (v.items || []).length, '건');
      sorted += 1;
    }
  }
  console.log('가르기', sorted, '벌 ·', rows.length, '결과 줄');
} else if (STAGE === 'B') {
  // 재기(measure) = measured 칸 · 반박(refute) = refuted 칸
  let m = 0, r = 0;
  for (const l of rows) {
    const v = l.result;
    // target 칸에 산문이 실려 오는 때가 있다("ending-2 — 몽골 선납 환불…"). 앞의 id 만 파일 이름으로 쓴다.
    if (v.refuted !== undefined && v.target) { console.log(write(`반박_${안전이름(v.target)}.json`, v)); r += 1; continue; }
    if (v.id && v.branches) { console.log(write(`잰것_${안전이름(v.id)}.json`, v)); m += 1; continue; }
  }
  console.log('잰것', m, '· 반박', r, '·', rows.length, '결과 줄');
} else if (STAGE === 'C') {
  // 수리(repair) = change_log 칸을 가진 것
  let n = 0;
  for (const l of rows) {
    const v = l.result;
    if (Array.isArray(v.change_log) && v.id) { console.log(write(`고침_${안전이름(v.id)}.json`, v)); n += 1; }
  }
  console.log('고침', n, '·', rows.length, '결과 줄');
} else {
  console.error('모르는 단계:', STAGE);
  process.exit(1);
}
