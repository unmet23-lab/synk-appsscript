/* synkbrief 뉴스 · 내 GPTs·젬 옮기기 점검 — 질문·선택지·팁·출처.
 * 원본: SYNK-appsscript/docs/마케팅/맞춤도구/skills/content.js
 * 화면에 보이는 문장은 이 파일이 쥔다. 날짜 계산·할 일 순서는 rules.js, 그림과 결과 화면은 view.js가 맡는다.
 * 제작 절차(../제작절차.md): 질문마다 왜 묻는지, 선택지마다 고른 뒤 한 줄, 결과 요소마다 팁 종류를 TIPS에 둔다.
 * 날짜·사실은 SOURCES의 확인 날짜 기준이다. 바뀌면 탐색노트.md → 이 파일 → rules.js 순서로 고친다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkSkillsContent = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CHECKED = '2026-10-17';
  const OAI_FAQ = 'https://help.openai.com/ko-kr/articles/20001519-custom-gpt-retirement-and-migration-faq';
  const G_HELP = 'https://support.google.com/gemini/answer/18560919?hl=ko';

  const SOURCES = {
    'oai-faq': { kind: 'official', label: 'OpenAI 고객센터 · 맞춤형 GPT 지원 종료 및 마이그레이션 FAQ · 2026년 12월 11일 종료(모든 요금제, 연기 승인 Enterprise는 2027년 2월 11일), 대화 기록은 남음, 내 GPT → 플러그인으로 마이그레이션, 최신 게시본만(공개 공유는 필요 없음), 옮긴 원본은 읽기 전용, 지침은 스킬·지식 파일은 참조 파일로, 맞춤 액션·공유 설정·고른 모델은 따라오지 않음, 남이 만든 GPT는 옮길 수 없음', url: OAI_FAQ },
    'oai-plugins': { kind: 'official', label: 'OpenAI 고객센터 · ChatGPT의 플러그인 · 플러그인 디렉터리는 모든 ChatGPT 요금제에서 사용 가능, 개별 플러그인은 요금제·워크스페이스·지역에 따라 다름', url: 'https://help.openai.com/ko-kr/articles/20001256-plugins-in-chatgpt' },
    'oai-app': { kind: 'official', label: 'ChatGPT 「내 GPT」 화면 안내(2026-10-17 읽음) · 「GPT가 12월 11일부로 종료됩니다. GPT를 계속 사용하려면 12월 11일까지 각 GPT를 플러그인으로 이전하세요」, GPT 공유 창 「더 이상 GPT를 공개적으로 공유할 수 없습니다」', url: 'https://chatgpt.com/gpts/mine' },
    'g-help': { kind: 'official', label: 'Gemini 앱 고객센터 · Gem에서 스킬로의 전환 · 개인 Google 계정 2026년 11월, Workspace 비즈니스·엔터프라이즈·비영리 2027년 3월, Workspace Education 2027년 6월, 젬이 사라지면 스킬로 자동 재생성(지원 파일 포함), 스킬은 / (곧 @) + 이름, 동영상·음악·Canvas·Deep Research·가이드 학습은 스킬과 아직 안 됨', url: G_HELP },
    'g-app': { kind: 'official', label: '제미나이 Gems 화면 안내(2026-10-17 읽음) · 「11월 17, 2026부터 Gems가 스킬로 자동으로 이전되기 시작합니다. 이전되기 전까지는 Gems를 사용할 수 있습니다」', url: 'https://gemini.google.com/gems/view' },
    'g-blog': { kind: 'official', label: 'Google 블로그(2026-09-30) · 스킬이 Gems를 대체, 한 번 저장한 지침을 / 와 이름으로 다시 쓰기, 여러 스킬 겹쳐 쓰기, 텍스트·PDF·이미지 참조 파일', url: 'https://blog.google/products-and-platforms/products/gemini/automate-tasks-with-skills/' },
    'synk-seen': { kind: 'seen', label: 'SYNK가 직접 본 것 · 10-07 제미나이 스킬 만드는 곳(설정 → 스킬 → 수동으로 만들기)과 스킬을 골라도 다섯 번 중 한 번은 규칙이 안 붙은 답, 10-17 시험용 GPT를 「나만 보기」로 게시하자 「플러그인으로 마이그레이션」 단추가 생김, GPT 편집 화면 「구성」 맨 아래 「작업」 칸(새 작업 만들기)과 왼쪽 메뉴 「플러그인」(chatgpt.com/plugins) 확인, 10-18 단추를 누르자 세 줄 점검 확인 창 → 몇 초 뒤 「플러그인 마이그레이션이 완료되었습니다」, 「내 GPT」 단추가 「플러그인 열기」로 바뀌고 새 채팅 @ 목록에 같은 이름이 「플러그인」·「맞춤형 GPT」 두 곳에 뜸(컴퓨터 웹)' },
    synk: { kind: 'synk', label: 'SYNK 판단 · 공식 자료가 정하지 않은 부분(할 일의 순서, 비교 질문 개수, 자주 쓰는 것부터 옮기기)은 위 자료와 SYNK가 직접 본 것으로 정한 기준이에요. 기준 문서: 추천기준.md' },
  };

  // 결과에 들어가는 요소와, 요소마다 반드시 채울 팁 종류(제작 절차 §3). core/content-check.js가 검사한다.
  // 돈이 드는 주제가 아니라서 「왜 비싼가」 종류는 두지 않는다.
  const COMPONENTS = {
    date: ['what', 'why', 'trap', 'check'],
    migrate: ['what', 'why', 'skip', 'trap', 'check'],
    carry: ['what', 'why', 'trap', 'check'],
    gem: ['what', 'why', 'skip', 'trap', 'check'],
    use: ['what', 'skip', 'check'],
    test: ['why', 'check'],
  };

  const TIPS = {
    'date-gpt': {
      component: 'date', covers: ['what', 'check'], title: 'GPTs는 12월 11일부터 열리지 않아요',
      body: [
        'OpenAI는 GPT(공식 이름 「맞춤형 GPT」)를 2026년 12월 11일에 끝내요. 모든 요금제가 같고, 그날부터 GPT와 GPT 페이지에 들어갈 수 없어요.',
        '그동안 GPT와 나눈 대화는 남아요. 다만 옮기지 않은 GPT의 지침과 파일은 그날부터 열 수 없어요. 옮기지 않을 GPT라도 지침은 지금 복사해 두세요.',
        '확인하는 법: 「내 GPT」 화면(chatgpt.com/gpts/mine)을 열면 맨 위에 종료 안내가 떠 있어요. 결과 화면 아래 단추로 바로 열 수 있어요.',
      ],
      src: ['oai-faq', 'oai-app', 'synk'],
    },
    'date-gem': {
      component: 'date', covers: ['what', 'trap', 'check'], title: '젬은 11월 17일부터 옮겨지기 시작해요',
      body: [
        '제미나이 앱의 안내는 「11월 17, 2026부터 Gems가 스킬로 자동으로 이전되기 시작합니다」예요. 그 전까지는 젬을 그대로 써도 돼요.',
        '함정은 「시작」이라는 말이에요. 그날 모든 계정이 한 번에 바뀌지 않을 수 있어요. 11월 17일에 아직 젬이 보여도 기다리면 돼요.',
        '확인하는 법: 제미나이에서 Gems 화면을 열면 맨 위에 이 안내가 보여요.',
      ],
      src: ['g-app', 'g-help'],
    },
    'date-work': {
      component: 'date', covers: ['why', 'trap'], title: '회사·학교 계정은 날짜가 달라요',
      body: [
        '제미나이는 Workspace 회사 계정이 2027년 3월, 학교 계정이 2027년 6월이에요. ChatGPT는 12월 11일이 기본이고, 연기가 승인된 Enterprise 워크스페이스만 2027년 2월 11일이에요.',
        '날짜는 그 GPT나 젬을 만든 계정을 따라요. 개인 계정으로 열어 써도 회사에서 만든 것이면 회사 일정이에요.',
        '회사 Enterprise는 새 GPT 만들기가 10월 26일에 끝날 계획이에요. 회사 알림과 관리자 안내가 이 화면보다 먼저예요.',
      ],
      src: ['g-help', 'oai-faq'],
    },
    'migrate-how': {
      component: 'migrate', covers: ['what', 'check'], title: '「플러그인으로 마이그레이션」은 이렇게',
      body: [
        '「내 GPT」 화면을 열면 내가 만든 GPT마다 「플러그인으로 마이그레이션」 단추가 있어요. 마이그레이션은 「옮기기」라는 뜻이에요. 누르면 지침·파일, 앱·액션, 공유를 점검한 확인 창이 뜨고, 아래 단추를 한 번 더 누르면 몇 초 만에 끝나요.',
        '옮긴 플러그인은 처음엔 나만 보여요. 같이 쓰던 사람은 새 플러그인을 따로 받아야 해요.',
        '단추가 안 보이면 그 GPT를 만든 계정이 아니거나 아직 내 계정에 열리지 않은 거예요. 휴대폰 앱에서 안 보이면 컴퓨터 브라우저로 chatgpt.com을 열어 보세요.',
      ],
      src: ['oai-faq', 'synk-seen'],
    },
    'migrate-publish': {
      component: 'migrate', covers: ['why', 'trap'], title: '게시한 판만 옮겨져요',
      body: [
        '마이그레이션은 GPT의 마지막 게시본을 가져가요. 고쳐 놓고 저장·게시를 안 했다면 그 수정은 안 따라와요.',
        '공개할 필요는 없어요. 「나만 보기」로 게시해도 돼요. 지금은 GPT를 공개적으로 공유할 수도 없어요.',
        '또 옮기고 나면 원본 GPT는 읽기 전용이 되고, 만든 사람도 지울 수 없어요. 고칠 게 있으면 옮기기 전에 끝내세요.',
      ],
      src: ['oai-faq', 'oai-app'],
    },
    'migrate-skip': {
      component: 'migrate', covers: ['skip'], title: '전부 옮기지 않아도 돼요',
      body: [
        '한 번 쓰고 만 GPT라면 옮기지 않아도 괜찮아요. 12월 11일 뒤에도 그 GPT와 나눈 대화는 남아요.',
        '매주 쓰는 GPT부터 옮기고, 나머지는 필요할 때 대화 기록을 보면 돼요. 남이 만든 GPT는 옮길 수도 없으니 목록에서 빼세요.',
      ],
      src: ['oai-faq', 'synk'],
    },
    'carry-action': {
      component: 'carry', covers: ['what', 'why', 'trap', 'check'], title: '외부 연결 액션은 따라오지 않아요',
      body: [
        '액션은 GPT가 다른 서비스(예약, 시트, 사내 시스템)에 직접 요청을 보내게 해 주는 연결이에요. 마이그레이션은 이 액션을 옮기지 않아서, 액션에 기대던 기능은 플러그인에서 바로 안 돼요.',
        '먼저 같은 일을 하는 앱이 플러그인 쪽에 있는지 찾아보세요. 없으면 개발자가 해야 하는 연결 작업이 필요할 수 있어서, 시간을 넉넉히 잡아야 해요.',
        '확인하는 법: 「내 GPT」에서 그 GPT의 연필(편집)을 누르고 「구성」을 열어요. 맨 아래 「작업」 칸에 무언가 있으면 액션을 쓰는 GPT예요.',
      ],
      src: ['oai-faq'],
    },
    'carry-share': {
      component: 'carry', covers: ['what', 'trap'], title: '공유 설정과 고른 모델은 따라오지 않아요',
      body: [
        '내 GPT를 같이 쓰던 사람들은 새 플러그인을 저절로 받지 못해요. 옮긴 플러그인은 나만 보이게 시작하고, 공개하려면 따로 제출 절차가 있어요.',
        '편집 화면에서 「권장 모델」을 골라 두었다면 그것도 따라오지 않아요. 대부분은 기본값이라 신경 쓰지 않아도 돼요. 같이 쓰던 사람 한 명에게 먼저 써 보게 하세요.',
      ],
      src: ['oai-faq'],
    },
    'carry-files': {
      component: 'carry', covers: ['what', 'check'], title: '지식 파일은 참조 파일로 복사돼요',
      body: [
        '올려 둔 지식 파일과 지침은 그대로 따라와요. 이름만 바뀌어서, 지식 파일은 「참조 파일」, 지침은 플러그인 안의 「스킬」이 돼요. 연결해 둔 앱은 플러그인의 앱으로 들어가요.',
        '확인하는 법: 옮긴 뒤 플러그인에서 참조 파일 목록이 GPT의 지식 파일과 같은지 보고, 그 파일을 써야 답할 수 있는 질문을 하나 해 보세요.',
      ],
      src: ['oai-faq'],
    },
    'gem-auto': {
      component: 'gem', covers: ['what', 'why', 'skip'], title: '젬은 기다리면 스킬이 돼요',
      body: [
        '스킬은 자주 쓰는 지시를 한 번 저장해 두고 채팅창에서 「/」와 이름으로 부르는 기능이에요. 관련 있는 질문엔 제미나이가 알아서 쓰기도 하고, 여러 개를 겹쳐 쓸 수도 있어요.',
        '젬이 사라질 때 구글이 젬을 스킬로 자동으로 다시 만들어 줘요. 지원되는 파일도 같이요. 그래서 개인 계정이라면 지금 손으로 옮길 필요가 없어요.',
        '미리 써 보고 싶을 때만 손으로 다시 만들면 돼요. Gems 화면 맨 위 안내의 「스킬 만들기」를 누르고, 젬에 적어 둔 지침을 복사해 넣으면 돼요.',
      ],
      src: ['g-help', 'g-blog'],
    },
    'gem-tools': {
      component: 'gem', covers: ['trap', 'check'], title: '스킬에서 아직 안 되는 기능',
      body: [
        '젬에서 쓰던 기본 도구 가운데 동영상 만들기, 음악 만들기, Canvas, Deep Research, 가이드 학습은 아직 스킬과 같이 쓸 수 없어요.',
        '그 일을 할 땐 스킬을 부르지 말고, Canvas 같은 기능을 먼저 켠 뒤 필요한 지시는 직접 적으세요. 그리고 젬마다 모아 보던 대화 목록은 없어져요. 대화는 평소 목록에서 찾으면 돼요.',
        '확인하는 법: 옮겨진 뒤 그 기능을 쓰던 질문을 한 번 넣어 보고, 기능이 안 붙으면 따로 고르세요.',
      ],
      src: ['g-help'],
    },
    'gem-early': {
      component: 'gem', covers: ['check', 'trap'], title: '스킬은 지금도 쓸 수 있어요',
      body: [
        '개인 Google 계정이면 지금도 제미나이 채팅에서 스킬을 쓸 수 있어요(만 18세 이상).',
        '만드는 곳은 Gems 화면 맨 위 안내의 「스킬 만들기」예요. 왼쪽 맨 아래 설정(톱니바퀴) → 스킬 → 수동으로 만들기로 가도 돼요.',
      ],
      src: ['g-help', 'synk-seen'],
    },
    'use-others': {
      component: 'use', covers: ['what', 'skip', 'check'], title: '남이 만든 GPT는 만든 사람이 옮겨요',
      body: [
        '남이 만든 GPT는 쓸 수 있어도 옮길 권한은 없어요. 옮기는 건 만든 사람이 해요.',
        '만든 사람이 플러그인으로 옮겨도, 쓰던 사람에게 저절로 생기지는 않아요. 만든 사람이 새로 알려 줘야 해요.',
        '그래서 할 일은 하나예요. 만든 사람에게 옮길 계획이 있는지 물어보세요. 결과 화면의 「만든 사람에게 보낼 한 줄」을 복사해 보내면 돼요. 답이 없으면 ChatGPT 왼쪽 메뉴 「플러그인」에서 비슷한 것을 찾아보세요.',
      ],
      src: ['oai-faq', 'oai-plugins', 'synk-seen'],
    },
    'test-compare': {
      component: 'test', covers: ['why', 'check'], title: '옮긴 뒤엔 같은 질문으로 비교해요',
      body: [
        'OpenAI도 옮긴 플러그인이 GPT와 다르게 답할 수 있다고 안내해요. 그래서 익숙한 질문 몇 개와 어려운 질문 하나로 비교하라고 해요.',
        'SYNK가 10월 7일 제미나이 스킬을 시험했을 때도, 스킬을 골라 놓고 다섯 번 중 한 번은 규칙이 안 붙은 답이 나왔어요.',
        '확인하는 법: 아래 비교 메모에 질문 넷과 지금 답을 적어 두고, 옮긴 뒤 같은 질문을 넣어 맞는 스킬을 쓰는지, 참조 파일을 쓰는지, 형식이 같은지 보세요.',
      ],
      src: ['oai-faq', 'synk-seen'],
    },
    'test-call': {
      component: 'test', covers: ['check', 'why'], title: '옮긴 뒤 부르는 법',
      body: [
        'ChatGPT는 입력창에 @를 치고 플러그인 이름을 고르거나, + 단추 → 더 보기에서 골라요. 설명이 맞으면 알아서 쓰기도 하지만 매번은 아니에요.',
        '제미나이는 채팅창에 「/」를 치고 스킬 이름을 골라요. 곧 @로도 부를 수 있게 바뀐다고 해요.',
        '처음 몇 번은 직접 불러서 쓰세요. 알아서 쓰기를 기다리면 스킬이 안 붙은 답이 섞일 수 있어요.',
      ],
      src: ['oai-faq', 'g-help'],
    },
  };

  // 아직 답하지 않은 질문은 「해당될 수 있음」으로 본다. 그래야 진행 표시가 1/5에서 시작해 줄어들고, 3에서 5로 늘지 않는다.
  const hasGpt = a => !a.where || a.where === 'gpt' || a.where === 'both';
  const hasGem = a => !a.where || a.where === 'gem' || a.where === 'both';
  const made = a => !a.who || a.who === 'mine' || a.who === 'both';

  const steps = [
    {
      id: 'where', type: 'single', eyebrow: '어디에', short: '어디에',
      title: '어떤 걸 쓰고 있나요?',
      sub: 'GPT도 젬도 올해 바뀌어요. 옮기는 방법만 달라요.',
      options: [
        { id: 'gpt', label: 'ChatGPT의 GPT', sub: '내가 만든 것, 링크로 받은 것, GPT 탐색에서 쓰는 것', tip: 'GPTs는 12월 11일에 끝나요. 옮기는 건 만든 사람이 직접 해야 해요.' },
        { id: 'gem', label: '제미나이 젬', sub: '왼쪽 메뉴 「Gems」에서 쓰는 것', tip: '젬은 11월 17일부터 스킬로 저절로 옮겨지기 시작해요.' },
        { id: 'both', label: '둘 다', tip: '날짜와 할 일을 둘로 나눠서 보여 드릴게요.' },
      ],
      tip: { title: '같은 방향, 다른 방법', body: ['두 회사 모두 저장해 둔 지침을 「스킬」로 바꿔요. ChatGPT는 플러그인 안의 스킬로, 제미나이는 채팅에서 「/」로 부르는 스킬로요.', '차이는 옮기는 방법이에요. 젬은 기다리면 자동으로 옮겨지고, GPTs는 만든 사람이 「플러그인으로 마이그레이션」을 직접 눌러야 해요.'], visual: 'timeline', src: 'oai-faq' },
    },
    {
      id: 'who', type: 'single', eyebrow: '누가 만들었나', short: '누가',
      title: '직접 만든 건가요?',
      sub: '옮길 수 있는 사람은 만든 사람뿐이에요.',
      options: [
        { id: 'mine', label: '내가 만들었어요', tip: '할 일 순서를 짜 드릴게요.' },
        { id: 'others', label: '남이 만든 걸 써요', sub: 'GPT 탐색, 공유받은 링크', tip: '쓰는 사람은 옮길 수 없고, 옮길 필요도 없어요.' },
        { id: 'both', label: '둘 다예요', tip: '내가 만든 것과 남이 만든 것을 나눠서 보여 드릴게요.' },
      ],
      tip: { title: '헷갈리면 「내 GPT」를 보세요', body: ['ChatGPT의 「내 GPT」 목록에 있는 것이 내가 만든 GPT예요. 거기 없고 GPT 탐색에서 찾아 쓰던 것은 남이 만든 거예요.', '남이 만든 GPT는 쓸 수 있어도 옮길 권한은 없어요. 만든 사람의 안내를 따르면 돼요.'], src: 'oai-faq' },
    },
    {
      id: 'account', type: 'single', eyebrow: '계정', short: '계정',
      title: '어느 계정에서 만들었나요?',
      sub: '여러 계정을 쓴다면 그걸 만든 계정이에요. 남이 만든 것만 쓰거나 잘 모르면 「잘 모르겠어요」를 고르세요.',
      options: [
        { id: 'unsure', label: '잘 모르겠어요', sub: '개인 계정 날짜로 보여 드려요', tip: '개인 계정 날짜로 셀게요. 회사에서 받은 계정이면 회사 알림을 같이 보세요.' },
        { id: 'personal', label: '개인 계정', sub: '내가 가입한 계정 · Plus·Pro도 여기', tip: '개인 계정 날짜로 셀게요.' },
        { id: 'work', label: '회사 계정', sub: '회사에서 만들어 준 계정 · 회사 메일로 로그인', tip: '회사 계정은 날짜가 다를 수 있어서, 회사 알림을 같이 보게 할게요.' },
        { id: 'school', label: '학교 계정', sub: '학교에서 받은 계정', tip: '학교 계정 젬은 2027년 6월이에요. GPT는 관리자 안내를 따르게 할게요.' },
      ],
      tip: { title: '만든 계정의 날짜를 따라요', body: ['여러 계정을 쓴다면 그걸 만든 계정을 고르세요. 다른 계정에서 열어 써도 만든 계정의 일정과 권한이 적용돼요.', '제미나이는 개인 계정이 2026년 11월, 회사 계정이 2027년 3월, 학교 계정이 2027년 6월이에요.'], src: 'g-help' },
    },
    {
      id: 'gptHas', type: 'multi', eyebrow: 'GPT 안에 든 것', short: 'GPT 안',
      title: '내 GPT에 무엇이 들어 있나요?',
      sub: '고른 것에 맞춰 조심할 점을 알려 드릴게요. 여러 개 골라도 되고, 잘 모르면 「잘 모르겠어요」를 고르세요.',
      when: a => hasGpt(a) && made(a),
      options: [
        { id: 'unsure', label: '잘 모르겠어요', sub: '확인하는 법을 할 일에 넣어 드려요', tip: '옮기기 전에 GPT 편집 화면에서 무엇이 들었는지 보는 법을 할 일 맨 앞에 넣어 드릴게요.' },
        { id: 'files', label: '지식 파일', sub: '올려 둔 PDF·문서', tip: '지식 파일은 플러그인의 참조 파일로 복사돼요. 옮긴 뒤 목록만 보면 돼요.' },
        { id: 'actions', label: '다른 서비스와 연결', sub: '편집 화면 「구성」 맨 아래 「작업」 칸에 뭔가 있음', tip: '이런 연결(액션)은 따라오지 않아요. 옮긴 뒤 다시 연결해야 해요.' },
        { id: 'shared', label: '다른 사람과 같이 써요', sub: '링크로 공유', tip: '공유 설정은 따라오지 않아요. 새 플러그인을 다시 알려야 해요.' },
        { id: 'drafts', label: '고쳐 놓고 게시 안 한 것', sub: '편집만 하고 저장(게시)을 안 누름', tip: '게시한 판만 옮겨져요. 먼저 게시하게 할게요(나만 보기도 돼요).' },
        { id: 'plain', label: '글로 쓴 지시만 있어요', tip: '지침은 플러그인 안의 스킬이 돼요. 가장 쉽게 옮겨지는 경우예요.' },
      ],
      tip: { title: '따라오는 것과 안 따라오는 것', body: ['지침은 스킬로, 지식 파일은 참조 파일로, 연결한 앱은 앱으로 옮겨져요.', '맞춤 액션, 공유 설정, 골라 둔 모델은 따라오지 않아요. 게시하지 않은 수정도요.'], src: 'oai-faq' },
    },
    {
      id: 'gemHas', type: 'multi', eyebrow: '젬 안에 든 것', short: '젬 안',
      title: '내 젬에 무엇이 들어 있나요?',
      sub: '스킬에서 아직 안 되는 기능이 있는지 볼게요. 잘 모르면 「잘 모르겠어요」를 고르세요.',
      when: a => hasGem(a) && made(a),
      options: [
        { id: 'unsure', label: '잘 모르겠어요', sub: '기다리면 되는 경우로 보여 드려요', tip: '대부분은 기다리면 돼요. 옮겨진 뒤 확인할 것만 알려 드릴게요.' },
        { id: 'files', label: '지식 파일', tip: '지원되는 파일은 젬과 같이 스킬로 옮겨져요.' },
        { id: 'tools', label: '동영상, 음악, Canvas, Deep Research', sub: '젬을 켠 채로 이 기능을 쓴 적이 있음', tip: '이 기능들은 아직 스킬과 같이 안 돼요. 따로 쓰는 법을 알려 드릴게요.' },
        { id: 'shared', label: '다른 사람과 같이 써요', tip: '구글은 10월 17일 기준 스킬 공유가 「몇 주 안에」 생긴다고 해요. 그 전엔 확인이 필요해요.' },
        { id: 'plain', label: '글로 쓴 지시만 있어요', tip: '지시만 있으면 기다리기만 하면 돼요.' },
      ],
      tip: { title: '스킬에서 아직 안 되는 것', body: ['젬에서 쓰던 기본 도구 가운데 동영상 만들기, 음악 만들기, Canvas, Deep Research, 가이드 학습은 아직 스킬과 같이 안 돼요.', '지식 파일과 지시는 옮겨지고, 공유와 Drive 파일 추가는 구글이 10월 17일 기준 「몇 주 안에」 생긴다고 해요.'], src: 'g-help' },
    },
  ];

  return Object.freeze({
    id: 'brief.skills', version: 1, checked: CHECKED,
    series: 'synkbrief 뉴스', title: '내 GPTs·젬 옮기기 점검',
    intro: {
      eyebrow: 'SYNKBRIEF · GPTs & GEMS',
      title: '내 GPTs·젬,<br><span class="hl">언제까지 뭘 하지?</span>',
      lead: '질문 몇 개에 답하면 내 날짜와 할 일이 나와요. 내 경우에 해당하는 것만 골라 드려요.',
      meta: ['약 1분', '질문 3~5개', 'ChatGPT·제미나이', '로그인 없음'],
      privacy: '고른 답만 이 기기에 저장돼요. GPT나 젬의 내용은 이 화면에 넣지 않아요.',
      start: '내 날짜 확인하기',
    },
    steps, SOURCES, TIPS, COMPONENTS,
    when: { hasGpt, hasGem, made },
    channels: { instagram: 'https://www.instagram.com/synkbrief/', youtube: 'https://www.youtube.com/@synkbrief' },
  });
});
