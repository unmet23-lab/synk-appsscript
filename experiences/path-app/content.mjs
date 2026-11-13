// PATH 초기 프론트 콘텐츠. 모든 기회(OPPORTUNITIES)는 데모 예시이며 실재 기관·공고가 아닙니다.
// 금액·마감·체류자격 조건은 의도적으로 포함하지 않습니다.

export const GOALS = [
  {
    id: 'study',
    label: { ko: '해외에서 한국을 준비해요', en: 'Preparing for Korea from abroad' },
    description: { ko: '학교·유학', en: 'Schools · study abroad' },
    homeTitle: { ko: '과정을 비교하고 지원 자료를 준비해요', en: 'Compare programs and prepare your application' },
    note: { ko: '학교와 과정을 비교하고, 지원 서류와 물어볼 질문을 정리하는 화면으로 시작해요.', en: 'Start by comparing schools and programs, then organize documents and questions.' },
    steps: [
      { ko: '학교 · 과정 예시를 둘러보고 비교해요.', en: 'Browse and compare school and program examples.' },
      { ko: '지원 이유와 학업 경험을 내 말로 적어 두어요.', en: 'Write your reasons and study background in your own words.' },
      { ko: '내가 확인하고, 실제 지원은 학교의 공식 창구로 해요.', en: 'Review it yourself; apply through the school’s official channel.' }
    ],
    homeAction: { ko: '과정 비교하기', en: 'Compare programs' },
    defaultLocation: 'abroad',
    interests: [
      { id: 'school', label: { ko: '학교·과정 고르기', en: 'Choosing a school or program' } },
      { id: 'scholarship', label: { ko: '장학 정보', en: 'Scholarships' } },
      { id: 'language', label: { ko: '한국어 준비', en: 'Korean language prep' } },
      { id: 'documents', label: { ko: '지원 서류 정리', en: 'Organizing application documents' } }
    ]
  },
  {
    id: 'student',
    label: { ko: '한국에서 유학 중이에요', en: 'Studying in Korea now' },
    description: { ko: '생활·졸업', en: 'Campus life · graduation' },
    homeTitle: { ko: '학교생활과 졸업 이후를 함께 준비해요', en: 'Plan campus life and what comes after graduation' },
    note: { ko: '학교생활과 졸업 이후를 함께 준비하는 화면으로 시작해요.', en: 'Start with campus life and what comes after graduation.' },
    steps: [
      { ko: '학교생활 · 졸업 준비 예시를 둘러봐요.', en: 'Browse campus life and graduation examples.' },
      { ko: '남은 학기 계획과 물어볼 질문을 적어 두어요.', en: 'Write your remaining-term plan and questions.' },
      { ko: '내가 확인하고, 실제 요건은 학교에 직접 확인해요.', en: 'Review it yourself and confirm requirements with your school.' }
    ],
    homeAction: { ko: '준비할 것 고르기', en: 'Pick what to prepare' },
    defaultLocation: 'korea',
    interests: [
      { id: 'campus', label: { ko: '학교생활 적응', en: 'Settling into campus life' } },
      { id: 'graduation', label: { ko: '졸업 준비', en: 'Graduation planning' } },
      { id: 'career', label: { ko: '진로 탐색', en: 'Exploring career paths' } },
      { id: 'parttime', label: { ko: '학업과 일 병행 고민', en: 'Balancing study and work' } }
    ]
  },
  {
    id: 'job',
    label: { ko: '취업을 준비하고 있어요', en: 'Preparing for a job' },
    description: { ko: '공고·지원·면접', en: 'Postings · applications · interviews' },
    homeTitle: { ko: '공고를 비교하고 지원 자료를 준비해요', en: 'Compare postings and prepare your application' },
    note: { ko: '공고와 연습 예시를 비교하고, 지원 자료를 내 말로 준비하는 화면으로 시작해요.', en: 'Start by comparing postings and practice examples, then prepare your materials in your own words.' },
    steps: [
      { ko: '공고와 연습 예시를 구분해 둘러보고 비교해요.', en: 'Browse real postings and practice examples, clearly labeled.' },
      { ko: '내 말로 답변 초안을 적어 두어요.', en: 'Draft your answers in your own words.' },
      { ko: '내가 확인하고, 실제 제출은 공식 경로로 해요.', en: 'Review it yourself; submit only through official channels.' }
    ],
    homeAction: { ko: '공고 비교하기', en: 'Compare postings' },
    defaultLocation: 'unknown',
    interests: [
      { id: 'resume', label: { ko: '이력서 정리', en: 'Resume' } },
      { id: 'interview', label: { ko: '면접 연습', en: 'Interview practice' } },
      { id: 'compare', label: { ko: '공고 조건 비교', en: 'Comparing postings' } },
      { id: 'korean', label: { ko: '업무 한국어', en: 'Workplace Korean' } }
    ]
  }
];

