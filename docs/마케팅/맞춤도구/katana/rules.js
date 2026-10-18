/* synkbrief 뉴스 · 카타나 요청문 만들기 — 계산 규칙.
 * 원본: SYNK-appsscript/docs/마케팅/맞춤도구/katana/rules.js
 * 답 → 요청문, 어림 크레딧·상한·시간, 나의 순서, 설정 카드, 경고, 확인표, 사람마다 고른 팁.
 * 순수 함수다. 네트워크·AI 호출·기록이 없다. 사진은 받지 않는다. 기준 문서: 추천기준.md
 * 요청문의 뼈대는 10-13 실제로 결과가 나온 두 요청(제품 광고 42.12크레딧, 아우라 에딧 84.24크레딧)이다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkKatanaRules = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'katana-rules-v1-2026-10-13';
  const r = (t, src = 'synk') => ({ t, src });
  const list = v => (Array.isArray(v) ? v : []);

  const HERO = { product: '제품', food: '음식', character: '캐릭터', place: '공간', person: '사람' };
  const STYLE = { ad: '제품 광고', aura: '아우라 에딧', clip: '편집 영상', ref: '내가 고른 영상처럼' };
  const STYLE_NOUN = { ad: '제품 광고 영상', aura: '아우라 파밍 에딧', clip: '편집 영상', ref: '영상' };
  const INPUT = { one: '사진', many: '사진', video: '영상' };
  const INPUT_LABEL = { one: '사진 1장', many: '사진 2~5장', video: '직접 찍은 영상' };
  const RES = { p480: '480p', p720: '720p', p1080: '1080p' };
  // 초당 크레딧(카타나 가격표 2026-10-08 관측값, Seedance 2.5)
  const RATE = { p480: 3, p720: 7, p1080: 12 };
  const WHERE = {
    shorts: { label: '릴스·쇼츠·틱톡', ratio: '세로 9:16', len: [10, 15] },
    store: { label: '상세 페이지', ratio: '정사각 1:1', len: [6, 10] },
    wide: { label: '가로 영상', ratio: '가로 16:9', len: [10, 20] },
  };
  // 생성 배수: 화면에 쓰는 초 대비 생성하는 초. 새 장면 위주 1.3~2.5(10-13 실제 1.3·2.0배), 가진 영상 편집 0.3~1.0
  const FACTOR = { gen: [1.3, 2.5], clip: [0.3, 1.0] };
  const STILLS = 2;  // 장소 그림 몇 장(Soul Cinema 장당 0.12, 여유를 둔 값)
  const FEEL = {
    ad: '스튜디오 조명, 빛이 지나가는 장면, 질감 가까이, 마지막은 정면 한 컷',
    aura: '무심하게 멋있게. 바람, 역광, 느린 장면, 비트에 맞춘 컷 전환',
    clip: '붙인 영상의 쓸 만한 장면을 먼저 쓰고, 박자에 맞춰 자르고 색을 맞춰 줘. 새로 생성하는 장면은 꼭 필요할 때만',
    ref: '아래 레퍼런스의 리듬·전환·글자 쓰는 법만 빌리고 장면은 새로 만들어 줘',
  };
  const FEEL_REF_NOTEXT = '아래 레퍼런스의 리듬·전환만 빌리고 장면은 새로 만들어 줘';
  const HERO_LOCK = {
    product: '제품의 모양과 색은 사진 그대로',
    food: '음식의 재료·양·색은 사진 그대로',
    character: '캐릭터의 모양·색·무늬는 사진 그대로',
    place: '간판과 공간 배치는 사진 그대로',
    person: '얼굴과 옷은 사진의 것만',
  };
  const KEEP_LINE = {
    logo: '로고와 글자는 사진에 있는 것만 쓰고 새로 지어내지 마',
    color: '밤이나 어두운 장면에서도 색이 바뀌지 않게',
    shape: '사진에 없는 부분을 새로 붙이지 마',
    face: '얼굴과 옷은 사진의 것만 써',
  };
  const SHAPE_CHARACTER = '팔다리나 입처럼 사진에 없는 부분을 새로 붙이지 마';
  const KEEP_IDS = ['logo', 'color', 'shape', 'face', 'nomusic', 'notext', 'calm'];

  // 영상 없이 ‘가진 영상 편집’을 고른 경우의 대신 뼈대: 사람·캐릭터는 아우라 에딧, 그 밖은 제품 광고.
  const fallbackStyle = f => (f.hero === 'person' || f.hero === 'character' ? 'aura' : 'ad');

  // 받침에 맞춰 이/가.
  function ga(word) {
    const c = word.charCodeAt(word.length - 1) - 0xac00;
    return word + (c >= 0 && c <= 11171 && c % 28 !== 0 ? '이' : '가');
  }

  function sanitize(a) {
    const src = a && typeof a === 'object' ? a : {};
    const one = (v, keys) => (typeof v === 'string' && keys.includes(v) ? v : undefined);
    const out = {};
    const hero = one(src.hero, Object.keys(HERO)); if (hero) out.hero = hero;
    const style = one(src.style, Object.keys(STYLE)); if (style) out.style = style;
    const input = one(src.input, Object.keys(INPUT)); if (input) out.input = input;
    const where = one(src.where, Object.keys(WHERE)); if (where) out.where = where;
    const quality = one(src.quality, Object.keys(RES)); if (quality) out.quality = quality;
    if (Array.isArray(src.keep)) out.keep = KEEP_IDS.filter(k => src.keep.includes(k));
    return out;
  }

  function estimate(f) {
    const w = WHERE[f.where], rate = RATE[f.quality];
    const factor = f.editOnly ? FACTOR.clip : FACTOR.gen;
    const low = Math.floor(w.len[0] * factor[0] * rate);
    const high = Math.ceil(w.len[1] * factor[1] * rate + STILLS);
    return { low, high, cap: Math.ceil(high / 10) * 10, rate, factor, len: w.len };
  }

  function prompt(f, est) {
    const w = WHERE[f.where];
    const lines = [];
    const what = INPUT[f.input];
    const style = f.style === 'clip' && !f.editOnly ? fallbackStyle(f) : f.style;  // 영상 없이 편집을 고르면 새 장면으로
    lines.push(`붙인 ${what} 속 ${ga(HERO[f.hero])} 주인공인 ${f.editOnly ? STYLE_NOUN.clip : STYLE_NOUN[style]}을 만들어 줘.`);
    lines.push(`· 비율·길이: ${w.ratio}, ${w.len[0]}~${w.len[1]}초`);
    lines.push(`· 느낌: ${f.editOnly ? FEEL.clip : style === 'ref' && f.keep.includes('notext') ? FEEL_REF_NOTEXT : FEEL[style]}`);
    if (style === 'ref') lines.push('· 레퍼런스: [여기에 영상 링크를 붙여 넣으세요]');
    else if (!f.editOnly) lines.push(`· 레퍼런스: 요즘 인기 있는 ${STYLE[style]} 숏폼에서 하나 골라 줘`);
    lines.push(`· 화질·예산: 새로 만드는 장면은 ${RES[f.quality]}로. 크레딧은 전부 합쳐 ${est.cap} 안에서만 써 줘. 넘을 것 같으면 장면 수를 줄여 줘`);
    let keep = [HERO_LOCK[f.hero]];
    for (const k of ['logo', 'color', 'shape', 'face']) {
      if (!f.keep.includes(k) || (k === 'face' && f.hero === 'person')) continue;
      keep.push(k === 'shape' && f.hero === 'character' ? SHAPE_CHARACTER : KEEP_LINE[k]);
    }
    if (style === 'aura' && !f.editOnly) keep.push('첫 컷에서도 주인공이 작게 묻히지 않게');
    if (f.input === 'video') keep = keep.map(x => x.replace(/사진/g, '영상'));
    lines.push(`· 지킬 것: ${keep.join('. ')}`);
    if (f.keep.includes('calm')) lines.push('· 움직임: 화면 회전·스핀·잦은 흔들림은 넣지 말고, 번쩍임은 약하게');
    lines.push(f.keep.includes('nomusic') ? '· 소리: 남의 노래(틱톡 음원 포함)는 쓰지 말고 효과음만. 소리 없는 판도 같이 줘' : '· 소리: 음악을 넣으면 어디서 가져온 곡인지 알려 줘');
    lines.push(f.keep.includes('notext') ? '· 글자: 화면 글자는 넣지 마' : '· 글자: 넣는다면 짧게. 한글이 깨지지 않는지 확인해 줘');
    lines.push(`· 끝나면 알려 줘: 쓴 크레딧, 걸린 시간, ${style === 'ref' || f.editOnly ? '' : '고른 레퍼런스 주소, '}새로 생성한 장면과 ${f.input === 'video' ? '붙인 영상을 그대로 쓴 장면' : '사진을 움직이거나 합성한 장면'}이 각각 몇 초인지${f.keep.includes('nomusic') ? '' : ', 음악 출처'}`);
    return lines.join('\n');
  }

  function tipIds(f) {
    const ids = ['connect-steps', 'cost-cap', 'cost-resolution'];
    if (f.quality !== 'p720') ids.push('cost-upscale');
    ids.push(f.hero === 'person' || f.keep.includes('face') ? 'identity-person' : 'identity-lock');
    if (f.input === 'one') ids.push('one-photo');
    if (f.input === 'video' || f.style === 'clip') ids.push('clip-edit');
    ids.push('request-remix', f.keep.includes('nomusic') ? 'sound-music' : 'sound-open');
    if (f.style === 'aura' || f.keep.includes('calm')) ids.push('motion-flash');
    ids.push('request-short', 'connect-plan');
    return [...new Set(ids)];
  }

  function compute(answers) {
    const a = sanitize(answers);
    const f = {
      hero: a.hero || 'product', style: a.style || 'ad', input: a.input || 'many',
      where: a.where || 'shorts', quality: a.quality || 'p480',
      keep: a.keep || ['nomusic', 'calm'],
    };
    f.editOnly = f.style === 'clip' && f.input === 'video';
    const est = estimate(f);
    const warns = [];
    if (f.style === 'clip' && f.input !== 'video') warns.push(r(`가진 영상 편집은 영상이 있어야 해요. 지금은 사진만 있어서, 사진으로 새 장면을 만드는 ${STYLE[fallbackStyle(f)]} 요청문으로 바꿨어요.`, 'hf-katana'));
    if (!f.keep.includes('nomusic')) warns.push(r('음악을 막지 않았어요. 카타나가 틱톡이나 스톡 음원을 넣으면 올린 뒤 저작권 주장이 걸릴 수 있어요. 쇼츠는 1분이 넘으면 전 세계에서 막혀요.', 'yt-shorts'));
    if (f.quality === 'p1080') warns.push(r('1080p는 480p의 4배예요. 처음이라면 480p로 방향을 먼저 보고, 고른 결과만 업스케일하는 게 싸요.', 'hf-prices'));
    if (f.hero === 'person') warns.push(r('본인이 동의한 사진만 쓰세요. 사실처럼 보이는 사람이 나오면 유튜브에 올릴 때 ‘AI 사용’ 표시를 켜야 해요.', 'yt-synthetic'));

    const minutes = f.style === 'ref' ? '약 20~40분' : '약 30~40분';
    const styleLabel = f.editOnly ? '편집 영상' : STYLE[f.style === 'clip' ? fallbackStyle(f) : f.style];
    const headline = {
      title: f.style === 'ref' ? `${ga(HERO[f.hero])} 주인공인 영상, 내가 고른 영상처럼` : `${ga(HERO[f.hero])} 주인공인 ${styleLabel}`,
      sub: `${RES[f.quality]}로 약 ${est.low}~${est.high}크레딧, ${minutes.replace('약 ', '')} 걸려요. 요청문에 상한 ${est.cap}크레딧을 넣어서, 카타나가 묻지 않고 이 안에서 계획해요. 영상 속 두 편은 480p로 42크레딧, 84크레딧이 들었어요.`,
    };
    const flow = [
      { t: '처음 한 번: 클로드에 힉스필드 연결', d: '클로드 설정 → 커넥터 → 사용자 지정 커넥터 추가 → 이름 Higgsfield, 주소 https://mcp.higgsfield.ai/mcp → 연결 → 힉스필드에 로그인해 허용해요.', src: 'hf-help' },
      { t: '요금 확인', d: '유료 구독이 있어야 써요. 클로드로 만들면 요금제와 상관없이 크레딧이 빠져요. 체험은 카드를 등록하고, 해지하지 않으면 자동 결제돼요.', src: 'hf-help' },
      { t: `새 채팅에 ${INPUT_LABEL[f.input]} 붙이기`, d: `입력창에 /katana 를 쓰고 아래 요청문을 붙여 넣어 보내요.${f.style === 'ref' ? ' 요청문의 링크 자리에 고른 영상 주소를 넣어 주세요.' : ''}`, src: 'synk' },
      { t: `기다리기 · ${minutes}`, d: f.style === 'ref' ? '레퍼런스를 줬으니 찾는 시간이 줄어요. 카타나는 중간에 묻지 않고 끝까지 가요.' : '우리가 해 보니 38분, 그중 레퍼런스 찾기와 분석이 25분이었어요. 카타나는 중간에 묻지 않고 끝까지 가요.', src: 'synk-runs' },
      { t: '결과 확인', d: '아래 ‘결과 받은 뒤 확인할 것’을 보세요. 마음에 들면 업스케일로 키우고, 아니면 요청문에서 한 줄만 바꿔 다시 보내요.', src: 'synk' },
    ];
    const cards = [
      { k: '어림 크레딧', v: `약 ${est.low}~${est.high}`, key: true, s: `${RES[f.quality]} 초당 ${est.rate} × 화면 ${est.len[0]}~${est.len[1]}초 × 생성 ${est.factor[0]}~${est.factor[1]}배${f.editOnly ? '' : ' + 장소 그림'}`, reasons: [r(`Seedance 2.5 초당 480p 3 · 720p 7 · 1080p 12크레딧(10-08 관측값). 실제 비용은 카타나가 계획할 때 받는 견적이에요.`, 'hf-prices'), r('영상 속 두 편(480p)은 42.12크레딧과 84.24크레딧이었어요.', 'synk-runs')] },
      { k: '요청문에 넣은 상한', v: `${est.cap}크레딧`, s: '카타나는 묻지 않고, 에이전트 작업엔 기본 상한이 없어서 직접 넣었어요.', reasons: [r('카타나는 사용자·계정 상한 안에서 계획하고 크레딧 확인을 묻지 않아요.', 'hf-katana'), r('힉스필드 도움말: 에이전트 작업에 기본 크레딧 상한이 없어요.', 'hf-help')] },
      { k: '화질', v: RES[f.quality], s: f.quality === 'p480' ? '방향을 보는 미리 보기' : f.quality === 'p720' ? '카타나 기본값(480p의 2.3배)' : '바로 올릴 완성본(480p의 4배)', yes: f.quality === 'p480' ? [r('처음 한 번은 480p로 충분해요.', 'synk')] : [], no: f.quality === 'p480' ? [r('1080p는 고른 결과만 업스케일하면 돼요.', 'hf-prices')] : [] },
      { k: '비율·길이', v: `${WHERE[f.where].ratio} · ${est.len[0]}~${est.len[1]}초`, s: WHERE[f.where].label },
      { k: '걸리는 시간', v: minutes, s: '레퍼런스 찾기·분석이 가장 오래 걸려요.' },
    ];
    const checklist = [
      { id: 'identity', t: `주인공이 ${f.input === 'video' ? '영상' : '사진'}과 같은지`, d: `첫 컷과 끝 컷을 멈추고 로고·글자·색·모양을 ${f.input === 'video' ? '원래 영상' : '사진'}과 나란히 보세요.` },
      { id: 'composite', t: f.input === 'video' ? '그대로 쓴 장면과 새로 만든 장면' : '사진을 합성한 구간', d: '보고에 적힌 구간을 보고, 소개할 때 모두 새로 생성한 것처럼 말하지 마세요.' },
      { id: 'music', t: '음악 출처', d: f.keep.includes('nomusic') ? '효과음만 넣었는지 확인하고, 음악은 올릴 때 앱의 음악 목록에서 고르세요.' : '보고의 음악 출처를 보고, 모르는 곡이면 무음판을 쓰세요.' },
      { id: 'flash', t: '번쩍임과 흔들림', d: '소리를 끄고 끝까지 보며 번쩍이는 곳을 세어 보세요.' },
      { id: 'credits', t: '쓴 크레딧', d: '카타나 보고와 힉스필드 거래 내역을 맞춰 보세요.' },
      { id: 'trial', t: '체험 중이라면 해지 날짜', d: '체험은 해지하지 않으면 자동으로 결제돼요.' },
    ];
    if (f.hero === 'person') checklist.push({ id: 'ai-label', t: 'AI 사용 표시', d: '유튜브에 올릴 때 업로드 화면의 ‘AI 사용’ 표시를 켜세요.' });
    const tips = tipIds(f);
    const sourcesUsed = ['hf-katana', 'hf-prices', 'hf-help', 'synk-runs', ...warns.map(x => x.src)];
    return { version: VERSION, answers: a, f, est, headline, flow, prompt: prompt(f, est), cards, warns, checklist, tips, sourcesUsed };
  }

  return Object.freeze({ VERSION, RATE, WHERE, FACTOR, sanitize, compute, estimate, ga });
});
