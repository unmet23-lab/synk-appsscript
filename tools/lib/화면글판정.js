'use strict';
/* 화면 글 판정(2026-11-23) — 화면 글 시간표(프레임마다 보이는 글 덩이)를 받아 글이 읽을 만큼 머무는지, 한 편에 새 낱말이 너무 많지 않은지 판정한다.
 * 시간표는 tools/화면글검사.js가 Remotion 원본에서 뽑는다. 이 파일은 읽기만 하고 계산만 한다(시험: tests/화면글판정.test.js).
 *
 * 왜: 11-14에 나간 LAB 몽골 「물개」 v8은 17.8초에 한국어 낱말 아홉 개를 넣고, 1~2.5초에 글을 0.5초마다 바꾸고, 답 «ДАЛАЙН ХАВ»를 1.8초,
 *   «САЛЮТ»를 1.1초만 두었다. 유호님 11-15 「물개 게시물 나쁘지않은데 너무 전환이 빨라서 이해가 어려운데 어떻게 생각해 ?」. 제작 회차의 이해 시험은
 *   이미 떨어졌지만 그것을 재는 기계 관문이 없어 「빈 날 없음 — 가장 나은 판」으로 나갔다.
 *
 * 무엇을 재나(걸림의 「항목」):
 *   머묾  새 글(그 편에서 처음 뜨는 글 덩이)이 화면에 MIN_DWELL초 넘게 있지 않다.
 *   읽기  새 글이 최소 머묾은 넘었는데 제 글자 수를 읽기 전에 사라진다(글마다 따로 잰다 — 뜬 차례로 하나씩 읽는 꼴은 옛 편에서 같이 뜬 짧은
 *         줄까지 지나치게 잡았다). 읽는 데 드는 시간은 목표어(LAB의 한국어) 글자 / KO_L2_CPS + 그 밖의 글자 / 그 언어의 초당 글자(언어프로필.json)다.
 *   핵심  답 · 뜻풀이 글(아래 「핵심 글」)이 KEY_DWELL초 넘게 있지 않다.
 *   새낱말 가르치는 한국어 낱말(아래 「낱말 세기」)이 WORD_CAP개를 넘는다. LAB 편만 잰다.
 *
 * 문턱의 근거:
 *   MIN_DWELL 1.2초 — 넷플릭스 자막 기준의 한 줄 최소 시간 5/6초(Timed Text Style Guide: General Requirements)를 제2언어 독자의 읽기 속도 비율로
 *     나눈 값이다. 외국어를 배우는 학생은 모국어 읽기 속도의 42~58%로 읽는다(학교에서 5년 배운 학생의 프랑스어 · 영어 읽기, 모국어 독자 대비) —
 *     5/6초 ÷ 0.7 ≈ 1.2초. 고친 물개 v11~v14가 쓴 「글이 바뀌면 1.2초 넘게」와 같다.
 *   KO_L2_CPS 6자 — 넷플릭스 한국어 자막 상한 초당 12자(어른 판, 어린이 판 9자)에 위 비율 0.5를 곱했다. 몽골 · 영어 같은 보는 사람의 모국어 줄은
 *     언어프로필.json의 초당 글자(몽골 13 · 영어 15 — 자막 관례를 10대 · 초보 기준으로 낮춘 어림)를 쓴다. 한국 사람이 보는 synkbrief · yuhobuilds의
 *     한국어 줄은 모국어라 초당 12자다.
 *   KEY_DWELL 2.5초 — 답 · 뜻풀이는 한 번 읽고 한 번 더 확인할 틈이 있어야 뜻이 남는다(자막이 빠를수록 다시 읽기가 줄고 이해가 떨어진다 —
 *     Szarkowska 외, 「Why subtitle speed matters」, Applied Psycholinguistics). 최소 머묾의 두 배(2.4초)를 올려 잡았고, 독립 검수가 「그대로 내도 된다」고 본
 *     물개 v12가 쓴 「답은 2.5초 넘게」와 같다.
 *   WORD_CAP 4개 — 사람이 새 항목을 한 번에 붙잡는 작업 기억은 3~5덩이다(Cowan 2001 「The magical number 4」 · 2010). 짧은 영상 한 편에 새 한국어
 *     낱말을 넷까지 둔다. 고친 물개(물 · 개 · 물개 · 끝 수수께끼 고기)가 넷이다.
 *   ±SLACK — 시간표가 1/10초 간격 표본이라 머묾을 한 표본만큼 짧게 잴 수 있다. 문턱에서 한 표본 간격까지는 봐준다.
 *
 * 등급(고칠 것 · 확인할 것은 관문 tools/lib/화면글관문.js가 매긴다): 걸림마다 「비」(잰 값 / 필요한 값)를 낸다. 비가 SEVERE 아래면 「심함」이다 —
 *   필요한 시간의 60%도 안 머물렀다는 뜻이다(판본 글자 검사 tools/lib/글자검사.js 읽기시간의 고칠 것 문턱과 같다).
 *
 * 핵심 글(답 · 뜻풀이)을 고르는 법 — 화면 코드를 모르고 보이는 글만 보고 고른다:
 *   ① 끝이 「:」인 이름표 줄(«Жинхэнэ утга нь:» = 진짜 뜻은:) 바로 밑에(이름표 높이 안으로 붙고 가로로 겹침) 뜬 글. 이름표는 다시 뜬 것 · 편 내내 떠 있는 것도 본다
 *   ② 「=」 한쪽에 한국어, 다른 쪽에 다른 문자가 있는 뜻풀이 식(«놀이 = тоглоом»). 한국어끼리의 식(물 + 개 = 물개)과 끝이 「?」인 물음은 뺀다
 *   ③ ✓ 표시가 붙은 글, 맞는 말 초록(#0A9A66 — 제작 절차 「맞는 말 · 틀린 말」)으로 칠한 글
 *   처음 뜬 글만이 아니라 다시 뜬 글도 이 셋이면 답으로 보고 잰다(보기로 먼저 나온 말이 초록 정답으로 다시 뜨는 퀴즈). ①은 그 글이 보인 동안을,
 *   ②와 ✓는 그 꼴이 보인 구간을(흰 보기 뒤에 ✓가 붙거나 물음이 답으로 바뀌면 그 구간이 답이다), 초록은 초록으로 칠한 동안을 잰다.
 *   낱말 밑의 짧은 뜻 딱지(물 · мул · ус)는 핵심으로 치지 않는다 — 낱말 카드는 최소 머묾과 읽기로 본다.
 *
 * 낱말 세기(LAB): 낱말 카드(한글 낱말 하나만 있고 다른 글자 · 숫자 · 부호 · 그림 글자가 없는 덩이 — 물 · 불꽃놀이)와 낱말 식(+ = → ≠ / 이 든 덩이 —
 *   ус + нохой = 물개? · 놀이 = тоглоом · 꽃 (flower) = цэцэг)의 조각 가운데 한글 낱말 하나만 남는 조각을 가르치는 낱말로 센다. 식의 조각은 괄호 속 풀이와
 *   끝의 물음표 · 느낌표를 걷어 낸 뒤 본다. 띄어 쓴 문장(물개 보러 가자!) · 부호가 붙은 한 낱말 대사(눈이다~! · 계세요?) · 안내 문구(SYNK 한국어 · 📌 초급 ·
 *   「한국어」 · 함께배워요: · #함께배워요)는 세지 않는다 — 문장은 머묾 · 읽기로 본다. 같은 낱말은 한 번만 센다.
 *
 * 같은 나타남 — 한 표본 앞의 글과 글자 · 숫자(열쇠)가 같거나, 같은 자리(상자가 겹침)에서 열쇠가 앞머리부터 늘거나 줄거나(타자 치듯) 숫자만 다르면
 *   (세는 숫자) 이어 본다. 식 부호(+ = → ≠ /)가 다른 꼴은 잇지 않는다(「물 + 개」 → 「물개」는 다른 글). 튀어나오는 순간의 띄어쓰기나 옅다가 짙어지는
 *   느낌표로 새 글이 되지 않는다(GPT 다시 검수 GA4). 머묾은 가장 긴 꼴이 처음 다 보인 때부터 잰다. 자리는 표본 상자의 가운데값(밀려 올라오거나
 *   커지며 뜨는 순간이 아니라 제자리)으로 적는다. 꼴마다 보인 구간을 적어, ✓ · 뜻풀이 식은 그 꼴이 보인 구간으로 재고 낱말은 다른 꼴의 앞머리가 아닌
 *   꼴마다 센다(설계 검토 1~3).
 * 늘 있는 글(편 길이의 85% 넘게 떠 있는 계정 이름 · 상표)은 재지 않는다. 글자(\p{L})가 없는 덩이(+ · → · 👇)도 재지 않는다.
 */

