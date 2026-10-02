/* synkbrief 활용 · 회의 기록 맞춤 정리 — 계산 규칙.
 * 원본: SYNK-appsscript/docs/마케팅/맞춤도구/meeting/rules.js
 * 답 → 나의 정리 순서, 요청문·저장할 규칙·다음 회의 한 줄·보낼 글 요청문, 설정 카드, 확인표, 사람마다 고른 팁.
 * 순수 함수다. 네트워크·AI 호출·기록이 없다. 회의 내용은 받지 않는다. 기준 문서: 추천기준.md
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkMeetingRules = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'meeting-rules-v1-2026-09-29';
  const r = (t, src = 'synk') => ({ t, src });
  const list = v => (Array.isArray(v) ? v : []);

  const MEET = { team: '팀 회의', client: '고객 미팅', one: '1:1 면담', class: '수업·스터디', group: '모임 회의' };
  const RECORD = { memo: '직접 쓴 메모', photo: '손글씨·화이트보드 사진', transcript: '녹음을 글로 바꾼 내용', audio: '녹음 파일', chat: '메신저 대화', auto: '회의 앱 자동 기록' };
  const SHARE = { me: '나', team: '참석자들', boss: '상사', absent: '참석하지 못한 사람', client: '고객' };
  const CHANNEL = { messenger: '메신저', email: '메일', doc: '공유 문서' };
  const AI_LABEL = { chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini' };
  const PLAN_LABEL = { free: '무료', paid: '유료', work: '회사·학교 계정' };

  // 회의 종류별 정리 칸(추천기준 §4). 칸 이름이 곧 요청문의 순서다.
  const SECTIONS = {
    team: ['핵심 요약(2~3문장)', '결정된 내용', '할 일(업무·담당자·기한 표)', '확인할 내용'],
    client: ['핵심 요약(2~3문장)', '고객 요청 사항', '우리가 약속한 것(담당자·기한 표)', '숫자·날짜 확인(금액·수량·납기)', '확인할 내용', '다음 연락'],
    one: ['핵심 요약(2~3문장)', '합의한 것', '서로 할 일(담당자·기한 표)', '다음에 확인할 것'],
    class: ['핵심 내용', '예시와 설명', '과제와 마감', '물어볼 것', '다음 수업 준비'],
    group: ['결정된 내용', '역할(누가 무엇을)', '일정·장소', '돈(회비·비용)', '확인할 내용'],
  };
  // 회의마다 ‘확정된 것’과 ‘아직 모르는 것’을 담는 칸 이름. 요청문 규칙이 이 이름을 쓴다.
  const DECIDED = { team: '결정된 내용', client: '우리가 약속한 것', one: '합의한 것', class: '', group: '결정된 내용' };
  const OPEN = { team: '확인할 내용', client: '확인할 내용', one: '다음에 확인할 것', class: '물어볼 것', group: '확인할 내용' };
  const NEXT_DATE = { team: '다음 회의 날짜를 할 일의 기한으로', client: '다음 미팅 날짜를 약속의 기한으로', one: '다음 면담 날짜를 할 일의 기한으로', class: '다음 수업 날짜를 과제 마감으로', group: '다음 모임 날짜를 역할의 기한으로' };
  const TASK_RULE = {
    team: '할 일은 업무·담당자·기한 표로 정리하세요. 없는 정보는 ‘확인 필요’로 표시하세요.',
    client: '우리가 약속한 것은 내용·담당자·기한 표로 정리하세요. 없는 정보는 ‘확인 필요’로 표시하세요.',
    one: '서로 할 일은 내용·담당자·기한 표로 정리하세요. 없는 정보는 ‘확인 필요’로 표시하세요.',
    class: '과제는 과제·마감 표로 정리하세요. 마감이 없으면 ‘확인 필요’로 표시하세요.',
    group: '역할은 사람·맡은 일·기한 표로 정리하세요. 없는 정보는 ‘확인 필요’로 표시하세요.',
  };
  const SECTIONS_SHORT = { team: '요약 · 결정 · 할 일 · 확인', client: '요약 · 요청 · 약속 · 숫자 · 확인 · 다음 연락', one: '요약 · 합의 · 할 일 · 다음 확인', class: '핵심 · 예시 · 과제 · 질문 · 준비', group: '결정 · 역할 · 일정 · 돈 · 확인' };

  // AI별 저장 위치와 메뉴(2026-09 확인). 화면 언어에 따라 영어로 보일 수 있어 영어 이름을 함께 적는다.
  const SAVE = {
    chatgpt: {
      name: '프로젝트', where: 'ChatGPT 프로젝트의 ‘지침’',
      steps: [
        r('왼쪽 메뉴에서 ‘프로젝트’ → ‘새 프로젝트’를 눌러요.', 'oa-projects'),
        r('이름을 ‘회의 정리’로 적고, ‘프로젝트 전용 메모리’를 고른 뒤 ‘프로젝트 만들기’를 눌러요. 다른 대화의 기억이 섞이지 않아요.', 'oa-projects'),
        r('프로젝트 화면 오른쪽 위 점 세 개(…) 메뉴 → ‘프로젝트 설정’ → ‘지침’ 칸에 규칙을 붙여 넣고 ‘저장’을 눌러요.', 'oa-projects'),
      ],
      open: '왼쪽 메뉴의 ‘프로젝트’에서 ‘회의 정리’를 열고 새 채팅에 보내요',
      note: r('계정 전체의 ‘맞춤 지침(Custom Instructions)’에 넣지 마세요. 모든 대화에 섞여요. 프로젝트 지침은 그 프로젝트 안에서만 쓰여요.', 'oa-projects'),
    },
    claude: {
      name: '프로젝트', where: 'Claude 프로젝트의 지침',
      steps: [
        r('왼쪽 메뉴의 ‘프로젝트(Projects)’에서 새 프로젝트를 만들고 이름을 ‘회의 정리’로 적어요. 무료도 5개까지 만들 수 있어요.', 'an-projects'),
        r('프로젝트 화면의 ‘Set project instructions’(프로젝트 지침 설정)를 눌러 규칙을 붙여 넣고 ‘Save instructions’(저장)를 눌러요.', 'an-instructions'),
        r('프로젝트마다 기억이 따로라서, 회의 정리 프로젝트의 기억은 다른 대화와 섞이지 않아요.', 'an-projects'),
      ],
      open: '왼쪽 ‘프로젝트’에서 ‘회의 정리’를 열고 새 채팅에 보내요',
      note: null,
    },
    gemini: {
      name: 'Gem', where: 'Gemini Gem의 ‘요청 사항’',
      steps: [
        r('‘사이드바 열기’ → ‘Gems’ → ‘새 Gem’을 눌러요.', 'gg-gems'),
        r('이름을 ‘회의 정리’로 적고 ‘요청 사항’ 칸에 규칙을 붙여 넣은 뒤 ‘저장’을 눌러요.', 'gg-gems'),
        r('2026년 11월부터 개인 계정의 Gem은 ‘스킬’로 자동으로 바뀌어요. 저장한 규칙과 파일도 함께 옮겨져요.', 'gg-skills'),
      ],
      open: '사이드바의 ‘Gems’에서 ‘회의 정리’를 열고 보내요',
      note: r('스킬로 바뀐 뒤에는 18세 이상, ‘활동 기록 보관’이 켜진 개인 계정에서 쓸 수 있어요.', 'gg-skills'),
    },
  };

  // AI별 정보 보호 설정(개인 계정 기준)과 업무 계정 안내.
  const PRIVACY = {
    chatgpt: {
      off: r('설정 → 데이터 제어 → ‘모두를 위한 모델 개선’(Improve the model for everyone)을 끄면 새 대화가 학습에 쓰이지 않아요.', 'oa-data'),
      temp: r('민감한 회의는 ‘임시 채팅’으로 보내세요. 기록에 남지 않고 학습·메모리에 쓰이지 않아요. 안전을 위해 최대 30일 보관돼요.', 'oa-temp'),
      work: r('ChatGPT Business·Enterprise·Edu 계정의 대화는 기본적으로 학습에 쓰이지 않아요.', 'oa-data'),
    },
    claude: {
      off: r('설정 → Privacy(개인정보)에서 모델 학습 허용 스위치를 끄세요. 허용하면 대화를 최대 5년, 끄면 30일 보관해요.', 'an-terms'),
      temp: r('민감한 회의는 시크릿(Incognito) 채팅으로 보내세요. 기록·기억·학습에 쓰이지 않아요. 프로젝트 밖에서만 열리니 요청문 전체를 함께 붙여요.', 'an-incognito'),
      work: r('Claude 업무용(Team·Enterprise) 계정에는 개인 계정의 학습 선택이 적용되지 않아요. 회사 규칙을 따르면 돼요.', 'an-terms'),
    },
    gemini: {
      off: r('‘설정 및 도움말’ → ‘활동’에서 활동 기록 보관을 ‘사용 중지’하면 학습에 쓰이지 않아요. 꺼도 대화는 최대 72시간 보관돼요.', 'gg-activity'),
      temp: r('민감한 회의는 ‘임시 채팅’으로 보내세요. 학습에 쓰이지 않아요. 임시 채팅 안에서는 Gem을 쓸 수 없으니 요청문 전체를 붙여요.', 'gg-temp'),
      work: r('업무·학교 계정의 Gemini 대화는 허락 없이 조직 밖 모델 학습에 쓰이지 않아요.', 'gg-workspace'),
    },
  };

  // 녹음 파일을 글로 바꾸는 길(기기별). 조사: 탐색노트 §2-4.
  const TRANSCRIBE = {
    galaxy: { v: '갤럭시 녹음 앱의 텍스트 변환', t: r('갤럭시 녹음 앱에서 녹음을 열고 텍스트 변환(텍스트 변환 어시스트)을 쓰세요. One UI 6.1 이상에서 한국어를 지원하고, 국내에서는 인터넷 연결과 삼성 계정 로그인이 필요해요.', 'ss-transcript') },
    iphone: { v: '아이폰 음성 메모의 받아 적기', t: r('아이폰 음성 메모에서 녹음을 열면 받아 적은 글을 볼 수 있어요. iOS 26 기준 아이폰 12 이상에서 한국어를 지원해요.', 'ap-voicememo') },
    meetingapp: { v: '회의 앱의 자동 기록 확인', t: r('회의 앱의 자동 기록부터 확인하세요. 한국어를 지원하지만 대부분 회사용·유료 요금제에서 돼요.', 'ms-recap') },
    other: { v: '클로바노트에 파일 올리기', t: r('녹음 파일을 네이버 클로바노트에 올려 한국어로 받아 적으세요. 개인은 매달 300분까지 무료이고, 한 번에 180분까지 올릴 수 있어요.', 'nv-clova') },
  };

  function sanitize(a) {
    const pick = (v, allowed) => (allowed.includes(v) ? v : undefined);
    const out = {};
    out.meet = pick(a && a.meet, Object.keys(MEET));
    out.record = list(a && a.record).filter(x => Object.hasOwn(RECORD, x));
    const au = (a && a.audio) || {};
    out.audio = { device: pick(au.device, ['galaxy', 'iphone', 'meetingapp', 'other']), mins: pick(au.mins, ['u10', 'u60', 'o60']) };
    out.length = pick(a && a.length, ['short', 'mid', 'long']);
    const ai = (a && a.ai) || {};
    out.ai = { app: pick(ai.app, ['chatgpt', 'claude', 'gemini', 'none']), plan: pick(ai.plan, ['free', 'paid', 'work']) };
    out.freq = pick(a && a.freq, ['once', 'weekly', 'many']);
    out.share = list(a && a.share).filter(x => Object.hasOwn(SHARE, x));
    out.channel = pick(a && a.channel, Object.keys(CHANNEL));
    out.sensitive = pick(a && a.sensitive, ['none', 'internal', 'personal', 'unsure']);
    return out;
  }

  // 결과에 필요한 답이 비어 있으면 보통값으로 채운다(공유 링크·중간 저장).
  function filled(a) {
    return {
      meet: a.meet || 'team',
      record: a.record.length ? a.record : ['memo'],
      audio: { device: a.audio.device || 'other', mins: a.audio.mins || 'u60' },
      length: a.length || 'mid',
      ai: { app: a.ai.app || 'none', plan: a.ai.plan || 'free' },
      freq: a.freq || 'once',
      share: a.share.length ? a.share : ['me'],
      channel: a.channel || 'messenger',
      sensitive: a.sensitive || 'unsure',
    };
  }
  const has = (f, id) => f.record.includes(id);
  const heard = f => has(f, 'transcript') || has(f, 'auto') || has(f, 'audio');
  const isLong = f => f.length === 'long' || (has(f, 'audio') && f.audio.mins === 'o60');
  const others = f => f.share.filter(x => x !== 'me');
  // Gemini는 10분 이하 녹음 파일을 바로 받아 받아 적기와 정리를 한 번에 한다(무료 오디오 합계 10분).
  const directAudio = (f, ai) => has(f, 'audio') && ai.app === 'gemini' && f.audio.mins === 'u10';
  const onlyAttach = (f, ai) => f.record.length === 1 && (has(f, 'photo') || directAudio(f, ai));
  const josa = (word, withBatchim, without) => {
    const last = String(word).trim().replace(/\s*\([^()]*\)$/, '').slice(-1);
    const code = last.charCodeAt(0) - 0xac00;
    if (code >= 0 && code <= 11171) return word + (code % 28 ? withBatchim : without);
    return word + (/[013678LMNlmn]$/.test(last) ? withBatchim : without);
  };

  function chooseAi(f) {
    let app = f.ai.app;
    const picked = app !== 'none';
    const reasons = [];
    if (!picked) {
      if (has(f, 'audio') && f.audio.mins === 'u10' && f.record.length === 1) {
        app = 'gemini';
        reasons.push(r('녹음 파일만 있고 10분 이하라면, Gemini 무료에 파일을 바로 올려 받아 적기와 정리를 한 번에 할 수 있어요.', 'gg-limits'));
      } else if (isLong(f)) {
        app = 'claude';
        reasons.push(r('긴 기록을 넣는다면 무료에서도 한 번에 많이 읽는 Claude가 편해요. 무료도 모델에 따라 최대 1M 토큰까지 읽어요.', 'an-pricing'));
      } else {
        app = 'chatgpt';
        reasons.push(r('영상과 11쪽 PDF가 ChatGPT 화면이라 그대로 따라 하기 쉬워요. 프로젝트도 무료에서 쓸 수 있어요.', 'oa-projects'));
      }
      if (f.ai.plan === 'work') reasons.push(r('회사·학교 계정이 있다면 회사가 허락한 AI부터 확인하세요. 회사 계정은 기본적으로 조직 밖 모델 학습에 쓰이지 않아요.', 'synk'));
    }
    const plan = picked ? f.ai.plan : (f.ai.plan === 'work' ? 'work' : 'free');
    return { app, picked, plan, label: AI_LABEL[app], planLabel: PLAN_LABEL[plan], reasons };
  }

  // 기록 넣는 법: 붙여 넣기 · 나눠 보내기 · 파일 · 사진 첨부
  function inputPlan(f, ai) {
    const reasons = [];
    const long = isLong(f);
    let method = 'paste';
    if (long) {
      if (ai.app === 'claude') { method = 'paste'; reasons.push(r('Claude는 한 번에 읽는 양이 커서 긴 기록도 대부분 한 번에 붙여 넣을 수 있어요. 아주 길면 .txt 파일로 올려도 돼요.', 'an-pricing')); if (ai.plan === 'free') reasons.push(r('다만 무료는 사용량이 5시간 단위라, 긴 기록을 여러 번 넣으면 금방 찰 수 있어요.', 'an-pricing')); }
      else if (ai.app === 'gemini' && ai.plan !== 'paid' && ai.plan !== 'work') { method = 'split'; reasons.push(r('Gemini 무료는 한 번에 32K 토큰까지 읽어요. 긴 기록은 두세 번에 나눠 보내고 마지막에 전체를 정리하게 해요.', 'gg-limits')); }
      else if (ai.app === 'chatgpt' && ai.plan === 'free') { method = 'split'; reasons.push(r('ChatGPT 무료는 한 번에 약 12쪽을 읽어요. 긴 기록은 두세 번에 나눠 보내고 마지막에 전체를 정리하게 해요.', 'oa-pricing')); reasons.push(r('1만 자가 넘게 붙여 넣으면 자동으로 첨부 파일이 돼요. 무료는 파일을 하루 3개까지 올릴 수 있어요.', 'oa-files')); }
      else { method = 'file'; reasons.push(r(ai.app === 'chatgpt' ? '유료·회사 계정은 한 번에 약 40쪽을 읽어요. 그보다 길면 .txt 파일로 올리거나 나눠 보내세요.' : '한 번에 읽는 양이 커서 긴 기록도 붙여 넣거나 파일로 올릴 수 있어요.', ai.app === 'chatgpt' ? 'oa-pricing' : 'gg-limits')); }
    } else if (f.length === 'mid' && ai.app === 'chatgpt' && ai.plan === 'free') {
      reasons.push(r('1시간 안쪽 메모는 대부분 한 번에 붙여 넣을 수 있어요. 무료는 한 번에 약 12쪽이 한도예요.', 'oa-pricing'));
    } else if (!onlyAttach(f, ai)) reasons.push(r('기록을 그대로 복사해 요청문 아래에 붙여 넣으면 돼요.'));
    if (has(f, 'photo')) reasons.push(r('사진은 복사하지 말고 그대로 첨부하세요. AI가 사진 속 글을 먼저 옮겨 적고 정리해요.'));
    if (has(f, 'chat')) reasons.push(r('메신저 대화는 회의와 관련된 날짜 범위만 복사하세요. 앞뒤 잡담이 많으면 결정이 묻혀요.'));
    if (has(f, 'auto')) reasons.push(r('회의 앱의 자동 요약만 넣지 말고 자막(대본)도 함께 넣으면 빠진 결정을 찾을 수 있어요.'));
    const direct = directAudio(f, ai);
    if (direct) reasons.unshift(r('녹음 파일은 요청문과 함께 첨부해 보내요. Gemini가 받아 적은 뒤 정리해요.', 'gg-limits'));
    const v = direct && f.record.length === 1 ? '녹음 파일 그대로 첨부' : has(f, 'photo') && f.record.length === 1 ? '사진 그대로 첨부' : { paste: '그대로 붙여 넣기', split: '두세 번에 나눠 보내기', file: '파일로 올리거나 나눠 보내기' }[method];
    return { method, v, reasons };
  }

  function transcribePlan(f, ai) {
    if (!has(f, 'audio')) return null;
    const route = TRANSCRIBE[f.audio.device];
    const reasons = [directAudio(f, ai) ? r(`Gemini를 쓰지 않거나 10분이 넘으면: ${route.t.t}`, route.t.src) : route.t];
    let v = route.v;
    if (f.audio.device === 'meetingapp') {
      reasons.push(r('구글 미트 ‘회의록 작성’은 한국어를 지원하지만 업무 계정이나 Google AI Pro 이상이 필요하고, 무료 Gmail에서는 안 돼요. 한 회의에 한 언어만 돼요.', 'gg-meet'));
      reasons.push(r('팀즈 회의 요약은 Teams Premium이나 Copilot 라이선스가 필요해요. 무료 팀즈는 실시간 자막만 돼요.', 'ms-recap'));
      reasons.push(r('줌 회의 요약은 한국어를 지원해요. 유료 요금제용이라는 안내와 무료도 월 3회라는 안내가 서로 달라서, 내 계정 메뉴에서 확인하세요.', 'zoom-summary'));
      reasons.push(r('회의 앱 기록이 없다면 녹음 파일을 클로바노트에 올리세요. 개인은 매달 300분까지 무료예요.', 'nv-clova'));
    } else if (f.audio.device !== 'other') reasons.push(r('기기에서 안 되면 녹음 파일을 클로바노트에 올려도 돼요. 개인은 매달 300분까지 무료이고 한 번에 180분까지 올릴 수 있어요.', 'nv-clova'));
    if (f.audio.mins === 'o60') reasons.push(r('3시간이 넘는 녹음은 클로바노트에 한 번에 못 올려요(한 번에 180분). 나눠서 올리세요.', 'nv-clova'));
    if (directAudio(f, ai)) { v = 'Gemini에 녹음 파일 바로 올리기'; reasons.unshift(r('Gemini는 녹음 파일을 바로 올려 받아 적기와 정리를 한 번에 할 수 있어요. 무료는 오디오를 합쳐 10분까지예요.', 'gg-limits')); }
    else if (f.audio.mins === 'u10') reasons.push(r('10분 이하라면 Gemini 무료에 녹음 파일을 바로 올려 받아 적게 해도 돼요. 무료는 오디오를 합쳐 10분까지예요.', 'gg-limits'));
    else if (ai.app === 'gemini') reasons.push(r('Gemini에 녹음 파일을 바로 올리려면 무료는 오디오 합계 10분, Google AI Pro·Ultra는 3시간까지예요.', 'gg-limits'));
    if (ai.app === 'chatgpt' && ai.plan !== 'free') reasons.push(r('ChatGPT의 기록 모드(Record)는 유료 요금제의 macOS 앱에서만 되고 영어에서 가장 정확해요. 한국어 회의라면 받아 적기 앱을 먼저 쓰세요.', 'oa-record'));
    reasons.push(r('받아 적은 글은 이름·숫자·말한 사람이 틀릴 수 있어요. 요청문에 확인 규칙을 넣었어요.'));
    return { v, reasons };
  }

  function paidVerdict(f, ai) {
    const yes = [], no = [];
    if (ai.plan === 'work') return { verdict: 'no', v: '회사 계정 그대로 충분해요', yes, no: [PRIVACY[ai.app].work] };
    if (ai.plan === 'paid') return { verdict: 'no', v: `${ai.label} 유료면 넉넉해요`, yes, no: [r('지금 요금제로 긴 기록과 잦은 정리도 충분히 할 수 있어요.')] };
    const long = isLong(f);
    if (long && ai.app === 'chatgpt') yes.push(r('1시간 넘는 기록을 자주 넣는다면: 무료는 한 번에 약 12쪽, Go·Plus는 약 40쪽을 읽어요. Go는 월 13,000원, Plus는 월 29,000원이에요.', 'oa-pricing'));
    if (long && ai.app === 'gemini') yes.push(r('1시간 넘는 기록을 자주 넣는다면: 무료는 한 번에 32K 토큰, Google AI Pro(월 29,000원)는 1M 토큰까지 읽어요.', 'gg-limits'));
    if (long && ai.app === 'claude') yes.push(r('긴 기록을 여러 번 넣는다면: 무료 사용량은 5시간 단위로 차요. Pro(월 20달러)는 무료보다 5배 이상 써요.', 'an-pricing'));
    if (f.freq === 'many') yes.push(r('하루에 여러 회의를 정리한다면 무료 사용량이 모자랄 수 있어요. 한도에 걸릴 때 유료를 생각해도 늦지 않아요.'));
    if (has(f, 'audio') && ai.app === 'gemini' && f.audio.mins !== 'u10') yes.push(r('녹음 파일을 Gemini에 바로 올리려면: 무료는 오디오 합계 10분, Google AI Pro는 3시간까지예요.', 'gg-limits'));
    no.push(r(long ? '짧은 회의는 무료로 충분해요. 긴 기록이 가끔이라면 나눠 보내는 것으로 해결돼요.' : '메모나 1시간 안쪽 회의는 무료로 충분해요.'));
    no.push({ chatgpt: r('규칙을 저장하는 프로젝트도 무료에서 쓸 수 있어요.', 'oa-projects'), claude: r('규칙을 저장하는 프로젝트도 무료에서 5개까지 만들 수 있어요.', 'an-projects'), gemini: r('규칙을 저장하는 Gem도 무료에서 만들 수 있어요.', 'gg-gems-free') }[ai.app]);
    return { verdict: yes.length ? 'some' : 'no', v: yes.length ? `${ai.label} 무료로 시작, 자주·길면 유료` : `${ai.label} 무료로 충분해요`, yes, no };
  }

  function privacyPlan(f, ai) {
    const P = PRIVACY[ai.app];
    const reasons = [];
    let v;
    if (ai.plan === 'work') {
      v = '회사 계정과 회사 규칙대로';
      reasons.push(P.work);
      if (f.sensitive === 'personal') reasons.push(r('회사 계정이어도 회의록에 필요 없는 연락처·계좌번호는 지우고 넣는 게 좋아요.'));
    } else if (f.sensitive === 'none') {
      v = '그대로 넣어도 돼요';
      reasons.push(r('가상이거나 공개돼도 괜찮은 내용이라면 설정을 바꾸지 않아도 돼요. 회사 자료라면 회사 규칙을 먼저 보세요.'));
    } else {
      v = f.sensitive === 'personal' ? '개인정보는 지우고, 임시 채팅으로' : f.sensitive === 'internal' ? '회사 계정 우선, 없으면 학습 끄기' : '넣기 전에 한 번 훑어보기';
      if (f.sensitive === 'personal' || f.sensitive === 'unsure') reasons.push(r('연락처·주소·계좌번호·주민등록번호·건강 이야기는 지우고 넣으세요. 이름은 ‘담당자 A’처럼 바꿔도 정리에는 문제없어요.'));
      if (f.sensitive === 'internal') reasons.push(r('매출·계획·인사 같은 회사 내부 정보는 회사가 허락한 계정과 규칙이 먼저예요. 회사 계정이 있다면 그걸 쓰세요.'));
      reasons.push(P.off, P.temp);
    }
    return { v, reasons };
  }

  function sharePlan(f) {
    const to = others(f);
    if (!to.length) return null;
    const names = to.map(x => SHARE[x]).join('·');
    const ch = CHANNEL[f.channel];
    const reasons = [];
    if (to.includes('boss')) reasons.push(r('상사에게는 결론·결정·요청할 것 세 줄을 맨 위에 두게 했어요.'));
    if (to.includes('absent')) reasons.push(r('참석하지 못한 사람에게는 배경 한 줄과 그 사람에게 온 일을 먼저 보여 주게 했어요.'));
    if (to.includes('team')) reasons.push(r('참석자들에게는 할 일을 담당자별로 모아 각자 자기 일을 바로 찾게 했어요.'));
    if (to.includes('client')) reasons.push(r('고객에게는 내부 메모와 추측, ‘확인 필요’ 표시를 빼고 확인할 것은 정중한 질문으로 바꾸게 했어요.'));
    reasons.push(r({ messenger: '메신저는 표가 깨지기 쉬워서 짧은 줄 목록으로 바꾸게 했어요.', email: '메일은 제목·인사·요약·요청·마무리 순서로 만들게 했어요.', doc: '공유 문서는 제목과 표를 그대로 살리게 했어요.' }[f.channel]));
    return { v: `${names} · ${ch}`, names, channel: ch, reasons };
  }

  function firstPrompt(f, ai, input) {
    const L = [];
    L.push('아래 회의 기록을 읽기 쉬운 회의록으로 정리해줘.');
    L.push(`[회의] ${MEET[f.meet]} · 날짜: (날짜를 적어 주세요) · 참석자: (이름을 적어 주세요, 모르면 비워 두세요)`);
    L.push(`[기록] ${f.record.map(x => (x === 'audio' && directAudio(f, ai)) || x === 'photo' ? `${RECORD[x]}(첨부)` : RECORD[x]).join(', ')}`);
    L.push(`[정리 칸] ${SECTIONS[f.meet].join(' / ')}`);
    L.push('[규칙]');
    L.push('- 기록에 없는 내용은 추측하지 말고, 모르면 ‘확인 필요’로 표시해줘.');
    L.push(`- ${NEXT_DATE[f.meet]} 쓰지 마.`);
    L.push(f.meet === 'class' ? '- 헷갈리거나 정해지지 않은 건 ‘물어볼 것’으로 분리해줘.' : `- 제안이나 미정 사항은 ${DECIDED[f.meet]}에 넣지 말고 ‘${OPEN[f.meet]}’으로 분리해줘.`);
    if (directAudio(f, ai)) L.push('- 첨부한 녹음을 먼저 받아 적은 뒤 정리해줘. 알아듣기 어려운 부분은 [?]로 표시해줘.');
    if (heard(f)) L.push('- 녹음을 글로 옮긴 기록이라 이름·숫자·말한 사람이 틀렸을 수 있어. 확실하지 않으면 ‘확인 필요’로 표시해줘.');
    if (has(f, 'photo')) L.push('- 첨부한 사진의 글을 먼저 옮겨 적고, 읽기 어려운 글자는 [?]로 표시한 뒤 정리해줘.');
    if (has(f, 'chat')) L.push('- 메신저 대화라 잡담이 섞여 있어. 결정·할 일·약속만 골라줘.');
    if (has(f, 'auto')) L.push('- 회의 앱이 만든 자동 요약과 자막이야. 요약에 없는 세부는 자막에서 찾아줘.');
    if (f.meet === 'one') L.push('- 사적인 이야기나 사람을 평가하는 표현은 회의록에 옮기지 마.');
    if (f.meet === 'client' || f.meet === 'group') L.push('- 금액·수량·날짜는 원문 표현 그대로 적어줘.');
    if (f.sensitive === 'personal' || f.sensitive === 'unsure') L.push('- 연락처·계좌번호 같은 개인정보가 남아 있으면 회의록에 옮기지 말고 ‘(개인정보 생략)’으로 적어줘.');
    L.push('- 마지막에 모호한 점을 질문으로 모아줘.');
    if (input.method === 'split') L.push('- 기록이 길어서 여러 번 나눠 보낼게. 내가 ‘끝’이라고 할 때까지는 ‘받았어’라고만 답하고, ‘끝’이라고 하면 전체를 한 번에 정리해줘.');
    L.push('', '[회의 기록]', onlyAttach(f, ai) ? `(${has(f, 'photo') ? '사진' : '녹음 파일'}을 첨부했어요)` : '(여기에 기록을 그대로 붙여 넣으세요)');
    return L.join('\n');
  }

  function rulesText(f, ai, share) {
    const place = SAVE[ai.app].name === 'Gem' ? '이 Gem은' : '이 프로젝트는';
    const kinds = f.record.map(x => RECORD[x]).join(', ');
    const R = [];
    R.push('이번 메시지의 회의 기록만 사용하세요. 지난 회의의 이름·날짜·업무를 섞지 마세요.');
    if (f.freq === 'many') R.push(`맨 위에 회의 종류를 적고 종류에 맞는 칸을 쓰세요. 팀 회의: ${SECTIONS.team.join(' / ')}. 고객 미팅: ${SECTIONS.client.join(' / ')}. 1:1 면담: ${SECTIONS.one.join(' / ')}. 수업: ${SECTIONS.class.join(' / ')}. 모임: ${SECTIONS.group.join(' / ')}. 종류를 모르면 팀 회의 칸을 쓰세요.`);
    else R.push(`${SECTIONS[f.meet].join(' / ')} 순서로 정리하세요.`);
    if (f.freq === 'many') R.push('요약은 2~3문장으로, 결정·합의·약속 칸에는 확정된 사항만 적으세요.');
    else if (f.meet === 'class') R.push('핵심 내용은 짧게, 예시와 설명은 수업에서 나온 것만 적으세요.');
    else if (f.meet === 'group') R.push(`${josa(DECIDED.group, '은', '는')} 확정된 사항만 적으세요.`);
    else R.push(`요약은 2~3문장으로, ${josa(DECIDED[f.meet], '은', '는')} 확정된 사항만 적으세요.`);
    R.push(f.freq === 'many' ? '할 일·약속·과제는 무엇을·누가·언제까지 표로 정리하세요. 없는 정보는 ‘확인 필요’로 표시하세요.' : TASK_RULE[f.meet]);
    R.push(f.freq === 'many' ? '제안이나 미정 사항은 확정된 칸에 넣지 말고 ‘확인할 내용’이나 ‘물어볼 것’으로 분리하세요.' : f.meet === 'class' ? '헷갈리거나 정해지지 않은 건 ‘물어볼 것’으로 분리하세요.' : `제안이나 미정 사항은 ${DECIDED[f.meet]}에 넣지 말고 ‘${OPEN[f.meet]}’으로 분리하세요.`);
    R.push(f.freq === 'many' ? '다음 회의·수업 날짜는 할 일의 기한과 구분하세요. 기록에 없는 정보는 추측하지 마세요.' : `${NEXT_DATE[f.meet]} 쓰지 마세요. 기록에 없는 정보는 추측하지 마세요.`);
    if (heard(f)) R.push('녹음을 글로 옮긴 기록은 이름·숫자·말한 사람이 틀릴 수 있어요. 확실하지 않으면 ‘확인 필요’로 표시하세요.');
    if (f.meet === 'one') R.push('사적인 이야기나 사람을 평가하는 표현은 회의록에 옮기지 마세요.');
    if (f.meet === 'client' || f.meet === 'group') R.push('금액·수량·날짜는 원문 표현 그대로 적으세요.');
    R.push('메모를 미리 다듬으라고 요구하지 말고, 있는 기록으로 먼저 정리하세요. 모호한 점은 마지막에 질문하세요.');
    R.push('사용자가 근거를 물으면 해당 원문 문장을 함께 보여주세요.');
    if (f.sensitive !== 'none') R.push('연락처·계좌번호 같은 개인정보는 회의록에 옮기지 말고 ‘(개인정보 생략)’으로 적으세요.');
    if (share) R.push(`사용자가 ‘보낼 글로 바꿔줘’라고 하면 ${share.names}에게 ${share.channel}로 보낼 글로 바꾸세요. ${shareRules(f, true).join(' ')}`);
    R.push('결과는 검토용 초안이에요. 외부 메시지 전송, 업무 배정, 일정 등록은 하지 마세요.');
    return `${place} 회의 기록을 읽기 쉬운 회의록으로 정리하는 공간입니다.\n사용자가 ${josa(kinds, '을', '를')} 주면 다음 규칙을 따르세요.\n\n${R.map((x, i) => `${i + 1}. ${x}`).join('\n')}`;
  }

  // 받는 사람별 규칙. polite=true는 저장할 규칙(존댓말), false는 채팅에 보내는 요청문(반말)이다.
  function shareRules(f, polite) {
    const to = others(f), out = [];
    const say = (p, c) => out.push(polite ? p : c);
    if (to.includes('boss')) say('상사에게는 맨 위에 결론·결정·요청할 것을 세 줄로 두세요.', '상사용은 맨 위에 결론·결정·요청할 것을 세 줄로 둬.');
    if (to.includes('absent')) say('참석하지 못한 사람에게는 첫 줄에 회의 배경을 한 문장으로 쓰고, 그 사람에게 온 일을 먼저 보여 주세요.', '참석하지 못한 사람용은 첫 줄에 회의 배경을 한 문장으로 쓰고, 그 사람에게 온 일을 먼저 보여 줘.');
    if (to.includes('team')) say('참석자들에게는 할 일을 담당자별로 모아 주세요.', '참석자용은 할 일을 담당자별로 모아 줘.');
    if (to.includes('client')) say('고객에게는 정중한 말투로 쓰고, 내부 메모·추측·‘확인 필요’ 표시는 빼고, 확인이 필요한 건 질문으로 바꾸세요. 금액·수량·날짜는 원문 그대로 쓰세요.', '고객용은 정중한 말투로 쓰고, 내부 메모·추측·‘확인 필요’ 표시는 빼고, 확인이 필요한 건 질문으로 바꿔 줘. 금액·수량·날짜는 원문 그대로 써 줘.');
    const ch = { messenger: ['메신저용이니 표 대신 짧은 줄 목록으로, 10줄 안쪽으로 쓰세요.', '메신저용이니 표 대신 짧은 줄 목록으로, 10줄 안쪽으로 써 줘.'], email: ['메일이니 제목, 인사, 요약, 요청, 마무리 순서로 쓰세요.', '메일이니 제목, 인사, 요약, 요청, 마무리 순서로 써 줘.'], doc: ['공유 문서이니 제목과 표를 살려서 쓰세요.', '공유 문서이니 제목과 표를 살려서 써 줘.'] }[f.channel];
    say(ch[0], ch[1]);
    return out;
  }

  function sharePrompt(f, share) {
    if (!share) return '';
    const to = others(f);
    const L = [`위 회의록을 ${share.names}에게 ${share.channel}로 보낼 글로 바꿔줘.`];
    if (to.length > 1) L.push('받는 사람마다 따로 만들어줘.');
    for (const x of shareRules(f, false)) L.push(`- ${x}`);
    L.push('- 내가 읽고 직접 보낼 거니까 초안만 줘. 보내거나 일정을 등록하지는 마.');
    return L.join('\n');
  }

  function nextLine(f, ai, input) {
    const L = ['이번 회의도 정리해줘.'];
    if (input.method === 'split') L.push('기록이 길어서 나눠 보낼게. ‘끝’이라고 하면 전체를 정리해줘.');
    L.push('', onlyAttach(f, ai) ? `(${has(f, 'photo') ? '사진' : '녹음 파일'}을 첨부하세요)` : '(이 줄 아래에 이번 회의 기록을 붙여 넣으세요)');
    return L.join('\n');
  }

  function flowSteps(f, ai, input, tr, share, save) {
    const S = [];
    const direct = directAudio(f, ai);
    if (tr && !direct) S.push({ t: '녹음을 글로 바꾸기', d: `${tr.v}. ${tr.reasons[0].t}`, src: tr.reasons[0].src });
    if (f.sensitive !== 'none' && ai.plan !== 'work') S.push({ t: '넣기 전에 지울 것 지우기', d: f.sensitive === 'internal' ? '회사 계정이 있다면 그걸로 하세요. 개인 계정이라면 학습 설정을 끄거나 임시 채팅으로 보내세요.' : '연락처·계좌번호 같은 개인정보는 지우고, 이름은 ‘담당자 A’처럼 바꿔도 돼요. 설정은 아래 ‘정보 보호’ 카드에 있어요.', src: 'synk' });
    if (!onlyAttach(f, ai)) S.push({ t: '기록을 한곳에 모아 그대로 복사하기', d: input.method === 'split' ? '긴 기록은 두세 덩어리로 나눠 두세요. 다듬지 않아도 돼요.' : '다듬지 않아도 돼요. 메모·대화·받아 적은 글이 나뉘어 있으면 한 번에 모아요.', src: 'synk' });
    const careful = f.sensitive !== 'none' && ai.plan !== 'work';
    const tempName = { chatgpt: '임시 채팅', claude: '시크릿 채팅', gemini: '임시 채팅' }[ai.app];
    const where = `${ai.label} ${careful ? tempName : '새 채팅'}에`;
    const attach = direct ? '녹음 파일' : has(f, 'photo') ? '사진' : '';
    S.push({
      t: attach ? `${where} 요청문을 붙이고 ${attach}을 첨부해 보내기` : `${where} 요청문과 기록을 함께 보내기`,
      d: `${direct ? 'Gemini 무료는 오디오를 합쳐 10분까지예요. 받아 적기와 정리를 한 번에 해요. ' : ''}${attach && f.record.length > 1 ? '다른 기록은 [회의 기록] 아래에 붙여 넣어요. ' : attach ? '' : '아래 요청문을 붙이고 [회의 기록] 아래에 기록을 넣어요. '}날짜와 참석자 칸을 채우면 더 정확해요.${careful ? ` ${tempName}은 기록에 남지 않고 학습에 쓰이지 않아요.` : ''}`,
      src: careful ? { chatgpt: 'oa-temp', claude: 'an-incognito', gemini: 'gg-temp' }[ai.app] : direct ? 'gg-limits' : 'synk',
    });
    S.push({ t: '이름·날짜·숫자를 원본과 대조하기', d: '특히 ‘확인 필요’와 기한 칸을 보세요. 틀린 곳은 같은 채팅에 “○○의 기한은 9월 30일이야, 고쳐줘”라고 말하면 돼요.', src: 'synk' });
    if (share) S.push({ t: `${share.names}에게 보낼 글로 바꿔 직접 보내기`, d: `‘보낼 글로 바꾸는 요청문’을 같은 채팅에 보내고, 읽어 본 뒤 복사해서 ${share.channel}로 보내요.`, src: 'synk' });
    if (save.recommend) S.push({ t: `규칙을 ${ai.label} ${SAVE[ai.app].name}에 한 번 저장하기`, d: '다음 회의부터는 ‘이번 회의도 정리해줘’ 한 줄과 기록만 보내면 같은 형식으로 나와요.', src: 'synk' });
    if (save.privateMode) S.push({ t: '요청문을 메모 앱에 저장해 두기', d: `다음 회의 때도 저장해 둔 요청문과 기록을 ${tempName}에 붙이면 같은 형식으로 나와요.`, src: 'synk' });
    return S;
  }

  function checklist(f, share) {
    const C = [];
    C.push({ id: 'names', t: '이름·호칭', d: heard(f) ? '참석자 이름이 원본과 같은지. 녹음을 글로 바꾼 기록은 이름이 자주 틀려요.' : '참석자 이름이 원본과 같은지.' });
    const nextWord = { team: '다음 회의 날짜가 기한으로', client: '다음 미팅 날짜가 약속 기한으로', one: '다음 면담 날짜가 기한으로', class: '다음 수업 날짜가 과제 마감으로', group: '다음 모임 날짜가 역할 기한으로' }[f.meet];
    C.push({ id: 'dates', t: '날짜·요일', d: `기한의 날짜와 요일이 맞는지, ${nextWord} 들어가지 않았는지.` });
    C.push(f.meet === 'class'
      ? { id: 'owners', t: '과제와 마감', d: '과제 이름과 마감이 원본과 같은지. 마감이 없으면 ‘확인 필요’가 맞아요.' }
      : { id: 'owners', t: '담당자', d: '할 일마다 담당자가 원본에 있는지. 없으면 ‘확인 필요’가 맞아요.' });
    if (f.meet === 'client' || f.meet === 'group' || heard(f)) C.push({ id: 'numbers', t: '숫자', d: '금액·수량·시간이 원본과 같은지. 녹음 글이라면 녹음을 다시 들어 확인하세요.' });
    C.push({ id: 'asks', t: '‘확인 필요’ 항목', d: '누구에게 언제 물을지 정했는지.' });
    if (f.sensitive === 'personal' || f.sensitive === 'unsure') C.push({ id: 'personal', t: '지운 정보', d: '연락처·계좌번호·주민등록번호가 회의록과 보낼 글에 남지 않았는지.' });
    if (has(f, 'audio') || has(f, 'transcript')) C.push({ id: 'consent', t: '녹음 사실 알리기', d: '참석자에게 녹음한다는 걸 알렸는지. 회사·학교 규칙도 확인하세요.' });
    if (share && others(f).includes('client')) C.push({ id: 'external', t: '외부에 보낼 글', d: '내부 메모, 추측, ‘확인 필요’ 표시가 남지 않았는지.' });
    C.push({ id: 'send', t: '내가 직접 보내기', d: 'AI가 대신 보내게 하지 말고, 읽어 본 뒤 복사해서 보내요.' });
    return C;
  }

  function tipIds(f, ai) {
    const ids = [];
    if (has(f, 'audio')) ids.push('audio-route');
    if (isLong(f)) ids.push('long-record');
    ids.push('hallucination');
    if (heard(f)) ids.push('transcript-errors');
    if (has(f, 'photo')) ids.push('photo-memo');
    if (has(f, 'memo') || has(f, 'chat')) ids.push('raw-memo');
    ids.push('format-by-meeting');
    if (others(f).length) ids.push('share-by-recipient');
    if (f.sensitive !== 'none' || heard(f)) ids.push('privacy-training');
    if (has(f, 'audio') || has(f, 'transcript')) ids.push('recording-consent');
    if (!ai.picked) ids.push('which-ai');
    if (ai.plan !== 'work') ids.push('free-or-paid');
    ids.push('project-save');
    return ids;
  }

  function compute(answers) {
    const a = sanitize(answers || {});
    const f = filled(a);
    const ai = chooseAi(f);
    const input = inputPlan(f, ai);
    const tr = transcribePlan(f, ai);
    const share = sharePlan(f);
    const paid = paidVerdict(f, ai);
    const privacy = privacyPlan(f, ai);
    // 민감한 회의를 자주 정리하는데 Claude·Gemini라면, 시크릿·임시 채팅에서는 프로젝트·Gem을 못 쓴다.
    // 그때는 규칙 대신 요청문을 메모 앱에 저장해 두고 매번 붙이게 한다(privateMode).
    const privateMode = f.freq !== 'once' && ai.plan !== 'work' && ['personal', 'internal'].includes(f.sensitive) && (ai.app === 'claude' || ai.app === 'gemini');
    const save = {
      recommend: f.freq !== 'once' && !privateMode, privateMode,
      where: SAVE[ai.app].where, name: SAVE[ai.app].name,
      steps: SAVE[ai.app].steps, note: SAVE[ai.app].note,
    };
    const warns = [];
    if (privateMode) warns.push(ai.app === 'claude'
      ? r('Claude 시크릿 채팅은 프로젝트 밖에서만 열려요. 그래서 민감한 회의는 규칙을 프로젝트에 저장하는 대신, 요청문을 메모 앱에 저장해 두고 매번 시크릿 채팅에 붙이는 방법으로 안내했어요.', 'an-incognito')
      : r('Gemini 임시 채팅 안에서는 Gem을 쓸 수 없고, Gem이 11월에 스킬로 바뀐 뒤에는 ‘활동 기록 보관’을 켜야 써요. 그래서 민감한 회의는 요청문을 메모 앱에 저장해 두고 매번 임시 채팅에 붙이는 방법으로 안내했어요.', 'gg-temp'));
    if (ai.app === 'gemini' && save.recommend && f.sensitive === 'unsure' && ai.plan !== 'work') warns.push(r('Gem이 11월에 스킬로 바뀐 뒤에는 ‘활동 기록 보관’을 켜야 쓸 수 있어요. 기록에 민감한 정보가 있다면 임시 채팅에 요청문 전체를 붙이는 방법이 더 안전해요.', 'gg-skills'));

    const prompts = { first: firstPrompt(f, ai, input), rules: rulesText(f, ai, share), next: nextLine(f, ai, input), share: sharePrompt(f, share) };
    const flow = flowSteps(f, ai, input, tr, share, save);

    const cards = [];
    cards.push({ k: 'AI·요금제', v: paid.v, key: true, small: true, yes: paid.yes, no: paid.no, yesLabel: '유료가 편한 경우', noLabel: '무료로 충분', reasons: ai.reasons });
    cards.push({ k: '기록 넣는 법', v: input.v, small: true, reasons: input.reasons });
    if (tr) cards.push({ k: '녹음을 글로', v: tr.v, small: true, reasons: tr.reasons });
    cards.push({ k: '정리 칸', v: SECTIONS_SHORT[f.meet], small: true, s: `${MEET[f.meet]}에 맞춘 칸이에요.`, reasons: [r('칸이 정해져 있으면 매번 같은 모양으로 나오고, 빠진 정보가 칸째로 눈에 띄어요.'), r('정해지지 않은 기한과 담당자는 지어내지 않고 ‘확인 필요’로 남기게 했어요.', ai.app === 'claude' ? 'an-accuracy' : 'oa-mistakes')] });
    cards.push({ k: '규칙 저장', v: save.recommend ? `${ai.label} ${save.name}에 한 번 저장` : save.privateMode ? '요청문을 메모 앱에 저장' : '저장 없이 요청문만', small: true, reasons: save.recommend ? [r('자주 정리한다면 한 번 저장해 두고 다음부터는 한 줄만 보내요.'), save.steps[0]] : save.privateMode ? [warns[0]] : [r('이번 한 번이라면 저장하지 않아도 돼요. 요청문 하나로 충분해요.')] });
    cards.push({ k: '정보 보호', v: privacy.v, small: true, reasons: privacy.reasons });
    if (share) cards.push({ k: '보내기', v: share.v, small: true, reasons: share.reasons });

    const sourcesUsed = new Set();
    const collect = x => { if (x && x.src) sourcesUsed.add(x.src); };
    [...ai.reasons, ...input.reasons, ...(tr ? tr.reasons : []), ...paid.yes, ...paid.no, ...privacy.reasons, ...(share ? share.reasons : []), ...save.steps, save.note, ...warns].forEach(collect);
    for (const c of cards) (c.reasons || []).forEach(collect);
    flow.forEach(collect);

    const title = save.recommend ? `${ai.label} ${save.name}에 규칙을 저장하고, 다음부턴 한 줄로` : save.privateMode ? `${ai.label} ${ai.app === 'claude' ? '시크릿 채팅' : '임시 채팅'}에 요청문을 붙여 정리해요` : `이번엔 ${ai.label}에 요청문 하나면 돼요`;
    const sub = `${MEET[f.meet]} · ${f.record.map(x => RECORD[x]).join('·')} · ${share ? `${share.names}에게 보낼 ${share.channel}` : '나만 보는 기록'} 기준으로 맞춘 순서와 문장이에요.${ai.picked ? '' : ` 쓰는 AI가 없어서 ${josa(ai.label, '을', '를')} 골랐어요.`}`;

    return {
      version: VERSION, answers: a, filled: f, ai, input, transcribe: tr, share, paid, privacy, save, warns, prompts, flow, cards,
      checklist: checklist(f, share), tips: tipIds(f, ai), sourcesUsed: [...sourcesUsed],
      headline: { title, sub },
      flowTitle: `${ai.label}에서 이렇게 해요 · ${flow.length}단계`,
      takeSub: save.recommend ? '처음 한 번은 요청문을, 저장한 뒤에는 한 줄을 보내면 돼요. 복사한 문장은 고친 뒤 써도 괜찮아요.' : save.privateMode ? '민감한 회의라 규칙을 저장하지 않고, 이 요청문을 메모 앱에 저장해 두고 매번 붙이는 방법으로 안내했어요.' : '요청문을 복사해 AI 새 채팅에 붙이고, 아래에 기록을 넣어 보내면 돼요.',
      shareLabel: share ? `${share.names}에게 보낼 글로 바꾸는 요청문(회의록을 받은 같은 채팅에)` : '',
    };
  }

  return Object.freeze({ VERSION, SECTIONS, sanitize, compute, josa });
});
