// 업무 백업 0.7.0 화면 시안 — 두 시안이 같이 쓰는 문구 · 예시 자료 (2026-11-13)
// 문구의 근거는 1단계 설계(STAGE1_DESIGN.md) 2장 · 4장. 숫자는 「예시」이고 서로 맞게 짰다
// (폴더 넷의 합 = 지키는 것, 옮겨 오기 결과의 합 = 전체, 증명 파일 수 ≥ 폴더 수 · 합 64MiB 안,
//  한꺼번에 지워짐은 4.4 문턱 위 — 전체의 30% 넘고 200개 넘음, 채움은 4시간에 한 번, 되돌리기는 T + 29일까지).
// 요일은 실제 달력(2026-11-13 금). 기본 화면에는 restic · 스냅샷 · 버킷 · 출입증 · 저장소 · pack · prune을 쓰지 않는다(설계 4.12 · T18).

// 받침 따라 조사 고르기(한글은 끝 글자 받침, 라틴 이름은 끝 소리로 어림 — Outlook → 이/을, Excel → 이/을)
export function josa(word, pair) {
  const [a, b] = pair.split('/');
  const c = word.trim().slice(-1);
  const code = c.charCodeAt(0);
  let batchim;
  if (code >= 0xac00 && code <= 0xd7a3) batchim = (code - 0xac00) % 28 !== 0;
  else if (/[0-9]/.test(c)) batchim = '013678'.includes(c);
  else batchim = /[bcdgjklmnpqrtvxz]$/i.test(c) && !/[aeiouy]$/i.test(c);
  return word + (batchim ? a : b);
}

