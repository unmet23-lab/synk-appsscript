#!/usr/bin/env node
// 점수 길 카드 맹검(README 「시험 ②」)의 시험관 묶음 — 시험관마다 카드 여섯 장을 뜻 없는 이름(p1-x · p1-y …)으로 옮기고,
// 같은 질문지를 만든다. R/S가 X/Y 어디에 갔는지는 짝(PLAN)에 고정해 두고 묶음 폴더에는 남기지 않는다(시험관이 볼 수 있어서).
//   node 시험관.mjs --cards <카드 폴더> --out <묶음 폴더>   → <묶음>/<T>/p<n>-<x|y>.png · <묶음>/<T>/질문.md
//   node 시험관.mjs --score <답 폴더>                     → <답>/<T>.json 넷을 모아 README 기준 1~5를 센다
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

export const PERSONA = {
  A: '몽골 울란바토르에서 온 21살 여자 대학생이다. 한국 대학 국제학부 1학년이고, 졸업하려면 TOPIK 4급이 필요하다. 지금은 3급 정도다. 휴대폰 앱으로 틈틈이 공부한다. 시험 점수에 신경을 많이 쓰지만, 앱이 숙제처럼 느껴지면 금방 지운다.',
  B: '베트남 하노이에서 온 23살 남자다. 한국 대학원 진학을 준비하고 있고 TOPIK 4급이 필요하다. 지금은 3급 경계다. 낮에는 아르바이트를 해서 하루 20~30분만 공부할 수 있다. 숫자와 근거를 따지는 편이다.',
};
// 시험관 넷 — 모델 둘 × 사람 둘. S(점수 길 판)가 X에 간 판단이 12번 중 6번이 되게 고정했다.
export const PLAN = {
  T1: { model: 'sonnet', persona: 'A', sIsX: { P1: true, P2: false, P3: true } },
  T2: { model: 'sonnet', persona: 'B', sIsX: { P1: false, P2: true, P3: false } },
  T3: { model: 'haiku', persona: 'A', sIsX: { P1: true, P2: false, P3: false } },
  T4: { model: 'haiku', persona: 'B', sIsX: { P1: false, P2: true, P3: true } },
};
// 2차(카드 R2 · S2) — 새 시험관 넷, X/Y 자리는 1차와 다르게 다시 6/12로 맞췄다.
// 1차에서 시험관 둘이 짝 안의 X · Y 이름을 그림과 반대로 적어, 2차는 장마다 가운데 묶음 제목(head)을 적게 해 이름을 대조한다.
export const PLAN2 = {
  T5: { model: 'sonnet', persona: 'A', sIsX: { P1: false, P2: true, P3: false } },
  T6: { model: 'sonnet', persona: 'B', sIsX: { P1: true, P2: false, P3: true } },
  T7: { model: 'haiku', persona: 'A', sIsX: { P1: false, P2: true, P3: true } },
  T8: { model: 'haiku', persona: 'B', sIsX: { P1: true, P2: false, P3: false } },
};
const round2 = opt('--판') === '2';
const plans = round2 ? PLAN2 : PLAN, suffix = round2 ? '2' : '';
const PEOPLE = ['P1', 'P2', 'P3'];

