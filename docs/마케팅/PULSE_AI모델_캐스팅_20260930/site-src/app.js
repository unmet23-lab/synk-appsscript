(function () {
  'use strict';
  const D = JSON.parse(document.getElementById('data').textContent);
  const $ = (s, r = document) => r.querySelector(s);
  const E = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEY = 'pulse-casting-picks-v1';
  const filters = { gender: '전체', age: '전체', concept: '전체' };
  let picks = load();
  let current = null;       // 열린 모델
  let lb = { list: [], i: 0 }; // 크게 보기
  const audio = new Audio();
  let playingBtn = null;

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(picks)); } catch { /* 저장이 막힌 브라우저에서도 화면은 그대로 쓴다 */ } }
  const byCode = (c) => D.models.find((m) => m.code === c);
  const pickOf = (c) => picks.find((p) => p.code === c);

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2400);
  }

  /* 첫 화면 */
  function renderHero() {
    const heroModels = D.models.slice(0, 3);
    const board = $('#board');
    board.classList.toggle('two', heroModels.length === 2);
    board.innerHTML = heroModels.map((m, i) => `<figure class="print p${i + 1}"><img src="${E(m.hero.s)}" alt="${E(m.code + ' ' + m.name)} 대표 사진" loading="eager"><figcaption>${E(m.code)} · ${E(m.name)}</figcaption></figure>`).join('');
    const shotCount = Math.max(...D.models.map((m) => m.shotCount));
    $('#facts').innerHTML = [[D.models.length + '명', '지금 고를 수 있는 모델'], [shotCount + '컷', '모델마다 보는 사진'], ['3가지', '모델마다 들어 보는 목소리']]
      .map(([b, s]) => `<li><b class="tabnum">${E(b)}</b><span>${E(s)}</span></li>`).join('');
    $('#updated').textContent = D.updated + ' 기준';
    $('#info-table').innerHTML = D.infoRows.map(([k, v]) => `<div class="info-row"><dt>${E(k)}</dt><dd>${E(v)}</dd></div>`).join('');
  }

  /* 거르기와 카드 */
  const join = (...xs) => xs.filter(Boolean).join(' · ');
  function renderFilters() {
    const concepts = ['상큼', '섹시', '지적', ...new Set(D.models.map((m) => m.concept))].filter((c, i, a) => c && a.indexOf(c) === i);
    const groups = [['gender', '성별', ['전체', '남', '여']], ['age', '나이', ['전체', '10대', '20대', '30대']], ['concept', '콘셉트', ['전체', ...concepts]]];
    $('#filters').innerHTML = groups.map(([k, label, opts]) => `<div class="filter-group"><span class="label">${E(label)}</span>${opts.map((o) => `<button type="button" class="chip" data-f="${k}" data-v="${E(o)}" aria-pressed="${filters[k] === o}">${E(o)}</button>`).join('')}</div>`).join('');
  }
  function renderGrid() {
    const list = D.models.filter((m) => (filters.gender === '전체' || m.gender === filters.gender) && (filters.age === '전체' || m.ageBand === filters.age) && (filters.concept === '전체' || m.concept === filters.concept));
    $('#result-note').textContent = `${list.length}명의 모델`;
    $('#grid').innerHTML = list.length ? list.map((m) => `
      <button type="button" class="card" data-open="${E(m.code)}" aria-label="${E(m.code + ' ' + m.name)} 자세히 보기">
        <div class="photo">
          <img src="${E(m.hero.s)}" srcset="${E(m.hero.s)} 1x, ${E(m.hero.l)} 2x" alt="" loading="lazy">
          ${m.alt ? `<img class="alt" src="${E(m.alt.s)}" srcset="${E(m.alt.s)} 1x, ${E(m.alt.l)} 2x" alt="" loading="lazy">` : ''}
          <span class="code">${E(m.code)}</span>
          ${pickOf(m.code) ? '<span class="picked">선택함</span>' : m.realPerson ? '<span class="picked real">실제 인물</span>' : ''}
        </div>
        <div class="meta">
          <div class="name">${E(m.name)} <small>${E(join(m.gender, m.age, m.height && m.height + 'cm'))}</small></div>
          <div class="line">${E(m.impression.join(' · '))}</div>
          <div class="tags"><span class="tag">${E(m.concept)}</span>${m.fits.slice(0, 2).map((f) => `<span class="tag plain">${E(f)}</span>`).join('')}</div>
        </div>
      </button>`).join('')
      : '<div class="empty">조건에 맞는 모델이 아직 없어요. 필요한 모델의 성별·나이·분위기를 알려 주시면 새로 만들어 드려요.</div>';
  }

  /* 모델 창 */
  const shotFig = (s, idx, cls = '') => s
    ? `<figure class="shot ${cls}"><button type="button" data-lb="${idx}" aria-label="${E(s.label)} 크게 보기"><img src="${E(s.s)}" alt="${E(current.code + ' ' + s.label)}" loading="lazy"></button><figcaption>${E(s.label)}<span>${E(s.en || '')}</span></figcaption></figure>`
    : '<figure class="shot missing"><div class="ph">준비 중</div></figure>';

  function openModel(code, push = true) {
    const m = byCode(code); if (!m) return;
    current = m;
    lb.list = m.gallery;
    const idx = (k) => m.gallery.findIndex((g) => g.key === k || g.alias === k);
    const sec = (id, title, en, why, cls, keys, figCls = '') => `
      <section class="shots" id="s-${id}" aria-labelledby="h-${id}">
        <h3 id="h-${id}">${E(title)} <small>${E(en)}</small></h3>
        <p class="why">${E(why)}</p>
        <div class="shot-row ${cls}">${keys.map((k) => shotFig(m.shots[k], idx(k), figCls)).join('')}</div>
      </section>`;
    const p = pickOf(m.code) || { hair: 0, voice: 0, memo: '' };
    const sheet = $('#sheet');
    sheet.innerHTML = `
      <div class="sheet">
        <div class="sheet-bar">
          <h2 id="sheet-title">${E(m.code)} ${E(m.name)} <small>${E(join(m.gender, m.age, m.concept))}</small></h2>
          <div class="acts"><a class="btn primary pick-in" href="#choose">이 모델 고르기</a><button type="button" class="icon-btn" data-close aria-label="창 닫기">×</button></div>
        </div>
        <div class="sheet-body">
          <div class="sheet-main">
            <nav class="jump" aria-label="모델 사진 구역">
              <a href="#s-angle">앞뒤좌우</a><a href="#s-face">표정</a><a href="#s-hair">헤어</a><a href="#s-body">전신·룩</a><a href="#s-detail">디테일·장면</a><a href="#voices">목소리</a>
            </nav>
            ${sec('angle', '앞뒤좌우', 'ANGLES', '옆모습과 뒷모습에서도 같은 사람으로 보이는지, 헤어 뒷모양은 어떤지 확인하세요.', 'c4', ['angle-front', 'angle-left', 'angle-right', 'angle-back'])}
            ${sec('face', '표정', 'EXPRESSIONS', '상황극이나 리액션 광고라면 감정 표현이 자연스러운지 보세요.', 'c4', ['hero', 'exp-smile', 'exp-angry', 'exp-surprised'])}
            ${sec('hair', '헤어', 'HAIR', '얼굴은 그대로 두고 헤어만 바꿨어요. 오른쪽에서 원하는 헤어를 고를 수 있어요.', 'c3', ['hair-1', 'hair-2', 'hair-3'])}
            ${sec('body', '전신·룩', 'FULL BODY & LOOKS', '옷 광고와 룩북은 전신 비율과 옷 태가 중요해요. 오른쪽 신체 정보와 함께 보세요.', 'c3', ['fullbody', 'look-1', 'look-2'], 'tall')}
            ${sec('detail', '디테일·광고 장면', 'DETAILS & SCENE', '뷰티 광고의 확대 컷, 제품을 드는 손, 실제 광고 장면에서의 느낌이에요.', 'c3', ['skin', 'hands', 'context'], 'wide')}
          </div>
          <aside class="side" aria-label="모델 정보">
            <div class="side-sticky">
              <div class="panel">
                <h3>신체 정보</h3>
                ${m.realPerson ? '<p class="real-note">SYNK 대표 본인의 얼굴로, 본인 동의를 받아 AI로 만든 모델이에요. 신체 정보는 본인이 알려 준 값이에요.</p>' : ''}
                <dl class="spec tabnum">
                  ${[['나이대', m.age], ['키', m.height && m.height + 'cm'], ['체형', m.build], ['옷 사이즈', join(m.sizes.top && '상의 ' + m.sizes.top, m.sizes.bottom && '하의 ' + m.sizes.bottom)], ['신발', m.sizes.shoe && m.sizes.shoe + 'mm'], ['피부 톤', m.skin], ['눈', m.eyes], ['기본 헤어', m.hairBase]]
                    .filter(([, v]) => v).map(([k, v]) => `<dt>${E(k)}</dt><dd>${E(v)}</dd>`).join('')}
                </dl>
                <div class="keywords"><div><span>인상</span>${E(m.impression.join(', '))}</div><div><span>어울리는 업종</span>${E(m.fits.join(', '))}</div></div>
              </div>
              <div class="panel" id="voices">
                <h3>목소리 3가지</h3>
                ${m.voices.map((v, i) => `<div class="voice"><button type="button" class="play" data-voice="${i}" aria-pressed="false" aria-label="목소리 ${i + 1} ${E(v.label)} 듣기">${svgPlay}</button><div class="v-text"><b>목소리 ${i + 1} · ${E(v.label)}</b><small>${E(v.note)}</small>${v.text ? `<small class="v-line">“${E(v.text)}”</small>` : ''}</div></div>`).join('')}
                ${m.script ? `<p class="script">읽은 문장: “${E(m.script)}”</p>` : ''}
              </div>
              <form class="panel choose" id="choose">
                <h3>이 조합으로 고르기</h3>
                <fieldset><legend>헤어</legend><div class="opts">${m.hair.map((h, i) => `<label class="opt"><input type="radio" name="hair" id="hair-${i}" value="${i}" ${i === p.hair ? 'checked' : ''}><span>${i + 1} · ${E(h.label)}</span></label>`).join('')}</div></fieldset>
                <fieldset><legend>목소리</legend><div class="opts">${m.voices.map((v, i) => `<label class="opt"><input type="radio" name="voice" id="voice-${i}" value="${i}" ${i === p.voice ? 'checked' : ''}><span>${i + 1} · ${E(v.label)}</span></label>`).join('')}</div></fieldset>
                <label for="memo" class="legend" style="font-weight:750;font-size:14.5px;display:block;margin-bottom:8px">메모 <span style="font-weight:500;color:var(--faint)">(선택)</span></label>
                <textarea id="memo" name="memo" placeholder="예: 헤어는 1번인데 조금 더 짧게, 목소리는 2번 톤으로">${E(p.memo)}</textarea>
                <button class="btn primary" type="submit">${pickOf(m.code) ? '선택 내용 고치기' : '선택 목록에 담기'}</button>
                <p class="done" id="choose-done" role="status"></p>
              </form>
            </div>
          </aside>
        </div>
      </div>`;
    if (!sheet.open) sheet.showModal();
    sheet.scrollTop = 0;
    if (push) try { history.replaceState(null, '', '#' + m.code); } catch { /* 주소를 못 바꿔도 창은 연다 */ }
  }
  function closeModel() {
    stopAudio();
    const sheet = $('#sheet'); if (sheet.open) sheet.close();
    current = null;
    try { history.replaceState(null, '', '#models'); } catch { /* 무시 */ }
  }

  /* 목소리 */
  const svgPlay = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>';
  const svgStop = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="3.5" width="9" height="9" rx="1.5" fill="currentColor"/></svg>';
  function stopAudio() {
    audio.pause();
    if (playingBtn) { playingBtn.setAttribute('aria-pressed', 'false'); playingBtn.innerHTML = svgPlay; playingBtn = null; }
  }
  function toggleVoice(btn) {
    const v = current.voices[Number(btn.dataset.voice)];
    if (playingBtn === btn) { stopAudio(); return; }
    stopAudio();
    audio.src = v.src; audio.currentTime = 0;
    audio.play().then(() => { playingBtn = btn; btn.setAttribute('aria-pressed', 'true'); btn.innerHTML = svgStop; })
      .catch(() => toast('소리를 재생하지 못했어요. 다시 눌러 주세요.'));
  }
  audio.addEventListener('ended', stopAudio);

  /* 크게 보기 */
  function openLb(i) {
    lb.i = i; const el = $('#lightbox'); el.hidden = false; drawLb();
    $('#lb-close', el)?.focus();
  }
  function drawLb() {
    const g = lb.list[lb.i]; const el = $('#lightbox');
    el.innerHTML = `<div class="lb-top"><span>${E(current.code)} ${E(current.name)} · ${E(g.label)} <span class="tabnum" style="opacity:.7">${lb.i + 1} / ${lb.list.length}</span></span><button type="button" class="icon-btn" id="lb-close" aria-label="크게 보기 닫기">×</button></div>
      <div class="lb-img"><img src="${E(g.l)}" alt="${E(current.code + ' ' + g.label)}"></div>
      <div class="lb-nav"><button type="button" id="lb-prev">이전 사진</button><button type="button" id="lb-next">다음 사진</button></div>`;
  }
  function closeLb() { $('#lightbox').hidden = true; }

  /* 내 선택 */
  function renderCount() { $('#pick-count').textContent = picks.length; }
  function pickText() {
    const lines = ['[SYNK PULSE AI 모델 선택]'];
    picks.forEach((p, i) => {
      const m = byCode(p.code); if (!m) return;
      lines.push(`${i + 1}. ${m.code} ${m.name} (${join(m.gender, m.age, m.concept)})`);
      lines.push(`   헤어: ${p.hair + 1}번 ${m.hair[p.hair]?.label || ''}`);
      lines.push(`   목소리: ${p.voice + 1}번 ${m.voices[p.voice]?.label || ''}`);
      if (p.memo) lines.push(`   메모: ${p.memo.replace(/\s+/g, ' ').trim()}`);
    });
    lines.push('', '상담에서 정할 것: 사용 매체와 기간, 업종 전속 여부, 사진·영상 수량');
    return lines.join('\n');
  }
  function openDrawer() {
    const d = $('#drawer');
    d.innerHTML = `<div class="drawer-head"><h2 id="drawer-title">내 선택 <span class="tabnum" style="color:var(--faint);font-size:15px">${picks.length}명</span></h2><button type="button" class="icon-btn" id="drawer-close" aria-label="내 선택 닫기">×</button></div>
      <div class="drawer-body">${picks.length ? picks.map((p) => { const m = byCode(p.code); if (!m) return ''; return `<div class="pick"><img src="${E(m.hero.s)}" alt=""><div><h3>${E(m.code)} ${E(m.name)}</h3><p>헤어 ${p.hair + 1} · ${E(m.hair[p.hair]?.label)}<br>목소리 ${p.voice + 1} · ${E(m.voices[p.voice]?.label)}${p.memo ? `<br>메모: ${E(p.memo)}` : ''}</p><button type="button" class="rm" data-edit="${E(m.code)}">고치기</button> <button type="button" class="rm" data-rm="${E(m.code)}">빼기</button></div></div>`; }).join('')
        : '<p style="color:var(--muted);margin:0">아직 고른 모델이 없어요. 모델 창에서 헤어와 목소리를 고른 뒤 ‘선택 목록에 담기’를 눌러 주세요.</p>'}</div>
      <div class="drawer-foot">${picks.length ? `<label for="copy-out" style="font-weight:750;font-size:14.5px">보낼 내용</label><textarea class="copy-out" id="copy-out" readonly>${E(pickText())}</textarea><button type="button" class="btn primary" id="copy-btn">선택 내용 복사</button><p>복사한 내용을 크몽 메시지나 발주서 ‘장면·모델’ 메모에 붙여 넣어 주세요. 이 페이지에서 자동으로 보내지는 않아요.</p>` : ''}</div>`;
    d.hidden = false; $('#scrim').hidden = false;
    $('#drawer-close').focus();
  }
  function closeDrawer() { $('#drawer').hidden = true; $('#scrim').hidden = true; }

  /* 이벤트 */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a'); if (!t) return;
    if (t.dataset.f) { filters[t.dataset.f] = t.dataset.v; renderFilters(); renderGrid(); return; }
    if (t.dataset.open) { openModel(t.dataset.open); return; }
    if (t.hasAttribute('data-close')) { closeModel(); return; }
    if (t.dataset.voice !== undefined && t.classList.contains('play')) { toggleVoice(t); return; }
    if (t.dataset.lb !== undefined) { openLb(Number(t.dataset.lb)); return; }
    if (t.id === 'lb-close') { closeLb(); return; }
    if (t.id === 'lb-prev') { lb.i = (lb.i - 1 + lb.list.length) % lb.list.length; drawLb(); return; }
    if (t.id === 'lb-next') { lb.i = (lb.i + 1) % lb.list.length; drawLb(); return; }
    if (t.id === 'open-picks') { openDrawer(); return; }
    if (t.id === 'drawer-close') { closeDrawer(); return; }
    if (t.dataset.rm) { picks = picks.filter((p) => p.code !== t.dataset.rm); save(); renderCount(); renderGrid(); openDrawer(); return; }
    if (t.dataset.edit) { closeDrawer(); openModel(t.dataset.edit); return; }
    if (t.id === 'copy-btn') {
      const text = pickText();
      const fallback = () => { const ta = $('#copy-out'); ta.focus(); ta.select(); toast('글자가 선택됐어요. 복사해서 붙여 넣어 주세요.'); };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => toast('선택 내용을 복사했어요.'), fallback); else fallback();
      return;
    }
    if (t.classList.contains('pick-in')) { e.preventDefault(); $('#choose')?.scrollIntoView({ block: 'start' }); $('#hair-0')?.focus({ preventScroll: true }); return; }
    if (t.closest('.jump')) { e.preventDefault(); $(t.getAttribute('href'))?.scrollIntoView({ block: 'start' }); }
  });
  $('#scrim').addEventListener('click', closeDrawer);
  $('#sheet').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModel(); });
  $('#sheet').addEventListener('cancel', (e) => { if (!$('#lightbox').hidden) { e.preventDefault(); closeLb(); return; } stopAudio(); current = null; });
  $('#sheet').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target; const hair = Number(f.hair.value), voice = Number(f.voice.value), memo = f.memo.value.trim();
    const had = !!pickOf(current.code);
    picks = picks.filter((p) => p.code !== current.code).concat({ code: current.code, hair, voice, memo });
    save(); renderCount(); renderGrid();
    const last = current.name.charCodeAt(current.name.length - 1) - 0xac00;
    const josa = last >= 0 && last < 11172 && last % 28 ? '을' : '를';
    $('#choose-done').textContent = `${current.code} ${current.name}${josa} ${had ? '고쳐 담았어요' : '선택 목록에 담았어요'}. 위쪽 ‘내 선택’에서 확인할 수 있어요.`;
    f.querySelector('button[type=submit]').textContent = '선택 내용 고치기';
  });
  document.addEventListener('keydown', (e) => {
    if (!$('#lightbox').hidden) {
      if (e.key === 'Escape') { e.preventDefault(); closeLb(); }
      if (e.key === 'ArrowLeft') { lb.i = (lb.i - 1 + lb.list.length) % lb.list.length; drawLb(); }
      if (e.key === 'ArrowRight') { lb.i = (lb.i + 1) % lb.list.length; drawLb(); }
      return;
    }
    if (e.key === 'Escape' && !$('#drawer').hidden) closeDrawer();
  });

  renderHero(); renderFilters(); renderGrid(); renderCount();
  const h = (location.hash || '').slice(1);
  if (byCode(h)) openModel(h, false);
})();
