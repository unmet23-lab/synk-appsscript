// 시안 조각을 만든다: a-home · a-atlas · a-lab · b-home · b-atlas · b-lab .html. 글은 여기 한 곳, 그림은 img/(실제 WORLD 화면).
// 쓰기: node docs/디자인/synk.im_개인화면_20261108/시안/만들기.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const src = name => `/시안/img/${name}.webp`;
const phone = (name, alt) => `<img src="${src(name)}" width="780" height="1688" alt="${esc(alt)}" loading="lazy" decoding="async">`;

const COPY = {
  label: ['In SYNK WORLD', '쓸수록 달라지는 것'],
  status: ['지금 이용', '미리보기'],
  title: ['틀린 말은 1분 뒤에,', '맞힌 말은 잊을 때쯤 돌아옵니다'],
  lead: '무엇을 할지 고르지 않아도, 복습 날짜를 챙기지 않아도 됩니다. 내가 놓친 항목과 고른 목표로 아틀라스가 다음 연습을 고르고, 다시 만날 때는 SYNK WORLD가 챙깁니다.',
  cap: '실제 SYNK WORLD 화면 · 시험용 손님 학습자',
  rows: [
    { when: '앱을 열면', say: '오늘 뭐 하지?', a: '<b>고르지 않아도 됩니다.</b> 앱을 열면 튜터가 다음 할 일과 그 이유를 먼저 말합니다. 내 기록이 달라지면 이 말도 달라집니다.', by: 'Core', img: 'home-reason', alt: 'SYNK WORLD 홈. 튜터가 최근 놓친 항목을 더 연습하자고 권하고 그 이유가 적힌 카드와 맞춤 연습 시작 단추' },
    { when: '1분 뒤', say: '방금 그 말, 뭐였지?', a: '<b>틀린 말은 1분 뒤 다른 장면으로 돌아옵니다.</b> 레슨 문제를 되풀이하지 않고, 같은 표현을 새 상황에서 묻습니다. 튜터가 먼저 알아봅니다. 「어? 전에 만난 말인데 장면이 달라!」', by: 'SYNK WORLD 복습 일정', img: 'review-scene', alt: '복습 화면. 학교에서 처음 만난 직원에게 인사하는 새 상황의 문제' },
    { when: '내일부터', say: '언제 또 봐야 하지?', a: '<b>날짜를 챙기지 않아도 돌아옵니다.</b> 표현마다 돌아오는 때가 적혀 있습니다. 맞힌 말은 내일, 그다음은 1 · 3 · 7 · 14 · 30일로 간격을 벌립니다.', by: 'SYNK WORLD 복습 일정', img: 'review-list', alt: '복습 요약. 안녕하세요는 1분 뒤, 감사합니다와 저는 몽글이에요는 내일 돌아온다고 적힌 목록' },
    { when: '1 · 7 · 30일 뒤', say: '외운 걸까, 아는 걸까?', a: '<b>맞혔다고 끝이 아닙니다.</b> 1 · 7 · 30일 뒤 같은 항목을 처음 보는 문제로 다시 확인합니다. 한 번의 결과로 판단하지 않고 칸마다 결과를 남깁니다.', by: 'Temper', img: 'followups', alt: '시간을 두고 다시 확인 카드. 1일 뒤 칸에 혼자 맞힘, 7일 뒤와 30일 뒤 칸에 날짜' },
    { when: '언제든', say: '나 늘고 있나?', a: '<b>점수 말고 근거로 봅니다.</b> 항목마다 언제, 어디서, 혼자 맞혔는지가 줄로 남습니다. 칸은 처음 보는 문제를 도움 없이 푼 첫 답으로 정합니다.', by: 'Trail · Core', img: 'evidence', alt: '내 위치 화면. 낱말 뜻 읽기를 펼치면 짧은 진단과 생활 한국어에서 혼자 맞힌 근거 줄이 보인다' },
    { when: '쉬고 싶은 날', say: '오늘은 공부하기 싫은데', a: '<b>그럼 게임 한 판.</b> 환승 러시의 답도, 생활 레슨의 답도, 짧은 진단의 답도 한 기록입니다. 게임에서 놓친 항목은 튜터가 다음 연습으로 꺼냅니다.', by: 'Trail · Core', img: 'game', alt: '환승 러시 게임 화면. 지하철 안에서 안내 방송을 듣고 왼쪽 문, 그대로, 오른쪽 문 가운데 고른다' },
  ],
  note: '화면은 시험용 손님 학습자로 풀고 브라우저 시계를 옮겨 찍었습니다. 복습 일정은 SYNK WORLD 생활 한국어의 규칙입니다.',
  go: { label: 'SYNK WORLD 열기', href: '/world/', arrow: '↗' },
  more: { label: '왜 이렇게 만들었나', href: '/atlas/#learner', arrow: '→' },
  swipe: '옆으로 넘겨 보세요',
  linesTitle: '같은 자리, 달라지는 한 줄',
  linesSub: '홈 튜터 카드의 이유 문장 — 실제 화면 그대로',
  lines: [
    ['첫날', '아직 연습 기록이 적어요. 짧게 해 보며 맞춰 갈게요.'],
    ['레슨 둘 뒤', '생활 팩의 다음 레슨이에요. 아직 기록이 없는 표현을 새로 만나요.'],
    ['복습이 돌아왔을 때', '복습할 시간이 된 내용이 있어요. 짧게 다시 만나 봐요.'],
    ['게임에서 놓친 뒤', '최근 놓친 듣고 세부 정보 찾기를 조금 더 연습해 봐요. 고른 목표와 이어지는 활동이에요.'],
  ],
  railTitle: '표현 하나가 돌아오는 길',
  railSub: '제때 돌아와 계속 맞힐 때 · 숫자는 앞 점과의 간격(일)',
  cardsTitle: '한 항목의 칸이 실제로 채워진 모습',
  cards: [['1일 뒤 확인', 'card-d1'], ['7일 뒤 확인', 'card-d7'], ['30일 뒤 확인', 'card-d30']],
  why: [
    { h: '같은 시간, 왜 더 남나', p: '몰아서 다시 읽으면 그날은 아는 것 같습니다. 간격을 두고 다시 꺼내 보면 더 오래 남는다는 것은 학습 연구가 되풀이해 보여 준 결과입니다. SYNK WORLD는 그 간격을 학습자 대신 기억하고, 같은 표현은 다른 장면에서, 같은 항목은 처음 보는 문제로 꺼냅니다.',
      small: '연구: <a href="https://pubmed.ncbi.nlm.nih.gov/16719566/" rel="noopener" target="_blank">간격 효과(Cepeda 외, 2006)</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/16507066/" rel="noopener" target="_blank">떠올리기 효과(Roediger · Karpicke, 2006)</a>. 연구 결과이며 SYNK WORLD에서 잰 효과는 아닙니다.' },
    { h: '공부하러 들어오지 않아도', p: '복습 시간표를 따로 열지 않습니다. 튜터가 먼저 말을 걸고, 돌아온 표현은 새 장면으로 오고, 재확인은 말의 리듬 · 주문 폭주 같은 게임 안에서도 일어납니다.' },
    { h: '쌓이지 않게', p: '못 한 계획은 다음 주로 쌓지 않습니다. 복습은 한 번에 여섯 개까지 꺼내고, 날짜를 놓친 재확인은 「기간 지남」으로 남을 뿐입니다.' },
  ],
};

