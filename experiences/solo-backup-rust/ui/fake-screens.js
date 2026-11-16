// 엔진 · 서버에 아직 없는 화면(옮겨 오기 · 사고 되돌리기 · 분실 신고 · 복구 코드 · 첫 시작 보호 범위)을 그리는 예시 값.
// 시안 A의 예시 자료(ui-mockups/_src/copy.mjs D)와 같은 하루(2026-11-13 금)다. 그 기능이 엔진에 생기면 그 화면은 실제 상태를 읽고 이 값은 시험에만 남는다.
// QA의 「가짜 상태로 그린 화면」 표가 이 목록을 따른다.

export const FAKE = Object.freeze({
  'start-2': '보호 범위 — 진단이 찾은 작업 폴더와 예상 용량(개통 · 진단 연결 전)',
  'move-1': '옮겨 오기 1 — 놓을 자리(옮겨 오기 엔진 전)',
  'move-2': '옮겨 오기 2 — 진행',
  'move-3': '옮겨 오기 3 — 결과',
  'move-4': '옮겨 오기 4 — 다시 깔 것 · 이어서 백업',
  'undo-1': '사고 되돌리기 1 — 시간마다 숨겨진 수(개통 서버 전)',
  'undo-2': '사고 되돌리기 2 — 미리 보기',
  'undo-3': '사고 되돌리기 3 — 되돌린 뒤 고르기',
  lost: '분실 신고 1',
  'lost-2': '분실 신고 2 — 남은 Google 걸음',
  code: '복구 코드 인쇄(복구 코드 형식 전)',
  'mass-list': '한꺼번에 지워진 파일 목록(대량 변경 멈춤 전)',
});

export const EX = {
  device: '작업 노트북', newDevice: '새 데스크톱', account: 'studio@example.com',
  folders: [
    { name: '문서', path: 'C:\\Users\\studio\\Documents', size: '8.2GB', files: '5,310', pct: 44.6 },
    { name: '바탕화면', path: 'C:\\Users\\studio\\Desktop', size: '1.1GB', files: '420', pct: 6 },
    { name: '사진', path: 'C:\\Users\\studio\\Pictures', size: '6.9GB', files: '4,880', pct: 37.5 },
    { name: '프로젝트', path: 'D:\\Projects', size: '2.2GB', files: '1,870', pct: 12, found: true },
  ],
  total: { files: '12,480', size: '18.4GB' }, onedriveOnly: '214', cap: '100GB', capPct: 18.4,
  move: { from: '작업 노트북', fromLast: '오늘 오후 2:02', waitMin: '25', pct: 41, doneSize: '7.5GB', doneFiles: '5,117', leftMin: '15',
    restored: '12,031', same: '437', sideBySide: '8', skipped: '4',
    skippedList: ['문서 › 내 음악', '문서 › 내 사진', '문서 › 내 비디오', '사진 › 휴대폰 사진'],
    autorunList: [['시작프로그램', '작업 동기화.lnk'], ['PowerShell 프로필', 'profile.ps1']], autorunTo: '다운로드 › 옮겨 오기에서 따로 둔 파일',
    newFolder: 'C:\\옮겨 온 업무 자료', room: 'C: 212GB · D: 820GB' },
  programs: [
    { name: 'Chrome', id: 'Google.Chrome' }, { name: '카카오톡', id: 'Kakao.KakaoTalk' }, { name: 'Slack', id: 'SlackTechnologies.Slack' },
    { name: 'Notion', id: 'Notion.Notion' }, { name: 'Figma', id: 'Figma.Figma' }, { name: 'Zoom', id: 'Zoom.Zoom' },
    { name: 'Adobe Creative Cloud', id: 'Adobe.CreativeCloud' }, { name: '한컴오피스', id: null },
  ],
  relogin: [
    { what: '브라우저', how: 'Chrome 계정으로 로그인하면 즐겨찾기와 저장한 비밀번호가 돌아옵니다' },
    { what: '메신저', how: '카카오톡, Slack. 휴대폰 인증이 필요할 수 있습니다' },
    { what: '클라우드 드라이브', how: 'OneDrive, Google Drive. 로그인하면 저절로 내려받습니다' },
    { what: 'AI 도구', how: '쓰던 계정으로 다시 로그인하세요' },
    { what: '공동인증서', how: '은행과 홈택스 인증서는 옛 PC에서 내보내 옮겨야 합니다' },
  ],
  // 사고 되돌리기 — 고른 시각 T와 그 시각의 가장 최근 판을 따로 적는다(카본 2차 5). 마감은 화면이 T + 29일로 셈한다
  undo: { detectKo: '11월 12일 오후 3시 무렵', pickAt: '2026-11-12T14:59:00+09:00', pickKo: '11월 12일 오후 2:59', pickShortKo: '11월 12일 오후 2:59',
    versionKo: '11월 12일 오후 2:02', files: '12,468', size: '18.4GB', byFolder: ['5,298', '420', '4,880', '1,870'], cancelKo: '오늘 오후 2:41', spike: '5,392' },
  undoHours: [
    ['08', 18], ['09', 22], ['10', 31], ['11', 19], ['12', 24], ['13', 27], ['14', 21],
    ['15', 3412], ['16', 1980], ['17', 6], ['18', 0], ['19', 0], ['20', 0], ['21', 0],
    ['22', 0], ['23', 0], ['00', 0], ['01', 0], ['02', 0], ['03', 0], ['04', 0], ['05', 0], ['06', 0], ['07', 0], ['08', 4],
  ],
  undoTicks: { 0: '12일 오전 8시', 8: '오후 4시', 16: '밤 12시', 24: '13일 오전 8시' },
  lost: { ko: '오늘 오후 4:12' },
  codeGroups: ['SWBK', '7KQ9', 'XRM4', 'T2HW', 'V8NB', '3PDE', 'Q6ZF', 'C9JA', 'HM2E', '5RWT', 'K8YN', 'N4GB', '2VXS', 'Q7DC', 'P3FZ', '6MTA',
    'W9KD', 'B4RQ', 'J7XH', 'E2NC', 'Y5PV', 'G8SK', 'R3TM', 'D6WQ', 'Z9FB', 'H4YJ', 'C7EN', 'S2GX', 'M5KR', 'A8VD', 'T3QP', 'F6HZ', 'K9WE', 'N2BS', 'X7MC', 'P4JG'],
  partialFiles: [{ name: '메일 보관함.pst', where: '문서 › Outlook 파일', size: '2.1GB' }, { name: '보관 폴더.pst', where: '문서 › Outlook 파일', size: '860MB' }],
  massFiles: [
    ['2026 계약서', '문서 › 계약', '1,204개'], ['견적', '문서 › 견적', '981개'], ['세금계산서', '문서 › 회계', '1,410개'], ['회의록', '문서 › 회의', '385개'],
  ],
  telemetry: '시범 동안 백업, 알림, 설치 결과 숫자를 SYNK로 보냅니다. 파일 이름, 경로, 내용은 보내지 않습니다.',
};