export const D = {
  app: '업무 백업',
  version: '0.7.0',
  device: '작업 노트북',
  newDevice: '새 데스크톱',
  account: 'studio@example.com',
  todayLong: '2026년 11월 13일 금요일',
  todayDots: '2026. 11. 13. 금',

  last: { ko: '오후 2:02', h24: '14:02' },
  next: { ko: '오후 3:02 무렵', h24: '15:02' },
  nextRun: { ko: '오후 4:02 무렵', h24: '16:02' }, // 15:02 회차가 도는 동안의 다음

  // 되살리기 증명 v2(설계 4.7): 매주 폴더마다 무작위 파일, 합 64MiB 안, 원본 SHA-256 대조
  proof: { ko: '11월 10일 화', dots: '11. 10. 화', files: 23, size: '61MB', nextKo: '11월 17일 화', nextDots: '11. 17. 화' },

  folders: [
    { name: '문서', path: 'C:\\Users\\studio\\Documents', size: '8.2GB', files: '5,310' },
    { name: '바탕화면', path: 'C:\\Users\\studio\\Desktop', size: '1.1GB', files: '420' },
    { name: '사진', path: 'C:\\Users\\studio\\Pictures', size: '6.9GB', files: '4,880' },
    { name: '프로젝트', path: 'D:\\Projects', size: '2.2GB', files: '1,870', found: true },
  ],
  total: { files: '12,480', size: '18.4GB', folders: '4곳' },
  onedriveOnly: '214',
  cap: '100GB',
  capPct: 18.4, // 18.4GB / 100GB

  // 회차 진행(설계 4.2 · progress.json — 종류 · 단계 · 퍼센트). 15:02에 시작한 회차
  run: { kind: '예약 백업', stage: '올리는 중', pct: 62, done: '133MB', all: '214MB', changed: '38', startKo: '오후 3:02' },

  // 부분 판(설계 4.2) — Outlook이 9시부터 열려 있음. 관리자 계정이라 4시간에 한 번 채움(09:02 · 13:02, 다음 17:02)
  partial: {
    program: 'Outlook',
    count: '2',
    keptKo: '오후 1:02',
    keptH24: '13:02',
    files: [
      { name: '메일 보관함.pst', where: '문서 › Outlook 파일', size: '2.1GB' },
      { name: '보관 폴더.pst', where: '문서 › Outlook 파일', size: '860MB' },
    ],
    nextFill: '오후 5:02 무렵',
    rest: '12,478',
    // 표준 사용자 계정이면 따로 읽기가 없다 — Outlook을 연 9시 전 회차(08:02) 판이 남는다
    stdKeptKo: '오전 8:02',
    stdKeptH24: '08:02',
  },

  // 폴더를 찾을 수 없음
  missing: { name: '프로젝트', path: 'D:\\Projects', keptKo: '11월 12일 오후 6:02', keptDots: '11. 12. 18:02', restFiles: '10,610', restSize: '16.2GB' },

  // 대량 삭제 · 변경 멈춤(설계 4.4) — 문서에서 3,980개(전체의 32%, 6.1GB) 지워짐
  mass: {
    count: '3,980', folder: '문서', whenKo: '오늘 오전 11시 무렵', whenH24: '11:00',
    docLeft: '1,330', docLeftSize: '2.1GB', totalNow: '8,500', sizeNow: '12.3GB', totalBefore: '12,480',
  },

  // 새 PC로 옮겨 오기(설계 2.3 · 4.6) — 18.4GB · 100Mbps면 약 25분. 이 PC의 알려진 폴더는 OneDrive 밖이라 「원래 자리」가 기본
  move: {
    from: '작업 노트북',
    fromLast: '오늘 오후 2:02',
    waitMin: '25',
    pct: 41,
    doneSize: '7.5GB',
    doneFiles: '5,117',
    leftMin: '15',
    restored: '12,031',
    same: '437',
    sideBySide: '8',
    skipped: '4',
    skippedList: ['문서 › 내 음악', '문서 › 내 사진', '문서 › 내 비디오', '사진 › 휴대폰 사진'],
    skippedWhy: '다른 곳을 가리키는 연결 폴더라 백업에 내용이 없습니다.',
    autorun: '2',
    newFolder: 'C:\\옮겨 온 업무 자료',
    room: 'C: 212GB · D: 820GB', // 설계 2.3 「되살릴 자리 … 용량과 함께」
  },
  programs: [
    { name: 'Chrome', id: 'Google.Chrome' },
    { name: '카카오톡', id: 'Kakao.KakaoTalk' },
    { name: 'Slack', id: 'SlackTechnologies.Slack' },
    { name: 'Notion', id: 'Notion.Notion' },
    { name: 'Figma', id: 'Figma.Figma' },
    { name: 'Zoom', id: 'Zoom.Zoom' },
    { name: 'Adobe Creative Cloud', id: 'Adobe.CreativeCloud' },
    { name: '한컴오피스', id: null },
  ],
  relogin: [
    { what: '브라우저', how: 'Chrome 계정으로 로그인하면 즐겨찾기 · 저장한 비밀번호가 돌아옵니다' },
    { what: '메신저', how: '카카오톡 · Slack. 휴대폰 인증이 필요할 수 있습니다' },
    { what: '클라우드 드라이브', how: 'OneDrive · Google Drive. 로그인하면 저절로 내려받습니다' },
    { what: 'AI 도구', how: '쓰던 계정으로 다시 로그인하세요' },
    { what: '공동인증서', how: '은행 · 홈택스 인증서는 옛 PC에서 내보내 옮겨야 합니다' },
  ],

  // 사고 뒤 되돌리기(설계 2.5 · 4.4) — 숨긴 지 30일 뒤 지움, T는 29일 안(T + 29일 = 12월 11일 오후 2:59)
  undo: {
    detectKo: '11월 12일 오후 3시 무렵',
    pickKo: '11월 12일 오후 2시 59분',
    pickH24: '14:59',
    versionKo: '11월 12일 오후 2:02',
    versionH24: '11. 12. 14:02',
    files: '12,468',
    size: '18.4GB',
    byFolder: ['5,298', '420', '4,880', '1,870'],
    daysLeft: '28',
    until: '12월 11일 오후 2:59',
    untilH24: '12월 11일 14:59',
    cancelKo: '오늘 오후 2:41', // 14:02 백업 뒤 되돌림 — 기본 화면의 하루와 겹치지 않게
    spike: '5,392',
  },
  // 시간마다 백업에서 숨겨진 묶음 수(서버가 센다) — 11-12 08시 ~ 11-13 08시
  undoHours: [
    ['08', 18], ['09', 22], ['10', 31], ['11', 19], ['12', 24], ['13', 27], ['14', 21],
    ['15', 3412], ['16', 1980], ['17', 6], ['18', 0], ['19', 0], ['20', 0], ['21', 0],
    ['22', 0], ['23', 0], ['00', 0], ['01', 0], ['02', 0], ['03', 0], ['04', 0], ['05', 0], ['06', 0], ['07', 0], ['08', 4],
  ],
  undoTicks: { show: [0, 3, 6, 9, 12, 16, 21, 24], day: { 0: '12일 8시', 16: '13일 0시' } },

  // 복구 코드(설계 4.8) — 예시 글자(헷갈리는 0 · 1 · I · L · O · U 없음)
  codeGroups: [
    'SWBK', '7KQ9', 'XRM4', 'T2HW', 'V8NB', '3PDE', 'Q6ZF', 'C9JA',
    'HM2E', '5RWT', 'K8YN', 'N4GB', '2VXS', 'Q7DC', 'P3FZ', '6MTA',
    'W9KD', 'B4RQ', 'J7XH', 'E2NC', 'Y5PV', 'G8SK', 'R3TM', 'D6WQ',
    'Z9FB', 'H4YJ', 'C7EN', 'S2GX', 'M5KR', 'A8VD', 'T3QP', 'F6HZ',
    'K9WE', 'N2BS', 'X7MC', 'P4JG',
  ],

  // 쓰는 자리를 넘겨준 옛 PC(설계 4.6 N2)
  moved: { to: '새 데스크톱', whenKo: '11월 13일 오후 3:40', timeKo: '오후 3:40', h24: '15:40' },
  // 새 기기 연결(알림 · 웹) — 14:02 백업 뒤 새 데스크톱이 이어짐
  joined: { ko: '오늘 오후 3:10', dots: '2026. 11. 13. 금 15:10', dotsKo: '2026. 11. 13. 금 오후 3:10' },
  // 분실 신고(설계 2.4) — 새 데스크톱으로 옮긴 뒤 옛 노트북을 잃어버림
  lost: { ko: '오늘 오후 4:12', h24: '16:12' },
  // 파일 되살리기는 지키는 폴더 밖 새 폴더로만(설계 4.6 · 0.5.0 엔진 restoreLatest가 원본 폴더와 겹치는 자리를 거부)
  restoreTo: '다운로드 › 되살린 파일 (11월 13일)',
};

