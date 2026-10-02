/* synkbrief 기초 · AI 컴퓨터 맞춤 추천 — 계산 규칙 v2.
 * 원본: SYNK-appsscript/docs/마케팅/맞춤도구/computer/rules.js
 * 기준 문서: computer/추천기준.md (2026-09-27 사용자 결정: 형태를 정해 준다 · 가성비 우선 · 무거우면 데스크톱)
 * 답을 받아 형태·사양(가성비/여유)·이유·팁·확인표·프롬프트를 돌려주는 순수 함수다. 네트워크·AI 호출·기록이 없다.
 * 이유(reason)마다 src를 단다. 'synk'는 SYNK 판단, 나머지는 content.js SOURCES의 공식·커뮤니티 자료다.
 * 책상 그림의 GB는 이해를 돕는 대략값이다. 공식 최소는 REQ.min, SYNK 판단은 REQ.value·roomy가 쥔다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkComputerRules = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'computer-rules-v2-2026-09-27';
  // 살 수 있는 램 단계(추천기준 §4). judge는 지금 컴퓨터를 판정할 때만 쓴다.
  const LADDER = {
    any: [16, 24, 32, 48, 64, 128],
    mac: [16, 24, 32, 48, 64, 128],
    winDesktop: [16, 32, 48, 64, 96, 128],
    winLaptop: [16, 32, 64, 128],
    judge: [8, 16, 24, 32, 48, 64, 96, 128],
  };
  const STORAGE = [256, 512, 1000, 2000, 4000];
  const WEIGHT = { light: 0, medium: 1, heavy: 2 };

  const USE_LABEL = { web: '웹 AI·문서', meeting: '화상회의·온라인 수업', photo: '사진·디자인', video: '영상 편집', code: '코딩·앱 만들기', localai: '내 컴퓨터에 AI 설치', game: '게임' };
  const VIDEO_APP = { capcut: '캡컷', premiere: '프리미어 프로', resolve: '다빈치 리졸브', fcp: '파이널 컷 프로', unknown: '편집 프로그램(미정)' };
  const PHOTO = { web: '캔바·피그마', adobe: '포토샵·라이트룸', heavy: '큰 사진·레이어 작업', '3d': '3D(블렌더)' };
  const CODE = { web: '웹·자동화 개발', mobile: '모바일 앱 개발', server: '서버·도커 개발' };
  const AI = { small: '작은 대화 AI(4B~8B)', mid: '중간 대화 AI(12B~14B)', large: '큰 대화 AI(27B~32B)', huge: '아주 큰 대화 AI(70B급)', image: '이미지 생성 AI', unsure: '작은 대화 AI 체험' };
  const TABS = { light: 2, normal: 4, heavy: 7 };
  const BUDGET = { lt100: 0, '100_150': 1, '150_250': 2, gt250: 3 };
  const BUDGET_LABEL = { lt100: '100만 원 미만', '100_150': '100~150만 원', '150_250': '150~250만 원', gt250: '250만 원 이상', unknown: '아직 정하지 않음' };
  const PLACE_LABEL = { home: '거의 책상에서만', both: '가끔 들고 나가서', carry: '자주 들고 다니며' };

  // 작업별 기준(추천기준 §4·§5). gb=책상 그림용 대략값, ramGb=윈도우에서 모델이 그래픽 메모리에 올라갈 때 램에 남는 몫,
  // min=공식 최소, value=가성비, roomy=여유, vram·vramRoomy=윈도우 그래픽 메모리(GB), weight=작업의 무게.
  const REQ = {
    web: { min: 8, value: 16, roomy: 16, weight: 'light', src: ['ms-win11'] },
    meeting: { gb: 1.5, min: 8, value: 16, roomy: 16, weight: 'light', src: ['synk'] },
    photo: {
      web: { gb: 1.5, min: 8, value: 16, roomy: 16, weight: 'light', src: ['synk'] },
      adobe: { gb: 5, min: 8, value: 16, roomy: 32, weight: 'medium', src: ['adobe-ps'] },
      heavy: { gb: 10, min: 16, value: 32, roomy: 64, weight: 'medium', src: ['adobe-ps'] },
      '3d': { gb: 12, min: 8, value: 32, roomy: 64, weight: 'heavy', vram: 8, vramRoomy: 16, src: ['blender'] },
    },
    video: {
      capcut: { light: { gb: 4, min: 4, value: 16, roomy: 32, weight: 'medium', src: ['capcut'] }, heavy: { gb: 5.5, min: 4, value: 16, roomy: 32, weight: 'medium', src: ['capcut'] }, '4k': { gb: 9, min: 16, value: 32, roomy: 64, weight: 'heavy', vram: 8, vramRoomy: 12, src: ['capcut'] } },
      premiere: { light: { gb: 7, min: 16, value: 16, roomy: 32, weight: 'medium', vram: 4, vramRoomy: 8, src: ['adobe-pr'] }, heavy: { gb: 11, min: 16, value: 32, roomy: 64, weight: 'heavy', vram: 8, vramRoomy: 12, src: ['adobe-pr'] }, '4k': { gb: 18, min: 32, value: 32, roomy: 64, weight: 'heavy', vram: 8, vramRoomy: 16, src: ['adobe-pr'] } },
      resolve: { light: { gb: 7, min: 16, value: 16, roomy: 32, weight: 'medium', vram: 4, vramRoomy: 8, src: ['bmd-resolve'] }, heavy: { gb: 11, min: 16, value: 32, roomy: 64, weight: 'heavy', vram: 8, vramRoomy: 12, src: ['bmd-resolve'] }, '4k': { gb: 18, min: 16, value: 32, roomy: 64, weight: 'heavy', vram: 8, vramRoomy: 16, src: ['bmd-resolve'] } },
      fcp: { light: { gb: 5, min: 8, value: 16, roomy: 24, weight: 'medium', src: ['apple-fcp'] }, heavy: { gb: 8, min: 8, value: 24, roomy: 32, weight: 'heavy', src: ['apple-fcp'] }, '4k': { gb: 12, min: 8, value: 32, roomy: 64, weight: 'heavy', src: ['apple-fcp'] } },
      unknown: { light: { gb: 6, min: 8, value: 16, roomy: 32, weight: 'medium', src: ['synk'] }, heavy: { gb: 9, min: 8, value: 32, roomy: 64, weight: 'heavy', vram: 8, vramRoomy: 12, src: ['synk'] }, '4k': { gb: 14, min: 16, value: 32, roomy: 64, weight: 'heavy', vram: 8, vramRoomy: 12, src: ['synk'] } },
    },
    code: {
      web: { gb: 3, min: 8, value: 16, roomy: 32, weight: 'light', src: ['synk'] },
      mobile: { gb: 8, min: 16, value: 32, roomy: 64, weight: 'medium', src: ['synk'] },
      server: { gb: 8, min: 16, value: 32, roomy: 64, weight: 'medium', src: ['synk'] },
    },
    // 대화 AI: file=Ollama 공식 라이브러리의 압축판 파일 크기(GB)
    localai: {
      small: { gb: 6, ramGb: 1.5, min: 16, value: 16, roomy: 32, valueWin: 16, roomyWin: 32, weight: 'medium', vram: 0, file: 5.2, src: ['ollama-qwen3'] },
      unsure: { gb: 6, ramGb: 1.5, min: 16, value: 16, roomy: 32, valueWin: 16, roomyWin: 32, weight: 'medium', vram: 0, file: 5.2, src: ['ollama-qwen3'] },
      mid: { gb: 11, ramGb: 2, min: 16, value: 16, roomy: 32, valueWin: 16, roomyWin: 32, weight: 'heavy', vram: 12, vramRoomy: 16, file: 9.3, src: ['ollama-qwen3'] },
      large: { gb: 23, ramGb: 3, min: 32, value: 48, roomy: 64, valueWin: 32, roomyWin: 64, weight: 'heavy', vram: 24, vramRoomy: 32, file: 20, src: ['ollama-qwen3'] },
      huge: { gb: 48, ramGb: 4, min: 64, value: 128, roomy: 128, valueWin: 64, roomyWin: 128, weight: 'heavy', vram: 48, vramRoomy: 48, file: 43, src: ['ollama-llama33'] },
      image: { gb: 8, ramGb: 8, min: 16, value: 32, roomy: 64, valueWin: 32, roomyWin: 64, weight: 'heavy', vram: 12, vramRoomy: 16, file: 20, src: ['comfy-community'] },
    },
    game: { gb: 8, min: 16, value: 16, roomy: 32, weight: 'heavy', vram: 8, vramRoomy: 12, src: ['synk'] },
  };

  const has = (a, use) => Array.isArray(a.uses) && a.uses.includes(use);
  const list = v => (Array.isArray(v) ? v : []);
  const round1 = n => Math.round(n * 10) / 10;
  const up = (ladder, x) => ladder.find(t => t >= x - 1e-9) || ladder[ladder.length - 1];
  const next = (ladder, x) => ladder.find(t => t > x + 1e-9) || ladder[ladder.length - 1];
  const storageUp = x => STORAGE.find(t => t >= x - 1e-9) || STORAGE[STORAGE.length - 1];
  const gbText = n => (n >= 1000 ? `${n / 1000}TB` : `${n}GB`);
  const r = (t, src = 'synk') => ({ t, src });
  // 받침 유무로 조사를 고른다. 한글이 아닌 끝 글자는 읽는 소리 기준(모니터→를, TB→가)으로 본다.
  // 끝에 괄호로 덧붙인 말은 건너뛰고 괄호 앞말에 맞춘다: 데스크톱(맥 미니)을. 숫자는 영·일·삼·육·칠·팔만 받침이 있다.
  const josa = (word, withBatchim, without) => {
    const last = String(word).trim().replace(/\s*\([^()]*\)$/, '').slice(-1);
    const code = last.charCodeAt(0) - 0xac00;
    if (code >= 0 && code <= 11171) return word + (code % 28 ? withBatchim : without);
    return word + (/[013678LMNlmn]$/.test(last) ? withBatchim : without);
  };

  function sanitize(a) {
    const out = {};
    const pick = (v, allowed) => (allowed.includes(v) ? v : undefined);
    out.owned = pick(a && a.owned, ['have', 'new', 'extra']);
    out.uses = list(a && a.uses).filter(u => Object.hasOwn(USE_LABEL, u));
    const v = (a && a.video) || {};
    out.video = { app: pick(v.app, Object.keys(VIDEO_APP)), res: pick(v.res, ['fhd', '4k']), load: pick(v.load, ['light', 'heavy']) };
    out.photo = pick(a && a.photo, Object.keys(PHOTO));
    out.code = pick(a && a.code, Object.keys(CODE));
    out.localai = list(a && a.localai).filter(x => Object.hasOwn(AI, x));
    out.multitask = pick(a && a.multitask, Object.keys(TABS));
    const c = (a && a.current) || {};
    out.current = { ram: pick(c.ram, ['4', '8', '16', '32', 'unknown']), os: pick(c.os, ['win11', 'win10', 'mac_as', 'mac_intel', 'unknown']), kind: pick(c.kind, ['laptop', 'desktop']), feel: pick(c.feel, ['ok', 'slow', 'untried']) };
    out.place = pick(a && a.place, ['home', 'both', 'carry']);
    out.os = pick(a && a.os, ['mac', 'win', 'any']);
    out.budget = pick(a && a.budget, [...Object.keys(BUDGET), 'unknown']);
    return out;
  }

  // 세부 질문 전에도 책상 그림이 반응하도록 보통값을 채운다. 결과까지 가면 세부 답이 늘 있다.
  function filled(a) {
    let b = a;
    if (has(b, 'video') && !(b.video.app && b.video.res)) b = { ...b, video: { app: b.video.app || 'unknown', res: b.video.res || 'fhd', load: b.video.load } };
    if (has(b, 'photo') && !b.photo) b = { ...b, photo: 'adobe' };
    if (has(b, 'code') && !b.code) b = { ...b, code: 'web' };
    if (has(b, 'localai') && !b.localai.length) b = { ...b, localai: ['unsure'] };
    return b;
  }
  const videoKey = a => (a.video.res === '4k' ? '4k' : a.video.load === 'heavy' ? 'heavy' : 'light');

  // 고른 작업마다 기준 하나씩. kind: base(늘 켜 둠) | app(번갈아 쓰는 무거운 작업)
  function workloads(a) {
    const w = [];
    if (has(a, 'web')) w.push({ id: 'web', label: USE_LABEL.web, kind: 'none', ...REQ.web });
    if (has(a, 'meeting')) w.push({ id: 'meeting', label: '화상회의', kind: 'base', tone: 'butter', ...REQ.meeting });
    if (has(a, 'code') && a.code) w.push({ id: 'code', label: CODE[a.code], kind: 'base', tone: 'meadow', ...REQ.code[a.code] });
    if (has(a, 'photo') && a.photo) w.push({ id: 'photo', label: PHOTO[a.photo], kind: 'app', tone: 'pop', ...REQ.photo[a.photo] });
    if (has(a, 'video') && a.video.app) {
      const k = videoKey(a);
      w.push({ id: 'video', label: `${VIDEO_APP[a.video.app]} ${a.video.res === '4k' ? '4K' : 'FHD'} 편집`, kind: 'app', tone: 'coral', vkey: k, ...REQ.video[a.video.app][k] });
    }
    if (has(a, 'localai')) {
      const llms = a.localai.filter(x => x !== 'image');
      if (llms.length) {
        const biggest = llms.map(x => ({ size: x, ...REQ.localai[x] })).sort((p, q) => q.gb - p.gb)[0];
        w.push({ id: 'llm', label: AI[biggest.size], kind: 'app', tone: 'lapis', ...biggest });
      }
      if (a.localai.includes('image')) w.push({ id: 'image', label: AI.image, kind: 'app', tone: 'meadow', ...REQ.localai.image });
    }
    if (has(a, 'game')) w.push({ id: 'game', label: '게임', kind: 'app', tone: 'butter', ...REQ.game });
    return w;
  }
  const weightOf = w => w.reduce((m, x) => (WEIGHT[x.weight] > WEIGHT[m] ? x.weight : m), 'light');

  function chooseOs(a, w) {
    const reasons = [], conflicts = [];
    const video = w.find(x => x.id === 'video');
    const fcp = video && a.video.app === 'fcp';
    const image = w.some(x => x.id === 'image');
    const game = w.some(x => x.id === 'game');
    const llm = w.find(x => x.id === 'llm');
    const bigLlm = llm && ['mid', 'large', 'huge'].includes(llm.size);
    const laptopEdit = video && video.weight === 'medium' && ['premiere', 'resolve', 'unknown'].includes(a.video.app) && a.place !== 'home' && weightOf(w) !== 'heavy';
    let mac = 0, win = 0;
    if (fcp) mac += 10;
    if (bigLlm) mac += 2;
    if (laptopEdit) mac += 1;
    if (image) win += 3;
    if (game) win += 3;
    let pick;
    if (a.os === 'mac') { pick = 'mac'; reasons.push(r('맥이 편하다고 하셔서 맥 기준으로 계산했어요.')); }
    else if (a.os === 'win') { pick = 'win'; reasons.push(r('윈도우가 편하다고 하셔서 윈도우 기준으로 계산했어요.')); }
    else {
      pick = mac > win ? 'mac' : win > mac ? 'win' : 'either';
      if (pick === 'mac' && fcp) reasons.push(r('파이널 컷 프로는 맥에서만 돌아가요.', 'apple-fcp'));
      else if (pick === 'mac' && bigLlm) reasons.push(r('대화 AI는 맥이 가성비예요. 맥은 램을 그래픽이 같이 쓰는 통합 메모리라, 같은 크기를 그래픽카드 메모리로 사는 것보다 싸요(2026년 그래픽카드 시세 기준).', 'wccftech-gpu'));
      else if (pick === 'mac' && laptopEdit) reasons.push(r('맥북 에어는 외장 그래픽 없이도 영상 편집을 가속하는 미디어 엔진이 있어서, 편집용 노트북으로 가성비가 좋아요.', 'apple-mba'));
      if (pick === 'win' && image) reasons.push(r('이미지 생성 AI는 엔비디아 그래픽카드를 단 윈도우가 가장 무난해요.', 'comfy-community'));
      if (pick === 'win' && game) reasons.push(r('PC 게임은 윈도우만 지원하는 경우가 많아요.'));
      if (pick === 'either') reasons.push(r('고른 작업은 맥과 윈도우 모두에서 잘 돼요. 익숙한 쪽을 고르세요.'));
    }
    if (pick === 'win' && fcp) conflicts.push(r('파이널 컷 프로는 맥 전용이에요. 윈도우라면 다빈치 리졸브·프리미어 프로·캡컷으로 편집할 수 있어요.', 'apple-fcp'));
    if (pick === 'mac' && image) conflicts.push(r('맥에서도 이미지 생성 AI를 쓸 수 있지만, 엔비디아 그래픽카드를 단 윈도우보다 느린 편이에요.', 'comfy-community'));
    if (pick === 'mac' && game) conflicts.push(r('하고 싶은 게임이 맥을 지원하는지 먼저 확인하세요. 윈도우만 지원하는 게임이 많아요.'));
    if (has(a, 'code') && a.code === 'mobile' && pick !== 'mac') conflicts.push(r('아이폰 앱까지 만들려면 맥이 필요해요. 애플의 개발 도구 Xcode는 맥에서만 돌아가요.', 'apple-xcode'));
    return { pick, reasons, conflicts };
  }

  // 형태(추천기준 §3): 무거우면 데스크톱, 그 밖은 들고 다니는 정도로.
  function chooseForm(a, w) {
    const weight = weightOf(w);
    const heavy = weight === 'heavy';
    const heavyList = w.filter(x => x.weight === 'heavy').map(x => x.label);
    const reasons = [], portable = [], fallback = [];
    let pick;
    if (heavy) {
      pick = 'desktop';
      reasons.push(r(`${josa(heavyList.join(', '), '은', '는')} 무거운 작업이라 데스크톱을 추천해요. 노트북은 권하지 않아요.`));
      reasons.push(r('같은 이름의 그래픽이라도 노트북용이 약해요. RTX 5070은 데스크톱용이 코어 6,144개·전력 250W, 노트북용이 코어 4,608개에 전력이 훨씬 낮아요. 처음 나온 노트북용은 그래픽 메모리도 8GB였어요(데스크톱 12GB).', 'pcworld-5070'));
      reasons.push(r('노트북은 오래 무거운 작업을 하면 열 때문에 스스로 속도를 낮춰요. 램·그래픽카드도 나중에 바꿀 수 없어요.'));
      reasons.push(r('같은 성능이면 노트북이 더 비싸고 무거워요. 데스크톱은 같은 돈으로 더 강하고, 나중에 부품만 바꿔 오래 써요.'));
      if (a.place !== 'home') {
        const laptopNow = ['have', 'extra'].includes(a.owned) && a.current && a.current.kind === 'laptop';
        portable.push(r(laptopNow ? '지금 쓰는 노트북은 밖에서 계속 쓰고, 무거운 작업은 새 데스크톱에서 하세요.' : '밖에서는 가진 기기(휴대폰·태블릿·쓰던 노트북)로 웹 AI와 문서를 하고, 무거운 작업은 데스크톱에서 하세요.'));
        portable.push(r('밖에서 집 데스크톱을 원격으로 켜서 쓰는 방법(원격 데스크톱)도 있어요. 인터넷만 되면 무거운 계산은 집에서 해요.'));
        fallback.push(r('꼭 노트북 한 대로 해결해야 한다면 외장 그래픽이 달린 고성능 노트북이 필요해요. 대개 2kg이 넘고 배터리가 짧으며, 같은 성능의 데스크톱보다 비싸요. 그래서 SYNK는 권하지 않아요.'));
      }
    } else if (a.place === 'home') {
      pick = 'desktop';
      reasons.push(r('들고 다닐 일이 거의 없으니 데스크톱이 가성비예요. 같은 돈이면 더 강하고, 화면이 크고, 나중에 램을 늘릴 수 있어요.'));
      if (weight === 'light') reasons.push(r('가벼운 작업이라 손바닥만 한 미니 PC(맥은 맥 미니)로도 충분해요. 가끔이라도 들고 나가야 한다면 노트북에 집에서 모니터를 연결하세요.'));
    } else if (a.place === 'both') {
      pick = 'laptop';
      reasons.push(r('가끔 들고 나가니 노트북이에요. 집에서는 모니터를 연결하면 데스크톱처럼 편하게 써요.'));
    } else {
      pick = 'laptop';
      reasons.push(r('자주 들고 다니니 노트북이에요. 본체와 충전기를 합친 무게가 1.5kg 안팎이면 매일 들기 편한 편이에요.'));
    }
    return { pick, weight, heavy, notLaptop: heavy, heavyList, portable, fallback, reasons };
  }

  function ladderFor(os, form) {
    if (os === 'mac') return LADDER.mac;
    if (os === 'win') return form === 'desktop' ? LADDER.winDesktop : LADDER.winLaptop;
    return LADDER.any;
  }

  // 윈도우에서 대화 AI·이미지 생성 모델은 그래픽 메모리에 올라가므로 램 책상에는 실행 몫만 남긴다.
  function deskBlocks(a, w, os) {
    const onGpu = os === 'win';
    const blocks = [{ id: 'os', label: '운영체제', gb: 4, tone: 'base' }];
    blocks.push({ id: 'tabs', label: has(a, 'web') ? '인터넷 탭·웹 AI' : '인터넷 탭', gb: TABS[a.multitask] || 4, tone: 'lapis' });
    for (const x of w.filter(y => y.kind === 'base')) blocks.push({ id: x.id, label: x.label, gb: x.gb, tone: x.tone });
    const apps = w.filter(y => y.kind === 'app').map(x => ({ ...x, deskGb: onGpu && x.ramGb != null ? x.ramGb : x.gb })).sort((p, q) => q.deskGb - p.deskGb);
    apps.forEach((x, i) => {
      const label = onGpu && x.ramGb != null ? `${x.label}(실행 몫)` : x.label;
      blocks.push({ id: x.id, label: i === 0 ? label : `${label} · 번갈아`, gb: i === 0 ? x.deskGb : round1(x.deskGb * 0.25), tone: x.tone });
    });
    return blocks;
  }

  function computeRam(a, w, blocks, os, form) {
    const ladder = ladderFor(os, form.pick);
    const used = round1(blocks.reduce((s, b) => s + b.gb, 0));
    // 윈도우에서 AI 모델은 그래픽 메모리에 올라가므로 램 기준은 valueWin·roomyWin을 쓴다.
    const onGpu = x => os === 'win' && x.valueWin != null;
    const officialMin = Math.max(8, ...w.map(x => (onGpu(x) ? 16 : x.min || 0)));
    const floorValue = Math.max(16, ...w.map(x => (onGpu(x) ? x.valueWin : x.value || 0)));
    // 가성비 = 작업 기준과 책상을 담는 가장 낮은 단계. 여유 = 한 단계 위 또는 작업별 여유(가벼운 작업뿐이거나 이미 넉넉하면 없음)
    const value = up(ladder, Math.max(floorValue, used));
    const maxRoomy = Math.max(0, ...w.map(x => (onGpu(x) ? x.roomyWin : x.roomy || 0)));
    const roomy = form.weight === 'light' || maxRoomy <= value ? value : up(ladder, Math.max(next(ladder, value), maxRoomy));
    const workable = Math.min(Math.max(officialMin, up(LADDER.judge, used * 0.8)), value);
    const reasons = [], groups = [];
    for (const x of w) {
      const g = { weight: (x.value || 0) + WEIGHT[x.weight], items: [] };
      groups.push(g);
      const push = item => g.items.push(item);
      if (x.id === 'web') push(r('웹 AI는 어려운 계산을 AI 회사의 서버가 해요. 내 컴퓨터는 탭 몇 개만큼만 램을 쓰면 돼요.'));
      else if (x.id === 'video') {
        const k4 = a.video.res === '4k';
        if (a.video.app === 'capcut') push(r('캡컷은 공식 최소 사양이 램 4GB일 만큼 가벼운 편이에요.', 'capcut'));
        if (a.video.app === 'premiere') push(r('어도비는 프리미어에 윈도우 기준 32GB 이상을 권하고, 애플 실리콘 맥은 영상 편집에 최소 16GB가 필요하다고 안내해요.', 'adobe-pr'));
        if (a.video.app === 'resolve') push(r('다빈치 리졸브는 윈도우 기준 최소 16GB, 퓨전 효과를 쓰면 32GB가 필요해요.', 'bmd-resolve'));
        if (a.video.app === 'fcp') push(r('애플은 파이널 컷 프로에 램 8GB 이상, 16GB를 권해요.', 'apple-fcp'));
        if (a.video.app === 'unknown') push(r('편집 프로그램마다 권장 사양이 달라서 흔한 기준으로 잡았어요.'));
        if (k4) push(r('4K는 한 장면이 FHD의 4배라 32GB가 가성비 기준이에요.'));
        else if (x.vkey === 'heavy' && a.video.app !== 'capcut') push(r(`긴 영상에 효과가 많아 ${x.value}GB가 가성비 기준이에요.`));
        else push(r('짧은 FHD 편집은 16GB로 충분해요. 효과를 많이 쓰면 여유 선택을 보세요.'));
      } else if (x.id === 'photo') {
        if (a.photo === 'web') push(r('캔바·피그마는 인터넷 창에서 돌아가서 탭처럼 가벼워요.'));
        if (a.photo === 'adobe') push(r('포토샵은 램 최소 8GB, 권장 16GB 이상이에요.', 'adobe-ps'));
        if (a.photo === 'heavy') { push(r('포토샵은 램 16GB 이상을 권해요.', 'adobe-ps')); push(r('큰 파일과 레이어가 많으면 32GB가 가성비 기준이에요.')); }
        if (a.photo === '3d') push(r('블렌더는 램 최소 8GB, 권장 32GB예요.', 'blender'));
      } else if (x.id === 'llm') {
        push(r(`${josa(AI[x.size], '은', '는')} 압축판 모델 파일만 약 ${x.file}GB예요.`, x.src[0]));
        push(r(os === 'win' ? '윈도우에서는 모델이 그래픽카드 메모리에 올라가서, 램에는 실행에 필요한 몫만 남아요.' : '맥은 모델 전체를 통합 메모리에 올려요. 대화 기억(문맥)과 다른 프로그램 몫까지 여유가 있어야 해요.'));
      } else if (x.id === 'image') { push(r('이미지 생성은 램보다 그래픽 메모리가 더 중요해요.', 'comfy-community')); push(r('모델 일부를 램으로 옮겨 가며 쓰기 때문에 램은 32GB가 가성비 기준이에요.')); }
      else if (x.id === 'code') push(r({ web: '웹 개발과 AI 코딩 도구는 16GB면 대부분 충분해요.', mobile: '에뮬레이터는 컴퓨터 안에 휴대폰을 하나 더 켜는 거라 32GB가 가성비 기준이에요.', server: '도커 컨테이너를 여러 개 띄우면 그만큼 램을 떼어 줘야 해서 32GB가 가성비 기준이에요.' }[a.code]));
      else if (x.id === 'meeting') push(r('화상회의는 카메라·화면 공유를 함께 처리해서 탭 몇 개만큼 램을 써요.'));
      else if (x.id === 'game') push(r('요즘 PC 게임은 16GB면 대부분 돌아가요. 하고 싶은 게임의 권장 사양을 꼭 확인하세요.'));
    }
    groups.sort((p, q) => q.weight - p.weight);
    const sum = r(`동시에 켜 두는 것까지 합치면 약 ${used}GB를 써요. 작업 기준과 이걸 함께 담는 가장 낮은 단계가 ${value}GB예요.`);
    groups.forEach((g, i) => { reasons.push(...g.items); if (i === 0) reasons.push(sum); });
    if (!groups.length) reasons.push(sum);
    const key = [];
    if (value === 16) key.push(r('16GB가 가성비 기준점이에요. 2026년 새 맥북 에어·맥 미니·코파일럿+ PC가 모두 16GB부터 시작해요. 새로 산다면 8GB는 권하지 않아요.', 'apple-mba'));
    if (os === 'win' && value !== up(LADDER.any, Math.max(floorValue, used))) key.push(r(`윈도우 ${josa(form.pick === 'desktop' ? 'PC' : '노트북', '은', '는')} ${up(LADDER.any, Math.max(floorValue, used))}GB 구성이 드물어서 ${value}GB로 잡았어요.`));
    if (os === 'either' && value === 24) key.push(r('맥은 24GB로 고를 수 있어요. 윈도우라면 보통 32GB를 고르세요.'));
    reasons.splice(reasons.indexOf(sum) + 1, 0, ...key);
    if (w.filter(x => x.kind === 'app').length > 1) reasons.push(r('무거운 작업끼리는 보통 번갈아 쓰니, 가장 무거운 작업을 기준으로 나머지는 일부만 더했어요.'));
    if (os === 'mac') reasons.push(r('맥은 그래픽도 이 메모리를 함께 써요. 맥은 나중에 램을 늘릴 수 없어요.'));
    const upgradable = os !== 'mac' && form.pick === 'desktop';
    const roomyNote = roomy > value
      ? (upgradable ? `여유가 되면 ${roomy}GB. 데스크톱은 나중에 램을 더 꽂을 수 있으니 지금은 ${value}GB로 시작해도 돼요.` : `여유가 되면 ${roomy}GB. ${os === 'mac' ? '맥은' : '노트북은'} 나중에 늘릴 수 없어서, 오래 쓸 거라면 처음에 고르세요.`)
      : `${value}GB면 충분해요. 이 용도엔 램을 더 늘려도 차이가 적으니, 남는 돈은 ${form.pick === 'desktop' ? '모니터·저장공간' : '무게·화면·보증'}에 쓰세요.`;
    return { value, roomy, officialMin, workable, used, upgradable, roomyNote, reasons };
  }

  function computeStorage(a, w, os, form) {
    const reasons = [];
    let value = 512, roomy = 512;
    const webOnly = w.every(x => ['web', 'meeting'].includes(x.id));
    const video = w.find(x => x.id === 'video');
    if (video && video.vkey === 'light') {
      value = 512; roomy = 1000;
      reasons.push(r('짧은 FHD 편집은 512GB로 시작해도 돼요. 끝난 영상은 외장 SSD나 클라우드로 옮기면 가성비가 좋아요.'));
    } else if (video) {
      value = 1000; roomy = 2000;
      reasons.push(r(a.video.res === '4k' ? '4K 원본은 파일이 아주 커요. 가성비는 1TB에 끝난 영상은 외장 SSD로 옮기는 방식이에요.' : '긴 영상 원본과 편집 캐시는 금방 수백GB가 돼요.'));
    }
    const models = w.filter(x => x.id === 'llm' || x.id === 'image').reduce((s, x) => s + (x.file || 0) * 2, 0);
    if (models) {
      value = Math.max(value, storageUp(512 + models)); roomy = Math.max(roomy, storageUp(value * 2));
      reasons.push(r(`AI 모델 파일은 하나에 수 GB에서 수십 GB예요. 두세 개를 번갈아 써 보면 약 ${Math.round(models)}GB가 더 필요해요.`, 'ollama-qwen3'));
    }
    if (w.some(x => x.id === 'photo') && ['heavy', '3d'].includes(a.photo)) { value = Math.max(value, 1000); roomy = Math.max(roomy, 2000); reasons.push(r('큰 사진·3D 파일은 작업 파일과 캐시가 빠르게 쌓여요.')); }
    if (w.some(x => x.id === 'game')) { value = Math.max(value, 1000); roomy = Math.max(roomy, 2000); reasons.push(r('요즘 게임은 하나에 100GB를 넘기도 해요.')); }
    if (w.some(x => x.id === 'code') && ['mobile', 'server'].includes(a.code)) { value = Math.max(value, 1000); roomy = Math.max(roomy, 2000); reasons.push(r('개발 도구·에뮬레이터·도커 이미지가 수십 GB씩 쌓여요.')); }
    if (value <= 512) reasons.unshift(r('윈도우 11도 최소 64GB를 요구하고, 업데이트와 프로그램이 쌓이면 금방 차요. 512GB가 가성비 출발점이에요.', 'ms-win11'));
    reasons.push(r(os !== 'mac' && form.pick === 'desktop' ? '데스크톱은 SSD를 나중에 한 칸 더 달 수 있어요. 지금은 가성비로 시작하세요.' : '저장공간은 외장 SSD로 나중에 늘릴 수 있어요. 램보다 먼저 아낄 곳이에요.'));
    const min = webOnly ? 256 : Math.min(512, value);
    return { value, roomy, min, valueText: gbText(value), roomyText: gbText(roomy), minText: gbText(min), reasons };
  }

  const GPU_EXAMPLE = {
    8: 'RTX 5060(8GB) 급',
    12: 'RTX 5070(12GB) 또는 RTX 5060 Ti 16GB',
    16: 'RTX 5060 Ti 16GB·RTX 5070 Ti·RTX 5080',
    24: 'RTX 5090(32GB) 급',
    32: 'RTX 5090(32GB)',
    48: '일반 그래픽카드로는 불가',
  };
  function computeGpu(a, w, os) {
    const reasons = [];
    const need = Math.max(0, ...w.map(x => x.vram || 0));
    const ai = w.some(x => x.id === 'llm' || x.id === 'image');
    if (os === 'mac') {
      reasons.push(r('맥은 그래픽카드를 따로 고르지 않아요. 그래픽이 램을 함께 쓰는 통합 메모리라, 위의 램 추천에 그래픽 몫까지 넣었어요.'));
      return { kind: 'unified', vram: 0, vramRoomy: 0, short: '통합 메모리', text: '통합 메모리(따로 고르지 않아요)', ai, reasons };
    }
    if (!need) {
      reasons.push(r('고른 작업은 CPU 안에 든 내장 그래픽으로 충분해요. 그래픽카드 값을 아낄 수 있어요.', w.some(x => x.id === 'video' && a.video.app === 'capcut') ? 'capcut' : 'synk'));
      if (w.some(x => x.id === 'llm')) reasons.push(r('작은 대화 AI는 CPU로도 돌아가요. 8GB 그래픽카드가 있으면 답이 훨씬 빨리 나와요.'));
      return { kind: 'integrated', vram: 0, vramRoomy: 0, short: '내장 그래픽', text: '내장 그래픽으로 충분해요', ai, reasons };
    }
    const buy = Math.max(need, 8); // 2026년에 새로 파는 외장 그래픽은 8GB부터
    const vramRoomy = Math.max(buy, ...w.map(x => x.vramRoomy || 0));
    if (os === 'either') {
      reasons.push(r(`윈도우라면 그래픽 메모리 ${buy}GB 이상 외장 그래픽, 맥이라면 통합 메모리로 해결돼요.`));
      return { kind: 'either', vram: buy, need, vramRoomy, short: `그래픽 ${buy}GB`, text: `윈도우: 그래픽 메모리 ${buy}GB 이상 · 맥: 통합 메모리`, example: GPU_EXAMPLE[buy] || '', ai, reasons };
    }
    for (const x of w.filter(y => (y.vram || 0) > 0)) {
      if (x.id === 'video') reasons.push(r(x.vram === 4 ? '프리미어·다빈치는 그래픽 메모리 4GB 이상을 요구해요. 요즘 새 외장 그래픽은 8GB부터예요.' : '4K·긴 편집은 그래픽 메모리 8GB가 가성비예요.', x.vram === 4 ? x.src[0] : 'synk'));
      else if (x.id === 'photo') reasons.push(r('블렌더는 그래픽 메모리 8GB를 권해요.', 'blender'));
      else if (x.id === 'llm') reasons.push(r(`${josa(AI[x.size], '을', '를')} 빨리 돌리려면 모델이 그래픽 메모리에 통째로 들어가야 해요. ${x.vram}GB 이상이 필요해요.`, 'ollama-qwen3'));
      else if (x.id === 'image') reasons.push(r('이미지 생성은 커뮤니티 기준으로 SDXL급 8GB, FLUX급은 12~16GB 이상이 편해요.', 'comfy-community'));
      else if (x.id === 'game') reasons.push(r('FHD 게임은 그래픽 메모리 8GB가 가성비예요. 하고 싶은 게임의 권장 그래픽카드를 확인하세요.'));
    }
    if (buy >= 12 && buy <= 16) reasons.push(r('2026년 8월 미국 시세로는 RTX 5060 Ti 16GB(약 805달러)가 RTX 5070 12GB(약 900달러)보다 싸면서 메모리가 커서, AI용 가성비가 좋았어요. 오늘 가격은 프롬프트로 확인하세요.', 'wccftech-gpu'));
    if (ai) reasons.push(r('AI용이면 엔비디아(NVIDIA) 지포스 RTX 계열이 지원하는 프로그램이 가장 많아요.'));
    const llm = w.find(x => x.id === 'llm');
    if (llm && llm.size === 'huge') reasons.push(r('그래픽 메모리 48GB는 일반 그래픽카드로는 어려워요. 맥 스튜디오(최대 128GB)나 웹 AI 구독이 현실적이에요.', 'apple-mac-desktop'));
    else if (llm && llm.size === 'large') reasons.push(r('24GB 이상은 RTX 5090급뿐이라 그래픽카드만 수백만 원이에요. 맥 미니(M5 Pro) 48GB나 웹 AI 구독이 가성비일 수 있어요.', 'apple-mac-desktop'));
    const roomyText = vramRoomy > buy ? `여유가 되면 ${vramRoomy}GB(${GPU_EXAMPLE[vramRoomy] || ''})` : '';
    return { kind: 'dedicated', vram: buy, need, vramRoomy, short: `그래픽 ${buy}GB`, text: `외장 그래픽카드 · 그래픽 메모리 ${buy}GB 이상`, example: GPU_EXAMPLE[buy] || '', roomyText, ai, reasons };
  }

  function computeCpu(a, w, os, form) {
    const reasons = [];
    const heavyCreative = w.some(x => x.weight === 'heavy' && ['video', 'photo'].includes(x.id));
    const aiOrGame = w.some(x => ['llm', 'image', 'game'].includes(x.id)) && !heavyCreative;
    let text;
    if (os === 'mac') {
      if (form.pick === 'desktop' && heavyCreative) { text = '맥 미니 M6 기본 · 4K가 잦으면 M5 Pro'; reasons.push(r('영상은 맥의 미디어 엔진이 처리해서 기본 칩으로도 가성비가 좋아요. 4K 편집이 잦으면 M5 Pro가 더 빨라요.', 'apple-mac-desktop')); }
      else { text = '기본 칩으로 충분'; reasons.push(r(form.pick === 'desktop' ? '맥 미니는 M6 기본 칩으로 충분해요.' : '맥북 에어의 M5 기본 칩으로 충분해요.', form.pick === 'desktop' ? 'apple-mac-desktop' : 'apple-mba')); }
    } else if (heavyCreative) {
      text = os === 'either' ? '중급 이상(윈도우는 코어 울트라 7·라이젠 7급, 맥은 기본 칩부터)' : '중급 이상(코어 울트라 7·라이젠 7급)';
      reasons.push(r('영상 내보내기·3D 렌더링은 CPU도 많이 써요. 한 단계 위 CPU가 시간을 줄여 줘요.'));
    } else if (aiOrGame) {
      text = '중급(코어 울트라 5·라이젠 5급)';
      reasons.push(r('AI와 게임은 그래픽카드가 일을 대부분 해요. CPU는 중급으로 두고 돈은 그래픽카드에 쓰세요.'));
    } else {
      text = os === 'either' ? '중급(윈도우는 코어 울트라 5·라이젠 5급, 맥은 기본 칩)' : '중급(코어 울트라 5·라이젠 5급)';
      reasons.push(r('고른 작업은 중급 CPU면 충분해요. 최상급 CPU는 가격 차이만큼 체감이 크지 않아요.'));
    }
    return { text, reasons };
  }

  // NPU(추천기준 §8-1·탐색노트): 누구에게 의미가 있고 누구에게는 차이가 없는지.
  function judgeNpu(a, w, os, form) {
    const yes = [], no = [];
    const uses = new Set(w.map(x => x.id));
    if (os === 'mac') {
      no.push(r('맥은 모든 모델에 뉴럴 엔진(애플의 NPU)이 들어 있어서 따로 고를 필요가 없어요.'));
      if (uses.has('llm')) no.push(r('맥에서도 Ollama·LM Studio 같은 AI 설치 도구는 뉴럴 엔진이 아니라 그래픽(GPU)으로 돌아가요.', 'ane-llm'));
      return { verdict: 'no', title: '맥은 NPU를 따로 신경 쓰지 않아도 돼요', yes, no };
    }
    if (uses.has('web')) no.push(r('웹 AI(ChatGPT·Claude·Gemini)는 서버가 계산해서 NPU와 상관없어요.'));
    if (uses.has('llm')) no.push(r('내 컴퓨터에 설치한 대화 AI도 마찬가지예요. Ollama·LM Studio는 2026년 중반까지 NPU를 쓰지 않고 그래픽카드·CPU로 돌아가요. 속도는 NPU 숫자(TOPS)가 아니라 메모리 크기와 속도가 정해요.', 'npu-llm'));
    if (uses.has('game')) no.push(r('게임은 NPU를 쓰지 않아요.'));
    if (form.pick === 'desktop') {
      no.push(r('데스크톱은 그래픽카드가 AI 작업을 훨씬 빨리 해서 NPU를 따질 필요가 없어요.'));
      return { verdict: 'no', title: 'NPU는 신경 쓰지 않아도 돼요', yes, no };
    }
    if (uses.has('meeting')) yes.push(r('화상회의 효과(배경 흐림·시선 맞춤·목소리 또렷하게)는 NPU가 맡아요. 줌·팀즈·구글 미트 어디서나 쓰이고 배터리를 덜 써요.', 'ms-copilot-features'));
    if (uses.has('photo') && ['adobe', 'heavy'].includes(a.photo)) yes.push(r('포토샵의 피사체 선택·배경 제거·노이즈 제거·업스케일이 NPU로 더 빠르고 배터리를 덜 써요.', 'wc-npu-apps'));
    if (uses.has('video') && ['capcut', 'resolve'].includes(a.video.app)) yes.push(r(a.video.app === 'capcut' ? '캡컷의 배경 지우기(자동 누끼)·얼굴 추적 같은 AI 기능은 NPU를 써요.' : '다빈치 리졸브의 마스크·업스케일 같은 AI 기능 일부가 NPU를 써요. 주로 스냅드래곤 노트북에서요.', 'wc-npu-apps'));
    if (uses.has('meeting') || uses.has('web')) no.push(r('자막만 켜는 건 NPU 없이 모든 윈도우 11에서 돼요. NPU가 필요한 실시간 번역 자막은 40여 개 언어를 영어로, 27개 언어를 중국어(간체)로만 번역해요. 한국어로 번역되지는 않아요.', 'ms-live-captions'));
    const lead = os === 'either' ? '윈도우 노트북을 고른다면 ' : '';
    if (yes.length) return { verdict: 'some', title: lead ? `${lead}같은 값에 NPU 있는 쪽이 조금 유리해요` : '같은 값이면 NPU 있는 노트북이 조금 유리해요', yes, no, note: r('코파일럿+ 조건을 맞춘 칩(인텔 코어 울트라 200V·300V, AMD 라이젠 AI 300·400, 스냅드래곤 X)은 NPU가 기본으로 들어 있고, 중급 노트북에도 흔히 쓰여요. NPU 때문에 더 비싼 걸 살 필요는 없어요.', 'ms-win11') };
    return { verdict: 'no', title: `${lead}NPU는 신경 쓰지 않아도 돼요`, yes, no, note: r('광고의 ‘AI PC’·TOPS 숫자는 내 용도에서 차이를 만들지 않아요. 그 돈은 램에 쓰세요.') };
  }

  function judgeCurrent(a, w, ram, form) {
    if (!['have', 'extra'].includes(a.owned)) return null;
    const c = a.current, reasons = [], actions = [], can = [];
    const gb = c.ram && c.ram !== 'unknown' ? Number(c.ram) : null;
    let verdict = 'unknown';
    if (gb != null) {
      verdict = gb >= ram.value ? 'enough' : gb >= ram.workable ? 'workable' : gb >= ram.officialMin ? 'tight' : 'short';
      reasons.push(r({ enough: `지금 램 ${gb}GB는 가성비 추천 ${ram.value}GB를 채워요.`, workable: `지금 램 ${gb}GB로 시작할 수 있어요. 가성비 추천 ${ram.value}GB보다는 작아서, 무거운 작업을 할 땐 다른 창을 닫아 주세요.`, tight: `지금 램 ${gb}GB로 돌아가긴 하지만 자주 느려질 거예요. 가성비 추천은 ${ram.value}GB예요.`, short: `지금 램 ${gb}GB는 고른 작업의 공식 최소(${ram.officialMin}GB)보다 작아요.` }[verdict]));
      for (const x of w) {
        const ok = x.weight === 'light' ? 8 : (x.value || 16);
        can.push({ label: x.id === 'web' ? USE_LABEL.web : x.label, level: gb >= ok ? 'ok' : gb >= (x.min || 8) ? 'maybe' : 'no' });
      }
    } else {
      reasons.push(r('램 용량을 모르면 판단이 어려워요. 아래 방법으로 1분 안에 확인할 수 있어요.'));
      actions.push(r('윈도우: 시작 → 설정 → 시스템 → 정보 → ‘설치된 RAM’. 맥: 화면 왼쪽 위 애플 메뉴 → 이 Mac에 관하여 → ‘메모리’.'));
    }
    if (form.heavy && c.kind === 'laptop') {
      const now = c.feel === 'slow' || ['tight', 'short'].includes(verdict);
      actions.push(r(now
        ? '작업이 무거우니 지금 노트북은 밖에서 계속 쓰고, 무거운 작업용 데스크톱을 더하세요. 노트북을 바꾸는 것보다 가성비가 좋아요.'
        : '먼저 지금 노트북으로 해 보세요. 막히면 노트북을 바꾸지 말고 무거운 작업용 데스크톱을 더하세요. 노트북은 밖에서 계속 쓰면 돼요.'));
    }
    if (['tight', 'short'].includes(verdict) && c.kind === 'desktop') actions.push(r('지금 컴퓨터가 데스크톱이라면 램만 더 꽂는 게 가장 싸요. 빈 램 슬롯이 있는지 먼저 보세요.'));
    if (['tight', 'short'].includes(verdict) && !c.kind) actions.push(r('데스크톱이라면 램만 추가할 수 있는 경우도 있어요. 빈 램 슬롯이 있는지 확인해 보세요.'));
    if (c.os === 'win10') actions.push(r('윈도우 10은 2025년 10월 14일에 일반 지원이 끝났어요. ‘PC 상태 검사’ 앱으로 윈도우 11로 바꿀 수 있는지부터 확인하세요.', 'ms-win10'));
    if (c.os === 'mac_intel') actions.push(r('인텔 맥은 macOS 26 Tahoe가 마지막 macOS예요. 앞으로 새 프로그램 지원이 줄어요.', 'apple-tahoe'));
    if (c.os === 'mac_intel' && has(a, 'photo') && a.photo === '3d') actions.push(r('블렌더 5부터는 애플 실리콘(M1 이후) 맥만 지원해요.', 'blender'));
    if (c.feel === 'slow') actions.push(r('느린 원인이 램이 아닐 수도 있어요. 저장공간이 거의 찼는지, 켤 때 함께 실행되는 프로그램이 많은지도 확인해 보세요.'));
    if (c.feel === 'untried') actions.push(r('사기 전에 하려는 작업을 지금 컴퓨터로 한 번 해 보세요. 실제로 막히는 순간이 가장 정확한 기준이에요.'));
    if (['enough', 'workable'].includes(verdict) && c.feel !== 'slow') actions.push(r('지금처럼 쓰다가 실제로 막히는 순간이 생기면 그때 바꿔도 늦지 않아요.'));
    actions.push(r('윈도우는 작업 관리자 → 성능 → 메모리에서, 맥은 활성 상태 보기 → 메모리에서 지금 얼마나 쓰는지 볼 수 있어요.'));
    return { gb, verdict, reasons, actions, can };
  }

  function judgeBudget(a, w, ram, gpu) {
    const level = ram.value >= 96 || gpu.vram >= 24 ? 3 : ram.value >= 48 || gpu.vram >= 12 ? 2 : ram.value >= 24 || gpu.vram >= 8 ? 1 : 0;
    const b = a.budget in BUDGET ? BUDGET[a.budget] : null;
    const warn = b != null && ((level >= 3 && b < 3) || (level >= 2 && b <= 1));
    const tight = !warn && b != null && level >= 2 && b === 2;
    const alternatives = [];
    if (warn) {
      const llm = w.find(x => x.id === 'llm');
      if (llm && ['large', 'huge'].includes(llm.size)) alternatives.push(r('모델을 한 단계 작게 써 보세요. 14B급은 맥 24GB나 그래픽 12GB로도 돌아가요.', 'ollama-qwen3'), r('큰 모델이 꼭 필요하지 않다면 웹 AI 유료 구독이 장비값보다 쌀 수 있어요.'));
      if (w.some(x => x.id === 'image')) alternatives.push(r('이미지 생성은 웹 서비스로 먼저 해 보고, 자주 쓰게 되면 장비를 사도 늦지 않아요.'));
      if (w.some(x => x.id === 'video') && a.video.res === '4k') alternatives.push(r('편집할 때만 가벼운 사본(프록시)을 쓰면 낮은 사양에서도 4K를 다룰 수 있어요.'));
      alternatives.push(r('같은 사양이면 한 세대 전 모델이나 조립 PC 견적이 싼 경우가 많아요.'));
    }
    const tips = [];
    if (tight) tips.push(r('고른 조건이면 이 예산 안에서 빠듯할 수 있어요. 프롬프트로 오늘 가격부터 확인해 보세요.'));
    return { level, budget: a.budget, warn, tight, alternatives, tips };
  }

  // 돈 쓰는 순서(추천기준 §1-5)
  function moneyOrder(ram, gpu, storage, form, os) {
    const steps = [r(`램을 가성비 추천(${ram.value}GB)까지 먼저 채우세요. ${ram.upgradable ? '데스크톱은 나중에 더 꽂을 수 있어요.' : '나중에 늘리기 어려운 부품이에요.'}`)];
    if (gpu.kind === 'dedicated') steps.push(r(`그다음은 그래픽카드예요. 필요한 그래픽 메모리(${gpu.vram}GB)만큼만 사세요. 2026년엔 그래픽 메모리가 클수록 값이 크게 뛰어요.`, 'tpu-gddr7'));
    steps.push(r(`저장공간은 ${storage.valueText}로 시작하고, 모자라면 외장 SSD로 늘리세요.`));
    steps.push(r(os === 'mac' ? '맥은 칩 등급보다 메모리가 먼저예요. 남는 돈이 있을 때만 칩 등급을 올리세요.' : 'CPU는 중급이면 충분해요. 남는 돈이 있을 때만 올리세요.'));
    if (form.pick === 'desktop' && os !== 'mac') steps.push(r('모니터·키보드·마우스·윈도우 값까지 합친 총액으로 비교하세요.'));
    return steps;
  }

  // 사람마다 보여 줄 팁 카드(content.js TIPS의 id). 제작 절차: 추천에 들어간 부품마다 필요 이유·값·필요 없는 경우를 알려 준다.
  function tipIds(w, os, form, gpu) {
    const ids = ['ram-why', 'ram-price'];
    ids.push(os === 'mac' ? 'mac-unified' : form.pick === 'desktop' ? 'ram-desktop' : 'ram-laptop');
    if (gpu.kind === 'dedicated' || gpu.kind === 'either') ids.push('gpu-why', 'gpu-price');
    else if (gpu.kind === 'integrated') ids.push('gpu-none');
    if (form.heavy) ids.push('laptop-gpu');
    ids.push(w.some(x => x.id === 'llm') ? 'npu-llm' : 'npu-what');
    if (w.some(x => ['video', 'llm', 'image', 'game'].includes(x.id))) ids.push('ssd-price');
    return ids;
  }

  function checklist(w, ram, storage, gpu, os, form) {
    const items = [
      { id: 'ram', t: `램 ${ram.value}GB${ram.roomy > ram.value ? ` (여유가 되면 ${ram.roomy}GB)` : ''}`, d: ram.upgradable ? '빈 램 슬롯이 남는지도 물어보세요. 나중에 늘릴 때 필요해요.' : '나중에 늘릴 수 없으니 필요한 만큼 처음에 고르세요.' },
      { id: 'ssd', t: `SSD ${storage.valueText}`, d: 'HDD가 아니라 SSD인지 확인하세요.' },
    ];
    if (gpu.kind === 'dedicated') items.push({ id: 'gpu', t: `그래픽카드의 그래픽 메모리 ${gpu.vram}GB 이상`, d: form.pick === 'desktop' ? '광고의 ‘게이밍’보다 그래픽 메모리 숫자를 보세요. 같은 메모리면 더 싼 모델로.' : '노트북용 그래픽은 같은 이름이어도 데스크톱보다 약해요.' });
    if (os !== 'mac') items.push({ id: 'win', t: '윈도우가 설치돼 있는지', d: '‘FreeDOS’나 ‘OS 미포함’이면 윈도우를 따로 사야 해요.' });
    if (form.pick === 'laptop') items.push({ id: 'weight', t: '본체와 충전기를 함께 든 무게', d: '매장에서 가방에 넣을 무게로 들어 보세요.' });
    if (form.pick === 'desktop') items.push({ id: 'extra', t: '모니터·키보드·마우스까지 합친 총액', d: '표시 가격에 빠진 것이 있는지 확인하세요.' });
    const apps = w.filter(x => ['video', 'photo', 'llm', 'image'].includes(x.id)).map(x => x.label);
    if (apps.length) items.push({ id: 'apps', t: `쓸 프로그램(${apps.join(', ')})의 공식 권장 사양과 한 번 더 비교`, d: '프로그램 업데이트로 권장 사양이 바뀔 수 있어요.' });
    items.push({ id: 'npu', t: 'NPU·‘AI PC’ 표시 때문에 더 비싼 걸 고르지 않았는지', d: '내 용도에서 의미가 있는지는 결과의 NPU 카드를 보세요.' });
    items.push({ id: 'warranty', t: '보증 기간과 수리 받는 곳', d: form.pick === 'desktop' ? '조립 PC라면 부품별 보증을 누가 맡는지 물어보세요.' : '노트북은 수리할 때 맡기는 곳이 가까운지도 보세요.' });
    return items;
  }

  function productLabel(form, os, ram) {
    if (form.pick === 'desktop') {
      if (os === 'mac') return ram.value >= 96 ? '맥 스튜디오' : ram.value >= 48 ? '맥 미니(M5 Pro)' : '맥 미니';
      if (os === 'either') return form.weight === 'light' ? '데스크톱(미니 PC·맥 미니)' : '데스크톱(윈도우 PC·맥 미니)';
      return form.weight === 'light' ? '데스크톱(작은 미니 PC도 충분)' : '데스크톱';
    }
    return os === 'mac' ? '맥북 에어' : os === 'either' ? '노트북(윈도우·맥북 에어)' : '노트북';
  }
  const osLabel = p => ({ mac: '맥', win: '윈도우', either: '맥·윈도우 둘 다 가능' }[p]);
  const usesSummary = w => w.map(x => (x.id === 'web' ? USE_LABEL.web : x.label)).join(', ');

  function promptText(a, w, ram, storage, gpu, cpu, os, form, product) {
    return [
      '너는 가성비를 중시하는 컴퓨터 구매 상담 조수야. 아래 조건에 맞는 컴퓨터를 오늘 기준으로 찾아줘.',
      '',
      '[내 상황]',
      `- 하려는 일: ${usesSummary(w)}`,
      `- 동시에 켜 두는 것: ${{ light: '창 몇 개', normal: '탭 10~20개와 메신저', heavy: '탭 수십 개와 화상회의, 작업 프로그램' }[a.multitask] || '보통'}`,
      `- 들고 다니는 정도: ${PLACE_LABEL[a.place] || '미정'}`,
      `- 운영체제: ${osLabel(os.pick)}`,
      `- 총예산: ${BUDGET_LABEL[a.budget] || '미정'}`,
      '',
      '[필요한 사양 · SYNK 가성비 추천]',
      `- 형태: ${product}${form.notLaptop ? ' (무거운 작업이라 노트북은 제외)' : ''}`,
      `- 램: ${ram.value}GB${ram.roomy > ram.value ? ` (여유가 되면 ${ram.roomy}GB)` : ''}`,
      `- 저장공간: SSD ${storage.valueText}`,
      `- 그래픽: ${gpu.kind === 'dedicated' ? `그래픽 메모리 ${gpu.vram}GB 이상 (예: ${gpu.example})` : gpu.text}`,
      `- CPU: ${cpu.text}`,
      '',
      '[요청]',
      '1. 지금 한국에서 살 수 있는 후보 3개를 가성비 좋은 순서로 비교표로 보여줘. 모델명, 램, 저장공간, 그래픽, 가격, 판매처 링크를 넣어줘.',
      '2. 같은 사양이면 더 싼 쪽을 먼저 보여 주고, 한 세대 전 모델이나 조립 PC 견적도 후보에 넣어줘.',
      '3. 가격은 오늘 확인한 값과 출처를 적고, 확인이 안 되면 ‘확인 필요’라고 써줘.',
      '4. 위 사양보다 낮은 부분이 있으면 표시하고, 그래도 괜찮은지 이유를 말해줘.',
      form.pick === 'desktop' ? '5. 램 슬롯이 남는지(나중에 늘릴 수 있는지)와 모니터·키보드 포함 총액도 알려줘.' : '5. 램을 나중에 늘릴 수 있는지와 본체·충전기 무게도 알려줘.',
      '6. NPU나 ‘AI PC’ 표시 때문에 비싸진 모델이면 알려줘. 내 용도에선 필요 없을 수 있어.',
    ].join('\n');
  }

  function storeText(a, w, ram, storage, gpu, os, form, product) {
    const g = gpu.kind === 'dedicated' ? `, 그래픽 메모리 ${gpu.vram}GB 이상` : '';
    const budget = a.budget && a.budget !== 'unknown' ? `총예산은 ${BUDGET_LABEL[a.budget]}이에요` : '예산은 아직 정하지 않았어요';
    return `저는 ${usesSummary(w)}에 쓸 ${josa(product, '을', '를')} 가성비 좋게 찾고 있어요. 램 ${ram.value}GB, SSD ${storage.valueText}${g}면 돼요. ${budget}. ${form.pick === 'desktop' ? '램을 나중에 더 꽂을 수 있는지' : '램을 나중에 늘릴 수 있는지'}${os.pick !== 'mac' ? ', 윈도우가 설치돼 있는지' : ''}도 알려 주세요.`;
  }

  function compute(input) {
    const a = sanitize(input || {});
    const f = filled(a);
    const w = workloads(f);
    const os = chooseOs(f, w);
    const form = chooseForm(a, w);
    const blocks = deskBlocks(f, w, os.pick);
    const ram = computeRam(f, w, blocks, os.pick, form);
    const storage = computeStorage(f, w, os.pick, form);
    const gpu = computeGpu(f, w, os.pick);
    const cpu = computeCpu(f, w, os.pick, form);
    const npu = judgeNpu(f, w, os.pick, form);
    const current = judgeCurrent(a, w, ram, form);
    const budget = judgeBudget(f, w, ram, gpu);
    const product = productLabel(form, os.pick, ram);
    // 지금 컴퓨터가 있으면: 램이 되고 느리지 않으면 그대로 쓰기, 램은 충분한데 느리면 원인 확인부터, 나머지는 새 추천.
    const cur = a.current || {};
    const heavyOnLaptop = form.heavy && cur.kind === 'laptop';
    const keep = a.owned === 'have' && current && ['enough', 'workable'].includes(current.verdict) && cur.feel !== 'slow';
    const checkFirst = a.owned === 'have' && current && current.verdict === 'enough' && cur.feel === 'slow' && !heavyOnLaptop;
    const spec = `${product} · 램 ${ram.value}GB${gpu.kind === 'dedicated' || gpu.kind === 'either' ? ` · 그래픽 ${gpu.vram}GB` : ` · SSD ${storage.valueText}`}`;
    // spec은 늘 GB·TB(기가·테라)로 끝나서 ‘예요’를 붙인다.
    const buyNew = `새로 산다면 가성비 추천은 ${spec}예요.`;
    const headline = keep
      ? { keep: true, title: '지금 컴퓨터로 시작해도 돼요', sub: `램 ${current.gb}GB면 ${usesSummary(w)}에 ${current.verdict === 'enough' ? '충분해요' : '쓸 만해요'}. ${buyNew}` }
      : checkFirst
        ? { keep: true, title: '램은 충분해요. 느린 원인부터 확인해 보세요', sub: `램 ${current.gb}GB면 ${usesSummary(w)}에 충분해요. 저장공간이 거의 찼는지, 켤 때 함께 실행되는 프로그램이 많은지 먼저 보세요. ${buyNew}` }
        : { keep: false, title: spec, sub: `${usesSummary(w)} 기준 가성비 추천이에요. ${ram.roomy > ram.value ? `여유가 되면 램 ${ram.roomy}GB.` : `이 용도엔 램 ${ram.value}GB면 충분해요.`}${a.owned === 'have' && heavyOnLaptop ? ' 지금 노트북은 밖에서 계속 쓰고, 이 데스크톱을 더하세요.' : ''}` };
    return {
      version: VERSION, answers: a, workloads: w, blocks, used: ram.used, ram, storage, gpu, cpu, npu, os, form, current, budget, headline,
      product, osLabel: osLabel(os.pick), weight: form.weight,
      money: moneyOrder(ram, gpu, storage, form, os.pick),
      tips: tipIds(w, os.pick, form, gpu),
      checklist: checklist(w, ram, storage, gpu, os.pick, form),
      prompt: promptText(a, w, ram, storage, gpu, cpu, os, form, product),
      store: storeText(a, w, ram, storage, gpu, os, form, product),
    };
  }

  // 램 용량별로 책상에 무엇이 올라가는지 — 설명용
  const TIER_NOTES = [
    { gb: 4, t: '윈도우 11의 최소 사양이에요. 켜기만 해도 책상이 거의 차서, 인터넷 창 몇 개에도 버벅일 수 있어요. 2026년에 새로 사는 건 권하지 않아요.', src: 'ms-win11' },
    { gb: 8, t: '웹 AI·문서·온라인 강의는 할 수 있어요. 탭을 많이 열거나 화상회의를 함께 하면 느려지기 쉽고, 영상 편집은 빠듯해요. 새로 산다면 권하지 않아요.', src: 'synk' },
    { gb: 12, t: '일부 노트북에 있는 구성이에요. 8GB보다 웹 작업이 한결 편하지만, 영상 편집이나 AI 설치엔 아직 좁아요.', src: 'synk' },
    { gb: 16, t: 'SYNK 가성비 기준점이에요. 2026년 새 맥북 에어·맥 미니·코파일럿+ PC가 모두 16GB부터 시작해요. 웹 AI, 짧은 FHD 편집, 작은 AI 모델(8B)까지 무난해요.', src: 'apple-mba' },
    { gb: 24, t: '맥에서 고를 수 있는 구성이에요. 14B급 AI 모델이나 긴 FHD 편집을 맥에서 하려면 가성비예요.', src: 'apple-mba' },
    { gb: 32, t: '4K 편집, 큰 사진, 이미지 생성, 개발용 에뮬레이터·도커의 가성비 기준이에요. 어도비가 프리미어에 권하는 용량이기도 해요.', src: 'adobe-pr' },
    { gb: 64, t: '32B급 AI 모델이나 긴 4K 편집의 여유 선택이에요. 대부분의 사람에겐 필요 이상이에요.', src: 'synk' },
  ];

  return Object.freeze({ VERSION, LADDER, REQ, TIER_NOTES, sanitize, compute, up, gbText });
});
