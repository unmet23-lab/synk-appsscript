/* yuhobuilds · 내 PC 이사 목록 — 계산 규칙.
 * 원본: SYNK-appsscript/docs/마케팅/맞춤도구/move/rules.js
 * 답 → 머리 글, 한눈에 카드, 먼저 알아 둘 것, ①②③④ 항목(content.ITEMS에서 고르고 순서를 정함), 요청문, 사람마다 고른 팁.
 * 순수 함수다. 네트워크·AI 호출·기록이 없다. 컴퓨터의 파일을 읽지 않는다. 기준 문서: 추천기준.md
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./content.js'));
  else root.SynkMoveRules = factory(root.SynkMoveContent);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C) {
  'use strict';
  const VERSION = 'move-rules-v1-2026-10-17';
  const r = (t, src = 'synk') => ({ t, src });

  const HOW = { ssd: '외장 SSD·USB', cloud: '구글 드라이브 같은 클라우드', direct: '두 PC 직접 연결', unsure: '아직 모름' };
  const HOW_SHORT = { ssd: '외장 SSD', cloud: '클라우드', direct: '직접 연결', unsure: '아직 모름' };
  const HOW_NOTE = { ssd: 'FAT32면 4GB 넘는 파일이 안 들어가요', cloud: '무료 구글 15GB · Microsoft 5GB', direct: '같은 네트워크 · 끝나면 공유 끄기', unsure: '크기부터 재고 정해요' };
  const USE_ORDER = ['work', 'code', 'creative', 'media', 'game', 'ai', 'docs'];  // 머리 둘째 줄·① 순서: 무거운 것부터
  const USE = { ai: 'AI 앱', code: '코딩 도구(git·Python·Node)', creative: '영상·디자인', media: '사진·영상 파일이 많음', work: '회사 보안 프로그램', game: '게임', docs: '문서·웹 위주' };
  const OLD = { sell: '바로 초기화·판매', keep2w: '2주쯤 보관', keep: '계속 씀' };
  const OLD_SHORT = { sell: '바로 판매', keep2w: '2주 보관', keep: '계속 씀' };
  const OLD_NOTE = { sell: '대조가 끝난 뒤 맨 마지막에 초기화', keep2w: '애매한 건 두고 목록만', keep: '두 컴퓨터가 서로 지우지 않게' };

  // 머리: 첫 줄은 방법, 둘째 줄은 가장 무거운 하는 일.
  const HEAD = { ssd: '외장 SSD로 한 번에', cloud: '클라우드로 가볍게', direct: '두 PC를 이어서', unsure: '방법을 고르기 전에' };
  const FOCUS = { work: '회사 자료는 회사 방식으로', code: '키와 안 올린 코드부터', creative: '프로젝트와 원본부터', media: '원본 사진·영상부터', game: '세이브 파일부터', ai: 'AI 지침과 키부터', docs: '인증서와 받아 둔 서류부터' };
  const OLD_SUB = {
    sell: '옛 컴퓨터는 팔기 전에 대조를 끝내고, 초기화는 맨 마지막에 해요.',
    keep2w: '옛 컴퓨터를 2주 두니까 애매한 건 두고 와도 돼요.',
    keep: '옛 컴퓨터도 계속 쓰니 급하게 다 옮기지 않아도 돼요.',
  };
  // 머리 그림: 방법을 설명하는 펠트 물건(외장 SSD · 짐 매단 구름 · 케이블로 이은 두 노트북 · 짐 올린 저울).
  const ART = { ssd: 'ssd', cloud: 'cloud', direct: 'direct', unsure: 'scale' };

  // 시계는 파일을 넣기 전에, 대조는 방법에 맞게.
  const CLOCK_WHEN = { ssd: 'SSD에서 복사해 넣기 전에', cloud: '클라우드에서 받기 전에', direct: '옛 PC에서 가져오기 전에', unsure: '파일을 옮겨 넣기 전에' };
  const COMPARE_WHERE = {
    ssd: 'SSD로 옮긴 폴더마다 파일 수·크기',
    cloud: '올린 묶음 수와 받은 묶음 수, 폴더별 파일 수·크기',
    direct: '가져온 폴더마다 파일 수·크기',
    unsure: '중요한 폴더마다 파일 수·크기',
  };

  const MUST_BY_USE = { work: ['m-work'], code: ['m-ssh', 'm-git', 'm-env'], creative: ['m-project', 'm-fonts'], media: ['m-originals'], game: ['m-saves'], ai: ['m-ai-local', 'm-ai-keys'], docs: ['m-docs'] };
  const SKIP_BY_USE = { work: ['s-work-apps'], code: ['s-deps', 's-clones'], creative: ['s-render'], media: ['s-media-cloud'], game: ['s-games'], ai: ['s-ai-chats', 's-models'], docs: ['s-browser-folder'] };
  const REDO_BY_USE = { work: ['r-work'], code: ['r-ssh-perm', 'r-git-login', 'r-env', 'r-toolchain'], creative: ['r-adobe', 'r-fonts'], media: ['r-photo-sync'], game: ['r-games'], ai: ['r-ai-login'], docs: ['r-printer', 'r-license'] };
  const VERIFY_BY_USE = { work: ['v-work'], code: ['v-git', 'v-robocopy', 'v-ssh'], creative: ['v-project'], media: ['v-media'], game: ['v-game'], ai: ['v-ai'], docs: ['v-docs'] };

  function sanitize(a) {
    const src = a && typeof a === 'object' ? a : {};
    const out = {};
    if (typeof src.how === 'string' && HOW[src.how]) out.how = src.how;
    if (Array.isArray(src.uses)) { const u = USE_ORDER.filter(k => src.uses.includes(k)); if (u.length) out.uses = Object.keys(USE).filter(k => u.includes(k)); }
    if (typeof src.old === 'string' && OLD[src.old]) out.old = src.old;
    return out;
  }

  function item(id, fill) {
    const it = C.ITEMS[id];
    if (!it) throw new Error(`모르는 항목 ${id}`);
    const t = it.t.replace('{when}', fill.when || '').replace('{where}', fill.where || '').trim();
    return { id, t, d: it.d, src: it.src };
  }
  const byUse = (table, uses) => USE_ORDER.filter(u => uses.includes(u)).flatMap(u => table[u]);
  const uniq = ids => [...new Set(ids)];

  function lists(f) {
    const fill = { when: CLOCK_WHEN[f.how], where: COMPARE_WHERE[f.how] };
    const must = uniq([...byUse(MUST_BY_USE, f.uses), ...(f.old === 'sell' ? ['m-left-sell'] : f.old === 'keep2w' ? ['m-left-2w'] : []), 'm-local', 'm-cert', 'm-pw']);
    const skip = uniq([...(f.how === 'cloud' ? ['s-big-reget'] : []), ...byUse(SKIP_BY_USE, f.uses), ...(f.old === 'keep2w' ? ['s-unsure-2w'] : f.old === 'keep' ? ['s-unsure-keep'] : []), 's-apps', 's-cache', 's-cloud-only', 's-installers']);
    const redo = uniq(['r-clock', 'r-onedrive-setup', ...byUse(REDO_BY_USE, f.uses), 'r-browser', 'r-credman', 'r-apps', 'r-cert', ...(f.how === 'cloud' ? ['r-cloud-clean'] : f.how === 'direct' ? ['r-share-off'] : []), ...(f.old === 'sell' ? ['r-reset-sell'] : f.old === 'keep2w' ? ['r-reset-2w'] : ['r-keep-sync'])]);
    const verify = uniq(['v-compare', ...(f.how === 'ssd' ? ['v-ssd-err'] : []), ...byUse(VERIFY_BY_USE, f.uses), 'v-must', 'v-open', 'v-onedrive', ...(f.old === 'sell' ? ['v-sell'] : f.old === 'keep2w' ? ['v-2w'] : [])]);
    const map = ids => ids.map(id => item(id, fill));
    return { must: map(must), skip: map(skip), redo: map(redo), verify: map(verify) };
  }

  function tipIds(f) {
    const has = u => f.uses.includes(u);
    const ids = ['onedrive-full', 'must-first'];
    if (has('code')) ids.push('must-code');
    if (has('work')) ids.push('work-policy');
    if (has('creative')) ids.push('creative-license');
    if (has('media')) ids.push('media-originals');
    if (has('game')) ids.push('game-saves');
    ids.push('must-cert', `method-${f.how}`, 'clock-first', 'login-cookies');
    if (has('ai') || has('code')) ids.push('login-apps');
    if (has('code')) ids.push('ssh-perm', 'env-merge');
    ids.push('skip-reget', 'verify-compare', `old-${f.old}`, 'onedrive-fix');
    return uniq(ids);
  }

  function warnings(f) {
    const w = [];
    if (f.how === 'unsure') w.push(r('먼저 크기부터 재요: 사용자 폴더를 오른쪽 클릭 → 속성. 무료 클라우드(구글 15GB, Microsoft 5GB) 안이면 클라우드, 그보다 크면 외장 SSD, 두 컴퓨터를 한곳에 켜 둘 수 있으면 직접 연결이 편해요.', 'google-storage'));
    if (f.how === 'ssd') w.push(r('SSD·USB가 FAT32로 포맷돼 있으면 4GB 넘는 파일 하나가 들어가지 않아요. 영상이나 큰 압축 파일이 있다면 먼저 확인하세요.', 'ms-fs'));
    if (f.how === 'cloud') w.push(r('무료 용량은 구글 15GB(Gmail·포토와 나눔), Microsoft 5GB예요. 차면 새 파일을 올릴 수 없어요. ②를 먼저 빼고 크기를 재세요.', 'google-storage'));
    if (f.how === 'direct') w.push(r('Microsoft가 안내하던 「새 PC로 파일과 설정 옮기기」는 지원 문서에 더 이상 사용할 수 없다고 적혀 있어요(10월 17일 확인). 폴더 공유로 옮기거나, Microsoft가 대신 안내하는 Windows 백업·복원을 써요.', 'ms-transfer'));
    if (f.uses.includes('work')) w.push(r('회사 보안 프로그램이 있는 컴퓨터는 회사가 정한 이사 방법이 먼저예요. Windows 백업도 회사·학교 계정은 지원하지 않아요.', 'ms-backup'));
    if (f.old === 'sell' && f.uses.includes('game')) w.push(r('클라우드 저장을 쓰지 않는 게임의 세이브는, 옛 컴퓨터를 팔고 나면 되살릴 수 없어요.', 'steam-cloud'));
    return w;
  }

  /** 요청문 [지킬 것]의 비밀 파일 예시 — 하는 일에 있는 것만(코딩이 아니면 ssh·.env를 말하지 않는다) */
  function secrets(f) {
    const s = [];
    if (f.uses.includes('code')) s.push('ssh 키', '.env');
    if (f.uses.includes('ai') || f.uses.includes('code')) s.push('API 키');
    s.push('공동인증서');
    return s.join('·');
  }

  function prompt(f, L) {
    const lines = [];
    lines.push('새 컴퓨터로 이사하려고 해. Windows에서 Windows로 옮겨. 아래 조건대로 같이 해 줘.', '');
    lines.push('[내 조건]', `· 옮기는 방법: ${HOW[f.how]}`, `· 이 컴퓨터로 하는 일: ${f.uses.map(u => USE[u]).join(', ')}`, `· 옛 컴퓨터: ${OLD[f.old]}`, '');
    lines.push('[1. 절대 두고 가면 안 되는 것 — 이것부터]', '아래 목록은 「이미 백업돼 있다」고 보여도 어떤 규칙으로도 빼지 마. 옮길 목록을 짜기 전에, 항목마다 이 컴퓨터 어디에 있는지부터 찾아서 알려 줘.', ...L.must.filter(x => !x.id.startsWith('m-left')).map(x => `- ${x.t}`), '');
    lines.push('[2. OneDrive 확인]', '바탕화면·문서·사진이 OneDrive로 백업되고 있다면, 저장 공간이 차서 백업이 멈췄는지 먼저 확인해 줘. 멈춰 있으면 그 뒤로 만든 파일은 이 컴퓨터에만 있는 걸로 보고 1번에 넣어 줘. 클라우드에만 있는 파일(온라인 전용)은 열지 마. 열면 내려받아.', '');
    lines.push('[3. 두고 올 것]', '다시 받으면 되는 건 옮기지 마. 뺀 것은 파일 목록으로 남겨 줘.', ...L.skip.map(x => `- ${x.t}`), '');
    const during = ['- 새 컴퓨터의 날짜·시간·표준 시간대가 맞는지 확인한 뒤에 파일을 넣어 줘.'];
    if (f.how === 'ssd') during.push('- SSD·USB가 FAT32면 4GB 넘는 파일이 안 들어가니 먼저 확인해 줘. 복사는 끊겨도 이어지는 방법(예: robocopy /z)으로 하고, 대상에서 파일을 지우는 옵션(/mir, /purge)은 쓰지 마.');
    if (f.how === 'cloud') during.push('- 무료 용량(구글 15GB, Microsoft 5GB)이 모자랄 수 있으니 옮길 크기부터 재 줘. 묶음 단위로 올리고, 재부팅으로 받기가 끊겨도 받은 것 다음부터 이어 받게 해 줘.');
    if (f.how === 'direct') during.push('- 두 컴퓨터를 같은 네트워크에 두고 폴더 공유로 옮겨 줘. 끝나면 이사 때문에 연 공유를 다시 꺼 줘.');
    if (f.how === 'unsure') during.push('- 옮기는 방법은 아직 못 정했어. 옮길 크기를 먼저 재고, 외장 SSD·클라우드·두 PC 직접 연결 중 무엇이 나은지 이유와 함께 추천해 줘.');
    if (f.uses.includes('code')) during.push('- 환경 변수는 옛 값으로 덮지 말고 새 컴퓨터 값과 합쳐 줘(Path는 없는 항목만 더하기, 바꾸기 전 값은 파일로 남기기). ssh 개인 키는 옮긴 뒤 내 계정만 읽게 권한을 고쳐 줘.');
    if (f.uses.includes('work')) during.push('- 회사 자료는 회사가 정한 방법이 있는지 나한테 먼저 물어봐 줘. 개인 클라우드나 USB로 옮기라고 하지 마.');
    if (f.uses.includes('creative')) during.push('- 편집 프로젝트는 원본 폴더와 같은 구조로 옮겨서 경로가 깨지지 않게 해 줘.');
    if (f.uses.includes('game')) during.push('- 게임은 클라우드 저장을 쓰는지 게임마다 확인하고, 안 쓰는 게임의 세이브 폴더를 찾아 줘.');
    lines.push('[4. 옮기는 동안]', ...during, '');
    lines.push('[5. 끝났는지 확인]', '옛 컴퓨터와 대조해서 알려 줘: 폴더별 파일 수·크기, 빠진 파일 목록, 1번 목록이 다 있는지, 다시 로그인하거나 설치할 곳 목록.', '');
    const oldLine = { sell: '이사가 끝나면 옛 컴퓨터는 초기화해서 팔 거야. 5번 대조가 끝나기 전에는 초기화하라고 하지 마.', keep2w: '옛 컴퓨터는 2주 보관해. 애매한 건 옮기지 말고 「두고 간 것 목록」에 적어서 새 컴퓨터에 남겨 줘.', keep: '옛 컴퓨터도 계속 써. 두 컴퓨터가 같은 클라우드 폴더를 동기화해서, 한쪽에서 정리한 파일이 다른 쪽에서 지워지지 않게 해 줘.' }[f.old];
    lines.push('[지킬 것]', `- 옛 컴퓨터에서는 아무것도 지우지 마. ${oldLine}`, '- 명령을 직접 실행할 수 있다면, 실행 전에 무엇을 할지 먼저 말하고 내가 좋다고 하면 해 줘.', `- ${secrets(f)} 같은 비밀 파일은 암호를 건 압축으로만 옮기고, 클라우드·공유 폴더·USB에 둔 이사용 사본은 5번 대조가 끝나면 지워 줘.`, '- 비밀번호·키·토큰 값은 화면에 보여 주지 마.');
    return lines.join('\n');
  }

  function compute(answers) {
    const a = sanitize(answers);
    const f = { how: a.how || 'unsure', uses: a.uses || ['docs'], old: a.old || 'keep2w' };
    const focus = USE_ORDER.find(u => f.uses.includes(u)) || 'docs';
    const L = lists(f);
    const headline = {
      title: `${HEAD[f.how]},`,
      hl: FOCUS[focus],
      sub: `절대 두고 가면 안 되는 것 ${L.must.length}가지부터 챙기고, 두고 와도 되는 것 ${L.skip.length}가지는 옮기지 않아요. ${OLD_SUB[f.old]}`,
    };
    const cards = [
      { k: '절대 두고 가면 안 되는 것', v: `${L.must.length}가지`, key: true, s: `맨 위: ${L.must[0].t}` },
      { k: '두고 와도 되는 것', v: `${L.skip.length}가지`, s: `맨 위: ${L.skip[0].t}` },
      { k: '옮긴 뒤 다시 할 것', v: `${L.redo.length}가지`, s: '첫 줄은 새 컴퓨터 시계' },
      { k: '옮기는 방법', v: HOW_SHORT[f.how], s: HOW_NOTE[f.how] },
      { k: '옛 컴퓨터', v: OLD_SHORT[f.old], s: OLD_NOTE[f.old] },
    ];
    const tips = tipIds(f);
    const warns = warnings(f);
    const sourcesUsed = [...new Set(['ms-quota', 'ms-folder-backup', 'synk-move', ...warns.map(w => w.src), ...[...L.must, ...L.skip, ...L.redo, ...L.verify].map(x => x.src), ...C.onedrive.steps.map(s => s.src)])];
    return { version: VERSION, answers: a, f, focus, headline, art: ART[f.how], cards, warns, ...L, prompt: prompt(f, L), tips, sourcesUsed };
  }

  return Object.freeze({ VERSION, HOW, USE, OLD, USE_ORDER, sanitize, compute });
});