// 알림 문구(설계 2.2 표 그대로 — 문제 + 할 일 하나, 같은 문제는 하루 한 번). 단추는 그 화면을 연다 — 바로 시작하는 것은 업데이트 「설치」뿐이고 그때도 관리자 확인 창이 먼저 뜬다.
export const NOTIFY = [
  { tone: 'ok', title: '첫 백업을 마쳤습니다', body: '이제 매시간 저절로 지킵니다.', act: null, when: '첫 백업 끝(한 번)' },
  { tone: 'warn', title: '사흘 넘게 백업을 못 했습니다', body: '이 PC의 백업 연결이 끊겼습니다. 다시 로그인하면 바로 이어서 합니다.', act: '다시 로그인', when: '사흘 넘게 소식 없음 · PC 켜짐(원인별)' },
  { tone: 'info', title: '쓰는 중인 파일 2개는 오후 1:02 판으로 지킵니다', body: 'Outlook을 닫으면 다음 확인 때 새로 담깁니다.', act: null, when: '몇 파일만 못 지킴' },
  { tone: 'warn', title: '「프로젝트」 폴더를 찾을 수 없습니다', body: '마지막 판(11월 12일 오후 6:02)은 지워지지 않게 붙들어 둡니다. 다시 고르거나 목록에서 빼세요.', act: '확인하기', when: '폴더를 찾을 수 없음' },
  { tone: 'bad', title: '백업이 바뀌었습니다', body: '되돌릴 수 있는 날이 28일 남았습니다.', act: '확인하기', when: '점검 실패 · 백업이 바뀜(서버 탐지)' },
  { tone: 'bad', title: '되살려 보기에서 꺼내지지 않는 파일이 나왔습니다', body: '확인하기 전까지 이전 판을 지우지 않습니다.', act: '확인하기', when: '되살리기 증명에서 손상 — 그날' },
  { tone: 'bad', title: '많은 파일이 한꺼번에 지워졌습니다', body: '「문서」에서 3,980개. 확인하기 전까지 이전 판을 지우지 않습니다.', act: '확인하기', when: '많은 파일이 한꺼번에 지워지거나 바뀜' },
  { tone: 'warn', title: '이 계정에 새 기기가 연결됐습니다', body: '「새 데스크톱」 · 오늘 오후 3:10. 내가 한 일이 아니면 끊으세요.', act: '확인하기', when: '새 기기 연결 · 되돌리기 요청' },
  { tone: 'warn', title: '되돌린 상태로 멈춰 있습니다', body: '파일을 확인했으면 이어 갈 방법을 고르세요.', act: '고르러 가기', when: '되돌린 뒤 고르기 기다림(하루 한 번)' },
  { tone: 'warn', title: '100GB에 가까워졌습니다', body: '지금 96GB입니다. 넘으면 새로 바뀐 파일을 올리지 않습니다.', act: '폴더 줄이기', when: '용량 상한에 가까움 · 넘음' },
  { tone: 'warn', title: 'Google 계정에 맡긴 복구 정보를 확인하지 못했습니다', body: '다시 로그인하면 바로 다시 확인합니다.', act: '다시 로그인', when: '복구 정보 재확인 실패' },
  { tone: 'info', title: '업데이트가 준비됐습니다', body: '설치할 때 관리자 확인 창이 한 번 뜹니다.', act: '설치', when: '업데이트 준비됨(표준 사용자는 「관리자에게 부탁하기」 · 주 1회)' },
];

