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

const write = (name, v) => {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(v, null, 1));
  return name;
};

// items[0].id 의 접두("space-1" → "space")가 문서키다. doc 칸은 자유 문자열이라 자로 안 쓴다.
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
    if (v.refuted !== undefined && v.target) { console.log(write(`반박_${v.target}.json`, v)); r += 1; continue; }
    if (v.id && v.branches) { console.log(write(`잰것_${v.id}.json`, v)); m += 1; continue; }
  }
  console.log('잰것', m, '· 반박', r, '·', rows.length, '결과 줄');
} else {
  console.error('모르는 단계:', STAGE);
  process.exit(1);
}
