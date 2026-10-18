/* synkbrief 뉴스 · 내 GPTs·젬 옮기기 점검 — 계산 규칙.
 * 원본: SYNK-appsscript/docs/마케팅/맞춤도구/skills/rules.js
 * 답 → 내 경우 한 줄, 날짜(D-몇), 할 일 순서, 안 따라오는 것·신경 안 써도 되는 것, 경고, 옮긴 뒤 확인표, 비교 메모, 사람마다 고른 팁.
 * 순수 함수다. 네트워크·AI 호출·기록이 없다. GPT·젬의 내용은 받지 않는다. 기준 문서: 추천기준.md
 * 날짜는 2026-10-17에 두 고객센터와 두 앱의 안내로 확인했다(탐색노트 §2). D-몇은 그 기기의 오늘로 센다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkSkillsRules = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'skills-rules-v2-2026-10-17';
  const r = (t, src = 'synk') => ({ t, src });
  const list = v => (Array.isArray(v) ? v : []);

  const WHERE = ['gpt', 'gem', 'both'];
  const WHO = ['mine', 'others', 'both'];
  const ACCOUNT = ['unsure', 'personal', 'work', 'school'];
  const GPT_HAS = ['unsure', 'files', 'actions', 'shared', 'drafts', 'plain'];
  const GEM_HAS = ['unsure', 'files', 'tools', 'shared', 'plain'];
  // 할 일 단계에 붙는 실제 앱 화면(2026-10-17·18 캡처, 노란 테). 파일은 ../assets/skills-shot-*.webp
  const SHOT = {
    migrate: { src: 'assets/skills-shot-migrate.webp', w: 877, h: 550, cap: '「내 GPT」에서 옮길 GPT 아래 「플러그인으로 마이그레이션」을 눌러요.', alt: 'ChatGPT 내 GPT 화면. 회의 메모 정리 GPT 아래 플러그인으로 마이그레이션 단추에 노란 테가 있다.' },
    confirm: { src: 'assets/skills-shot-confirm.webp', w: 480, h: 560, cap: '확인 창 아래 「플러그인으로 마이그레이션」을 한 번 더 눌러요.', alt: '회의 메모 정리 마이그레이션 확인 창. 지침 및 파일, 앱 및 액션은 발견된 문제 없음, 접근 및 공유는 비공개 플러그인으로 적혀 있고, 아래 플러그인으로 마이그레이션 단추에 노란 테가 있다.' },
    confirmAction: { src: 'assets/skills-shot-confirm-action.webp', w: 418, h: 344, cap: '「앱 및 액션」 줄이 이렇게 떠도 아래 단추로 그대로 옮겨져요.', alt: '마이그레이션 확인 창의 점검 칸. 앱 및 액션 줄에 지원되지 않는 액션과 사용자 지정 액션은 플러그인에서 작동하지 않지만 해당 액션 없이도 마이그레이션할 수 있다는 글이 있고, 그 줄에 노란 테가 있다.' },
    at: { src: 'assets/skills-shot-at.webp', w: 402, h: 196, cap: '@ 뒤에 이름 앞 글자를 치면 같은 이름이 둘 떠요. 위쪽 「플러그인」 것을 골라요.', alt: 'ChatGPT 새 채팅 입력칸에 @회의를 친 화면. 플러그인 칸의 회의 메모 정리에 노란 테가 있고, 그 아래 맞춤형 GPT 칸에도 같은 이름이 있다.' },
    private: { src: 'assets/skills-shot-private.webp', w: 789, h: 385, cap: '게시할 때 공유는 「나만 보기」 그대로 두고 「저장」을 눌러요.', alt: 'GPT 공유 창. 나만 보기와 저장 단추에 노란 테가 있고, 더 이상 GPT를 공개적으로 공유할 수 없다는 안내가 있다.' },
    gems: { src: 'assets/skills-shot-gems.webp', w: 472, h: 132, cap: 'Gems 화면 맨 위 안내의 「스킬 만들기」에서 미리 만들어 볼 수 있어요.', alt: '제미나이 Gems 화면 맨 위 안내의 두 단추. 자세히 알아보기와 스킬 만들기 가운데 스킬 만들기에 노란 테가 있다.' },
    slash: { src: 'assets/gemini-guide-5-slash.webp', w: 700, h: 200, cap: '채팅 입력칸에 「/」를 치면 내 스킬 이름이 떠요(그림의 이름은 예시예요).', alt: '제미나이 입력칸에 /를 치자 스킬 목록이 뜬 화면. 스킬 항목에 노란 테가 있다.' },
  };
  const LINK = { mygpt: 'https://chatgpt.com/gpts/mine', gems: 'https://gemini.google.com/gems/view' };

  // exact: 날짜까지 공식(앱 안내·FAQ). false면 달만 공식이라 그 달 1일로 세고 「○월 중」으로 쓴다.
  const DATES = {
    gem: {
      personal: { date: '2026-11-17', label: '11월 17일', exact: true, what: '스킬로 자동 이전 시작', src: 'g-app' },
      work: { date: '2027-03-01', label: '2027년 3월 중', exact: false, what: 'Workspace 회사 계정 스킬 전환', src: 'g-help' },
      school: { date: '2027-06-01', label: '2027년 6월 중', exact: false, what: 'Workspace 학교 계정 스킬 전환', src: 'g-help' },
    },
    gpt: {
      personal: { date: '2026-12-11', label: '12월 11일', exact: true, what: 'GPT 종료', src: 'oai-faq' },
      work: { date: '2026-12-11', label: '12월 11일', exact: true, what: 'GPT 종료(기본)', note: '연기가 승인된 Enterprise 워크스페이스는 2027년 2월 11일이에요. 회사 알림을 먼저 보세요.', src: 'oai-faq' },
      school: { date: '2026-12-11', label: '12월 11일', exact: true, what: 'GPT 종료(기본)', note: '학교 워크스페이스는 관리자 안내를 따르세요.', src: 'oai-faq' },
    },
  };
  const ENTERPRISE_FREEZE = { date: '2026-10-26', label: '10월 26일', what: 'Enterprise 새 GPT 만들기 종료(계획)', src: 'oai-faq' };

  function days(date, now) {
    const [y, m, d] = date.split('-').map(Number);
    const t = now instanceof Date && !isNaN(now) ? now : new Date();
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5);
  }
  function dLabel(n, exact) {
    if (!exact) return n > 0 ? `약 ${Math.max(1, Math.round(n / 30))}달 남음` : '그달이 됐어요';
    if (n > 0) return `D-${n}`;
    if (n === 0) return '오늘';
    return '지났어요';
  }

  function sanitize(a) {
    const src = a && typeof a === 'object' ? a : {};
    const one = (v, keys) => (typeof v === 'string' && keys.includes(v) ? v : undefined);
    const out = {};
    const where = one(src.where, WHERE); if (where) out.where = where;
    const who = one(src.who, WHO); if (who) out.who = who;
    const account = one(src.account, ACCOUNT); if (account) out.account = account;
    if (Array.isArray(src.gptHas)) out.gptHas = GPT_HAS.filter(k => src.gptHas.includes(k));
    if (Array.isArray(src.gemHas)) out.gemHas = GEM_HAS.filter(k => src.gemHas.includes(k));
    return out;
  }

  // 「지침만 있어요」·「잘 모르겠어요」를 다른 것과 같이 고르면 다른 것을 따른다. 아무것도 안 고르면 「지침만」으로 본다.
  const real = (has, all) => { const v = list(has).filter(k => all.includes(k)); const x = v.filter(k => k !== 'plain' && k !== 'unsure'); return x.length ? x : (v.includes('unsure') ? ['unsure'] : ['plain']); };

  function facts(answers) {
    const a = sanitize(answers);
    // 계정 「잘 모르겠어요」는 개인 계정 날짜로 센다(accountUnsure로 표시만 남긴다).
    const f = { where: a.where || 'both', who: a.who || 'mine', account: a.account && a.account !== 'unsure' ? a.account : 'personal', accountUnsure: a.account === 'unsure' };
    f.gpt = f.where === 'gpt' || f.where === 'both';
    f.gem = f.where === 'gem' || f.where === 'both';
    f.mine = f.who === 'mine' || f.who === 'both';
    f.others = f.who === 'others' || f.who === 'both';
    f.gptMine = f.gpt && f.mine;
    f.gemMine = f.gem && f.mine;
    f.gptHas = f.gptMine ? real(a.gptHas, GPT_HAS) : [];
    f.gemHas = f.gemMine ? real(a.gemHas, GEM_HAS) : [];
    return { a, f };
  }

  function dateCards(f, now) {
    const cards = [];
    const card = (k, d, key) => {
      const n = days(d.date, now);
      return { k, v: d.label, d: dLabel(n, d.exact !== false), n, past: n < 0, s: d.what, note: d.note || '', src: d.src, key: !!key };
    };
    if (f.gem) cards.push(card('제미나이 젬 → 스킬', DATES.gem[f.account], !f.gptMine));
    if (f.gpt) cards.push(card('ChatGPT GPTs', DATES.gpt[f.account], f.gptMine));
    if (f.gpt && f.account === 'work') cards.push(card('회사 Enterprise', { ...ENTERPRISE_FREEZE, exact: true }, false));
    return cards;
  }

  function headline(f, cards) {
    const gemC = cards.find(c => c.k.startsWith('제미나이')), gptC = cards.find(c => c.k === 'ChatGPT GPTs');
    const gptPast = gptC && gptC.past;
    // 강조(mark)는 제목 끝 절에 둔다 — 문장 가운데 노란 칠은 깨진 것처럼 보였다(10-17 검수).
    let title, mark;
    if (f.gptMine && f.gemMine) { title = '젬은 기다리고, GPTs는 직접 옮겨요'; mark = '직접 옮겨요'; }
    else if (f.gptMine) { title = gptPast ? 'GPTs 종료일이 지났어요' : 'GPTs는 12월 11일 전에 직접 옮겨요'; mark = gptPast ? '지났어요' : '직접 옮겨요'; }
    else if (f.gemMine) { title = '젬은 기다리면 돼요'; mark = '기다리면 돼요'; }
    else { title = '남이 만든 것만 쓴다면, 옮길 건 없어요'; mark = '옮길 건 없어요'; }
    const bits = [];
    if (gemC) bits.push(`젬 ${gemC.v}${gemC.d ? `(${gemC.d})` : ''}`);
    if (gptC) bits.push(`GPTs ${gptC.v}${gptC.d ? `(${gptC.d})` : ''}`);
    const how = f.gptMine
      ? 'GPTs는 「내 GPT」 화면에서 GPT마다 있는 「플러그인으로 마이그레이션」(옮기기) 단추를 직접 눌러야 해요.'
      : f.gpt ? '남이 만든 GPT는 만든 사람이 옮겨요. 만든 사람에게 한 번 물어보면 돼요.' : '';
    const gemHow = !f.gemMine ? '' : f.account === 'personal' ? ' 젬은 그날부터 스킬로 저절로 옮겨지기 시작해요.' : ' 젬은 그달에 스킬로 저절로 옮겨져요. 회사·학교 알림을 같이 보세요.';
    // 낮음 8: 간단히에서는 날짜만(바로 아래 낱말 풀이·할 일이 같은 말을 한다). 기본·자세히는 more까지.
    return { title, mark, sub: `${bits.join(' · ')}.`, more: `${how}${gemHow}`.replace(/\s+/g, ' ').trim() };
  }

  // 할 일: 실제로 손이 가는 행동부터. 꼼꼼히 하고 싶은 사람의 일(비교 메모·확인표)은 결과 아래쪽에 따로 있다.
  function flow(f) {
    const groups = [];
    if (f.gptMine) {
      const has = f.gptHas;
      const steps = [];
      if (has.includes('unsure')) steps.push({ t: '내 GPT에 무엇이 들었는지 보기', d: '「내 GPT」에서 그 GPT의 연필(편집)을 누르고 「구성」을 열어요. 「지식」에 파일이 있는지, 맨 아래 「작업」 칸에 무언가 있는지만 보면 돼요. 둘 다 비어 있으면 가장 쉬운 경우예요. 파일이 있으면 그대로 따라오고, 「작업」 칸에 무언가 있으면 옮긴 뒤 다시 연결해야 해요. 맨 아래 「답 바꿔 보기」에서 「GPT 안」을 고르면 그 경우의 할 일이 나와요.', src: 'synk-seen' });
      if (has.includes('drafts')) steps.push({ t: '고친 것 먼저 게시하기', d: '게시한 판만 옮겨져요. 편집 화면 오른쪽 위 단추로 저장하고, 공유는 「나만 보기」 그대로 두면 돼요. 공개할 필요는 없어요. 옮기지 않을 GPT가 있다면 지침만 지금 복사해 두세요. 12월 11일부터는 열 수 없어요.', src: 'oai-faq', img: SHOT.private });
      else steps.push({ t: '고칠 게 있으면 먼저 고치기', d: '옮긴 뒤엔 원래 GPT를 고치거나 지울 수 없어요(읽기 전용). 고칠 게 없으면 바로 다음으로 가세요. 옮기지 않을 GPT가 있다면 지침만 지금 복사해 두세요. 12월 11일부터는 열 수 없어요.', src: 'oai-faq' });
      steps.push({ t: '「내 GPT」에서 「플러그인으로 마이그레이션」 누르기', d: '마이그레이션은 「옮기기」라는 뜻이에요. 아래 「ChatGPT에서 내 GPT 열기」를 누르면 「내 GPT」 화면이 열려요. 옮길 GPT 아래 단추를 누르세요. 단추가 없으면 그 GPT를 만든 계정으로 로그인했는지 보세요. 휴대폰 앱에 단추가 없으면 컴퓨터 브라우저에서 하세요.', src: 'oai-faq', img: SHOT.migrate, link: { href: LINK.mygpt, label: 'ChatGPT에서 내 GPT 열기' } });
      steps.push({ t: '확인 창에서 한 번 더 누르기', d: '「지침 및 파일」, 「앱 및 액션」, 「접근 및 공유」 세 줄을 점검한 창이 떠요. 아래 「플러그인으로 마이그레이션」을 한 번 더 누르면 몇 초 뒤 「플러그인 마이그레이션이 완료되었습니다」가 떠요. 그만두려면 「나중에 마이그레이션」을 누르면 돼요. 옮겨진 뒤엔 「내 GPT」의 단추가 「플러그인 열기」로 바뀌어요.' + (has.includes('actions') ? ' 액션이 있으면 「앱 및 액션」 줄에 「지원되지 않는 액션」이 떠요. 액션만 빼고 옮겨지니 그대로 눌러도 돼요.' : ''), src: 'synk-seen', img: has.includes('actions') ? SHOT.confirmAction : SHOT.confirm });
      steps.push({ t: '자주 쓰던 질문 하나로 확인하기', d: '새 채팅 입력창에 @와 GPT 이름 앞 글자를 쳐요. 같은 이름이 「플러그인」과 「맞춤형 GPT」 두 곳에 뜨면, 위쪽 「플러그인」 것을 골라 자주 쓰던 질문 하나를 넣어 보세요. 예전처럼 답하면 돼요.' + (has.includes('files') ? ' 지식 파일이 있어야 답할 수 있는 질문으로 하면 참조 파일까지 한 번에 확인돼요.' : '') + (has.includes('actions') ? ' 액션이 필요한 질문은 다음 단계에서 다시 연결한 뒤에 넣어 보세요.' : ''), src: 'synk-seen', img: SHOT.at });
      if (has.includes('actions')) steps.push({ t: '액션 다시 연결하기', d: '다른 서비스와의 연결(액션)은 따라오지 않아요. 같은 일을 하는 앱이 플러그인 쪽에 있는지 먼저 찾고, 없으면 개발자 도움이 필요할 수 있어요.', src: 'oai-faq' });
      if (has.includes('shared')) steps.push({ t: '쓰던 사람들에게 알리기', d: '옮긴 플러그인은 처음엔 나만 보여요. 새로 공유하고 쓰던 사람들에게 알려 주세요.', src: 'oai-faq' });
      groups.push({ id: 'gpt-mine', title: '내가 만든 GPT', steps });
    }
    if (f.gpt && f.others) {
      groups.push({ id: 'gpt-others', title: '남이 만든 GPT', steps: [
        { t: '만든 사람에게 물어보기', d: '옮기는 건 만든 사람만 할 수 있어요. 아래 한 줄을 복사해 그 GPT를 알려 준 사람에게 보내 보세요. 「(GPT 이름)」만 그 GPT 이름으로 바꿔 쓰면 돼요.', src: 'oai-faq', copy: 'ask' },
        { t: '답이 없으면 비슷한 플러그인 찾기', d: 'ChatGPT 왼쪽 메뉴 「플러그인」에서 비슷한 것을 찾아볼 수 있어요. 그 GPT와 나눈 대화는 남지만, GPT 자체는 12월 11일부터 열 수 없어요.', src: 'oai-plugins' },
      ] });
    }
    if (f.gemMine) {
      const has = f.gemHas;
      const wait = { personal: '11월 17일부터 젬이 스킬로 저절로 옮겨지기 시작해요. 지금은 할 일이 없어요. 그 전까지 젬을 그대로 쓰세요.', work: '회사 계정은 2027년 3월에 옮겨져요. 지금은 할 일이 없고, 회사 알림을 같이 보세요.', school: '학교 계정은 2027년 6월에 옮겨져요. 지금은 할 일이 없고, 학교 안내를 같이 보세요.' }[f.account];
      const steps = [{ t: '기다리기', d: wait, src: f.account === 'personal' ? 'g-app' : 'g-help' }];
      if (has.includes('tools')) steps.push({ t: '동영상, 음악, Canvas, Deep Research는 따로', d: '이 기능은 아직 스킬과 같이 안 돼요. 그 일을 할 땐 스킬을 부르지 말고, 기능을 먼저 켠 뒤 필요한 지시는 직접 적으세요.', src: 'g-help' });
      if (has.includes('shared')) steps.push({ t: '같이 쓰던 사람 챙기기', d: '구글은 10월 17일 기준 스킬 공유가 「몇 주 안에」 생긴다고 해요. 옮겨진 뒤 같이 쓰던 사람이 쓸 수 있는지 확인하세요.', src: 'g-help' });
      steps.push({ t: '옮겨진 뒤 「/」로 불러 보기', d: '채팅창에 「/」를 치면 스킬 이름이 떠요. 자주 쓰던 질문 하나로 젬 때처럼 답하는지 보세요.', src: 'g-help', img: SHOT.slash });
      if (f.account === 'personal') steps.push({ t: '미리 써 보고 싶다면(안 해도 돼요)', d: 'Gems 화면 맨 위 안내의 「스킬 만들기」를 누르고 젬에 적어 둔 지침을 복사해 넣어요. 그 지침은 Gems 목록에서 그 젬 옆 연필(수정)을 누르면 보여요. 지식 파일은 내려받아 같이 올려요.', src: 'synk-seen', img: SHOT.gems, link: { href: LINK.gems, label: '제미나이 Gems 열기' } });
      groups.push({ id: 'gem-mine', title: '내가 만든 젬', steps });
    }
    if (f.gem && f.others) {
      groups.push({ id: 'gem-others', title: '남이 공유한 젬', steps: [
        { t: '만든 사람의 안내 보기', d: '남이 공유한 젬이 어떻게 옮겨지는지는 고객센터에 아직 적혀 있지 않아요. 만든 사람에게 확인하세요.', src: 'g-help' },
      ] });
    }
    return groups;
  }

  function carryLists(f) {
    const carry = [], relax = [];
    if (f.gptMine) {
      if (f.gptHas.includes('actions')) carry.push(r('맞춤 액션: 다시 연결해야 해요(개발자 도움이 필요할 수 있어요)', 'oai-faq'));
      if (f.gptHas.includes('shared')) carry.push(r('공유 설정: 쓰던 사람들은 새 플러그인을 저절로 못 받아요', 'oai-faq'));
      if (f.gptHas.includes('drafts')) carry.push(r('게시 안 한 수정: 게시한 판만 옮겨져요', 'oai-faq'));
      if (f.gptHas.includes('files')) relax.push(r('지식 파일: 참조 파일로 복사돼요', 'oai-faq'));
      relax.push(r('공개 공유: 옮기려고 공개할 필요 없어요. 「나만 보기」로 게시하면 돼요', 'oai-faq'));
      relax.push(r('골라 둔 모델: 따라오지 않지만, 대부분 기본값이라 신경 쓰지 않아도 돼요', 'oai-faq'));
    }
    if (f.gpt) relax.push(r('GPT와 나눈 대화: 12월 11일 뒤에도 남아요', 'oai-faq'));
    if (f.gpt && f.others) relax.push(r('남이 만든 GPT: 내가 옮길 수 없고, 옮길 필요도 없어요', 'oai-faq'));
    if (f.gemMine) {
      if (f.gemHas.includes('tools')) carry.push(r('동영상, 음악, Canvas, Deep Research, 가이드 학습: 스킬에서 아직 안 돼요', 'g-help'));
      if (f.gemHas.includes('shared')) carry.push(r('공유: 구글은 10월 17일 기준 「몇 주 안에」 생긴다고 해요', 'g-help'));
      carry.push(r('젬마다 모아 보던 대화 목록: 없어져요(대화는 평소 목록에 남아요)', 'g-help'));
      relax.push(r('젬 옮기기: 기다리면 자동이에요(지원 파일 포함)', 'g-help'));
    }
    return { carry, relax };
  }

  // 경고는 「안 따라오는 것」·할 일 단계와 겹치지 않는 것만(종료일 지남, 회사·학교 일정, 계정을 몰라 개인 날짜로 셈).
  function warnings(f, cards) {
    const w = [];
    const gptC = cards.find(c => c.k === 'ChatGPT GPTs');
    if (gptC && gptC.past && f.gptMine) w.push(r('GPT 종료일이 지났어요. 옮기지 않은 GPT는 열 수 없고, 대화 기록만 남아요.', 'oai-faq'));
    if (f.gpt && f.account !== 'personal') w.push(r(f.account === 'work' ? '회사 워크스페이스는 일정이 다를 수 있어요. 회사 알림과 관리자 안내가 이 화면보다 먼저예요.' : '학교 워크스페이스의 GPT 일정은 관리자 안내를 따르세요.', 'oai-faq'));
    if (f.accountUnsure && (f.gptMine || f.gemMine)) w.push(r('계정을 몰라서 개인 계정 날짜로 셌어요. 회사에서 받은 계정이라면 회사 알림을 같이 보세요.', 'synk'));
    return w;
  }

  function checklist(f) {
    const c = [];
    if (f.gptMine) {
      c.push({ id: 'skill', t: '맞는 스킬을 골라 쓰는지', d: '비교 메모의 질문을 넣고, 답이 GPT 때의 지침을 따르는지 보세요.' });
      c.push({ id: 'files', t: '참조 파일을 쓰는지', d: '지식 파일이 있어야 답할 수 있는 질문을 하나 넣어 보세요.' });
      c.push({ id: 'format', t: '형식이 같은지', d: '표·목록·파일처럼 받던 형식으로 나오는지 보세요.' });
      c.push({ id: 'tools', t: '필요한 도구·연결이 있는지', d: '앱이나 다시 연결한 액션이 실제로 되는지 따로 시험하세요.' });
      if (f.gptHas.includes('shared')) c.push({ id: 'share', t: '같이 쓰던 사람이 쓸 수 있는지', d: '한 명이 설치해 같은 질문을 넣어 보게 하세요.' });
    }
    if (f.gemMine) {
      c.push({ id: 'slash', t: '/로 스킬이 불러지는지', d: '옮겨진 뒤 채팅창에 /를 치고 이름이 보이는지 보세요.' });
      c.push({ id: 'gem-files', t: '파일이 같이 왔는지', d: '젬의 지식 파일을 써야 답할 수 있는 질문을 넣어 보세요.' });
      c.push({ id: 'gem-rule', t: '규칙이 빠진 답이 없는지', d: 'SYNK가 10월 7일 해 본 시험에서 다섯 번 중 한 번은 스킬 규칙이 안 붙었어요. 두세 번 넣어 보세요.' });
    }
    return c;
  }

  function memo(f) {
    const name = f.gptMine && f.gemMine ? 'GPT·젬 이름' : f.gemMine ? '젬 이름' : 'GPT 이름';
    const q = n => [`자주 쓰던 질문 ${n}:`, '  옮기기 전 답(요약):', '  옮긴 뒤 답(요약):', ''];
    return ['[옮기기 전후 비교 메모]', `${name}:`, '', ...q(1), ...q(2), ...q(3), '어려운 질문:', '  옮기기 전 답(요약):', '  옮긴 뒤 답(요약):', '', '볼 것: 맞는 스킬을 골랐나 · 참조 파일을 썼나 · 형식이 같나 · 필요한 도구가 있나', '', '— synkbrief · synk.im/brief/skills/'].join('\n');
  }

  // 남이 만든 GPT만 쓰는 사람이 만든 사람에게 보낼 한 줄(그 GPT를 알려 준 사람에게).
  function ask() {
    return '안녕하세요. 만들어 두신 「(GPT 이름)」 GPT를 잘 쓰고 있어요. ChatGPT GPT가 12월 11일에 끝난다고 해서요. 플러그인으로 옮기실 계획이 있으면, 옮긴 뒤 새로 쓰는 법을 알려 주실 수 있을까요?';
  }

  // 결과 화면 아래 떠 있는 주 단추: 갈래마다 다음에 할 일 하나(내 GPT 열기 · Gems 열기 · 한 줄 복사).
  function primary(f) {
    if (f.gptMine) return { kind: 'link', href: LINK.mygpt, label: 'ChatGPT에서 내 GPT 열기' };
    if (f.gpt && f.others) return { kind: 'copy', id: 'ask', label: '만든 사람에게 보낼 한 줄 복사' };
    if (f.gemMine) return { kind: 'link', href: LINK.gems, label: '제미나이 Gems 열기' };
    return null;
  }

  function tipIds(f) {
    const ids = [];
    if (f.gpt) ids.push('date-gpt');
    if (f.gem) ids.push('date-gem');
    if (f.account !== 'personal') ids.push('date-work');
    if (f.gptMine) {
      ids.push('migrate-how', 'migrate-publish');
      if (f.gptHas.includes('actions')) ids.push('carry-action');
      if (f.gptHas.includes('shared')) ids.push('carry-share');
      if (f.gptHas.includes('files')) ids.push('carry-files');
    }
    if (f.gemMine) {
      ids.push('gem-auto');
      if (f.gemHas.includes('tools')) ids.push('gem-tools');
      if (f.account === 'personal') ids.push('gem-early');
    }
    if (f.gpt && f.others) ids.push('use-others');
    if (f.gptMine || f.gemMine) ids.push('test-compare', 'test-call');
    if (f.gptMine) ids.push('migrate-skip');
    if (f.gptMine && !f.gptHas.includes('shared')) ids.push('carry-share');
    return [...new Set(ids)];
  }

  function compute(answers, now) {
    const { a, f } = facts(answers);
    const cards = dateCards(f, now);
    const { carry, relax } = carryLists(f);
    const warns = warnings(f, cards);
    const groups = flow(f);
    const tips = tipIds(f);
    const sourcesUsed = [...new Set(['oai-faq', 'g-help', ...cards.map(c => c.src), ...warns.map(x => x.src), ...carry.map(x => x.src), ...relax.map(x => x.src), ...groups.flatMap(g => g.steps.map(s => s.src))])];
    return { version: VERSION, answers: a, f, cards, headline: headline(f, cards), groups, carry, relax, warns, checklist: checklist(f), memo: memo(f), ask: f.gpt && f.others ? ask() : '', primary: primary(f), tips, sourcesUsed };
  }

  return Object.freeze({ VERSION, DATES, ENTERPRISE_FREEZE, SHOT, LINK, days, dLabel, sanitize, facts, compute });
});
