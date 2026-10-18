// 모델 고르기의 판단만 모은 곳. 화면(app.js)과 빌드(build-site.cjs)와 시험이 같은 함수를 쓴다.
// 브라우저에서는 전역 CastingLogic, Node에서는 require로 읽는다. DOM을 만지지 않는다.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CastingLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ASCII = /^[A-Za-z0-9 ]+$/;
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 글에서 낱말을 찾는다. 긴 낱말부터 찾고 찾은 자리는 지워서 「아이스크림」 안의 「크림」처럼 겹쳐 잡히지 않게 한다.
  // 영문 낱말(IT·AI·SUV)은 낱말 경계에서만 잡는다(OUTFIT의 IT를 잡지 않게).
  function findWords(text, entries) {
    let rest = ' ' + String(text || '') + ' ';
    const found = [];
    const sorted = entries.slice().sort((a, b) => b.word.length - a.word.length);
    for (const e of sorted) {
      const re = ASCII.test(e.word)
        ? new RegExp('(^|[^A-Za-z0-9])' + escapeRe(e.word) + '(?=[^A-Za-z0-9]|$)', 'gi')
        : new RegExp(escapeRe(e.word), 'g');
      let hit = false;
      rest = rest.replace(re, (m) => { hit = true; return ' '.repeat(m.length); });
      if (hit) found.push(e);
    }
    return found;
  }

  // 모델의 업종 문구(fits)와 인상(impression)·콘셉트를 분류 id로 바꾼다. 새 모델은 문구만 적으면 저절로 분류된다.
  function tagModel(model, taxonomy) {
    const fits = model.fits || [];
    const industries = [], fitsBy = {};
    for (const ind of taxonomy.industries) {
      const hits = fits.filter((f) => ind.fits.some((w) => f.includes(w)));
      if (hits.length) { industries.push(ind.id); fitsBy[ind.id] = hits; }
    }
    const words = [...(model.impression || []), model.concept || ''].filter(Boolean);
    const moods = [], moodBy = {};
    for (const mood of taxonomy.moods) {
      const hits = words.filter((w) => mood.match.some((m) => w.includes(m)));
      if (hits.length) { moods.push(mood.id); moodBy[mood.id] = [...new Set(hits)]; }
    }
    return { industries, fitsBy, moods, moodBy };
  }

  const heightBand = (cm) => (Number(cm) > 0 ? Math.floor(Number(cm) / 10) * 10 + 'cm대' : '');

  // 거르기. 값이 ''이거나 '전체'면 그 조건은 보지 않는다.
  function filterModels(models, f) {
    const on = (v) => v && v !== '전체';
    return models.filter((m) =>
      (!on(f.gender) || m.gender === f.gender)
      && (!on(f.age) || m.ageBand === f.age)
      && (!on(f.concept) || m.concept === f.concept)
      && (!on(f.industry) || (m.industries || []).includes(f.industry))
      && (!on(f.height) || heightBand(m.height) === f.height));
  }

  // 브리프 읽기: 고른 업종·분위기 + 제품 설명 속 낱말.
  function readBrief(brief, taxonomy) {
    const inds = new Map(), moods = new Map();
    const add = (map, id, w, word) => {
      const cur = map.get(id) || { weight: 0, words: [], picked: false };
      cur.weight = Math.max(cur.weight, w);
      if (word) cur.words.push(word); else cur.picked = true;
      map.set(id, cur);
    };
    if (brief.industry) add(inds, brief.industry, 3);
    for (const id of brief.moods || []) add(moods, id, 2);
    const entries = [];
    for (const ind of taxonomy.industries) for (const word of ind.words) entries.push({ word, kind: 'industry', id: ind.id });
    for (const mood of taxonomy.moods) for (const word of mood.words) entries.push({ word, kind: 'mood', id: mood.id });
    for (const e of findWords(brief.product, entries)) {
      if (e.kind === 'industry') add(inds, e.id, 2, e.word); else add(moods, e.id, 1, e.word);
    }
    // 세부 분야: 「아이스크림」은 식음료 중에서도 「디저트」라서 업종 문구에 「디저트」가 있는 모델을 한 칸 더 올린다
    const subs = new Map();
    for (const ind of taxonomy.industries) {
      const keys = Object.entries(ind.sub || {}).filter(([, words]) => findWords(brief.product, words.map((word) => ({ word }))).length).map(([k]) => k);
      if (keys.length) subs.set(ind.id, keys);
    }
    // 설명에 「남성·여자」 같은 말이 있으면 그 성별 모델을 한 칸 더 올린다(성별을 직접 고르면 그쪽이 우선)
    let gender = '', genderWord = '';
    for (const [g, words] of Object.entries(taxonomy.genderWords || {})) {
      const hit = findWords(brief.product, words.map((word) => ({ word })));
      if (hit.length) { gender = gender ? 'both' : g; genderWord = hit[0].word; }
    }
    return gender && gender !== 'both' ? { inds, moods, subs, gender, genderWord } : { inds, moods, subs, gender: '', genderWord: '' };
  }

  const briefIsEmpty = (b) => !b || (!b.industry && !(b.moods || []).length && !String(b.product || '').trim());

  // 추천: 업종 3점(설명에서 찾은 업종 2점) · 설명에 세부 분야가 있으면 맞는 모델 +1, 안 맞는 모델은 그 업종으로 고르지 않음
  // · 분위기 2점(설명에서 찾은 분위기 1점) · 그 업종 사진이 있으면 0.5점. 같은 점수는 명단 순서.
  // 성별·나이대를 고르면 그 안에서만 찾고, 성별을 안 골랐어도 설명에 「여성 니트」처럼 성별이 있으면 그 성별 안에서 찾는다.
  function recommend(models, brief, taxonomy, n = 3) {
    if (briefIsEmpty(brief)) return [];
    const { inds, moods, subs, gender } = readBrief(brief, taxonomy);
    const label = (list, id) => (list.find((x) => x.id === id) || {}).label || id;
    const out = [];
    models.forEach((m, order) => {
      if ((brief.gender || gender) && m.gender !== (brief.gender || gender)) return;
      if (brief.age && m.ageBand !== brief.age) return;
      let score = 0;
      const reasons = [];
      const matchedInds = [];
      for (const [id, v] of inds) {
        if (!(m.industries || []).includes(id)) continue;
        const fits = (m.fitsBy || {})[id] || [];
        const subFit = fits.find((f) => (subs.get(id) || []).some((k) => f.includes(k)));
        // 설명에 세부 분야(라떼 → 음료·카페)가 있는데 이 모델의 업종 문구가 그 분야가 아니면(위스키·주류) 이 업종으로는 고르지 않는다
        if (subs.has(id) && !subFit) continue;
        score += v.weight + (subFit ? 1 : 0); matchedInds.push(id);
        const fit = subFit || fits[0] || label(taxonomy.industries, id);
        if (!reasons.some((r) => r.text === `${fit} 광고에 어울려요`)) reasons.push({ kind: 'industry', id, text: `${fit} 광고에 어울려요`, words: v.words });
      }
      for (const [id, v] of moods) {
        if (!(m.moods || []).includes(id)) continue;
        score += v.weight;
        const words = ((m.moodBy || {})[id] || []).filter((w) => w !== m.concept);
        reasons.push({ kind: 'mood', id, text: words.length ? `${words.join('·')} 인상이에요` : `${label(taxonomy.moods, id)} 콘셉트예요`, words: v.words });
      }
      if (score <= 0) return;
      const evidence = evidenceFor(m, matchedInds.length ? matchedInds : [...inds.keys()]);
      if (evidence && matchedInds.length) score += 0.5;
      out.push({ model: m, score, reasons, evidence, order, strong: reasons.some((r) => r.kind === 'industry') && reasons.some((r) => r.kind === 'mood') });
    });
    out.sort((a, b) => b.score - a.score || a.order - b.order);
    return out.slice(0, n);
  }

  // 그 업종이 붙은 사진 중 첫 장(장면 사진이 먼저, 그다음 광고 장면·손·룩).
  function evidenceFor(model, industryIds) {
    for (const id of industryIds) {
      const hit = (model.tagged || []).find((t) => (t.tags || []).includes(id));
      if (hit) return hit;
    }
    return null;
  }

  // 받침이 있으면 첫째, 없으면 둘째 조사. 한글이 아니면 둘 다 적는다.
  function josa(word, a, b) {
    const ch = String(word || '').trim().slice(-1);
    const code = ch.charCodeAt(0) - 0xac00;
    if (code < 0 || code > 11171) return `${a}(${b})`;
    return code % 28 ? a : b;
  }

  const joinDot = (...xs) => xs.filter(Boolean).join(' · ');

  function modelLine(m) {
    return `${m.code} ${m.name} (${joinDot(m.gender, m.age || m.ageBand, m.concept, m.height && m.height + 'cm')})`;
  }

  // 문의용 글. format: 'kmong'(크몽 메시지) | 'order'(발주서 「장면·모델」 메모)
  function inquiryText({ picks, models, brief, compare, taxonomy, format = 'kmong' }) {
    const byCode = (c) => models.find((m) => m.code === c);
    const chosen = (picks || []).map((p) => ({ p, m: byCode(p.code) })).filter((x) => x.m);
    const others = (compare || []).filter((c) => !chosen.some((x) => x.m.code === c)).map(byCode).filter(Boolean);
    const lines = [];
    const hairOf = (x) => x.m.hair[x.p.hair] ? `${x.p.hair + 1}번 ${x.m.hair[x.p.hair].label}` : '';
    const voiceOf = (x) => x.m.voices[x.p.voice] ? `${x.p.voice + 1}번 ${x.m.voices[x.p.voice].label}` : '';
    const briefBits = [];
    if (brief && brief.touched && !briefIsEmpty(brief)) {
      const ind = taxonomy.industries.find((i) => i.id === brief.industry);
      if (ind) briefBits.push(['업종', ind.label]);
      if (String(brief.product || '').trim()) briefBits.push(['제품·서비스', String(brief.product).trim()]);
      const ms = (brief.moods || []).map((id) => (taxonomy.moods.find((x) => x.id === id) || {}).label).filter(Boolean);
      if (ms.length) briefBits.push(['분위기', ms.join(', ')]);
    }
    if (format === 'order') {
      chosen.forEach((x, i) => {
        lines.push(`[모델 ${i + 1}] ${modelLine(x.m)}`);
        if (hairOf(x)) lines.push(`헤어: ${hairOf(x)}`);
        if (voiceOf(x)) lines.push(`목소리: ${voiceOf(x)}`);
        if (x.p.line) lines.push(`대사: ${x.p.line.replace(/\s+/g, ' ').trim()}`);
        if (x.p.memo) lines.push(`메모: ${x.p.memo.replace(/\s+/g, ' ').trim()}`);
      });
      if (others.length) lines.push(`[함께 비교한 모델] ${others.map((m) => `${m.code} ${m.name}`).join(', ')}`);
      if (briefBits.length) lines.push(`[광고] ${briefBits.map(([, v]) => v).join(' · ')}`);
      return lines.join('\n');
    }
    const blocks = [['안녕하세요. PULSE 모델 캐스팅북을 보고 문의드려요.']];
    if (chosen.length) {
      const b = ['[고른 모델]'];
      chosen.forEach((x, i) => {
        b.push(`${i + 1}. ${modelLine(x.m)}`);
        const hv = [hairOf(x) && `헤어 ${hairOf(x)}`, voiceOf(x) && `목소리 ${voiceOf(x)}`].filter(Boolean).join(' / ');
        if (hv) b.push(`   ${hv}`);
        if (x.p.line) b.push(`   이 목소리로 들어 보고 싶은 문장: “${x.p.line.replace(/\s+/g, ' ').trim()}”`);
        if (x.p.memo) b.push(`   메모: ${x.p.memo.replace(/\s+/g, ' ').trim()}`);
      });
      blocks.push(b);
    }
    if (others.length) blocks.push([`[함께 비교한 모델] ${others.map((m) => `${m.code} ${m.name}`).join(', ')}`]);
    if (briefBits.length) blocks.push(['[광고 내용]', ...briefBits.map(([k, v]) => `${k}: ${v}`)]);
    blocks.push(['상담에서 함께 정하고 싶은 것: 사용 매체와 기간, 업종 전속 여부, 사진·영상 수량']);
    return blocks.map((b) => b.join('\n')).join('\n\n');
  }

  // 같은 성별 모델 사이에서 이 값이 어디쯤인지(가장 작음·가장 큼·사이).
  function rankAmong(models, model, pick) {
    const peers = models.filter((m) => m.gender === model.gender && pick(m) != null);
    const v = pick(model);
    if (v == null || peers.length < 2) return null;
    const vals = peers.map(pick);
    const min = Math.min(...vals), max = Math.max(...vals);
    return { min, max, value: v, count: peers.length, lowest: v === min, highest: v === max };
  }

  return { findWords, tagModel, heightBand, filterModels, readBrief, briefIsEmpty, recommend, evidenceFor, josa, inquiryText, rankAmong };
});