export const OPPORTUNITIES = [
  {
    id: 'demo-study-a',
    goal: 'study',
    title: { ko: '예시대학A · 학부 과정', en: 'Example University A · Undergraduate' },
    summary: { ko: '학부 과정을 가정한 데모 예시입니다. 실제 모집 요강은 학교 공식 안내에서 확인하세요.', en: 'A demo example of an undergraduate program. Check the school’s official guide for real admission details.' },
    source: 'demo',
    requirements: [
      { ko: '지원하려는 이유를 내 말로 정리', en: 'Put your reason for applying in your own words' },
      { ko: '지금까지의 학업 경험 정리', en: 'Summarize your academic background' },
      { ko: '확인이 필요한 질문 목록 만들기', en: 'List questions you still need to confirm' }
    ],
    prompt: { ko: '이 과정을 고려하는 이유와 지금까지의 학업 경험을 적어 보세요.', en: 'Write why you are considering this program and your academic experience so far.' }
  },
  {
    id: 'demo-study-b',
    goal: 'study',
    title: { ko: '예시대학B · 어학 과정', en: 'Example University B · Language program' },
    summary: { ko: '한국어 어학 과정을 가정한 데모 예시입니다. 기간과 비용은 표시하지 않습니다.', en: 'A demo example of a Korean language program. Duration and costs are not shown.' },
    source: 'demo',
    requirements: [
      { ko: '현재 한국어 수준을 솔직하게 기록', en: 'Note your current Korean level honestly' },
      { ko: '어학 과정 이후 계획 정리', en: 'Outline your plan after the language program' }
    ],
    prompt: { ko: '지금 한국어 수준과 어학 과정 이후의 계획을 적어 보세요.', en: 'Describe your current Korean level and your plan after the program.' }
  },
  {
    id: 'demo-student-a',
    goal: 'student',
    title: { ko: '예시 졸업 준비 점검', en: 'Example graduation checklist' },
    summary: { ko: '졸업 전에 스스로 점검할 항목을 정리하는 데모 예시입니다. 실제 요건은 소속 학교에 확인하세요.', en: 'A demo checklist for reviewing before graduation. Confirm real requirements with your school.' },
    source: 'demo',
    requirements: [
      { ko: '남은 학기와 이수 상황을 내 기록으로 정리', en: 'Record your remaining terms and credits yourself' },
      { ko: '학과 사무실에 물어볼 질문 적기', en: 'Write questions for your department office' }
    ],
    prompt: { ko: '남은 학기 계획과 학교에 확인할 질문을 적어 보세요.', en: 'Write your plan for the remaining terms and questions for your school.' }
  },
  {
    id: 'demo-student-b',
    goal: 'student',
    title: { ko: '예시 진로 탐색 노트', en: 'Example career exploration note' },
    summary: { ko: '졸업 후 진로를 생각해 보는 데모 예시입니다. 특정 기관이나 프로그램이 아닙니다.', en: 'A demo note for thinking about life after graduation. Not a specific organization or program.' },
    source: 'demo',
    requirements: [
      { ko: '관심 분야 두세 가지 적기', en: 'List two or three fields of interest' },
      { ko: '관련 수업·활동 경험 정리', en: 'Summarize related classes or activities' }
    ],
    prompt: { ko: '관심 있는 분야와 관련된 수업이나 활동 경험을 적어 보세요.', en: 'Write fields you are interested in and related classes or activities.' }
  },
  {
    id: 'demo-job-a',
    goal: 'job',
    title: { ko: '예시공고A · 사무 지원 직무', en: 'Example Posting A · Office support role' },
    summary: { ko: '사무 지원 직무를 가정한 데모 공고입니다. 급여·마감·자격 조건은 포함하지 않습니다.', en: 'A demo posting for an office support role. No pay, deadline, or eligibility conditions included.' },
    source: 'demo',
    requirements: [
      { ko: '직무와 관련된 경험 한 가지 구체적으로 적기', en: 'Describe one relevant experience in detail' },
      { ko: '지원 동기 짧게 정리', en: 'Summarize your motivation briefly' }
    ],
    prompt: { ko: '이 직무와 관련된 경험 하나와 지원 동기를 적어 보세요.', en: 'Write one related experience and why you want this role.' }
  },
  {
    id: 'demo-job-b',
    goal: 'job',
    title: { ko: '예시공고B · 돌봄 서비스 직무', en: 'Example Posting B · Care service role' },
    summary: { ko: '돌봄 서비스 직무를 가정한 데모 공고입니다. 실제 채용 조건은 공식 공고에서 확인하세요.', en: 'A demo posting for a care service role. Check official postings for real hiring conditions.' },
    source: 'demo',
    requirements: [
      { ko: '사람을 돕거나 돌본 경험 정리', en: 'Summarize experience helping or caring for people' },
      { ko: '어려웠던 상황과 대처 방법 적기', en: 'Describe a difficult situation and how you handled it' }
    ],
    prompt: { ko: '누군가를 돕거나 돌본 경험과 어려웠던 순간의 대처를 적어 보세요.', en: 'Write about helping or caring for someone and how you handled a hard moment.' }
  }
];