function questions(dir, persona) {
  const pairs = PEOPLE.map((p, i) => `- 짝 ${i + 1}: \`${path.join(dir, `p${i + 1}-x.png`)}\` (X) · \`${path.join(dir, `p${i + 1}-y.png`)}\` (Y)`).join('\n');
  return `당신은 ${persona}

한국어 학습 앱에 새로 들어갈 「내 위치」 화면의 시안을 봐 주세요. 짝마다 **같은 학습 결과**를 두 가지 방식(X · Y)으로 보여 줍니다. 짝 셋은 서로 다른 학습자의 결과지만, 짝마다 **그 화면이 내 결과라고 생각하고** 답해 주세요.

아래 여섯 그림만 Read 도구로 열어 보세요. 다른 파일이나 폴더는 열지 마세요(시험이 망가집니다).
${pairs}

장마다(X · Y 각각) 1~5로 답합니다.
- open: 이 화면을 다시 열어 보고 싶다(1 전혀 아니다 ~ 5 매우 그렇다)
- study: 이걸 보면 공부하고 싶어진다
- trust: 이 숫자와 말을 믿겠다
- heavy: 성적표처럼 무겁고 부담스럽다(1 가볍다 ~ 5 아주 무겁다)
- today: 이 화면을 보고 오늘 무엇을 공부하겠는지 한 줄${round2 ? '\n- head: 그 장의 범위 그림 아래, 가로줄 다음에 오는 첫 묶음의 제목(그림에 적힌 글자 그대로)' : ''}
짝마다:
- pick: 둘 중 하나만 앱에 둔다면 "X" 또는 "Y"
- why: 고른 까닭 한 줄
- cheap: 싸 보이거나 거슬리는 곳(없으면 "")

마지막 답에는 아래 꼴의 JSON 하나만 \`\`\`json 블록으로 주세요. 다른 말은 그 앞에 짧게만.
\`\`\`json
${round2
    ? '{"pairs":[{"pair":1,"X":{"head":"","open":0,"study":0,"trust":0,"heavy":0,"today":""},"Y":{"head":"","open":0,"study":0,"trust":0,"heavy":0,"today":""},"pick":"X","why":"","cheap":""}]}'
    : '{"pairs":[{"pair":1,"X":{"open":0,"study":0,"trust":0,"heavy":0,"today":""},"Y":{"open":0,"study":0,"trust":0,"heavy":0,"today":""},"pick":"X","why":"","cheap":""}]}'}
\`\`\``;
}

if (opt('--cards')) {
  const cards = path.resolve(opt('--cards')), out = path.resolve(opt('--out'));
  for (const [t, plan] of Object.entries(plans)) {
    const dir = path.join(out, t);
    fs.mkdirSync(dir, { recursive: true });
    PEOPLE.forEach((p, i) => {
      const [x, y] = plan.sIsX[p] ? ['S', 'R'] : ['R', 'S'];
      fs.copyFileSync(path.join(cards, `${p}-${x}${suffix}.png`), path.join(dir, `p${i + 1}-x.png`));
      fs.copyFileSync(path.join(cards, `${p}-${y}${suffix}.png`), path.join(dir, `p${i + 1}-y.png`));
    });
    fs.writeFileSync(path.join(dir, '질문.md'), questions(dir, PERSONA[plan.persona]));
    console.log(`${t} ${plan.model} ${plan.persona} → ${dir}`);
  }
}

