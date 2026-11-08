// synk.im 「쓸수록 달라지는 것」 시안 동작(2026-11-08). 스크립트가 없으면 안 A는 모두 펼쳐 보이고, 안 B는 첫 문제와 30일 선만 보인다.
// 안 B의 일정은 SYNK WORLD 코드와 같은 규칙이다: 틀림 1분 뒤 · 처음 맞힘 내일(experiences/synk-world-app/life-progress.mjs), 틀린 답도 1 · 7 · 30일 확인의 첫 기록(atlas/temper.js).

/* ── 안 A: 물음을 고르면 그 물음의 답과 실제 화면. 좁은 화면은 옆으로 넘기는 줄(모두 펼침). ── */
const narrow = matchMedia('(max-width:900px)');
for (const list of document.querySelectorAll('.ln-qs')) {
  const rows = [...list.querySelectorAll('.ln-q')];
  const pick = (row, focus = false) => {
    for (const r of rows) {
      const on = r === row;
      r.classList.toggle('is-on', on);
      r.querySelector('.ln-btn').setAttribute('aria-expanded', on ? 'true' : 'false');
    }
    if (focus) row.querySelector('.ln-btn').focus();
  };
  rows.forEach((row, i) => {
    const b = row.querySelector('.ln-btn');
    b.addEventListener('click', () => { if (!narrow.matches) pick(row); });
    b.addEventListener('keydown', e => {
      if (narrow.matches) return;
      const n = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: rows.length - 1 }[e.key];
      if (n === undefined) return;
      e.preventDefault();
      pick(rows[(n + rows.length) % rows.length], true);
    });
  });
  const mode = () => {
    for (const r of rows) {
      const b = r.querySelector('.ln-btn');
      if (narrow.matches) { b.setAttribute('tabindex', '-1'); b.setAttribute('aria-expanded', 'true'); }
      else { b.removeAttribute('tabindex'); b.setAttribute('aria-expanded', r.classList.contains('is-on') ? 'true' : 'false'); }
    }
  };
  narrow.addEventListener('change', mode); mode();
  // 좁은 화면의 몇 번째 칸인지
  const count = list.parentElement.querySelector('[data-ln-count]');
  if (count) {
    const total = String(rows.length).padStart(2, '0');
    list.addEventListener('scroll', () => {
      const mid = list.scrollLeft + list.clientWidth / 2;
      let best = 0, gap = Infinity;
      rows.forEach((r, i) => { const d = Math.abs(r.offsetLeft + r.offsetWidth / 2 - mid); if (d < gap) { gap = d; best = i; } });
      count.textContent = `${String(best + 1).padStart(2, '0')} / ${total}`;
    }, { passive: true });
  }
}

/* ── 안 B: 한 문제를 풀고 30일을 빨리 감는다 ── */
for (const stage of document.querySelectorAll('[data-try]')) {
  const Q = JSON.parse(stage.querySelector('[data-try-data]').textContent);
  const $ = s => stage.querySelector(s);
  const when = $('[data-when]'), context = $('[data-context]'), prompt = $('[data-prompt]'), box = $('[data-choices]'), out = $('[data-out]');
  const shots = [...stage.querySelectorAll('[data-shot]')];
  const rail = $('[data-rail]');
  const show = name => { for (const i of shots) i.classList.toggle('is-on', i.dataset.shot === name); };
  const setNow = day => rail.style.setProperty('--now', String(day / 30));
  // review: 복습 일정이 정해졌는가(맞힌 뒤에만) · check: 1 · 7 · 30일 확인이 잡혔는가(틀린 답도 첫 기록이다)
  const paint = ({ review = false, check = false, day = 0 } = {}) => {
    rail.dataset.review = review ? 'on' : 'off';
    rail.dataset.check = check ? 'on' : 'off';
    setNow(day);
    for (const m of rail.querySelectorAll('[data-day]')) m.classList.toggle('is-past', Number(m.dataset.day) <= day && day > 0);
  };
  const button = (label, fn, cls = 'lt-next') => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.innerHTML = label;
    b.addEventListener('click', fn);
    return b;
  };
  const say = (html, ...buttons) => {
    out.innerHTML = '';
    if (html) { const p = document.createElement('p'); p.innerHTML = html; out.append(p); }
    if (buttons.length) { const row = document.createElement('div'); row.className = 'lt-out-btns'; row.append(...buttons); out.append(row); }
  };
  const ask = (q, done) => {
    when.textContent = q.when; context.textContent = q.context; context.hidden = false; prompt.textContent = q.prompt; prompt.classList.remove('is-say');
    box.innerHTML = ''; box.hidden = false;
    for (const c of q.choices) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'lt-choice'; b.textContent = c.text;
      b.addEventListener('click', () => {
        const right = c.id === q.answerId;
        for (const x of box.children) x.disabled = true;
        b.classList.add(right ? 'is-right' : 'is-wrong');
        if (!right) [...box.children].find(x => x.textContent === q.choices.find(y => y.id === q.answerId).text)?.classList.add('is-right');
        done(right);
      });
      box.append(b);
    }
  };
  const arrow = '<span aria-hidden="true">→</span>';
  const step = i => {
    const s = Q.steps[i];
    when.textContent = s.when; context.hidden = true; box.hidden = true; box.innerHTML = '';
    prompt.textContent = s.say; prompt.classList.add('is-say');
    show(s.shot); paint({ review: true, check: true, day: s.day });
    if (s.next) say(s.sub, button(`${s.next} ${arrow}`, () => step(i + 1)));
    else say(s.sub, button(Q.again, first, 'lt-again'));
  };
  const second = () => {
    show(Q.shots.scene);
    ask(Q.second, right => {
      if (right) { show(Q.shots.done); paint({ review: true, check: true }); say(Q.backRight, button(`${Q.toDay1} ${arrow}`, () => step(0))); }
      else say(Q.backWrong, button(`${Q.toMinute} ${arrow}`, second));
    });
    say('');
  };
  function first() {
    paint(); show(Q.shots.start);
    ask(Q.first, right => {
      if (right) { show(Q.shots.right); paint({ review: true, check: true }); say(Q.right, button(`${Q.toDay1} ${arrow}`, () => step(0))); }
      else { show(Q.shots.wrong); paint({ review: false, check: true }); say(Q.wrong, button(`${Q.toMinute} ${arrow}`, second)); }
    });
    say(Q.hint);
  }
  first();
}