const MIN_DWELL = 1.2;
const KEY_DWELL = 2.5;
const KO_L2_CPS = 6;
const KO_L1_CPS = 12;
const DEFAULT_L1_CPS = 13;
const WORD_CAP = 4;
const PACE = 5 / 6;
const READ_BAND = 0.9; // 읽기 속도는 어림이라 필요한 시간의 90%까지는 봐준다
const SEVERE = 0.6;
const VISIBLE = 0.5; // 이 투명도 넘게 보여야 읽을 수 있는 글로 친다(나타나고 사라지는 반투명 사이는 뺀다)
const GROUP_GAP = 0.4; // 이 안에 뜬 새 글은 한 무리(한 카드)로 본다
const ALWAYS = 0.85;
const OK_GREEN = [10, 154, 102];

const HANGUL = /[가-힣]/;
const HANGUL_ALL = /[가-힣]/g;
const LETTER = /\p{L}/u;

const 글자수 = (s) => [...String(s).normalize('NFC')].filter((c) => /[\p{L}\p{N}]/u.test(c)).length;
const 한글수 = (s) => (String(s).match(HANGUL_ALL) || []).length;
const 정리 = (s) => String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim();
// 열쇠 — 글자 · 결합 부호 · 숫자만 남긴다. 결합 부호(태국어 성조 · 버마어 모음 기호)를 지우면 「มา」와 「ม้า」가 한 글이 된다(GPT 5회차 GA3)
// 그림 글자의 변형 선택자(U+FE00~FE0F)와 잇는 기호(U+200D)는 결합 부호로 잡히지만 글이 아니라 뺀다(GPT 6회차 GA4)
// 숫자 사이의 소수점 · 쉼표 · 쌍점(1.5초 · 1,000원 · 10:30)은 남긴다 — 지우면 「1.5초」와 「15초」가 한 글이 된다(GPT 7회차 GA1)
const 글열쇠 = (s) => 정리(s).replace(/[\uFE00-\uFE0F\u200D]/g, '').replace(/[^\p{L}\p{M}\p{N}]/gu, (m, i, 글) => (/^[.,:]$/.test(m) && /\p{N}/u.test(글[i - 1] || '') && /\p{N}/u.test(글[i + 1] || '') ? m : ''));
// 합집합 길이 — 겹치거나 맞닿은 구간을 한 번만 센다
const 합친길이 = (구간들) => { let 합 = 0, 끝 = -Infinity; for (const c of [...구간들].sort((a, b) => a.시작 - b.시작)) { if (c.끝 <= 끝) continue; 합 += c.끝 - Math.max(c.시작, 끝); 끝 = c.끝; } return 합; };
// 늘어남 — 짧은 열쇠 뒤에 글자나 숫자가 붙은 것만(성조 · 모음 부호만 붙은 「ปู」 → 「ปู่」는 다른 글, GPT 6회차 GA8)
const 늘어남 = (긴, 짧은) => 긴.length > 짧은.length && 긴.startsWith(짧은) && /^[\p{L}\p{N}]/u.test(긴.slice(짧은.length));
const 둘째 = (n) => Math.round(n * 100) / 100;

