// 방향 제안 시안(2026-11-06). 서버 없이 도는 화면 시안이다. 자료는 오미톡 가상 주문.
(() => {
  const DIRECTIONS = {
    tok: {
      name: '톡',
      sentence: '캔 따는 소리 한 번에 코트 전체가 멈춰요.',
      flow: [
        ['0:00', '경기가 한창인 시끄러운 농구장.'],
        ['0:04', '한결이 캔을 따는 순간 톡. 공도 사람도 멈추고, 모두 한결을 봐요.'],
        ['0:10', '혼자 한 모금. “…왜요? 다섯 가지 맛인데.” 다시 경기. 다섯 가지 맛, 톡. 11월, 편의점에서.'],
      ],
      why: '처음 나오는 제품은 이름부터 남아야 해요. 「톡」이 소리와 그림으로 한 번에 남아요.',
      work: '유리결', film: './assets/film-gift.mp4',
      taste: './assets/taste-tok.mp4', tasteCap: '멈춘 코트에서 「…왜요?」까지 · 5초',
    },
    wait: {
      name: '아니, 잠깐',
      sentence: '맛을 설명하려다 말을 다섯 번 바꿔요.',
      flow: [
        ['0:00', '경기가 끝나고 친구 폰 앞. “이거 무슨 맛이야?”'],
        ['0:03', '한 모금마다 말이 바뀌어요. “달아. 아니, 새콤해. 어… 근데 끝이 알싸해?”'],
        ['0:11', '친구가 뺏어 마셔요. “달아. 아니, 잠깐…” 다섯 가지 맛, 톡. 11월, 편의점에서.'],
      ],
      why: '「다섯 가지 맛」이 대사로 풀려요. 친구 폰으로 찍은 결이라, 요청하신 「너무 광고 같지 않게」에 맞아요.',
      work: '매진 임박', film: './assets/film-maejin.mp4',
      taste: './assets/taste-wait.mp4', tasteCap: '말을 바꾸다 캔을 뺏기기까지 · 8초',
    },
  };
  const MODELS = [
    { id: 'm06', name: '한결' },
    { id: 'f02', name: '하린' },
    { id: 'm02', name: '태준' },
    { id: 'f11', name: '해인' },
  ];
  const DUE = '11월 9일(월) 18시';

  const root = document.querySelector('.dp');
  const detail = root.querySelector('[data-detail]');
  const goLabel = root.querySelector('[data-go-label]');
  const frames = [...root.querySelectorAll('[data-frame]')];
  const tabs = [...root.querySelectorAll('[data-pick]')];
  const moreBox = root.querySelector('[data-more-box]');
  const noteBox = root.querySelector('[data-note-box]');
  const views = Object.fromEntries([...root.querySelectorAll('[data-view]')].map((el) => [el.dataset.view, el]));
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = matchMedia('(max-width: 860px)');
  let focus = '';
  let modelOpen = false;
  let model = MODELS[0];
  let playing = '';
  let playingKind = '';

  const esc = (text) => String(text).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const withParticle = (name) => `${name}${(name.charCodeAt(name.length - 1) - 0xAC00) % 28 ? '으로' : '로'}`;
  const fade = (el, y = 8) => { if (!still && el.animate) el.animate([{ opacity: 0, transform: `translateY(${y}px)` }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)' }); };

  function stopFilm() {
    if (!playing) return;
    const frame = root.querySelector(`[data-frame="${playing}"]`);
    frame.querySelector('.dp-film')?.remove();
    frame.querySelector('.dp-film-cap')?.remove();
    playing = '';
  }
  function playFilm(id, kind) {
    const item = DIRECTIONS[id], frame = root.querySelector(`[data-frame="${id}"]`);
    stopFilm();
    const video = document.createElement('video');
    const taste = kind === 'taste';
    video.className = `dp-film${taste ? ' is-model' : ''}`;
    video.src = taste ? item.taste : item.film;
    // 미리 움직여 보기는 손님이 누른 순간이라 소리를 켜고 한 번만 튼다. 끝나면 그림으로 돌아간다.
    video.muted = !taste; video.loop = !taste; video.playsInline = true; video.autoplay = taste || !still;
    if (taste) video.addEventListener('ended', () => { stopFilm(); drawDetail(false); }, { once: true });
    const cap = document.createElement('span');
    cap.className = 'dp-film-cap sx-small';
    cap.textContent = taste ? `미리 움직여 본 첫 판 · ${item.tasteCap} · 소리 있음` : `「${item.work}」 · 가상 브랜드로 만든 자체 작품`;
    frame.append(video, cap);
    video.play?.().catch(() => { video.muted = true; video.play?.().catch(() => {}); });
    playing = id; playingKind = kind;
  }
  function modelRow() {
    const list = modelOpen ? `<div class="dp-casts" role="group" aria-label="다른 모델 고르기">${MODELS.map((item) => `<button type="button" class="dp-cast ${item.id === model.id ? 'is-on' : ''}" aria-pressed="${item.id === model.id}" data-model="${item.id}"><img src="./assets/model-scene-${item.id}.webp" alt="" width="538" height="720" loading="lazy"><span class="sx-small">${esc(item.name)}</span></button>`).join('')}</div>${model.id === MODELS[0].id ? '' : '<p class="sx-small dp-cast-note">이 모델로 바꿔 장면 이미지에서 보여 드려요.</p>'}` : '';
    const on = (kind) => playing === focus && playingKind === kind;
    return `<div class="dp-model"><button type="button" class="dp-taste" data-film="taste" aria-pressed="${on('taste')}"><span class="dp-taste-mark" aria-hidden="true">${on('taste') ? '<svg viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8"/></svg>' : '<svg viewBox="0 0 10 10"><path d="M2 0.5 9.5 5 2 9.5z"/></svg>'}</span><span><b>${on('taste') ? '그림으로 돌아가기' : '미리 움직여 보기'}</b><span class="sx-small">${esc(DIRECTIONS[focus].tasteCap)} · 소리 있음</span></span></button><div class="dp-model-row sx-small"><p><span class="dp-label">AI 모델</span><b>${esc(model.name)}</b><button type="button" class="sx-link dp-model-open" data-model-open aria-expanded="${modelOpen}">${modelOpen ? '닫기' : '다른 모델로'}</button></p><button type="button" class="sx-link" data-film="work" aria-pressed="${on('work')}">${on('work') ? '그림으로' : '비슷한 작품 보기'}</button></div>${list}</div>`;
  }
  function drawDetail(animate) {
    const item = DIRECTIONS[focus];
    detail.innerHTML = `<h1 class="sx-serif dp-title" tabindex="-1">${esc(item.name)}</h1><p class="sx-serif dp-sentence">${esc(item.sentence)}</p><ol class="dp-flow">${item.flow.map(([at, text]) => `<li><span class="sx-no">${at}</span><span class="sx-body">${esc(text)}</span></li>`).join('')}</ol><p class="sx-small dp-why">${esc(item.why)}</p>${modelRow()}`;
    goLabel.textContent = `「${item.name}」${withParticle(item.name).slice(item.name.length)} 정하고 글 콘티 받기`;
    if (animate) [...detail.children].forEach((child, index) => { if (!still && child.animate) child.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 460, delay: index * 36, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }); });
  }
  function setFocus(id, { animate = true } = {}) {
    if (id === focus) return;
    stopFilm();
    focus = id;
    root.dataset.focus = id;
    frames.forEach((frame) => frame.setAttribute('aria-pressed', String(frame.dataset.frame === id)));
    tabs.forEach((tab) => { const on = tab.dataset.pick === id; tab.classList.toggle('is-on', on); tab.setAttribute('aria-pressed', String(on)); });
    drawDetail(animate);
  }
  function show(state) {
    root.dataset.state = state;
    root.querySelector('[data-step-no]').textContent = state === 'done' && !views.done.querySelector('[data-road]').hidden ? '2/3' : '1/3';
    Object.entries(views).forEach(([name, el]) => { el.hidden = name !== state; });
    fade(views[state]);
    if (narrow.matches && state !== 'choose') views[state].scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
  }
  function done(kicker, title, sentence, text, { road = true, note = '' } = {}) {
    views.done.querySelector('[data-done-kicker]').textContent = kicker;
    views.done.querySelector('[data-done-title]').textContent = title;
    const line = views.done.querySelector('[data-done-sentence]'); line.textContent = sentence; line.hidden = !sentence;
    views.done.querySelector('[data-done-text]').textContent = text;
    const echo = views.done.querySelector('[data-done-note]'); echo.textContent = note ? `덧붙이신 말: ${note}` : ''; echo.hidden = !note;
    views.done.querySelector('[data-road]').hidden = !road;
    views.done.querySelector('[data-done-kv]').hidden = !road;
    stopFilm();
    show('done');
    views.done.querySelector('[data-done-title]').focus({ preventScroll: true });
  }

  root.addEventListener('click', (event) => {
    const hit = event.target.closest('[data-frame],[data-pick],[data-go],[data-neither],[data-back],[data-model],[data-model-open],[data-film],[data-more],[data-note-open]');
    if (!hit) return;
    if (hit.dataset.frame && root.dataset.state === 'choose') setFocus(hit.dataset.frame);
    if (hit.dataset.pick) setFocus(hit.dataset.pick);
    if (hit.hasAttribute('data-go')) {
      const item = DIRECTIONS[focus], note = noteBox.querySelector('input').value.trim();
      done('이 방향으로 정했어요', item.name, item.sentence, `글 콘티를 ${DUE}까지 보내 드릴게요. 보시고 마음에 드시면 그때 결제를 안내해 드려요.`, { note });
    }
    if (hit.hasAttribute('data-neither')) { stopFilm(); show('neither'); views.neither.querySelector('textarea').focus({ preventScroll: true }); drawDetail(false); }
    if (hit.hasAttribute('data-back')) show('choose');
    if (hit.hasAttribute('data-model-open')) { modelOpen = !modelOpen; detail.classList.toggle('is-casting', modelOpen); drawDetail(false); detail.querySelector('[data-model-open]').focus({ preventScroll: true }); }
    if (hit.dataset.model) { model = MODELS.find((item) => item.id === hit.dataset.model); drawDetail(false); detail.querySelector(`[data-model="${model.id}"]`).focus({ preventScroll: true }); }
    if (hit.dataset.film) { const kind = hit.dataset.film; if (playing === focus && playingKind === kind) stopFilm(); else playFilm(focus, kind); drawDetail(false); detail.querySelector(`[data-film="${kind}"]`).focus({ preventScroll: true }); }
    if (hit.hasAttribute('data-more')) { moreBox.hidden = !moreBox.hidden; hit.setAttribute('aria-expanded', String(!moreBox.hidden)); hit.textContent = moreBox.hidden ? '자세히' : '접기'; }
    if (hit.hasAttribute('data-note-open')) { noteBox.hidden = !noteBox.hidden; hit.setAttribute('aria-expanded', String(!noteBox.hidden)); if (!noteBox.hidden) noteBox.querySelector('input').focus({ preventScroll: true }); }
  });
  views.neither.addEventListener('submit', (event) => {
    event.preventDefault();
    done('말씀 고맙습니다', '다시 제안해 드릴게요', '', `주신 말씀으로 새 방향을 ${DUE}까지 보내 드릴게요.`, { road: false });
    event.target.reset();
  });
  setFocus('wait', { animate: false });
})();