// 시범 측정 안내 한 줄(설계 4.9) — 첫 화면 아래 · 보호 범위 확인 · 설정 서랍에만 둔다(기본 화면에는 두지 않는다)
export const TELEMETRY = '시범 동안 백업 · 알림 · 설치 결과 숫자를 SYNK로 보냅니다. 파일 이름 · 경로 · 내용은 보내지 않습니다.';

// 설정 서랍(설계 4.12 — 기본 화면 밖의 것 전부)
export const DRAWER = [
  {
    group: '지키는 것',
    rows: [
      { name: '지키는 폴더', value: '4곳 · 18.4GB', act: '더하기 · 빼기' },
      { name: '쓰는 중인 파일', value: '켜짐 · 관리자 계정이라 4시간에 한 번 따로 읽어 채웁니다', act: null },
      { name: '외장 드라이브 사본', value: '꺼짐', act: '켜기' },
    ],
  },
  {
    group: '되찾는 길',
    rows: [
      { name: '복구 코드', value: '아직 없음 · Google 계정에 못 들어갈 때 쓰는 종이 한 장', act: '만들기', nudge: true, to: 'code' },
      { name: '내 기기', value: '작업 노트북(이 PC) · 백업하는 기기. 잃어버리면 다른 PC나 휴대폰의 메일 링크에서 분실 신고합니다', act: null },
      { name: '사고가 났을 때 되돌리기', value: '29일 안이면 그 시각으로 되돌립니다', act: '되돌리기', to: 'undo-1' },
    ],
  },
  {
    group: '이 앱',
    rows: [
      { name: '트레이 아이콘', value: '꺼짐 · 꺼져 있어도 백업은 매시간 돕니다', act: '켜기' },
      { name: '시범 측정', value: '백업 · 알림 · 설치 결과 숫자를 보냅니다(파일 이름 · 경로 · 내용 없이)', act: '보내는 내용 보기' },
      { name: '업데이트', value: '0.7.0 · 최신', act: null },
      { name: '도움 요청', value: '보낼 내용을 먼저 보여 드립니다', act: '쓰기' },
      { name: '계정', value: 'studio@example.com · Google 2단계 인증을 켜 두세요', act: '로그아웃' },
    ],
  },
];