export const OFFICIAL_LINKS = [
  {
    id: 'study-in-korea',
    goal: 'study',
    title: { ko: 'Study in Korea', en: 'Study in Korea' },
    summary: { ko: '한국 유학 공식 안내 사이트입니다. 세부 조건은 원문에서 직접 확인하세요.', en: 'Official guide to studying in Korea. Check details on the original site.' },
    source: 'official',
    url: 'https://www.studyinkorea.go.kr/',
    checkedAt: '2026-11-09',
    summaryOnly: true
  },
  {
    id: 'work24',
    goal: 'job',
    title: { ko: '고용24', en: 'Work24' },
    summary: { ko: '고용·채용 관련 공공 서비스입니다. PATH와 연동되어 있지 않습니다.', en: 'Public employment service. Not connected to PATH.' },
    source: 'official',
    url: 'https://www.work24.go.kr/',
    checkedAt: '2026-11-09',
    summaryOnly: true
  },
  {
    id: 'hikorea',
    goal: null,
    title: { ko: '하이코리아', en: 'HiKorea' },
    summary: { ko: '외국인 체류 관련 공공 안내입니다. 본인 상황은 원문과 공식 문의로 확인하세요.', en: 'Public information on stay in Korea for foreign nationals. Confirm your case via the original source and official inquiry.' },
    source: 'official',
    url: 'https://www.hikorea.go.kr/',
    checkedAt: '2026-11-09',
    summaryOnly: true
  }
];

export const EXISTING_TOOLS = [
  {
    id: 'travel',
    title: { ko: 'SYNK 여행 체험', en: 'SYNK travel experience' },
    summary: { ko: '별도 페이지에서 열립니다. 이 앱의 저장 내용과 분리됩니다.', en: 'Opens as a separate page. Kept apart from this app’s saved data.' },
    url: 'https://synk.im/try/travel/'
  },
  {
    id: 'interview',
    title: { ko: '면접 리허설 (돌봄 직무 상황)', en: 'Interview rehearsal (care role scenario)' },
    summary: { ko: '현재 돌봄 직무 상황만 다룹니다. 모든 직종을 지원하지 않으며 별도 페이지에서 열립니다.', en: 'Currently covers a care role scenario only, not every job type. Opens as a separate page.' },
    url: 'https://synk.im/path/interview/film/rehearsal.html'
  }
];
