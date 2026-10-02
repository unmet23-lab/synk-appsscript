/* synkbrief 활용 · 회의 기록 맞춤 정리 — 질문·선택지·팁·출처.
 * 원본: SYNK-appsscript/docs/마케팅/맞춤도구/meeting/content.js
 * 화면에 보이는 문장은 이 파일이 쥔다. 요청문·순서 계산은 rules.js, 그림과 결과 화면은 view.js가 맡는다.
 * 제작 절차(../제작절차.md): 질문마다 왜 묻는지, 선택지마다 고른 뒤 한 줄, 결과에 들어가는 요소마다
 * 무엇인지·왜 필요한지·값을 정하는 것·필요 없는 경우·함정·확인법을 TIPS에 둔다. core/content-check.js가 빠진 칸을 잡는다.
 * 숫자와 메뉴 이름은 SOURCES의 확인 날짜 기준이다. 바뀌면 탐색노트.md → 이 파일 → rules.js 순서로 고친다.
 * 영상·11쪽 PDF·연습 자료(keep/)는 GPT 작업본(synk.im 2026-09-24 공개)을 바이트 그대로 싣는다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkMeetingContent = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CHECKED = '2026-09-29';

  const SOURCES = {
    'oa-projects': { kind: 'official', label: 'OpenAI 도움말 · ChatGPT 프로젝트: 무료 포함 모든 요금제, 프로젝트 ‘… → 프로젝트 설정 → 지침’, 프로젝트 전용 메모리, 파일은 무료 5개·Go/Plus 25개', url: 'https://help.openai.com/en/articles/10169521-projects-in-chatgpt' },
    'oa-release': { kind: 'official', label: 'OpenAI 릴리스 노트 · 2025-09-03 무료 요금제에 프로젝트, 2026-08-04부터 1만 자 넘는 붙여넣기는 첨부 파일로 바뀜', url: 'https://help.openai.com/en/articles/6825453-chatgpt-release-notes' },
    'oa-temp': { kind: 'official', label: 'OpenAI 도움말 · 임시 채팅: 기록에 남지 않고 학습·메모리에 쓰지 않음, 안전을 위해 최대 30일 보관', url: 'https://help.openai.com/en/articles/8914046-temporary-chat-faq' },
    'oa-data': { kind: 'official', label: 'OpenAI 도움말 · 데이터 제어: 설정 → 데이터 제어 → ‘모두를 위한 모델 개선’(Improve the model for everyone) 끄기. Business·Enterprise·Edu는 기본적으로 학습에 쓰지 않음', url: 'https://help.openai.com/en/articles/7730893-data-controls-faq' },
    'oa-record': { kind: 'official', label: 'OpenAI 도움말 · 기록 모드(Record): Plus·Pro·Business·Enterprise·Edu의 macOS 앱, 한 번에 최대 4시간, 영어에서 가장 정확', url: 'https://help.openai.com/en/articles/11487532-chatgpt-record' },
    'oa-files': { kind: 'official', label: 'OpenAI 도움말 · 파일 업로드: 파일당 512MB, 문서 한 개 최대 200만 토큰, 무료는 하루 3개', url: 'https://help.openai.com/en/articles/8555545-file-uploads-faq' },
    'oa-pricing': { kind: 'official', label: 'ChatGPT 요금제(한국어 페이지) · 한 번에 읽는 양 무료 약 12쪽(27K 토큰)·Go·Plus 약 40쪽(54K), Go 월 13,000원·Plus 월 29,000원', url: 'https://chatgpt.com/ko-KR/pricing' },
    'oa-dictation': { kind: 'official', label: 'OpenAI 도움말 · 음성 받아쓰기(마이크): 말한 메시지를 글로 바꿔 입력. 파일 업로드 형식 목록에 오디오는 없음', url: 'https://help.openai.com/en/articles/12168547' },
    'oa-mistakes': { kind: 'official', label: 'OpenAI 도움말 · “ChatGPT can make mistakes. Check important information”(중요한 정보는 확인)', url: 'https://help.openai.com/en/articles/20001274' },
    'an-projects': { kind: 'official', label: 'Claude 도움말 · 프로젝트: 무료는 최대 5개, 프로젝트마다 따로 기억', url: 'https://support.claude.com/en/articles/9517075' },
    'an-instructions': { kind: 'official', label: 'Claude 도움말 · 프로젝트 지침: ‘Set project instructions’ → ‘Save instructions’', url: 'https://support.claude.com/en/articles/9519177' },
    'an-terms': { kind: 'official', label: 'Anthropic 발표(2025-08-28) · 무료·Pro·Max 대화의 모델 학습 선택, 허용하면 5년·아니면 30일 보관, 업무용(Claude for Work)·API는 제외', url: 'https://www.anthropic.com/news/updates-to-our-consumer-terms' },
    'an-privacy': { kind: 'official', label: 'Claude 개인정보 도움말 · 설정의 Privacy에서 모델 학습 허용 스위치 끄기', url: 'https://privacy.claude.com/en/articles/12109829' },
    'an-incognito': { kind: 'official', label: 'Claude 도움말 · 시크릿(Incognito) 채팅: 기록·기억·학습에 쓰지 않음, 30일 보관, 프로젝트 밖에서만', url: 'https://support.claude.com/en/articles/12260368' },
    'an-files': { kind: 'official', label: 'Claude 도움말 · 업로드: 파일당 500MB, 대화당 20개, 지원 형식에 오디오는 없음', url: 'https://support.claude.com/en/articles/8241126' },
    'an-pricing': { kind: 'official', label: 'Claude 요금제 · 무료도 한 번에 읽는 양 최대 1M 토큰(모델별 다름), 사용량은 5시간 단위, Pro 월 20달러(연간 결제 시 월 17달러)', url: 'https://claude.com/pricing' },
    'an-accuracy': { kind: 'official', label: 'Claude 도움말 · Claude를 유일한 사실의 근거로 삼지 말 것', url: 'https://support.claude.com/en/articles/8525154' },
    'gg-gems': { kind: 'official', label: 'Gemini 도움말(한국어) · Gem 만들기: 사이드바 열기 → Gems → 새 Gem → 이름·요청 사항·지식 → 저장', url: 'https://support.google.com/gemini/answer/15146780?hl=ko' },
    'gg-gems-free': { kind: 'official', label: 'Google 블로그(2025-03-13) · Gem을 모든 사용자에게 무료로 제공', url: 'https://blog.google/products-and-platforms/products/gemini/new-gemini-app-features-march-2025/' },
    'gg-skills': { kind: 'official', label: 'Gemini 도움말 · 개인 계정의 Gem은 2026년 11월부터 스킬로 자동 전환(파일 포함). 스킬은 18세 이상·활동 기록 보관이 켜져 있어야 함', url: 'https://support.google.com/gemini/answer/18560919' },
    'gg-activity': { kind: 'official', label: 'Gemini 도움말(한국어) · 활동 기록 보관: 켜 두면 생성형 AI 모델 학습 등 서비스 개선에 사용, 꺼도 최대 72시간 보관', url: 'https://support.google.com/gemini/answer/13278892?hl=ko' },
    'gg-temp': { kind: 'official', label: 'Gemini 도움말 · 임시 채팅: 학습·맞춤에 쓰지 않음, 개인 계정만, 안에서 Gem은 못 씀', url: 'https://support.google.com/gemini/answer/13275745' },
    'gg-limits': { kind: 'official', label: 'Gemini 도움말 · 요금제별 한도: 한 번에 읽는 양 무료 32K 토큰·AI Pro 1M, 파일 10개·파일당 100MB, 오디오 합계 무료 10분·Pro 3시간', url: 'https://support.google.com/gemini/answer/16275805' },
    'gg-workspace': { kind: 'official', label: 'Google Workspace 개인정보 허브 · 업무·학교 계정의 Gemini 대화는 허락 없이 조직 밖 모델 학습에 쓰지 않음', url: 'https://knowledge.workspace.google.com/admin/gemini/generative-ai-in-google-workspace-privacy-hub' },
    'gg-meet': { kind: 'official', label: 'Google Meet 도움말 · 회의록 작성(Take notes for me): 한국어 지원, 한 회의 한 언어, 무료 Gmail 불가(업무 계정·Google AI Pro 이상)', url: 'https://support.google.com/meet/answer/14754931' },
    'gg-plans': { kind: 'official', label: 'Google AI 요금제(대한민국) · AI Plus 월 7,500원, AI Pro 월 29,000원', url: 'https://one.google.com/about/google-ai-plans/?hl=ko&gl=KR' },
    'nv-clova': { kind: 'official', label: '네이버 클로바노트 도움말 · 개인은 매달 300분 무료(서비스 품질 향상 동의 시 300분 추가), 한 번에 녹음·업로드 180분, 개인용 유료 요금 없음', url: 'https://help.naver.com/service/24269/contents/12814' },
    'nv-clova-lang': { kind: 'official', label: '네이버 클로바노트 도움말 · 인식 언어: 한국어, 한국어+영어, 영어, 일본어, 중국어. 받아 적은 글과 참석자 구분은 초안으로 쓰기를 권장', url: 'https://help.naver.com/service/24269/contents/14638' },
    'nv-works': { kind: 'official', label: '네이버웍스 클로바노트 요금 · 업무용 Lite 회사당 월 20,000원(1,000분), 업무 데이터는 AI 학습에 쓰지 않음', url: 'https://naver.worksmobile.com/pricing/clovanote/' },
    'ss-transcript': { kind: 'official', label: '삼성전자서비스 · 녹음 앱 텍스트 변환 어시스트: One UI 6.1 이상, 한국어 지원, 국내는 네트워크 연결과 삼성 계정 로그인 필요, 결과의 정확성은 보장되지 않음', url: 'https://www.samsungsvc.co.kr/solution/1847983' },
    'ap-voicememo': { kind: 'official', label: 'Apple 지원(iOS 26) · 음성 메모 받아 적기: iPhone 12 이상, 한국어 포함', url: 'https://support.apple.com/guide/iphone/view-a-transcription-iph00953a982/26.0/ios/26.0' },
    'ap-call': { kind: 'official', label: 'Apple 지원(iOS 26) · 통화 녹음: 양쪽 모두 녹음 안내를 듣고, 받아 적은 글은 믿기 전에 정확성을 확인', url: 'https://support.apple.com/guide/iphone/record-and-transcribe-a-call-iph57c6590e9/26.0/ios/26.0' },
    'zoom-summary': { kind: 'official', label: 'Zoom 도움말 · 회의 요약은 Pro·Business·Enterprise 유료 사용자, 한국어 지원. 제품 페이지는 무료 월 3회라고 안내해 서로 다름', url: 'https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0058013' },
    'ms-recap': { kind: 'official', label: 'Microsoft Learn · Teams 회의 요약(Intelligent recap)은 Teams Premium이나 Copilot 라이선스 필요, 한국어 지원. 무료 Teams는 실시간 자막만', url: 'https://learn.microsoft.com/en-us/microsoftteams/intelligent-recap-calls-meetings' },
    'kr-law': { kind: 'official', label: '국가법령정보센터 · 통신비밀보호법 제3조(공개되지 않은 타인 간의 대화 녹음 금지), 제16조(1년 이상 10년 이하 징역과 5년 이하 자격정지)', url: 'https://www.law.go.kr/법령/통신비밀보호법' },
    'kr-court': { kind: 'official', label: '대법원 2006. 10. 12. 선고 2006도4981 판결 · 대화에 참여한 사람의 녹음은 ‘타인 간의 대화’ 녹음이 아님', url: 'https://www.law.go.kr/판례/(2006도4981)' },
    synk: { kind: 'synk', label: 'SYNK 판단 · 공식 자료가 없는 부분(회의 종류별 정리 칸, 받는 사람별 형식, 순서)은 위 자료와 영상 제작 때의 실제 시연을 바탕으로 SYNK가 정한 기준이에요. 기준 문서: 추천기준.md' },
  };

  // 결과에 들어가는 요소와, 요소마다 반드시 채울 팁의 종류(제작 절차 §3). core/content-check.js가 검사한다.
  const COMPONENTS = {
    record: ['what', 'why', 'skip', 'trap', 'check'],
    transcribe: ['what', 'why', 'price', 'skip', 'trap', 'check'],
    ai: ['what', 'why', 'price', 'skip', 'trap'],
    format: ['why', 'trap', 'check'],
    save: ['what', 'why', 'skip', 'trap', 'check'],
    share: ['why', 'trap', 'check'],
    privacy: ['what', 'why', 'skip', 'trap', 'check'],
  };

  // 팁 은행. rules.js의 tipIds가 사람마다 고른다. covers = 이 카드가 채우는 팁 종류.
  const TIPS = {
    'raw-memo': {
      component: 'record', covers: ['what', 'why', 'skip'], title: '메모는 다듬지 말고 그대로 넣으세요',
      body: [
        'AI에게 맡기는 일이 바로 ‘두서없는 기록을 정리하는 것’이에요. 먼저 예쁘게 다듬으면 시간도 들고, 옮기다가 기한이나 담당자 같은 한 줄을 빠뜨리기 쉬워요.',
        '맞춤법, 줄임말, 순서가 뒤섞인 메모도 괜찮아요. 다만 팀에서만 쓰는 줄임말이나 별명이 있다면 요청문 위에 한 줄로 풀어 주면 더 정확해져요.',
        '미리 정리하지 않아도 되는 것: 문장 다듬기, 순서 맞추기, 표 만들기. 이건 AI가 해요. 여러분은 빠진 기록이 없는지만 보면 돼요.',
        '대신 요청문의 날짜와 참석자 칸은 채워 주세요. 기록에 날짜가 없으면 AI가 ‘다음 주 금요일’ 같은 말을 실제 날짜로 바꿀 수 없어요.',
      ],
      src: ['synk'],
    },
    'photo-memo': {
      component: 'record', covers: ['trap', 'check'], title: '손글씨·화이트보드 사진은 이렇게 넣어요',
      body: [
        'ChatGPT·Claude·Gemini 모두 사진 속 글자를 읽을 수 있어요. 사진을 그대로 올리고, 요청문에 ‘먼저 사진의 글을 옮겨 적고, 읽기 어려운 글자는 [?]로 표시해 줘’를 붙이면 돼요.',
        '함정은 흘려 쓴 이름과 숫자예요. 비슷하게 생긴 숫자나 비슷한 이름을 바꿔 읽기 쉬워요. AI가 자신 있게 적어도 원본 사진과 한 번 대조하세요.',
        '확인하는 법: 결과에서 이름·날짜·금액만 골라 사진과 나란히 보세요. [?] 표시가 남은 곳은 참석자에게 물어보는 게 가장 빨라요.',
      ],
      src: ['synk'],
    },
    'transcript-errors': {
      component: 'transcribe', covers: ['what', 'why', 'trap', 'check'], title: '녹음을 글로 바꾼 기록에서 자주 틀리는 것',
      body: [
        '녹음을 글로 바꾸는 기능은 소리를 듣고 받아 적는 기능이에요. 회의록 정리의 재료로는 아주 좋지만, 받아 적은 글 자체가 틀릴 수 있어요.',
        '자주 틀리는 곳은 사람 이름·회사 이름 같은 고유명사, 숫자와 날짜, 말한 사람 구분이에요. 두 사람이 겹쳐 말하면 누가 한 말인지 바뀌기도 해요.',
        '만드는 회사도 같은 말을 해요. 네이버는 클로바노트의 받아 적은 글과 참석자 구분을 ‘초안’으로 쓰라고 권하고, 삼성은 결과의 정확성을 보장하지 않는다고, 애플은 믿기 전에 정확성을 확인하라고 안내해요.',
        '그래서 요청문에 참석자 이름을 적어 주고, 확실하지 않은 이름과 숫자는 ‘확인 필요’로 표시하게 했어요. 금액이나 기한처럼 중요한 숫자는 녹음을 다시 들어 확인하세요.',
      ],
      src: ['nv-clova-lang', 'ss-transcript', 'ap-call'],
    },
    'audio-route': {
      component: 'transcribe', covers: ['what', 'why', 'price', 'skip'], title: '녹음을 글로 바꾸는 방법과 비용',
      body: [
        '녹음 파일은 먼저 글로 바꿔야 정리할 수 있어요. 대부분 무료로 돼요. 갤럭시는 녹음 앱의 텍스트 변환 어시스트(One UI 6.1 이상), 아이폰은 음성 메모의 받아 적기(iOS 26, 아이폰 12 이상)가 한국어를 지원해요.',
        '녹음 파일만 있다면 네이버 클로바노트가 편해요. 개인은 매달 300분이 무료이고(서비스 품질 향상에 동의하면 300분 추가), 한 번에 180분까지 올릴 수 있어요. 개인용 유료 요금은 없어요. Gemini는 파일을 바로 올릴 수 있지만 무료는 오디오 합계 10분, Google AI Pro(월 29,000원)는 3시간까지예요.',
        '회의 앱의 자동 요약은 대부분 회사용·유료예요. 팀즈 요약은 Teams Premium이나 Copilot, 구글 미트 회의록은 업무 계정이나 Google AI Pro가 필요하고 무료 Gmail에서는 안 돼요. 필요 없는 경우: 10분 안팎의 짧은 회의라면 끝나자마자 적은 메모가 더 빠르고 정확할 때가 많아요.',
      ],
      src: ['ss-transcript', 'ap-voicememo', 'nv-clova', 'gg-limits', 'gg-plans', 'ms-recap', 'gg-meet'],
    },
    'long-record': {
      component: 'ai', covers: ['what', 'why', 'trap'], title: '긴 기록은 AI가 한 번에 다 못 읽을 수 있어요',
      body: [
        'AI가 한 번에 펼쳐 볼 수 있는 양에는 한도가 있어요. 토큰은 AI가 글을 세는 단위예요. ChatGPT는 무료가 한 번에 약 12쪽(27K 토큰), Go·Plus가 약 40쪽(54K)이라고 안내해요. Gemini 무료는 32K 토큰, Claude는 무료도 모델에 따라 최대 1M 토큰까지 읽어요.',
        '한도를 넘으면 앞부분을 잊거나 일부만 보고 정리할 수 있어요. 특히 회의 끝에 나온 결정이 빠지기 쉬워요. ChatGPT는 1만 자가 넘게 붙여 넣으면 자동으로 첨부 파일로 바꾸는데, 이때도 전체를 꼼꼼히 읽었는지는 따로 확인해야 해요.',
        '그래서 긴 기록은 두세 번에 나눠 보내고 ‘다 보낼 때까지 정리하지 마’라고 먼저 말한 뒤, 마지막에 전체를 정리하게 했어요. 결과를 받으면 마지막 부분의 결정이 들어갔는지 꼭 보세요.',
      ],
      src: ['oa-pricing', 'oa-release', 'gg-limits', 'an-pricing'],
    },
    'free-or-paid': {
      component: 'ai', covers: ['price', 'skip'], title: '유료 요금제가 필요할까',
      body: [
        '회의 한두 번을 정리하는 데는 무료로 충분해요. 프로젝트(ChatGPT·Claude)와 Gem(Gemini)도 무료에서 쓸 수 있어요. Claude 무료는 프로젝트를 5개까지 만들 수 있어요.',
        '유료가 값을 하는 경우는 세 가지예요. 1시간이 넘는 녹음 글을 자주 넣을 때(한 번에 읽는 양), 하루에 여러 회의를 정리할 때(사용량), 녹음 파일을 그대로 올릴 때(Gemini 무료는 오디오 합계 10분)예요. ChatGPT 무료는 파일을 하루 3개까지 올릴 수 있어요.',
        '2026년 9월 기준 한국 요금은 ChatGPT Go 월 13,000원·Plus 월 29,000원, Google AI Pro 월 29,000원이고, Claude Pro는 월 20달러예요. 회사 계정이 있다면 개인 결제보다 그걸 쓰는 게 안전하고 쌀 때가 많아요.',
      ],
      src: ['oa-pricing', 'oa-projects', 'oa-files', 'an-projects', 'an-pricing', 'gg-limits', 'gg-plans'],
    },
    'which-ai': {
      component: 'ai', covers: ['what', 'skip'], title: '어떤 AI든 회의록 정리는 잘해요',
      body: [
        'ChatGPT·Claude·Gemini 모두 두서없는 기록을 요약·결정·할 일로 나누는 일을 잘해요. 차이는 이름과 한도예요. 규칙을 저장하는 곳이 ChatGPT와 Claude는 ‘프로젝트’, Gemini는 ‘Gem’이에요.',
        '이미 쓰는 AI가 있다면 바꿀 필요가 없어요. 새로 고른다면 영상과 11쪽 PDF가 ChatGPT 화면으로 되어 있어 따라 하기 쉬워요. 긴 녹음 글을 자주 넣는다면 무료에서도 한 번에 많이 읽는 Claude가 편해요.',
        '따로 필요 없는 것: 회의록 전용 유료 앱. 메모나 녹음 글이 있다면 쓰던 AI와 요청문 하나로 충분해요.',
      ],
      src: ['synk', 'an-pricing', 'oa-pricing'],
    },
    'hallucination': {
      component: 'format', covers: ['why', 'trap', 'check'], title: 'AI가 기록에 없는 내용을 채울 때',
      body: [
        'AI는 빈칸을 그럴듯하게 채우려는 버릇이 있어요. 담당자가 안 정해진 일에 이름을 붙이거나, 마감이 없는 일에 다음 회의 날짜를 기한으로 적는 식이에요. ChatGPT·Claude·Gemini 모두 ‘틀릴 수 있으니 중요한 건 확인하라’고 안내해요.',
        '그래서 요청문에 ‘기록에 없는 건 추측하지 말고 확인 필요로 표시’와 ‘다음 회의 날짜를 기한으로 쓰지 말 것’을 넣었어요. 영상의 실제 시연에서도 기한이 없던 민호의 일은 ‘확인 필요’로 나왔어요.',
        '확인하는 법: 결과의 이름·날짜·숫자를 하나씩 원본에서 찾아보세요. 원본에 없는 게 보이면 같은 채팅에 “이 날짜는 원문 어디에 있어?”라고 물으면 근거를 보여 주거나 고쳐요.',
      ],
      src: ['oa-mistakes', 'an-accuracy', 'synk'],
    },
    'format-by-meeting': {
      component: 'format', covers: ['why', 'check'], title: '회의마다 남길 칸이 다른 이유',
      body: [
        '회의록은 나중에 “그래서 누가 뭘 언제까지?”를 찾으려고 봐요. 그래서 팀 회의는 할 일 표가, 고객 미팅은 요청 사항과 약속·숫자가, 수업은 과제와 질문이 중심이에요.',
        '요청문의 칸은 고른 회의에 맞춰 바꿨어요. 칸이 정해져 있으면 AI가 매번 다른 모양으로 쓰지 않고, 빠진 정보가 칸째로 눈에 띄어요.',
        '확인하는 법: 칸이 비어 있으면 AI 잘못이 아니라 회의에서 안 정해진 거예요. 그 칸을 다음 회의 안건으로 옮기면 돼요.',
      ],
      src: ['synk'],
    },
    'project-save': {
      component: 'save', covers: ['what', 'why', 'skip', 'trap', 'check'], title: '프로젝트·Gem에 규칙을 저장하면',
      body: [
        '프로젝트(ChatGPT·Claude)와 Gem(Gemini)은 ‘규칙을 넣어 둔 전용 폴더’예요. 한 번 저장하면 다음 회의부터는 “이번 회의도 정리해줘” 한 줄과 기록만 보내도 같은 형식으로 나와요.',
        '함정은 저장 위치예요. 계정 전체에 적용되는 ‘맞춤 지침’에 넣으면 회의와 상관없는 대화에도 섞여요. 그리고 지난 회의의 이름·날짜가 섞이지 않게 규칙 첫 줄에 ‘이번 메시지의 기록만 사용’을 넣었어요. ChatGPT는 프로젝트를 만들 때 ‘프로젝트 전용 메모리’를 고르면 다른 대화의 기억이 섞이지 않아요.',
        '필요 없는 경우: 이번 한 번만 정리한다면 저장하지 않아도 돼요. 요청문 하나로 충분해요. Gemini의 Gem은 2026년 11월부터 개인 계정에서 ‘스킬’로 자동으로 바뀌어요. 저장해 둔 규칙은 그대로 옮겨져요.',
      ],
      src: ['oa-projects', 'an-projects', 'gg-gems', 'gg-skills'],
    },
    'share-by-recipient': {
      component: 'share', covers: ['why', 'trap', 'check'], title: '받는 사람에 맞춰 바꿔 보내요',
      body: [
        '같은 회의록도 받는 사람마다 먼저 봐야 할 게 달라요. 상사는 결론과 결정, 요청할 것 세 줄을 먼저 봐요. 참석하지 못한 사람은 배경 한 줄과 자기에게 온 일이 필요해요. 고객은 약속한 것과 확인할 질문이 필요해요.',
        '함정은 내부 메모가 그대로 나가는 거예요. “이건 비싸게 불러 보자” 같은 내부 이야기, AI가 붙인 ‘확인 필요’ 표시, 추측 문장이 외부 메일에 남지 않게 요청문에 넣었어요. 메신저는 표가 깨지니 줄 목록으로 바꾸게 했어요.',
        '확인하는 법: 보내기 전에 받는 사람 입장에서 처음부터 한 번 읽어 보세요. AI에게 대신 보내게 하지 말고, 복사해서 내가 보내요.',
      ],
      src: ['synk'],
    },
    'privacy-training': {
      component: 'privacy', covers: ['what', 'why', 'skip', 'trap', 'check'], title: 'AI에 넣은 회의 내용은 어디에 쓰일까',
      body: [
        '개인 계정(무료·유료)에서는 대화가 AI 모델을 개선하는 데 쓰일 수 있어요. ChatGPT·Claude·Gemini 모두 끌 수 있고, Gemini는 켜 두면 대화가 생성형 AI 학습에 쓰인다고 한국어 도움말에 적혀 있어요. Claude는 학습을 허락하면 대화를 최대 5년, 아니면 30일 보관해요.',
        '회사 계정은 달라요. ChatGPT Business·Enterprise, Claude의 업무용 요금제, Google Workspace는 기본적으로 조직 밖 모델 학습에 쓰지 않아요. 회사 자료라면 회사가 허락한 계정과 규칙부터 확인하세요.',
        '함정: 학습을 꺼도 대화는 한동안 보관돼요(ChatGPT 임시 채팅 최대 30일, Gemini는 꺼도 72시간). 그래서 연락처·계좌번호·주민등록번호 같은 개인정보는 설정과 상관없이 지우고 넣으세요. 필요 없는 경우: 영상 속 예시처럼 가상이거나 공개된 내용이라면 그대로 써도 돼요.',
      ],
      src: ['oa-data', 'oa-temp', 'an-terms', 'gg-activity', 'gg-workspace'],
    },
    'recording-consent': {
      component: 'privacy', covers: ['trap', 'check'], title: '회의를 녹음하기 전에',
      body: [
        '한국에서는 대화에 참여한 사람이 그 대화를 녹음하는 건 통신비밀보호법 위반이 아니라는 게 대법원 판례예요(2006도4981). 하지만 내가 참여하지 않은 다른 사람들의 대화를 몰래 녹음하면 1년 이상 10년 이하의 징역이 될 수 있어요(제3조·제16조).',
        '법에 걸리지 않아도 녹음은 시작할 때 알리는 게 좋아요. 회사·학교마다 녹음 규칙이 따로 있을 수 있어요. 아이폰으로 통화를 녹음하면 상대방에게도 녹음 중이라는 안내가 나와요.',
        '확인하는 법: 회의 시작 때 “정리용으로 녹음할게요” 한마디를 하고, 회의록을 다 만든 뒤 필요 없는 녹음 파일과 받아 적은 글은 지우세요.',
      ],
      src: ['kr-court', 'kr-law', 'ap-call'],
    },
  };

  const steps = [
    {
      id: 'meet', type: 'single', eyebrow: '어떤 회의인가요', short: '회의 종류',
      title: '정리할 회의는 어떤 자리인가요?',
      sub: '회의마다 꼭 남겨야 할 칸이 달라서 먼저 물어요.',
      options: [
        { id: 'team', label: '팀 회의·업무 회의', sub: '주간 회의, 프로젝트 점검', tip: '팀 회의는 ‘누가 무엇을 언제까지’가 핵심이에요. 할 일 표를 중심으로 정리할게요.' },
        { id: 'client', label: '고객·거래처 미팅', sub: '요청 사항, 견적, 약속', tip: '고객 미팅은 요청과 약속, 금액·수량·날짜가 핵심이에요. 숫자 확인 칸을 따로 둘게요.' },
        { id: 'one', label: '1:1 면담·코칭', sub: '피드백, 목표, 다음 약속', tip: '1:1은 합의한 것과 다음에 확인할 날짜가 핵심이에요. 사적인 이야기는 옮기지 않게 할게요.' },
        { id: 'class', label: '수업·스터디·세미나', sub: '배운 내용, 과제, 질문', tip: '수업은 핵심 내용과 과제·마감, 물어볼 것이 핵심이에요.' },
        { id: 'group', label: '모임·동아리·가족 회의', sub: '역할, 일정, 돈', tip: '모임은 역할 나누기와 일정, 회비 같은 돈 이야기가 핵심이에요.' },
      ],
      tip: { title: '회의록은 ‘나중에 찾을 것’을 위해 써요', body: ['회의가 끝나고 가장 많이 찾는 건 “그래서 누가 뭘 언제까지 하기로 했지?”예요. 좋은 회의록은 긴 요약보다 이 질문에 바로 답해요.', '아래 그림처럼 기한이 안 정해진 일을 AI가 다음 회의 날짜로 채우는 실수가 흔해요. 요청문에 이걸 막는 규칙을 넣어 드릴게요.'], visual: 'deadline' },
    },
    {
      id: 'record', type: 'multi', eyebrow: '지금 가진 기록', short: '기록 형태',
      title: '지금 가진 기록은 어떤 모양인가요?',
      sub: '있는 것을 모두 골라 주세요. 두서없어도 괜찮아요.',
      options: [
        { id: 'memo', label: '직접 쓴 메모', sub: '휴대폰·노트북 메모, 수첩', tip: '메모는 다듬지 말고 그대로 넣으면 돼요. 정리는 AI가 해요.' },
        { id: 'photo', label: '손글씨·화이트보드 사진', sub: '사진으로 찍어 둔 것', tip: '사진을 그대로 올리면 AI가 글자를 읽어요. 흘려 쓴 이름과 숫자는 꼭 대조할게요.' },
        { id: 'transcript', label: '녹음을 글로 바꾼 내용', sub: '녹음 앱·클로바노트의 텍스트', tip: '받아 적은 글은 이름·숫자가 틀릴 수 있어요. 헷갈리는 건 ‘확인 필요’로 표시하게 할게요.' },
        { id: 'audio', label: '녹음 파일만 있어요', sub: '아직 글로 안 바꿨어요', tip: '먼저 글로 바꾸는 방법을 기기에 맞춰 알려 드릴게요.' },
        { id: 'chat', label: '메신저·채팅 기록', sub: '카톡·슬랙·팀즈 대화', tip: '잡담이 섞인 대화에서 결정·할 일·약속만 골라내게 할게요.' },
        { id: 'auto', label: '회의 앱 자동 기록', sub: '줌·팀즈·구글 미트의 요약·자막', tip: '자동 요약은 빠진 게 있을 수 있어요. 자막이 있으면 함께 넣게 할게요.' },
      ],
      tip: { title: '두서없는 메모도 이렇게 바뀌어요', body: ['영상에서 쓴 가상 메모예요. 순서가 뒤섞이고 줄임말투성이여도 AI가 할 일·담당·기한으로 나눠 줘요.', '정해지지 않은 기한은 지어내지 않고 ‘확인 필요’로 남기는 게 핵심이에요.'], visual: 'beforeafter' },
    },
    {
      id: 'audio', type: 'group', when: a => (a.record || []).includes('audio'), eyebrow: '녹음을 글로', short: '녹음 기기',
      title: '녹음은 어떤 기기로 했나요?',
      sub: '기기마다 무료로 글로 바꾸는 방법이 달라요.',
      fields: [
        { id: 'device', label: '녹음한 기기', options: [
          { id: 'galaxy', label: '갤럭시 휴대폰', tip: '갤럭시 녹음 앱의 텍스트 변환 어시스트가 한국어를 지원해요(One UI 6.1 이상).' },
          { id: 'iphone', label: '아이폰', tip: '아이폰 음성 메모는 iOS 26부터 한국어로 받아 적어요(아이폰 12 이상).' },
          { id: 'meetingapp', label: '회의 앱(줌·팀즈·미트)', tip: '회의 앱의 자동 기록은 한국어를 지원하지만 대부분 회사용·유료 요금제예요. 되는지부터 볼게요.' },
          { id: 'other', label: '녹음기·기타 파일', tip: '클로바노트에 올리면 개인은 매달 300분까지 무료로 받아 적어요.' },
        ] },
        { id: 'mins', label: '녹음 길이', options: [
          { id: 'u10', label: '10분 이하', tip: '짧으면 Gemini 무료에 파일을 바로 올려도 돼요.' },
          { id: 'u60', label: '1시간 이하' },
          { id: 'o60', label: '1시간 넘게', tip: '긴 녹음은 받아 적기 앱으로 먼저 글로 바꾸는 게 편해요.' },
        ] },
      ],
      tip: { title: '녹음은 먼저 ‘글’이 되어야 정리할 수 있어요', body: ['ChatGPT와 Claude는 대화창에 녹음 파일을 올려 받아 적는 방법을 공식적으로 안내하지 않아요. 먼저 받아 적은 글이 필요해요. Gemini는 녹음 파일을 바로 올릴 수 있지만 무료는 합쳐서 10분까지예요.', '받아 적은 글은 이름·숫자가 틀릴 수 있어서, 결과를 녹음과 대조하는 단계를 순서에 넣어 드릴게요.'], src: 'gg-limits' },
    },
    {
      id: 'length', type: 'single', eyebrow: '기록 분량', short: '분량',
      title: '기록은 얼마나 긴가요?',
      sub: 'AI가 한 번에 읽는 양에 한도가 있어서, 길이에 맞춰 넣는 법을 바꿔요.',
      options: [
        { id: 'short', label: '짧아요', sub: '메모 한 화면, 10분 안팎 회의', tip: '그대로 붙여 넣으면 돼요.' },
        { id: 'mid', label: '보통이에요', sub: '30분~1시간 회의 메모', tip: '대부분 한 번에 붙여 넣을 수 있어요. 무료 요금제라면 넣는 법을 같이 알려 드릴게요.' },
        { id: 'long', label: '길어요', sub: '1시간 넘는 녹음 글, 회의 여러 개', tip: '나눠 보내거나 파일로 올리는 법을 요청문에 넣어 드릴게요.' },
      ],
      tip: { title: 'AI가 한 번에 펼쳐 보는 양', body: ['AI에게도 한 번에 펼쳐 볼 수 있는 책상 크기가 있어요. ChatGPT 무료는 한 번에 약 12쪽, Go·Plus는 약 40쪽이라고 안내해요. 그보다 길면 앞부분을 잊거나 일부만 보고 정리할 수 있어요.', '긴 기록은 나눠 보내고 마지막에 전체를 정리하게 하면 빠지는 게 줄어요.'], src: 'oa-pricing' },
    },
    {
      id: 'ai', type: 'group', eyebrow: '쓰는 AI', short: '쓰는 AI',
      title: '어떤 AI로 정리할까요?',
      sub: '메뉴 이름과 저장하는 곳이 AI마다 달라서 맞춰 드려요.',
      fields: [
        { id: 'app', label: 'AI', options: [
          { id: 'chatgpt', label: 'ChatGPT', tip: '영상과 11쪽 PDF가 ChatGPT 화면이라 그대로 따라 하면 돼요.' },
          { id: 'claude', label: 'Claude', tip: 'Claude는 ‘프로젝트’에 규칙을 저장해요. 무료도 5개까지 만들 수 있어요.' },
          { id: 'gemini', label: 'Gemini', tip: 'Gemini는 ‘Gem’에 규칙을 저장해요. 2026년 11월부터 개인 계정의 Gem은 ‘스킬’로 자동으로 바뀌어요.' },
          { id: 'none', label: '아직 없어요', tip: '기록 길이와 쓰임에 맞는 AI를 골라 드릴게요.' },
        ] },
        { id: 'plan', label: '요금제', options: [
          { id: 'free', label: '무료', tip: '회의록 정리는 무료로도 충분한 경우가 많아요. 한도에 걸리는 경우만 따로 알려 드릴게요.' },
          { id: 'paid', label: '유료(개인)' },
          { id: 'work', label: '회사·학교 계정', tip: '회사 계정은 기본적으로 조직 밖 모델 학습에 쓰지 않아요. 회사 규칙이 먼저예요.' },
        ] },
      ],
      tip: { title: '같은 기능, 다른 이름', body: ['규칙을 한 번 저장해 두는 기능이 ChatGPT와 Claude는 ‘프로젝트’, Gemini는 ‘Gem’이에요. 저장하는 칸 이름도 ‘지침’과 ‘요청 사항’으로 달라요.', '고른 AI의 실제 메뉴 순서대로 알려 드릴게요.'], visual: 'names' },
    },
    {
      id: 'freq', type: 'single', eyebrow: '얼마나 자주', short: '정리 빈도',
      title: '이런 정리를 얼마나 자주 하나요?',
      sub: '자주 한다면 규칙을 한 번 저장해 두는 게 훨씬 편해요.',
      options: [
        { id: 'once', label: '이번 한 번', sub: '다음은 그때 생각할래요', tip: '그럼 요청문 하나면 돼요. 저장은 건너뛸게요.' },
        { id: 'weekly', label: '비슷한 회의를 자주', sub: '주간 회의, 정기 수업', tip: '규칙을 한 번 저장하면 다음부터는 한 줄이면 돼요.' },
        { id: 'many', label: '여러 종류 회의를 자주', sub: '회의마다 성격이 달라요', tip: '회의 종류별로 칸을 바꿔 쓰는 규칙을 만들어 드릴게요.' },
      ],
      tip: { title: '처음 한 번만 길게, 다음부터는 한 줄', body: ['자주 정리한다면 규칙을 프로젝트나 Gem에 저장해 두세요. 매번 긴 요청문을 붙이지 않아도 같은 형식이 나와요.', '이번 한 번이라면 저장하지 않아도 돼요.'], visual: 'repeat' },
    },
    {
      id: 'share', type: 'multi', eyebrow: '누구에게', short: '받는 사람',
      title: '정리한 회의록을 누구에게 보내나요?',
      sub: '받는 사람마다 먼저 봐야 할 게 달라요. 모두 골라 주세요.',
      options: [
        { id: 'me', label: '나만 봐요', sub: '기록과 할 일 관리용', tip: '내가 다시 찾기 쉬운 형식이면 충분해요.' },
        { id: 'team', label: '같이 회의한 사람들', sub: '팀원·참석자', tip: '각자 할 일이 한눈에 보이게 담당자별로 모을게요.' },
        { id: 'boss', label: '상사·보고용', sub: '결론부터 짧게', tip: '결론·결정·요청할 것을 세 줄로 먼저 두게 할게요.' },
        { id: 'absent', label: '참석하지 못한 사람', sub: '배경부터 필요해요', tip: '배경 한 줄과 그 사람에게 온 일을 먼저 두게 할게요.' },
        { id: 'client', label: '고객·외부', sub: '정중하게, 내부 이야기는 빼고', tip: '내부 메모와 추측을 빼고, 확인할 것은 질문으로 바꾸게 할게요.' },
      ],
      tip: { title: '회의록은 받는 사람이 읽기 쉬워야 끝나요', body: ['같은 내용도 상사에게는 결론 먼저, 고객에게는 약속과 질문 먼저가 좋아요. 받는 사람에 맞춰 바꿔 주는 요청문을 따로 만들어 드릴게요.', 'AI에게 대신 보내게 하지 말고, 내가 읽고 복사해서 보내는 게 안전해요.'] },
    },
    {
      id: 'channel', type: 'single', when: a => (a.share || []).some(x => x !== 'me'), eyebrow: '어디로', short: '보내는 곳',
      title: '어디로 보내나요?',
      sub: '보내는 곳에 따라 모양이 달라져요.',
      options: [
        { id: 'messenger', label: '메신저', sub: '카톡·슬랙·팀즈 채팅', tip: '메신저는 표가 깨지기 쉬워요. 짧은 줄 목록으로 바꾸게 할게요.' },
        { id: 'email', label: '메일', sub: '제목·인사·요약·요청', tip: '메일은 제목과 인사, 요약, 요청, 마무리 순서로 만들게 할게요.' },
        { id: 'doc', label: '공유 문서', sub: '노션·구글 문서·워드', tip: '문서는 제목과 표를 그대로 살리게 할게요.' },
      ],
      tip: { title: '보내는 곳에 맞는 모양', body: ['메신저는 다섯 줄 안팎의 줄 목록, 메일은 제목과 요청이 분명한 글, 문서는 표가 있는 회의록이 읽기 좋아요.', '같은 회의록을 받는 곳에 맞게 바꾸는 요청문을 만들어 드릴게요.'] },
    },
    {
      id: 'sensitive', type: 'single', eyebrow: '정보 보호', short: '민감한 정보',
      title: '기록에 이런 정보가 들어 있나요?',
      sub: 'AI에 넣기 전에 지울 것과 설정을 알려 드릴게요.',
      options: [
        { id: 'none', label: '없어요', sub: '공개돼도 괜찮은 내용', tip: '그대로 넣어도 돼요. 그래도 회사 자료라면 회사 규칙을 먼저 보세요.' },
        { id: 'internal', label: '회사 내부 정보', sub: '매출, 계획, 인사 이야기', tip: '회사 계정이 있다면 그걸 쓰고, 개인 계정이라면 학습 설정부터 확인할게요.' },
        { id: 'personal', label: '다른 사람의 개인정보', sub: '연락처, 주소, 계좌, 건강 이야기', tip: '개인정보는 넣기 전에 지우는 게 가장 확실해요. 지우는 법을 순서에 넣을게요.' },
        { id: 'unsure', label: '잘 모르겠어요', tip: '넣기 전에 확인할 것을 순서에 넣어 드릴게요.' },
      ],
      tip: { title: '설정보다 먼저, 넣지 않는 게 가장 안전해요', body: ['개인 계정에서는 대화가 AI 개선에 쓰일 수 있어요. 끄는 설정이 있지만, 꺼도 대화는 한동안 보관돼요.', '그래서 연락처·계좌번호처럼 회의록에 필요 없는 개인정보는 지우고 넣는 게 가장 확실해요. 이름은 “담당자 A”처럼 바꿔도 정리에는 문제없어요.'], src: 'gg-activity' },
    },
  ];

  const practiceMemo = '오늘 회의 메모. 소개 페이지 문구가 길다는 얘기 나옴. 짧게 고치기로. 지수가 9월 23일까지 수정하겠다고 함. 설문 얘기도 했는데 초안은 민호가 맡기로 했고 마감은 안 정함. 고객 인터뷰 해보자는 말도 나왔지만 할지는 아직 미정. 아 다음 회의는 9월 25일 오후 2시.';

  return Object.freeze({
    id: 'brief.meeting', version: 1, checked: CHECKED,
    series: 'synkbrief 활용', title: '회의 기록 맞춤 정리',
    intro: {
      eyebrow: 'synkbrief 활용 · 회의 정리',
      title: '흩어진 회의 기록을<br><span class="hl">내 상황에 맞는</span> 회의록으로',
      lead: '어떤 회의인지, 기록이 어떤 모양인지, 어떤 AI를 쓰는지 고르면 그대로 붙여 넣을 요청문과 한 번 저장할 규칙, 받는 사람에게 보낼 글까지 만들어 드려요. 고르는 동안 왜 그렇게 하는지도 알려 드릴게요.',
      meta: ['약 1분', '질문 7~9개', 'ChatGPT·Claude·Gemini', '로그인 없음'],
      privacy: '고른 답만 이 기기에 저장돼요. 회의 내용은 이 화면에 입력하지 않아요.',
      start: '내 회의에 맞추기',
      linksLabel: '영상 속 자료 바로 받기',
      links: [
        { href: 'meeting-guide.pdf', label: '11쪽 따라 하기 PDF', sub: 'ChatGPT 화면 기준' },
        { href: 'meeting-kit.zip', label: '복사 문장·연습 메모 ZIP', sub: '가상 메모와 정리 예시', download: true },
      ],
    },
    steps, SOURCES, TIPS, COMPONENTS,
    guidePdf: 'meeting-guide.pdf', kitZip: 'meeting-kit.zip', practiceMemo,
    channels: { instagram: 'https://www.instagram.com/synkbrief/', youtube: 'https://www.youtube.com/@synkbrief' },
  });
});