function rgbOf(c) {
  const m = String(c || '').match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
const 초록인가 = (c) => { const v = rgbOf(c); return !!v && v.every((x, i) => Math.abs(x - OK_GREEN[i]) <= 24); };

const 식부호 = (s) => [...new Set(String(s).match(/[+=→≠/]/g) || [])].sort().join('');
const 숫자뺌 = (k) => k.replace(/\p{N}+(?:[.,:]\p{N}+)*/gu, '');
const 상자겹침 = (a, b) => !!a && !!b && Math.min(a[2], b[2]) > Math.max(a[0], b[0]) && Math.min(a[3], b[3]) > Math.max(a[1], b[1]);
const 가운데값 = (xs) => { const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : 0; };

/**
 * 시간표 → 글 나타남 목록.
 * timeline: { fps, step(초), 길이(초), frames: [{ f, items: [{ t, b:[x0,y0,x1,y1], o, fs, c }] }] }
 * → { 목록: [{ 글, 시작, 끝, 머묾, 처음, 위, 아래, 왼, 오른, 크기, 색, 꼴들: [{ 글, 구간: [{ 시작, 끝, 머묾 }] }], 초록들: [{ 시작, 끝, 머묾 }] }](시작 차례),
 *   늘있음: [글], 늘목록: 늘 있는 글의 나타남(이름표 찾기에만) }. 꼴들은 다른 꼴의 앞머리가 아닌 꼴(타자 치는 중간 꼴은 뺌)이다.
 */
function 나타남(timeline) {
  const fps = timeline.fps || 30;
  const frames = [...(timeline.frames || [])].sort((a, b) => a.f - b.f);
  if (!frames.length) return { 목록: [], 늘있음: [], 늘목록: [] };
  const step = timeline.step || (frames.length > 1 ? (frames[1].f - frames[0].f) / fps : 0.1);
  const 길이 = timeline.길이 || (frames[frames.length - 1].f / fps + step);
  const 이어짐 = (구간, t) => 구간 && t - 구간.끝 <= step + 1e-6;
  const 모든 = [];
  let 열린 = [];
  for (const fr of frames) {
    const t = fr.f / fps;
    const 덩이 = [];
    const 본 = new Set();
    for (const it of fr.items || []) {
      const 글 = 정리(it.t);
      if (!글 || !LETTER.test(글) || !((it.o ?? 1) >= VISIBLE)) continue;
      const d = { it, 글, 열쇠: 글열쇠(글), 부호: 식부호(글), b: it.b || null, 초록: 초록인가(it.c) };
      // 한 장에 글자열까지 같은 덩이 둘만 하나로 — 열쇠만 같은 「✓ ДАЛАЙН ХАВ」를 흰 보기에 합쳐 버리지 않는다(GPT 5회차 GA4)
      const 같은 = 덩이.find((x) => x.글 === d.글);
      if (같은) { 같은.초록 = 같은.초록 || d.초록; continue; }
      덩이.push(d);
      본.add(d.열쇠);
    }
    // 한 표본(1/10초)만 빈 것은 이어 본다 — 장면이 바뀌며 겹쳐 사라지는 한 장. 두 표본 넘게 비면 다시 뜬 글이다(GPT 검수 GA13)
    열린 = 열린.filter((r) => 이어짐(r, t));
    const 쓴 = new Set();
    const 짝 = new Map();
    // 짝 찾기 차례: 앞 장과 글자열이 같은 나타남 → 열쇠가 같은 나타남 → 같은 자리에서 늘거나 줄거나 숫자만 다른 나타남
    for (const d of 덩이) { const r = 열린.find((x) => !쓴.has(x) && x.글 === d.글); if (r) { 짝.set(d, r); 쓴.add(r); } }
    for (const d of 덩이) { if (짝.has(d)) continue; const r = 열린.find((x) => !쓴.has(x) && x.열쇠 === d.열쇠 && x.부호 === d.부호); if (r) { 짝.set(d, r); 쓴.add(r); } }
    for (const d of 덩이) {
      if (짝.has(d)) continue;
      const r = 열린.find((x) => !쓴.has(x) && x.부호 === d.부호 && 상자겹침(x.상자, d.b)
        && (늘어남(x.열쇠, d.열쇠) || 늘어남(d.열쇠, x.열쇠) || (숫자뺌(x.열쇠) === 숫자뺌(d.열쇠) && /\p{N}/u.test(x.열쇠 + d.열쇠))));
      if (r) { 짝.set(d, r); 쓴.add(r); }
    }
    for (const d of 덩이) {
      let r = 짝.get(d);
      if (!r) { r = { 처음때: t, 끝: t + step, 열쇠: d.열쇠, 부호: d.부호, 상자: d.b, 상자들: [], 꼴: new Map(), 초록: [], 크기: d.it.fs || 0, 색: d.it.c || '' }; 모든.push(r); 열린.push(r); }
      r.끝 = t + step;
      r.열쇠 = d.열쇠;
      r.글 = d.글;
      if (d.b) { r.상자 = d.b; r.상자들.push(d.b); }
      const 꼴 = r.꼴.get(d.글) || { 열쇠: d.열쇠, 장: 0, 구간: [] };
      꼴.장++;
      const 마지막 = 꼴.구간[꼴.구간.length - 1];
      if (이어짐(마지막, t)) 마지막.끝 = t + step; else 꼴.구간.push({ 시작: t, 끝: t + step });
      r.꼴.set(d.글, 꼴);
      if (d.초록) { const c = r.초록[r.초록.length - 1]; if (이어짐(c, t)) c.끝 = t + step; else r.초록.push({ 시작: t, 끝: t + step }); }
    }
  }
  const 끝맞춤 = (x) => 둘째(Math.min(x, 길이));
  // 반올림하기 전 시작 · 끝은 JSON에 안 나가는 칸(_시작 · _끝)에 둔다 — 답 구간을 이을 때 반올림 오차가 문턱을 넘기지 않게(GPT 7회차 GA2)
  const 구간글 = (c) => Object.defineProperties({ 시작: 둘째(c.시작), 끝: 끝맞춤(c.끝), 머묾: 둘째(Math.min(c.끝, 길이) - c.시작) }, { _시작: { value: c.시작 }, _끝: { value: Math.min(c.끝, 길이) } });
  const 나 = 모든.map((r) => {
    const 꼴들 = [...r.꼴.entries()].map(([글, v]) => ({ 글, ...v, 동안: v.구간.reduce((t, c) => t + Math.min(c.끝, 길이) - c.시작, 0) }));
    // 완성 꼴 — 숫자를 뺀 열쇠가 가장 긴 꼴(세는 숫자는 모두 완성 꼴). 머묾은 완성 꼴이 보인 동안을 더한 값이다 —
    // 다 보인 뒤 짧아진 꼴(「오늘은 한국어를 배워요」 0.4초 → 「오늘은 한국어」 3.1초)이 남은 시간을 더하지 않는다(GPT 5회차 GA1)
    const 최대 = Math.max(...꼴들.map((x) => 숫자뺌(x.열쇠).length));
    const 완성 = 꼴들.filter((x) => 숫자뺌(x.열쇠).length === 최대);
    const 시작 = Math.min(...완성.map((x) => x.구간[0].시작));
    const 완성동안 = Math.min(합친길이(완성.flatMap((x) => x.구간.map((c) => ({ 시작: c.시작, 끝: Math.min(c.끝, 길이) })))), 길이); // 꼴끼리 겹친 표본을 두 번 세지 않는다(GPT 6회차 GA3)
    const 글 = [...완성].sort((a, b) => b.장 - a.장)[0].글;
    // 셀 꼴 — 다른 꼴의 앞머리가 아니거나, 앞머리라도 0.5초 넘게 보인 꼴(같은 자리의 「꽃」 0.8초 → 「꽃잎」은 둘 다 가르친 낱말, GPT 5회차 GA2 · 6회차 GA7).
    // 타자 치는 중간 꼴(0.1~0.2초씩)은 뺀다
    const 극대 = 꼴들.filter((x) => x.동안 >= 0.5 - 1e-6 || !꼴들.some((y) => 늘어남(y.열쇠, x.열쇠)));
    const 상 = r.상자들;
    return {
      글, 열쇠: 글열쇠(글), 시작: 둘째(시작), 끝: 끝맞춤(r.끝), 머묾: 둘째(완성동안), 처음때: r.처음때, 극대열쇠: 극대.map((x) => x.열쇠), 완성열쇠: 완성.map((x) => x.열쇠),
      완성구간: 완성.flatMap((x) => x.구간.map((c) => ({ 시작: c.시작, 끝: Math.min(c.끝, 길이) }))),
      위: 가운데값(상.map((b) => b[1])), 아래: 가운데값(상.map((b) => b[3])), 왼: 가운데값(상.map((b) => b[0])), 오른: 가운데값(상.map((b) => b[2])),
      크기: r.크기, 색: r.색,
      꼴들: 극대.map((x) => ({ 글: x.글, 구간: x.구간.map(구간글) })),
      초록들: r.초록.map(구간글),
    };
  }).sort((a, b) => a.처음때 - b.처음때);
  // 「처음」 — 완성 꼴의 열쇠가 앞선 나타남의 셀 꼴에 없던 나타남(앞서 본 「꽃」 뒤에 같은 자리로 자란 「꽃잎」은 처음 뜬 글, GPT 6회차 GA1).
  // 늘 있는 글 — 같은 열쇠의 완성 꼴이 보인 구간을 합집합으로 모아 편 길이의 85% 넘게(따로 뜬 「✓ 꽃」과 「꽃」을 겹쳐 두 번 세지 않는다 · 앞부분만 남은 시간은
  // 넣지 않는다, GPT 6회차 GA2 · GA6)
  const 본열쇠 = new Set();
  const 구간모음 = new Map();
  for (const a of 나) {
    a.처음 = !a.완성열쇠.some((k) => 본열쇠.has(k));
    a.극대열쇠.forEach((k) => 본열쇠.add(k));
    구간모음.set(a.열쇠, [...(구간모음.get(a.열쇠) || []), ...a.완성구간]);
  }
  const 합 = new Map([...구간모음].map(([k, v]) => [k, 합친길이(v)]));
  const 늘있음 = [];
  const 늘목록 = [];
  const 목록 = [];
  for (const a of 나) {
    const 늘 = 합.get(a.열쇠) >= 길이 * ALWAYS;
    if (늘 && !늘있음.includes(a.글)) 늘있음.push(a.글);
    delete a.처음때; delete a.극대열쇠; delete a.완성열쇠; delete a.완성구간;
    // 늘 있는 글은 머묾을 재지 않지만, 편 내내 떠 있는 이름표(「정답:」)는 답을 고를 때 쓴다(GPT 검수 GA12)
    (늘 ? 늘목록 : 목록).push(a);
  }
  목록.sort((a, b) => a.시작 - b.시작 || a.위 - b.위);
  return { 목록, 늘있음, 늘목록, step, 길이 };
}

/** 두 글 상자가 한 카드의 줄처럼 붙어 있나 — 가로로 겹치고, 세로 틈이 큰 줄 높이의 1.5배 안. 자리를 모르면(상자 없음) 붙은 것으로 본다 */
function 붙음(a, b) {
  if (!(a.오른 > a.왼) || !(b.오른 > b.왼)) return true;
  const 겹침 = Math.min(a.오른, b.오른) - Math.max(a.왼, b.왼);
  const 틈 = Math.max(a.위, b.위) - Math.min(a.아래, b.아래);
  return 겹침 > 0 && 틈 <= Math.max(a.아래 - a.위, b.아래 - b.위) * 1.5;
}

/** 새 글을 무리(한 카드)로 묶는다 — 앞 무리 첫 글에서 GROUP_GAP초 안에 뜨고 그 무리의 줄에 붙은 새 글만 같은 무리.
 *  떨어진 자리의 별개 카드는 0.4초 안에 떠도 따로 센다(GPT 검수 다시 GA13) */
function 무리짓기(새글) {
  const 무리 = [];
  for (const a of 새글) {
    // GROUP_GAP 안에 시작한 앞 무리들 가운데 이 글이 붙는 무리 — 사이에 별개 카드가 끼어도 한 카드의 줄을 가르지 않는다(GPT 다시 검수 GA6)
    let g = null;
    for (let i = 무리.length - 1; i >= 0 && a.시작 - 무리[i].시작 <= GROUP_GAP + 1e-6; i--) if (무리[i].글들.some((b) => 붙음(a, b))) { g = 무리[i]; break; }
    if (g) g.글들.push(a); else 무리.push({ 시작: a.시작, 글들: [a] });
  }
  return 무리;
}

/** 꼴만 보고 아는 답 — ✓ 표시, 한국어와 다른 문자의 「=」 뜻풀이 식(물음 · 이름표 꼴은 뺀다) */
function 꼴핵심(글) {
  if (/[✓✔]/.test(글)) return '맞는 말 표시';
  if (/[:：]\s*$/.test(글)) return null;
  if (/=/.test(글) && !/[?？]\s*$/.test(글)) {
    const sides = 글.split('=');
    const 한쪽한글 = sides.some((s) => HANGUL.test(s));
    const 한쪽다른글 = sides.some((s) => /\p{L}/u.test(s.replace(HANGUL_ALL, '')) && !HANGUL.test(s));
    if (한쪽한글 && 한쪽다른글) return '뜻풀이 식';
  }
  return null;
}

function 핵심인가(a, 무리, 목록 = []) {
  return 꼴핵심(a.글) || 이름표핵심(a, 무리, 목록);
}

/** 자리로 아는 답 — 이름표(끝이 「:」) 바로 밑에 뜬 글 */
function 이름표핵심(a, 무리, 목록 = []) {
  if (/[:：]\s*$/.test(a.글)) return null;
  // 이름표는 다시 뜬 것도 본다(물개 v8의 «Жинхэнэ утга нь:»는 둘째 세트에서 다시 떠 «САЛЮТ»를 받쳤다) — a가 뜰 때 떠 있거나 같은 무리 안에 뜬 위쪽 이름표
  // 바로 밑 = 이름표 아래에 붙고(틈이 이름표 높이 안) 가로로 겹친다(좁은 쪽 폭의 30% 넘게 — 같은 줄 옆자리 글은 답이 아니다, GPT 검수 GA9)
  const 가로겹침 = (b) => { const w = Math.min(b.오른 - b.왼, a.오른 - a.왼); return !(w > 0) || Math.min(b.오른, a.오른) - Math.max(b.왼, a.왼) >= w * 0.3; };
  const 이름표 = [...무리.글들, ...목록].filter((b) => b !== a && /[:：]\s*$/.test(b.글) && b.위 < a.위 && a.위 - b.아래 <= Math.max(b.아래 - b.위, 40)
    && 가로겹침(b) && b.시작 <= a.시작 + GROUP_GAP + 1e-6 && b.끝 > a.시작 + 1e-6);
  if (이름표.length) return `이름표 「${이름표[이름표.length - 1].글}」 다음 글`;
  return null;
}

/** 가르치는 한국어 낱말 — 덩이를 + = → ≠ / 로 나눈 조각 가운데 한글 낱말 하나만 남는 조각.
 *  식이 없는 덩이(카드)는 한글 낱말 하나 말고 아무것도 없어야 한다 — 부호 · 그림 글자 · 다른 글자가 붙은 대사와 안내 문구(눈이다~! · 📌 초급 · 「한국어」 ·
 *  함께배워요: · SYNK 한국어)는 낱말 카드가 아니다(GPT 검수 GA10 · 다시 GA11). 식의 조각은 괄호 속 풀이(눈(1) · 꽃 (flower)) · 낫표와 따옴표(「꽃」) ·
 *  끝의 ?!~…를 걷어 낸 뒤 같은 잣대로 본다(다시 GA3 · 3회차 GA3) */
const 낱말꼴 = /^[가-힣]+$/;
function 낱말들(글) {
  const 식 = /[+=→≠/]/.test(String(글));
  const out = [];
  for (const part of String(글).split(/[+=→≠/]/)) {
    const 본 = 식 ? part.replace(/[(（][^)）]*[)）]/g, ' ').replace(/[「」『』“”"'‘’《》〈〉«»<>]/g, '').replace(/[!?！？~…]+\s*$/, '').trim() : part.trim();
    if (낱말꼴.test(본)) out.push(본);
  }
  return out;
}

/**
 * 판정. opts: { 목표어: true면 한국어를 배우는 말로(LAB), 모국어초당: 보는 사람 말의 초당 글자, 낱말세기: true면 새낱말을 잰다,
 *   최소머묾: 새 글의 최소 머묾(기본 MIN_DWELL — 한국 사람이 보는 편은 모국어 자막 최소 PACE를 준다) }
 * → { 걸림: [{ 항목, 초, 끝초, 글, 잰값, 필요, 비, 심함 }], 낱말: [...], 핵심: [...], 요약 }
 * 「심함」: 머묾은 넷플릭스가 모국어 자막에도 두지 않는 5/6초 아래(모국어 판은 그 60% 아래), 핵심은 KEY_DWELL의 60% 아래,
 *   읽기는 필요한 시간의 60% 아래, 새낱말은 WORD_CAP / 낱말 수가 60% 아래(일곱 개부터). 바뀜은 심함이 없다(아래 바뀜 주석).
 */
function 판정(timeline, opts = {}) {
  const { 목록, 늘있음, 늘목록, step, 길이 } = 나타남(timeline);
  const slack = step || 0.1;
  const MIN = opts.최소머묾 || MIN_DWELL;
  const 심한머묾 = MIN > PACE + 1e-6 ? PACE : PACE * SEVERE;
  const 목표어 = opts.목표어 !== false;
  const l1 = opts.모국어초당 || DEFAULT_L1_CPS;
  const ko = 목표어 ? KO_L2_CPS : KO_L1_CPS;
  const 읽는시간 = (글) => { const h = 한글수(글); const o = 글자수(글) - h; return h / ko + Math.max(0, o) / l1; };
  const 새글 = 목록.filter((a) => a.처음);
  const 무리 = 무리짓기(새글);
  const 걸림 = [];
  const 핵심 = [];
  const push = (항목, a, 잰값, 필요, 심함, 글) => {
    const 비 = 필요 > 0 ? 잰값 / 필요 : 1;
    걸림.push({ 항목, 초: a.시작, 끝초: a.끝, 글: a.글, 잰값: 둘째(잰값), 필요: 둘째(필요), 비: 둘째(비), 심함: !!심함, 설명: 글 });
  };
  for (const g of 무리) {
    for (const a of g.글들) {
      if (a.머묾 + slack < MIN - 1e-6) push('머묾', a, a.머묾, MIN, a.머묾 + slack < 심한머묾 - 1e-6, `「${a.글}」이 ${a.시작.toFixed(1)}초에 떠 ${a.머묾.toFixed(1)}초만 있다(새 글은 ${MIN.toFixed(1)}초 넘게)`);
    }
  }
  // 핵심 — 처음 뜬 글만이 아니라 다시 뜬 글도 본다. 보기로 먼저 보인 말이 초록 정답으로 다시 뜨면 그때가 답이다(GPT 검수 GA11)
  const 이름표목록 = [...목록, ...늘목록];
  for (const a of [...목록, ...늘목록]) {
    const 늘 = !목록.includes(a);
    const g = 무리.find((x) => x.글들.includes(a)) || { 글들: [a] };
    // ① 이름표 밑 글은 보인 동안, ② 뜻풀이 식 · ✓는 그 꼴이 보인 구간마다, 그 밖에 초록으로 칠한 글은 초록인 동안마다 잰다(설계 검토 2)
    // 이름표 규칙이 ✓ · 식 · 초록 구간을 덮지 않는다(GPT 5회차 GA6). 편 내내 떠 있는 보기가 끝에 초록 · ✓로 바뀌는 구간도 잰다(GA5)
    const 자리 = 늘 ? null : 이름표핵심(a, g, 이름표목록);
    // 꼴로 아는 답(✓ · 뜻풀이 식)은 열쇠가 같은 꼴끼리 구간을 이어 잰다 — 답 끝에 느낌표만 붙은 꼴로 답이 끊기지 않는다(GPT 6회차 GA5)
    const 답꼴 = new Map();
    for (const k of a.꼴들 || [{ 글: a.글, 구간: [a] }]) { const why = 꼴핵심(k.글); if (!why) continue; const 열 = 글열쇠(k.글); const v = 답꼴.get(열) || { 글: k.글, why, 구간: [] }; v.구간.push(...k.구간); 답꼴.set(열, v); }
    const 날 = (c) => ({ 시작: c._시작 ?? c.시작, 끝: c._끝 ?? c.끝 });
    const 이은구간 = (xs) => { const out = []; for (const c of xs.map(날).sort((p, q) => p.시작 - q.시작)) { const l = out[out.length - 1]; if (l && c.시작 <= l.끝 + 1e-6) l.끝 = Math.max(l.끝, c.끝); else out.push(c); } return out; };
    const 답구간 = [...답꼴.values()].flatMap((v) => 이은구간(v.구간).map((c) => ({ ...c, v })));
    const 꼴구간 = 답구간.map(({ 시작, 끝, v }) => ({ ...a, 글: v.글, 시작: 둘째(시작), 끝: 둘째(끝), 머묾: 둘째(끝 - 시작), 까닭: v.why }));
    // 초록은 꼴로 아는 답의 구간과 겹친 부분만 빼고 남은 동안을 잰다 — 「✓ 꽃」 구간 뒤에 이어진 초록 1.2초를 통째로 빼먹지 않는다(GPT 6회차 GA9 · 7회차 GA3)
    const 초록구간 = (a.초록들 || []).flatMap((c) => {
      let 남은 = [날(c)];
      for (const k of 답구간) 남은 = 남은.flatMap((x) => (k.끝 <= x.시작 + 1e-6 || k.시작 >= x.끝 - 1e-6 ? [x] : [{ 시작: x.시작, 끝: k.시작 }, { 시작: k.끝, 끝: x.끝 }].filter((y) => y.끝 - y.시작 > 1e-6)));
      return 남은.map((x) => ({ ...a, 시작: 둘째(x.시작), 끝: 둘째(x.끝), 머묾: 둘째(x.끝 - x.시작), 까닭: '맞는 말 초록' }));
    });
    const 잴것 = [...(자리 ? [{ ...a, 까닭: 자리 }] : []), ...꼴구간, ...초록구간];
    for (const k of 잴것) {
      핵심.push({ 글: k.글, 초: k.시작, 머묾: k.머묾, 까닭: k.까닭, 처음: a.처음 });
      if (k.머묾 + slack < KEY_DWELL - 1e-6) push('핵심', k, k.머묾, KEY_DWELL, k.머묾 + slack < KEY_DWELL * SEVERE - 1e-6, `답 · 뜻풀이 「${k.글}」(${k.까닭})이 ${k.시작.toFixed(1)}초에 떠 ${k.머묾.toFixed(1)}초만 있다(${KEY_DWELL}초 넘게)`);
    }
  }
  // 읽기 — 새 줄마다 제 글자 수를 읽을 시간(최소 머묾은 넘었는데 글이 길어 모자란 줄)
  for (const a of 새글) {
    const r = 읽는시간(a.글) * READ_BAND;
    if (a.머묾 + slack >= MIN - 1e-6 && a.머묾 + slack < r - 1e-6) push('읽기', a, a.머묾, r / READ_BAND, a.머묾 < (r / READ_BAND) * SEVERE, `「${a.글}」(${글자수(a.글)}자)을 읽는 데 ${(r / READ_BAND).toFixed(1)}초가 드는데 ${a.머묾.toFixed(1)}초만 있다`);
  }
  // 바뀜 — 새 글이 앞 무리 뒤 PACE초 안에 또 뜬다(앞 글이 남아 있어도 눈이 새 글로 끌려간다). 늘 확인할 것이다 — 새 글 사이 간격은 요구(글자 수만큼의
  // 읽기 시간 · 최소 머묾 · 답 머묾 · 낱말 상한)에 없는 덧붙인 항목이고, 두 글이 다 오래 남으면 둘 다 읽을 틈이 있다. 짧게 사라지는 글은 머묾 · 읽기 · 핵심이
  // 고칠 것으로 잡는다(GPT 검수 GA14 · 다시 GA4)
  // 모국어 편(synkbrief · yuhobuilds)은 목소리를 따라 자막이 바뀌어 한 편에 20개 넘게 나와 재지 않는다(11-23 실측)
  for (let i = 1; 목표어 && i < 무리.length; i++) {
    const gap = 무리[i].시작 - 무리[i - 1].시작;
    if (gap + slack < PACE - 1e-6) {
      const a = 무리[i].글들[0];
      const 앞 = 무리[i - 1].글들.map((x) => x.글).join(' · ');
      push('바뀜', a, gap, PACE, false, `「${a.글}」이 앞 글(${앞}) ${gap.toFixed(1)}초 뒤에 또 뜬다(새 글 사이는 ${PACE.toFixed(2)}초 넘게)`);
    }
  }
  // 새 낱말
  const 낱말 = [];
  if (opts.낱말세기) {
    for (const a of 목록) for (const k of a.꼴들 || [{ 글: a.글 }]) for (const w of 낱말들(k.글)) if (!낱말.some((x) => x.낱말 === w)) 낱말.push({ 낱말: w, 초: a.시작, 글: k.글 });
    if (낱말.length > WORD_CAP) {
      const 비 = WORD_CAP / 낱말.length;
      걸림.push({ 항목: '새낱말', 초: 낱말[WORD_CAP].초, 끝초: 길이, 글: 낱말.map((x) => x.낱말).join(' · '), 잰값: 낱말.length, 필요: WORD_CAP, 비: 둘째(비), 심함: 비 < SEVERE,
        설명: `가르치는 한국어 낱말이 ${낱말.length}개다(${낱말.map((x) => x.낱말).join(' · ')}) — 한 편에 ${WORD_CAP}개까지` });
    }
  }
  걸림.sort((a, b) => a.초 - b.초);
  return {
    걸림, 낱말, 핵심,
    요약: { 길이: 둘째(길이 || 0), 표본: 둘째(step || 0), 새글: 새글.length, 무리: 무리.length, 늘있음, 가장짧은새글: 새글.length ? Math.min(...새글.map((a) => a.머묾)) : null },
    나타남: 목록,
  };
}

module.exports = { 판정, 나타남, 무리짓기, 핵심인가, 낱말들, MIN_DWELL, KEY_DWELL, KO_L2_CPS, KO_L1_CPS, DEFAULT_L1_CPS, WORD_CAP, PACE, READ_BAND, SEVERE, VISIBLE, GROUP_GAP };