const statusTag = ([a, b]) => `<span class="status">${esc(a)} <small>· ${esc(b)}</small></span>`;
const labelTag = (l = COPY.label) => `<p class="label"><span class="en">${esc(l[0])}</span><span>${esc(l[1])}</span>${statusTag(COPY.status)}</p>`;
const titleTag = (t = COPY.title) => `<h2 class="h2" id="learner-title"><span>${esc(t[0])}</span> <span>${esc(t[1])}</span></h2>`;

/* 30일 선: 다시 만나기(맞힐 때마다 간격이 벌어짐) · 확인(처음 보는 문제). 칸 = 날짜 비례. */
const AT = d => (d / 30).toFixed(4);
function rail({ live = false } = {}) {
  const dot = (d, cls, label) => `<i class="rail-mark ${cls}" style="--at:${AT(d)}" data-day="${d}">${label ? `<span>${esc(label)}</span>` : ''}</i>`;
  const gap = (d, l, cls = '') => `<em class="rail-gap ${cls}" style="--at:${AT(d)}">${l}</em>`;
  return `<div class="rail"${live ? ' data-rail' : ''}>
<div class="rail-track" data-track="review"><p class="rail-name">다시 만나기<small>같은 말, 다른 장면</small></p><div class="rail-axis">${dot(0, 'is-hot', '틀리면 1분 뒤')}${dot(1, '', '')}${dot(2, '', '')}${dot(5, '', '')}${dot(12, '', '')}${dot(26, '', '')}${gap(0.5, '1', 'is-tiny')}${gap(1.5, '1', 'is-tiny')}${gap(3.5, '3')}${gap(8.5, '7')}${gap(19, '14')}<em class="rail-off">다음은 30일 뒤 →</em></div></div>
<div class="rail-track" data-track="check"><p class="rail-name">확인<small>같은 항목, 처음 보는 문제</small></p><div class="rail-axis">${dot(1, 'is-ring', '1일')}${dot(7, 'is-ring', '7일')}${dot(30, 'is-ring', '30일')}</div></div>
</div>`;
}