// 화면 목록 — 두 시안이 같은 순서 · 같은 이름을 쓴다. move-0 · lost-2는 A를 고른 뒤 더한 화면이라 A에만 있다(시안마다 원고에 있는 화면만 굽는다)
export const SCREENS = [
  ['home', '기본 · 안전함'],
  ['home-run', '기본 · 예약 백업 도는 중'],
  ['home-partial', '기본 · 몇 파일은 앞 판으로'],
  ['home-missing', '기본 · 폴더를 찾을 수 없음'],
  ['home-mass', '기본 · 한꺼번에 지워짐'],
  ['home-moved', '기본 · 백업이 다른 PC로 옮겨짐'],
  ['start-1', '첫 시작 1 · Google로 시작'],
  ['start-2', '첫 시작 2 · 보호 범위 확인'],
  ['start-3', '첫 시작 3 · 첫 백업'],
  ['restore', '파일 되살리기'],
  ['partial', '부분 보호 안내 · 관리자 계정'],
  ['partial-std', '부분 보호 안내 · 표준 사용자 계정'],
  ['move-0', '옮겨 오기 · 옛 PC에서 누르면'],
  ['move-1', '옮겨 오기 1 · 자리 고르기'],
  ['move-2', '옮겨 오기 2 · 진행'],
  ['move-3', '옮겨 오기 3 · 결과'],
  ['move-4', '옮겨 오기 4 · 다시 깔 것 · 이어서 백업'],
  ['undo-1', '되돌리기 1 · 시각'],
  ['undo-2', '되돌리기 2 · 미리 보기'],
  ['undo-3', '되돌리기 3 · 되돌린 뒤 고르기'],
  ['lost', '분실 신고 1 · 신고 확인'],
  ['lost-2', '분실 신고 2 · 남은 보안 걸음'],
  ['code', '복구 코드 인쇄'],
  ['web', '기기 끊기 확인 · 웹(메일 링크)'],
  ['notify', '알림 문구'],
  ['drawer', '설정 서랍'],
];

// 시간 눈금 자료(시안 B) — 지난 7일 × 24시간, 한 칸 = 한 회차(실제 달력: 11-07 토 ~ 11-13 금)
// c 온전 · s 쉼(배터리 · 절전 · 휴대폰 데이터) · o 꺼짐 · 잠듦(회차 없음) · p 되살려 봄(증명) · n 아직(앞으로)
export const WEEK = (() => {
  const days = [
    { dow: '토', d: '7' }, { dow: '일', d: '8' }, { dow: '월', d: '9' }, { dow: '화', d: '10' },
    { dow: '수', d: '11' }, { dow: '목', d: '12' }, { dow: '금', d: '13' },
  ];
  const on = {
    '토': [[13, 17]], '일': [[21, 22]], '월': [[9, 19]], '화': [[9, 20]],
    '수': [[9, 18]], '목': [[9, 19], [21, 23]], '금': [[8, 14]],
  };
  return days.map((day, i) => {
    const hours = Array.from({ length: 24 }, (_, h) => {
      const awake = on[day.dow].some(([a, b]) => h >= a && h <= b);
      if (i === 6 && h > 14) return 'n';
      if (!awake) return 'o';
      if (day.dow === '화' && h === 10) return 'p';
      if (day.dow === '수' && (h === 15 || h === 16)) return 's';
      return 'c';
    });
    return { ...day, hours, today: i === 6 };
  });
})();