// 구체적인 할 일: 문항 번호 · 유형 이름 · 과제를 댄 답. 「쓰기 공부」 같은 영역 이름만은 구체적이지 않다.
const CONCRETE = /\d{2}\s*(번|~)|순서\s*배열|자료\s*설명|주장하는\s*글|인터뷰|토론|끝맺음|-ㄴ다|빈칸|모의|대답/;
// --바꿈 T1:2,T2:2 — 시험관이 짝 안의 X · Y 이름을 그림과 반대로 적은 곳(답의 내용이 다른 장의 것)을 바로잡는다.
// 바로잡기 전 값도 함께 찍는다. 어디를 왜 바꿨는지는 README 결과에 적는다.
const swaps = new Set((opt('--바꿈') || '').split(',').filter(Boolean));
if (opt('--score')) {
  // 답은 폴더(<T>.json)나 시험관답.mjs(ANSWERS[판])에서 읽는다. 집계.json은 폴더일 때 그 폴더에, mjs일 때 결과/에 쓴다.
  const source = path.resolve(opt('--score'));
  const fromModule = source.endsWith('.mjs');
  const answers = fromModule ? (await import(pathToFileURL(source).href)).ANSWERS[round2 ? 2 : 1] : null;
  const dir = fromModule ? path.join(path.dirname(fileURLToPath(import.meta.url)), '결과') : source;
  const rows = [], raw = [];
  for (const [t, plan] of Object.entries(plans)) {
    const file = path.join(source, `${t}.json`);
    const answer = fromModule ? answers?.[t] : (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);
    if (!answer) continue;
    for (const pair of answer.pairs) {
      const p = PEOPLE[pair.pair - 1], sKey = plan.sIsX[p] ? 'X' : 'Y', rKey = sKey === 'X' ? 'Y' : 'X';
      const row = { t, model: plan.model, persona: plan.persona, p, S: pair[sKey], R: pair[rKey], pickS: pair.pick === sKey, why: pair.why, cheap: pair.cheap };
      raw.push(row);
      // 2차는 적힌 묶음 제목으로 대조한다 — R 판의 첫 묶음 제목은 「영역별」이다.
      const headSwapped = round2 && /영역/.test(row.S?.head || '') && !/영역/.test(row.R?.head || '');
      if (headSwapped) swaps.add(`${t}:${pair.pair}`);
      rows.push(swaps.has(`${t}:${pair.pair}`) ? { ...row, S: row.R, R: row.S, pickS: !row.pickS, swapped: true } : row);
    }
  }
  // 판을 잘못 주면(1차 답에 --판 2 등) 시험관 이름이 맞지 않아 0건이 된다 — 조용히 0/0으로 끝내지 않는다.
  if (!rows.length) throw new Error(`이 판(${round2 ? 2 : 1}차)의 시험관 답이 없다: ${source}`);
  fs.mkdirSync(dir, { recursive: true });
  if (swaps.size) {
    const rawMean = (side, key) => raw.reduce((s, r) => s + Number(r[side][key]), 0) / (raw.length || 1);
    console.log(`바로잡기 전 — S를 고름 ${raw.filter((r) => r.pickS).length}/${raw.length} · 공부 S ${rawMean('S', 'study').toFixed(2)} · R ${rawMean('R', 'study').toFixed(2)} · 믿기 S ${rawMean('S', 'trust').toFixed(2)} · R ${rawMean('R', 'trust').toFixed(2)} · 무거움 S ${rawMean('S', 'heavy').toFixed(2)} · R ${rawMean('R', 'heavy').toFixed(2)}`);
    console.log(`바로잡은 곳: ${[...swaps].join(', ')}`);
  }
  const mean = (list, side, key) => list.reduce((s, r) => s + Number(r[side][key]), 0) / (list.length || 1);
  const concrete = (list, side) => list.filter((r) => CONCRETE.test(r[side].today || '')).length;
  const p3 = rows.filter((r) => r.p === 'P3');
  const out = {
    n: rows.length, pickS: rows.filter((r) => r.pickS).length,
    mean: Object.fromEntries(['open', 'study', 'trust', 'heavy'].map((k) => [k, { S: mean(rows, 'S', k), R: mean(rows, 'R', k) }])),
    concrete: { S: concrete(rows, 'S'), R: concrete(rows, 'R') }, p3StudyS: mean(p3, 'S', 'study'), rows,
  };
  fs.writeFileSync(path.join(dir, '집계.json'), JSON.stringify(out, null, 1));
  const m = out.mean;
  console.log([
    `판단 ${out.n} · S를 고름 ${out.pickS}/${out.n} (선 8/12)`,
    `공부하고 싶어지나 S ${m.study.S.toFixed(2)} · R ${m.study.R.toFixed(2)} (선 S ≥ R + 0.5)`,
    `믿기나 S ${m.trust.S.toFixed(2)} · R ${m.trust.R.toFixed(2)} (선 S ≥ R + 0.5)`,
    `무겁나 S ${m.heavy.S.toFixed(2)} · R ${m.heavy.R.toFixed(2)} (선 S ≤ R + 0.5)`,
    `다시 열겠나 S ${m.open.S.toFixed(2)} · R ${m.open.R.toFixed(2)}`,
    `할 일이 구체적 S ${out.concrete.S}/${out.n} · R ${out.concrete.R}/${out.n} (선 S ≥ 10/12, S > R)`,
    `P3 공부하고 싶어지나 S ${out.p3StudyS.toFixed(2)} (선 3 이상)`,
  ].join('\n'));
}