/* ── 안 A ── */
function qList(rows = COPY.rows, { by = false } = {}) {
  return `<ol class="ln-qs">${rows.map((r, i) => `<li class="ln-q${i ? '' : ' is-on'}"><button class="ln-btn" type="button" aria-expanded="${i ? 'false' : 'true'}"><span class="ln-when">${esc(r.when)}</span><span class="ln-say">${esc(r.say)}</span><span class="ln-sign" aria-hidden="true"></span></button>
<div class="ln-a"><div class="ln-a-in"><p>${r.a}</p>${by ? `<p class="ln-by"><span>맡는 곳</span> ${esc(r.by)}</p>` : ''}</div></div>
<figure class="ln-shot"><span class="ln-frame">${phone(r.img, r.alt)}</span><figcaption class="ln-cap">${esc(COPY.cap)}</figcaption></figure></li>`).join('\n')}</ol>
<p class="ln-swipe" aria-hidden="true"><span data-ln-count>01 / ${String(rows.length).padStart(2, '0')}</span><span>${esc(COPY.swipe)} →</span></p>`;
}
const whyTag = () => `<div class="ln-why">${COPY.why.map(w => `<div><h3>${esc(w.h)}</h3><p>${esc(w.p)}</p>${w.small ? `<small>${w.small}</small>` : ''}</div>`).join('')}</div>`;
const headA = () => `<div class="ln-head">${labelTag()}${titleTag()}<p class="lead">${esc(COPY.lead)}</p></div>`;
const btns = () => `<div class="ln-more"><a class="btn btn-dark" href="${COPY.go.href}">${esc(COPY.go.label)} <span class="arr" aria-hidden="true">${COPY.go.arrow}</span></a><a class="link" href="${COPY.more.href}">${esc(COPY.more.label)} <span class="arr" aria-hidden="true">${COPY.more.arrow}</span></a></div>`;
const linesTag = () => `<div class="ln-block"><div class="ln-block-head"><h3>${esc(COPY.linesTitle)}</h3><p>${esc(COPY.linesSub)}</p></div><ol class="ln-lines">${COPY.lines.map(([w, t]) => `<li><span>${esc(w)}</span><q>${esc(t)}</q></li>`).join('')}</ol></div>`;
const railTag = () => `<div class="ln-block"><div class="ln-block-head"><h3>${esc(COPY.railTitle)}</h3><p>${esc(COPY.railSub)}</p></div>${rail()}
<div class="ln-cards"><p class="ln-cards-head">${esc(COPY.cardsTitle)}</p><ol>${COPY.cards.map(([t, n]) => `<li><span>${esc(t)}</span><img src="${src(n)}" width="636" height="226" alt="${esc(t)} 뒤의 다시 확인 카드" loading="lazy" decoding="async"></li>`).join('')}</ol></div></div>`;
const A = {
  home: `<section class="section ln" id="learner" aria-labelledby="learner-title"><div class="wrap">
${headA()}
${qList()}
${btns()}
</div></section>`,
  atlas: `<section class="section ln" id="learner" aria-labelledby="learner-title"><div class="wrap">
${headA()}
${qList(COPY.rows, { by: true })}
${linesTag()}
${railTag()}
${whyTag()}
<p class="ln-note">${esc(COPY.note)}</p>
</div></section>`,
  lab: `<section class="section ln" id="learner" aria-labelledby="learner-title"><div class="wrap">
${headA()}
${qList()}
${btns()}
</div></section>`,
};

/* ── 안 B: 한 문제를 풀고 30일을 빨리 감는다 ── */
const TRY = {
  first: { when: '오늘 · 첫 레슨의 첫 문제', context: '교실에 들어가 선생님을 처음 만났어요.', prompt: '처음 만난 선생님에게 어떤 인사를 할까요?', answerId: 'a', choices: [{ id: 'a', text: '안녕하세요.' }, { id: 'b', text: '감사합니다.' }, { id: 'c', text: '다녀왔어요.' }] },
  second: { when: '1분 뒤 · 같은 표현, 다른 장면', context: '아직 도움을 받거나 헤어지는 상황은 아니에요.', prompt: '학교에서 처음 만난 직원에게 인사해요.', answerId: 'b', choices: [{ id: 'a', text: '다녀왔어요.' }, { id: 'b', text: '안녕하세요.' }, { id: 'c', text: '감사합니다.' }] },
  hint: '실제 첫 레슨의 문제입니다. 일부러 틀려 봐도 좋습니다.',
  right: '<b>맞았습니다.</b> 이 말은 내일 다른 장면으로 다시 옵니다.',
  wrong: '<b>이 말은 1분 뒤 다른 장면으로 돌아옵니다.</b> 틀린 답도 첫 기록이 되어 1 · 7 · 30일 확인이 잡힙니다.',
  backRight: '<b>다시 만나 맞혔습니다.</b> 이제 내일 또 옵니다. 맞힐수록 간격이 1 · 3 · 7 · 14 · 30일로 벌어집니다.',
  backWrong: '<b>또 1분 뒤에 돌아옵니다.</b> 맞힐 때까지 간격이 벌어지지 않습니다.',
  toMinute: '1분 뒤로',
  toDay1: '내일로',
  steps: [
    { key: 'day1', when: '내일', say: '앱을 열면 튜터가 돌아온 표현부터 꺼냅니다.', sub: '복습 시간표를 따로 열지 않습니다.', shot: 'home-review', day: 1, next: '7일 뒤로' },
    { key: 'day7', when: '7일 뒤', say: '맞혔다고 끝이 아닙니다. 같은 항목을 처음 보는 문제로 다시 확인합니다.', sub: '앞 칸의 결과는 그대로 남아 있습니다.', shot: 'followups-d7', day: 7, next: '30일 뒤로' },
    { key: 'day30', when: '30일 뒤', say: '마지막 칸입니다. 한 번의 결과로 판단하지 않고 칸마다 결과를 남깁니다.', sub: '날짜를 놓친 칸은 「기간 지남」으로 남을 뿐, 쌓이지 않습니다.', shot: 'followups-d30', day: 30, next: '내 위치 보기' },
    { key: 'where', when: '내 위치', say: '점수 말고 근거로 봅니다.', sub: '언제, 어디서, 혼자 맞혔는지가 줄로 남습니다. 게임 · 생활 레슨 · 짧은 진단의 답이 한 기록입니다.', shot: 'evidence', day: 30 },
  ],
  again: '처음부터 다시',
  shots: { start: 'lesson-first', right: 'review-list-right', wrong: 'lesson-wrong', scene: 'review-scene', done: 'review-done' },
};
const shotNames = [...new Set([...Object.values(TRY.shots), ...TRY.steps.map(s => s.shot)])];
const B = () => `<section class="lt" id="learner" aria-labelledby="learner-title" data-try><div class="wrap">
<script type="application/json" data-try-data>${JSON.stringify(TRY)}</script>
<div class="lt-grid"><div class="lt-main">
${labelTag(['In SYNK WORLD', '직접 풀어 보기'])}<h2 class="h2" id="learner-title"><span>한 문제만 풀어 보세요.</span> <span>30일을 빨리 감아 드립니다</span></h2>
<div class="lt-try">
<p class="lt-when" data-when></p>
<p class="lt-context" data-context lang="ko"></p>
<p class="lt-prompt" data-prompt lang="ko"></p>
<div class="lt-choices" data-choices></div>
<div class="lt-out" data-out aria-live="polite"></div>
</div>
<div class="lt-rail">${rail({ live: true })}</div>
</div>
<figure class="lt-phone"><span class="lt-frame">${shotNames.map((n, i) => `<img data-shot="${n}"${i ? '' : ' class="is-on"'} src="${src(n)}" width="780" height="1688" alt="" loading="${i ? 'lazy' : 'eager'}" decoding="async">`).join('')}</span><figcaption class="lt-cap">${esc(COPY.cap)}</figcaption></figure>
</div>
<div class="lt-foot"><a class="btn btn-light" href="${COPY.go.href}">${esc(COPY.go.label)} <span class="arr" aria-hidden="true">${COPY.go.arrow}</span></a><a class="link" href="${COPY.more.href}">${esc(COPY.more.label)} <span class="arr" aria-hidden="true">${COPY.more.arrow}</span></a></div>
<p class="lt-note">${esc(COPY.note)} 이 쪽에서 고른 답은 어디에도 저장하지 않습니다.</p>
</div></section>`;

const out = {
  'a-home': A.home, 'a-atlas': A.atlas, 'a-lab': A.lab,
  'b-home': B(),
  'b-atlas': B() + `\n<section class="section ln"><div class="wrap">${linesTag()}${whyTag()}</div></section>`,
  'b-lab': B(),
};
for (const [k, v] of Object.entries(out)) fs.writeFileSync(path.join(here, `${k}.html`), v + '\n');
console.log(Object.keys(out).join(' '));
