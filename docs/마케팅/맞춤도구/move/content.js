/* yuhobuilds · 내 PC 이사 목록 — 질문·선택지·결과 항목·팁·출처.
 * 원본: SYNK-appsscript/docs/마케팅/맞춤도구/move/content.js
 * 화면에 보이는 문장은 이 파일이 쥔다. 어떤 항목을 누구에게 보일지와 요청문은 rules.js, 그림과 결과 화면은 view.js가 맡는다.
 * 제작 절차(../제작절차.md): 질문마다 왜 묻는지, 선택지마다 고른 뒤 한 줄, 결과 요소마다 팁 여섯 종류를 TIPS에 둔다.
 * 사실은 탐색노트.md(2026-10-17 확인)와 기획.md 사실 대조 표가 근거다. 바뀌면 탐색노트.md → 이 파일 → rules.js 순서로 고친다.
 * 사이트 글에는 AI 도구 이름을 쓰지 않는다(요청문 안의 「AI」 일반 표현만).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkMoveContent = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CHECKED = '2026-10-17';

  const SOURCES = {
    'ms-quota': { kind: 'official', label: 'Microsoft 지원 · Microsoft 저장 공간 한도: 무료 5GB, 넘으면 OneDrive에 새 파일을 올리거나 고치거나 동기화할 수 없고 있던 파일은 읽기 전용, 구름 아이콘의 빨간 동그라미는 넘침·노란 삼각형은 거의 참', url: 'https://support.microsoft.com/en-au/onedrive/microsoft-storage-quotas' },
    'ms-folder-backup': { kind: 'official', label: 'Microsoft 지원 · OneDrive로 폴더 백업: 바탕화면·문서·사진 등, 구름 아이콘 → 도움말 및 설정 → 설정 → 동기화 및 백업 → 백업 관리', url: 'https://support.microsoft.com/en-us/office/back-up-your-folders-with-onedrive-d61a7930-a6fb-4b95-b28a-6552e77c3057' },
    'ms-backup': { kind: 'official', label: 'Microsoft 지원 · Windows 백업: 폴더는 OneDrive로, 앱은 「내 앱 기억」, Wi-Fi와 암호, 회사·학교 계정은 지원하지 않음, 공간이 모자라면 개인 설정은 백업되지 않음', url: 'https://support.microsoft.com/en-us/windows/experience/backup-recovery/back-up-and-restore-with-windows-backup' },
    'ms-transfer': { kind: 'official', label: 'Microsoft 지원 · 새 Windows PC로 파일과 설정 옮기기: 문서 맨 위에 「이 기능은 더 이상 사용할 수 없음」, 설치한 앱·저장한 암호·Program Files·Temp는 옮기지 않음', url: 'https://support.microsoft.com/en-US/Windows/Experience/Backup-Recovery/transfer-your-files-and-settings-to-a-new-windows-pc' },
    'ms-dpapi': { kind: 'official', label: 'Microsoft Learn · DPAPI(CryptProtectData): 보통 같은 로그인 자격의 사용자만, 암호화한 그 컴퓨터에서만 풀 수 있음', url: 'https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata' },
    'ms-credman': { kind: 'official', label: 'Microsoft 지원 · 자격 증명 관리자: 웹사이트·연결된 앱·네트워크의 로그인 정보(웹 자격 증명·Windows 자격 증명)', url: 'https://support.microsoft.com/en-us/windows/security/credential-manager-in-windows' },
    'chrome-sync': { kind: 'official', label: 'Chrome 고객센터 · 동기화하면 계정에 북마크·읽기 목록·비밀번호·결제 정보·확장 프로그램·설정, 로그인 뒤 탭·방문 기록이 저장됨(쿠키는 목록에 없음)', url: 'https://support.google.com/chrome/answer/165139?hl=ko' },
    'ssh-man': { kind: 'official', label: 'OpenSSH 설명서 ssh(1) · 개인 키 파일은 사용자만 읽을 수 있어야 하고, 다른 사람이 접근할 수 있으면 ssh가 그 키를 그냥 무시함', url: 'https://man.openbsd.org/ssh' },
    'ms-openssh': { kind: 'official', label: 'Microsoft Learn · Windows OpenSSH 키 인증: 개인 키 파일은 비밀번호와 같아서 비밀번호처럼 보호해야 함', url: 'https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_keymanagement' },
    'gh-auth': { kind: 'official', label: 'GitHub CLI 설명서 · gh auth login은 로그인 토큰을 시스템 자격 증명 저장소에 저장(없을 때만 평문 파일)', url: 'https://cli.github.com/manual/gh_auth_login' },
    'ms-setx': { kind: 'official', label: 'Microsoft Learn · setx: 값은 1024자에서 잘려 저장되고, 잘린 값이 기존 변수를 덮으면 원래 값을 잃을 수 있음', url: 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/setx' },
    'ms-time': { kind: 'official', label: 'Microsoft 지원 · 시작 → 설정 → 시간 및 언어 → 날짜 및 시간에서 자동으로 시간 설정·자동으로 표준 시간대 설정', url: 'https://support.microsoft.com/ko-kr/windows/experience/personalization/set-time-date-and-time-zone-settings-in-windows' },
    'ms-fs': { kind: 'official', label: 'Microsoft Learn · 파일 시스템 비교: FAT32의 최대 파일 크기는 4GiB(NTFS·exFAT는 훨씬 큼)', url: 'https://learn.microsoft.com/en-us/windows/win32/fileio/filesystem-functionality-comparison' },
    'ms-robocopy': { kind: 'official', label: 'Microsoft Learn · robocopy: /z는 끊긴 곳부터 이어서 복사, /l은 목록만(복사·삭제 안 함), /mir·/purge는 대상에서 파일을 지움', url: 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/robocopy' },
    'google-storage': { kind: 'official', label: 'Google One 고객센터 · 구글 계정 무료 15GB는 Gmail·드라이브·포토가 나눠 쓰고, 차면 드라이브에 새 파일을 올릴 수 없음', url: 'https://support.google.com/googleone/answer/9312312?hl=ko' },
    'ms-share': { kind: 'official', label: 'Microsoft 지원 · 네트워크로 파일 공유: 같은 LAN에서 「액세스 권한 부여」, 기기가 안 보이면 네트워크 검색 켜기', url: 'https://support.microsoft.com/en-us/windows/experience/connectivity-networking/file-sharing-over-a-network-in-windows' },
    'ms-nearby': { kind: 'official', label: 'Microsoft 지원 · 근처 공유: 블루투스·Wi-Fi로 가까운 PC에 문서·사진·링크 보내기', url: 'https://support.microsoft.com/en-us/windows/experience/connectivity-networking/share-things-with-nearby-devices-in-windows' },
    'ms-reset': { kind: 'official', label: 'Microsoft 지원 · PC 초기화: 「모든 항목 제거」에 「데이터 정리(Clean data)」를 켜면 기부·재활용·판매 때 지운 파일을 되살리기 어려워짐, 암호화된 기기는 BitLocker 복구 키 필요', url: 'https://support.microsoft.com/en-us/windows/experience/backup-recovery/reset-your-pc' },
    'ms-bitlocker': { kind: 'official', label: 'Microsoft 지원 · BitLocker 복구 키 찾기: 개인 계정 aka.ms/myrecoverykey, 회사·학교 계정 aka.ms/aadrecoverykey', url: 'https://support.microsoft.com/ko-kr/windows/security/encryption/find-your-bitlocker-recovery-key' },
    'adobe-2': { kind: 'official', label: 'Adobe 도움말 · 컴퓨터를 바꿀 때: 한 번에 두 대까지 활성화, 옛 컴퓨터에서 로그아웃하거나 계정에서 해제', url: 'https://helpx.adobe.com/download-install/apps/licensing-activation/activate-deactivate-apps/activate-deactivate-when-switching-computer.html' },
    'steam-cloud': { kind: 'official', label: 'Steam 지원 · Steam Cloud: 모든 게임이 세이브를 Steam Cloud에 두는 건 아님, 옛 컴퓨터에 접근할 수 없으면 그 세이브는 되살릴 수 없음, 상점 페이지 오른쪽 위 Steam Cloud 표시로 확인', url: 'https://help.steampowered.com/en/faqs/view/68D2-35AB-09A9-7678' },
    'kftc-joint': { kind: 'official', label: '금융결제원 YESKEY · 공동인증서(옛 공인인증서): PC·스마트폰·USB 등 내가 고른 저장소에 담아 씀(인증서 → 공동인증서)', url: 'https://www.yeskey.or.kr/' },
    'kftc-finance': { kind: 'official', label: '금융결제원 YESKEY · 금융인증서: 금융결제원 클라우드에 보관, 인증서 이동·복사 없이 6자리 비밀번호(인증서 → 금융인증서)', url: 'https://www.yeskey.or.kr/' },
    'synk-move': { kind: 'synk', label: 'SYNK 실제 이사 기록(2026-10-15~17, 옛 노트북 → 새 노트북, 구글 드라이브) · OneDrive 무료 5GB가 10-05부터 가득 차 바탕화면 11.25GB가 PC에만, 첫 규칙이 「이미 드라이브에 있음」으로 키·장부까지 뺐다가 검수에서 잡힘, 두고 간 것 107.4GB, 조각 39개, 새 PC 시계가 약 16시간 앞서 시각을 고친 파일 180,240개, 끝에 옛 노트북과 대조' },
    synk: { kind: 'synk', label: 'SYNK 판단 · 공식 자료가 없는 부분(무엇을 ①에 넣을지, 하는 일별 목록, 순서)은 위 자료와 10-15~17 실제 이사로 SYNK가 정한 기준이에요. 기준 문서: 추천기준.md' },
  };

  // 결과 네 칸의 항목 은행. rules.js가 사람마다 고르고 순서를 정한다. {when}·{where}는 rules.js가 채운다.
  const ITEMS = {
    // ① 절대 두고 가면 안 되는 것
    'm-local': { t: '클라우드에 없는 바탕화면·문서·다운로드', d: '「이미 백업돼 있겠지」 싶은 폴더부터 확인해요. OneDrive가 멈춘 뒤에 만든 파일은 이 컴퓨터에만 있어요.', src: 'synk-move' },
    'm-cert': { t: '공동인증서(옛 공인인증서)', d: 'PC에 저장해 두었다면 새 컴퓨터에는 없어요. 은행 인증센터의 인증서 복사로 USB나 스마트폰에 옮겨 두세요. 금융인증서는 클라우드라 그대로 써요.', src: 'kftc-joint' },
    'm-pw': { t: '브라우저에만 저장한 비밀번호', d: '동기화를 켜지 않았다면 폴더를 복사해도 새 컴퓨터에서 열리지 않아요. 옮기기 전에 동기화를 켜거나 쓰는 비밀번호 관리자로 옮겨 두세요.', src: 'ms-dpapi' },
    'm-ai-local': { t: 'AI에게 준 지침·기억 파일과 결과물 폴더', d: '대화는 계정에 있어도, 컴퓨터 폴더에 둔 지침·기억·만든 파일은 직접 옮겨야 해요.', src: 'synk-move' },
    'm-ai-keys': { t: 'API 키·토큰을 적어 둔 곳', d: '비밀 값은 공유 폴더에 그냥 올리지 말고 암호를 건 압축으로 옮겨요. 다 옮기면 옮기려고 만든 사본은 지워요.', src: 'synk' },
    'm-ssh': { t: 'ssh 개인 키(.ssh 폴더)', d: '잃으면 접속하던 서버와 저장소마다 새 키를 다시 등록해야 해요. 개인 키는 비밀번호와 같아요.', src: 'ms-openssh' },
    'm-git': { t: 'push 안 한 커밋과 커밋 안 한 변경', d: '원격 저장소에 없는 것은 새 컴퓨터에서 다시 클론해도 따라오지 않아요. 저장소마다 확인해요.', src: 'synk-move' },
    'm-env': { t: '.env 같은 git 밖 설정 파일', d: '.gitignore로 빠진 파일은 클론에 없어요. 비밀 값이 들어 있으니 키처럼 다뤄요.', src: 'synk' },
    'm-project': { t: '편집 프로젝트 파일과 그 원본 소스', d: '프로젝트는 원본 영상·사진을 경로로 가리켜요. 프로젝트만 옮기면 미디어가 오프라인으로 떠요. 원본 폴더를 같은 구조로 옮겨요.', src: 'synk' },
    'm-fonts': { t: '직접 넣은 폰트·프리셋·LUT·브러시', d: '프로그램을 다시 깔아도 내가 넣은 것은 돌아오지 않아요.', src: 'synk' },
    'm-originals': { t: '클라우드에 없는 사진·영상 원본', d: '휴대폰에서 옮겨 두고 휴대폰에서는 지운 원본이라면, 이 컴퓨터가 하나뿐인 사본일 수 있어요.', src: 'synk' },
    'm-work': { t: '회사 자료는 회사가 정한 방법으로만', d: '개인 클라우드나 USB로 옮기면 안 되는 회사가 많아요. Windows 백업도 회사·학교 계정은 지원하지 않아요. 옮기기 전에 IT 담당자에게 방법을 물어요.', src: 'synk' },
    'm-saves': { t: '클라우드 저장을 쓰지 않는 게임의 세이브', d: '모든 게임이 세이브를 Steam Cloud에 두는 건 아니에요. 상점 페이지의 Steam Cloud 표시로 게임마다 확인해요.', src: 'steam-cloud' },
    'm-docs': { t: '다운로드 폴더에 받아 둔 서류', d: '계약서·영수증·증명서 PDF는 받아 두고 잊기 쉬워요. 다운로드 폴더를 한 번 훑어서 서류만 골라 옮겨요.', src: 'synk' },
    'm-left-sell': { t: '두고 간 것 목록(파일 이름만이라도)', d: '팔고 나면 꺼낼 곳이 없어요. 무엇을 두고 왔는지라도 새 컴퓨터에 가져가요.', src: 'synk-move' },
    'm-left-2w': { t: '두고 간 것 목록(파일 이름만이라도)', d: '2주 안에 「그 파일 어디 있었지」를 찾을 때 써요. 저희도 두고 간 것 목록을 새 노트북에 받아 두었어요.', src: 'synk-move' },

    // ② 두고 와도 되는 것
    's-apps': { t: '설치한 프로그램', d: '복사해도 새 컴퓨터에서 돌지 않는 경우가 많아요. 공식 사이트나 스토어에서 다시 깔아요.', src: 'synk' },
    's-cache': { t: '캐시·임시 파일·휴지통', d: '쓰다 보면 다시 생기는 것들이에요. Microsoft의 이사 안내도 Temp 폴더는 옮기지 않았어요.', src: 'ms-transfer' },
    's-cloud-only': { t: '클라우드에만 있는 파일', d: '구름 표시가 붙은 파일은 새 컴퓨터에서 로그인하면 보여요. 옮기려고 열면 오히려 내려받아요.', src: 'synk-move' },
    's-installers': { t: '설치 파일·압축 파일', d: '다운로드 폴더의 .exe·.zip은 필요할 때 다시 받으면 돼요.', src: 'synk' },
    's-ai-chats': { t: 'AI 앱의 대화 기록', d: '대부분 계정에 있어서 다시 로그인하면 보여요. 앱 폴더를 통째로 복사할 필요는 없어요.', src: 'synk' },
    's-models': { t: '내려받은 AI 모델 파일', d: '파일 하나가 몇 GB씩 하지만 다시 받으면 돼요. 저희도 모델은 두고 왔어요.', src: 'synk-move' },
    's-deps': { t: 'node_modules·가상환경·빌드 결과', d: 'package.json·requirements 같은 목록만 있으면 새 컴퓨터에서 다시 만들어져요.', src: 'synk-move' },
    's-clones': { t: '원격에 다 올라간 저장소 사본', d: '①에서 push 안 한 것이 없다고 확인한 저장소만, 새 컴퓨터에서 다시 클론해요.', src: 'synk-move' },
    's-render': { t: '렌더 캐시·미리보기·프록시 파일', d: '프로젝트를 열면 다시 만들어져요. 크기만 크고 이사 시간을 늘려요.', src: 'synk' },
    's-media-cloud': { t: '원본 화질로 클라우드에 올라간 사진·영상', d: '용량 절약 화질로 올라간 것은 원본이 아니에요. 원본 화질로 올라간 것만 두고 와요.', src: 'synk' },
    's-work-apps': { t: '회사 보안 프로그램 자체', d: '복사해서 옮기는 게 아니라 회사가 새 컴퓨터에 다시 깔고 등록해요.', src: 'synk' },
    's-games': { t: '게임 설치 파일', d: '런처에서 다시 받으면 돼요. 인터넷이 느리면 설치 폴더를 SSD로 옮겨 런처에 폴더로 추가하는 방법도 있어요.', src: 'synk' },
    's-browser-folder': { t: '브라우저 폴더 통째 복사', d: '비밀번호·쿠키는 그 컴퓨터에서만 풀려서 복사해도 소용이 없어요. 동기화 로그인으로 충분해요.', src: 'ms-dpapi' },
    's-big-reget': { t: '다시 받을 수 있는 큰 파일', d: '클라우드 이사는 올리는 시간이 가장 길어요. 다시 받을 수 있는 것을 올리지 않는 만큼 빨라져요.', src: 'synk-move' },
    's-unsure-2w': { t: '애매한 것', d: '옛 컴퓨터를 2주 두니까 애매한 건 두고 와요. 지우는 게 아니라 안 가져가는 거예요.', src: 'synk-move' },
    's-unsure-keep': { t: '애매한 것', d: '옛 컴퓨터를 계속 쓰니 애매한 건 그 자리에 둬요. 필요할 때 꺼내면 돼요.', src: 'synk' },

    // ③ 옮긴 뒤 다시 할 것
    'r-clock': { t: '{when} 새 컴퓨터 시계부터 맞추기', d: '설정 → 시간 및 언어 → 날짜 및 시간에서 자동 시간 설정과 자동 표준 시간대 설정을 켜요. 시계가 틀린 채로 넣으면 새로 생기는 파일의 시각이 미래로 찍혀요.', src: 'ms-time' },
    'r-onedrive-setup': { t: '새 컴퓨터 첫 설정의 OneDrive 백업 화면', d: '무료 5GB가 이미 찼다면 「이 PC에만 파일 저장」을 골라요. 그 화면이 안 나오면 작업 표시줄의 구름 아이콘 → 설정 → 동기화 및 백업 → 백업 관리에서 꺼요. 그대로 켜 두면 같은 일이 되풀이돼요.', src: 'synk' },
    'r-browser': { t: '브라우저 로그인과 동기화 켜기', d: '동기화를 켜도 쿠키는 따라오지 않아서 사이트마다 다시 로그인해요.', src: 'chrome-sync' },
    'r-credman': { t: '자격 증명 관리자에 있던 로그인', d: '네트워크 드라이브와 일부 앱의 로그인은 다시 입력해요. 폴더 복사로는 넘어오지 않아요.', src: 'ms-credman' },
    'r-apps': { t: '프로그램 다시 설치', d: '공식 사이트나 스토어에서 받아요. Windows 백업의 「내 앱 기억」은 목록을 기억하는 정도예요.', src: 'ms-backup' },
    'r-cert': { t: '공동인증서 가져오기와 은행 보안 프로그램', d: '은행·홈택스 인증센터에서 인증서를 가져오고, 처음 들어갈 때 안내하는 보안 프로그램을 다시 깔아요.', src: 'synk' },
    'r-ai-login': { t: 'AI 앱 다시 로그인', d: '로그인 정보는 그 기기에 묶여서 넘어오지 않아요. 연결해 둔 드라이브·메일 같은 서비스도 다시 허용해요.', src: 'synk-move' },
    'r-ssh-perm': { t: 'ssh 개인 키를 내 계정만 읽게', d: '권한이 넓으면 ssh가 키를 무시해요. icacls로 상속을 끊고 내 계정에만 읽기를 줘요.', src: 'ssh-man' },
    'r-git-login': { t: 'git·gh 다시 로그인', d: '토큰이 자격 증명 저장소에 있어서 새 컴퓨터에서 gh auth login을 다시 해요.', src: 'gh-auth' },
    'r-env': { t: '환경 변수는 덮지 말고 합치기', d: '옛 Path로 덮으면 새 컴퓨터에 깔린 프로그램 경로가 사라져요. 없는 항목만 하나씩 더해요.', src: 'ms-setx' },
    'r-toolchain': { t: 'Python·Node 같은 도구를 같은 판으로', d: '판이 다르면 다시 받은 패키지가 다르게 돌 수 있어요. 옛 컴퓨터에서 판 번호를 적어 와요.', src: 'synk-move' },
    'r-adobe': { t: '옛 컴퓨터에서 유료 프로그램 로그아웃', d: 'Adobe 앱은 한 번에 두 대까지 활성화돼요. 옛 컴퓨터에서 로그아웃하거나 계정에서 해제해요.', src: 'adobe-2' },
    'r-fonts': { t: '폰트·프리셋 다시 넣기', d: '①에서 챙긴 폰트를 설치하고, 프로그램 프리셋 폴더에 다시 넣어요.', src: 'synk' },
    'r-photo-sync': { t: '사진 백업을 다시 켤 때 두 번 올리지 않게', d: '새 컴퓨터에서 사진 폴더 백업을 켜기 전에, 이미 올라간 폴더와 겹치지 않는지 봐요.', src: 'synk' },
    'r-work': { t: 'IT 담당자에게 새 PC 등록', d: '보안 프로그램·VPN·회사 인증서를 등록해요. 회사 계정 기기의 BitLocker 복구 키는 aka.ms/aadrecoverykey에 있어요. 거기 없으면 IT 담당자에게 물어요.', src: 'ms-bitlocker' },
    'r-games': { t: '런처 로그인, 동기화가 끝난 뒤 게임 실행', d: '동기화가 끝나기 전에 게임을 켜면 세이브가 엇갈릴 수 있어요.', src: 'synk' },
    'r-printer': { t: '프린터·스캐너 다시 연결', d: '드라이버는 제조사 사이트에서 받아요.', src: 'synk' },
    'r-license': { t: '유료 프로그램 라이선스 옮기기', d: '쓸 수 있는 기기 수가 정해진 프로그램은 옛 컴퓨터에서 먼저 해제해요.', src: 'synk' },
    'r-cloud-clean': { t: '클라우드에 올린 이사용 사본 정리', d: '키·토큰이 들어 있을 수 있어요. 대조가 끝나면 지우고, 이사 때문에 늘린 용량이 있으면 해지해요.', src: 'synk-move' },
    'r-share-off': { t: '폴더 공유 다시 끄기', d: '이사 때문에 열어 둔 공유와 네트워크 검색을 끝나면 꺼요.', src: 'ms-share' },
    'r-reset-sell': { t: '맨 마지막에 옛 컴퓨터 초기화(데이터 정리 켜기)', d: '계정·라이선스를 해제한 뒤 설정 → 시스템 → 복구 → PC 초기화 → 모든 항목 제거로 가서 「데이터 정리」를 켜요. 판매할 때 권하는 옵션이에요.', src: 'ms-reset' },
    'r-reset-2w': { t: '2주 뒤 초기화 날짜를 달력에', d: '그 사이 빠진 것을 꺼내고, 초기화는 「모든 항목 제거」에 「데이터 정리」를 켜서 해요.', src: 'ms-reset' },
    'r-keep-sync': { t: '두 컴퓨터가 서로 지우지 않게', d: '같은 클라우드 폴더를 두 컴퓨터가 동기화하면, 한쪽에서 정리한 파일이 다른 쪽에서도 사라질 수 있어요. 정리는 한 컴퓨터에서만 해요.', src: 'synk' },

    // ④ 끝났는지 확인하는 법
    'v-compare': { t: '옛 컴퓨터와 대조: {where}', d: '폴더를 오른쪽 클릭 → 속성에서 두 컴퓨터의 숫자가 같은지 봐요. 「복사 완료」 표시만 믿지 않아요.', src: 'synk-move' },
    'v-must': { t: '① 목록을 한 줄씩 새 컴퓨터에서 찾기', d: '찾았으면 ①의 체크를 눌러요.', src: 'synk' },
    'v-open': { t: '가장 중요한 파일 몇 개를 실제로 열어 보기', d: '복사는 됐는데 열리지 않는 파일이 있을 수 있어요.', src: 'synk' },
    'v-onedrive': { t: 'OneDrive 구름 아이콘에 빨간 표시가 없는지', d: '같은 계정이면 새 컴퓨터도 같은 저장 공간을 써요.', src: 'ms-quota' },
    'v-git': { t: '저장소마다 마지막 커밋이 옛 컴퓨터와 같은지', d: 'git log -1 과 git status 로 두 컴퓨터를 비교해요.', src: 'synk-move' },
    'v-robocopy': { t: '빠진 파일 목록 뽑기', d: 'robocopy 옛폴더 새폴더 /e /l 은 복사하지 않고 차이만 보여 줘요. /mir는 지우는 옵션이라 쓰지 않아요.', src: 'ms-robocopy' },
    'v-ssh': { t: 'ssh 접속 시험', d: 'ssh -T 로 저장소와 서버에 접속되는지 봐요.', src: 'ssh-man' },
    'v-ai': { t: '새 대화에서 지침이 살아 있는지 물어보기', d: '「내가 정해 둔 규칙 기억해?」처럼 한 번 물어요.', src: 'synk' },
    'v-project': { t: '편집 프로젝트를 열어 빠진 미디어가 없는지', d: '미디어 오프라인이나 폰트 대체 경고가 없으면 끝이에요.', src: 'synk' },
    'v-media': { t: '사진·영상 폴더 개수 비교와 무작위로 몇 개 열기', d: '큰 영상은 끝까지 재생돼야 다 옮겨진 거예요.', src: 'synk' },
    'v-work': { t: '회사 메일·VPN 접속', d: 'IT 담당자가 등록을 끝냈는지 같이 확인해요.', src: 'synk' },
    'v-game': { t: '게임 하나 실행해 마지막 진행 확인', d: '진행이 예전 것이면 옛 컴퓨터에서 런처를 켜 동기화를 다시 해요.', src: 'synk' },
    'v-docs': { t: '자주 가는 사이트와 은행에 로그인해 보기', d: '인증서와 비밀번호가 다 넘어왔는지 한 번에 보여요.', src: 'synk' },
    'v-ssd-err': { t: '복사 오류가 0인지', d: '건너뛴 파일이 있으면 경로가 너무 길거나 쓰는 중이던 파일이에요. 그 파일만 다시 복사해요.', src: 'synk' },
    'v-sell': { t: '초기화 버튼은 대조가 끝난 다음에', d: '대조 전에 초기화하면 빠진 것을 꺼낼 곳이 없어요.', src: 'ms-reset' },
    'v-2w': { t: '2주 동안 빠진 것 적기', d: '없다고 느낀 파일을 적어 두었다가 초기화 전에 한 번에 꺼내요.', src: 'synk-move' },
  };

  // OneDrive 확인 · 질문 없이 모든 결과의 맨 앞(00)에 들어간다.
  const onedrive = {
    title: '바탕화면이 정말 백업되고 있나요',
    story: '저희 노트북은 OneDrive 무료 5GB가 이미 차 있어서, 바탕화면 11GB가 이 PC에만 있었어요.',
    steps: [
      { t: '작업 표시줄 오른쪽 구름 아이콘 보기', d: '빨간 동그라미(흰 빼기 표시)면 공간이 넘쳐 새 파일이 올라가지 않는 거예요. 노란 삼각형은 거의 찼다는 뜻이에요.', src: 'ms-quota' },
      { t: '백업 중인 폴더 보기', d: '구름 아이콘 → 도움말 및 설정 → 설정 → 동기화 및 백업 → 백업 관리에서 바탕화면·문서·사진이 백업 중인지 봐요.', src: 'ms-folder-backup' },
      { t: '멈춰 있었다면', d: '그 뒤로 만든 파일은 이 컴퓨터에만 있어요. ①의 「클라우드에 없는 바탕화면·문서·다운로드」로 옮겨요.', src: 'synk-move' },
      { t: '새 컴퓨터 첫 설정에서', d: 'OneDrive 백업을 묻는 화면은 공간을 늘리거나 비우기 전까지 「이 PC에만 파일 저장」을 골라요. 화면이 안 나오면 구름 아이콘 → 설정 → 동기화 및 백업 → 백업 관리에서 꺼요.', src: 'synk' },
    ],
  };

  // 결과 요소와, 요소마다 반드시 채울 팁 종류(제작 절차 §3). core/content-check.js가 검사한다.
  const COMPONENTS = {
    onedrive: ['what', 'why', 'price', 'skip', 'trap', 'check'],
    must: ['what', 'why', 'skip', 'trap', 'check'],
    skip: ['what', 'why', 'price', 'skip', 'check'],
    redo: ['what', 'why', 'skip', 'trap', 'check'],
    clock: ['what', 'why', 'trap', 'check'],
    method: ['what', 'why', 'price', 'skip', 'trap', 'check'],
    uses: ['what', 'why', 'skip', 'trap', 'check'],
    verify: ['what', 'why', 'trap', 'check'],
    old: ['what', 'trap', 'check'],
  };

  const TIPS = {
    'onedrive-full': {
      component: 'onedrive', covers: ['what', 'trap', 'check', 'price'], title: 'OneDrive 무료 5GB가 차면 백업이 조용히 멈춰요',
      body: [
        'Windows는 첫 설정 때 바탕화면·문서·사진을 OneDrive로 백업하자고 권해요. 켜 두면 이 폴더들이 OneDrive 폴더 안으로 들어가고, 무료 계정의 저장 공간은 5GB예요. 더 쓰려면 유료 저장 공간이 필요해요.',
        '함정은 5GB가 찼을 때예요. OneDrive는 새 파일을 올리지도, 고친 파일을 동기화하지도 못해요. 그런데 파일은 그대로 보여서 알아채기 어렵고, 그 뒤로 만든 파일은 이 컴퓨터에만 남아요. 저희 노트북도 무료 5GB가 차서 바탕화면 11GB가 이 PC에만 있었어요.',
        '확인하는 법: 작업 표시줄 오른쪽 구름 아이콘에 빨간 동그라미(흰 빼기 표시)가 있으면 공간이 넘친 거예요. 노란 삼각형은 거의 찼다는 뜻이에요.',
      ],
      src: ['ms-quota', 'synk-move'],
    },
    'onedrive-fix': {
      component: 'onedrive', covers: ['why', 'skip', 'check'], title: '멈춰 있었다면 이렇게 옮겨요',
      body: [
        '멈춘 뒤 만든 파일은 클라우드에 없으니 ①에 넣어 직접 옮겨요. 반대로 구름 표시가 붙은 파일(클라우드에만 있는 파일)은 새 컴퓨터에서 같은 계정으로 로그인하면 보여요. 옮기려고 열면 내려받기만 늘어요.',
        '새 컴퓨터 첫 설정에서 OneDrive 백업을 그대로 켜면 같은 일이 되풀이돼요. 공간이 찼다면 「이 PC에만 파일 저장」을 고르고, 공간을 비우거나 늘린 다음에 켜세요.',
        '이런 경우엔 신경 쓰지 않아도 돼요: 구름 아이콘에 경고가 없고 백업 관리에서 폴더가 백업 중으로 보이면 OneDrive가 제 역할을 하고 있는 거예요.',
      ],
      src: ['ms-folder-backup', 'ms-quota'],
    },
    'must-first': {
      component: 'must', covers: ['what', 'why', 'trap'], title: '「절대 두고 가면 안 되는 것」을 먼저 적는 이유',
      body: [
        '이사를 맡길 때 보통 「다 옮겨 줘」라고 해요. 그런데 다 옮기면 느리고, 공간이 모자랄 때마다 무엇을 뺄지 그때그때 정하게 돼요. 그 순간에 실수가 나요.',
        '저희 이사에서 AI가 짠 첫 규칙은 예전 백업 목록을 「이미 드라이브에 있음」으로 보고 암호화 키와 장부까지 빼고 있었어요. 검수하던 다른 AI가 잡았어요. 두 번째 규칙에는 어떤 규칙으로도 빼지 않을 파일 목록이 따로 붙었어요.',
        '그래서 이 결과는 ①부터 보여 드려요. ①은 「이미 백업돼 있겠지」 싶어도 빼지 않는 것들이에요. ①을 정해 두면 나머지는 과감하게 두고 와도 돼요.',
      ],
      src: ['synk-move', 'synk'],
    },
    'must-cert': {
      component: 'must', covers: ['what', 'skip', 'check'], title: '공동인증서는 직접 옮겨야 해요',
      body: [
        '공동인증서(옛 공인인증서)는 PC·스마트폰·USB처럼 내가 고른 저장소에 담아 쓰는 인증서예요. PC에 저장했다면 새 컴퓨터에는 없어요. 은행이나 홈택스 인증센터의 인증서 복사로 USB나 스마트폰에 옮겨 두고, 새 컴퓨터에서 가져오세요.',
        '이런 경우엔 옮기지 않아도 돼요: 금융인증서는 금융결제원 클라우드에 보관돼서, 이동이나 복사 없이 새 컴퓨터에서 6자리 비밀번호로 써요.',
        '확인하는 법: 자주 쓰는 은행의 인증센터 → 인증서 관리에서 저장 위치가 하드디스크로 된 인증서가 있는지 보세요.',
      ],
      src: ['kftc-joint', 'kftc-finance'],
    },
    'must-code': {
      component: 'must', covers: ['why', 'trap', 'check'], title: '개발 도구를 쓴다면: 원격에 없는 것',
      body: [
        'git 저장소는 원격(GitHub 같은 곳)에 올라간 것만 다시 받을 수 있어요. 커밋하지 않은 변경, push하지 않은 커밋, .gitignore로 빠진 .env 같은 설정 파일은 클론해도 따라오지 않아요.',
        'ssh 개인 키(사용자 폴더의 .ssh)를 잃으면 접속하던 서버와 저장소마다 새 키를 다시 등록해야 해요. 개인 키는 비밀번호와 같아서, 공유 드라이브에 그냥 올리지 말고 암호를 건 압축으로 옮기세요.',
        '확인하는 법: 저장소마다 git status(커밋 안 한 변경)와 git log --branches --not --remotes(push 안 한 커밋)를 보세요. 둘 다 비어 있으면 그 저장소는 다시 클론해도 돼요.',
      ],
      src: ['ms-openssh', 'synk-move'],
    },
    'skip-reget': {
      component: 'skip', covers: ['what', 'why', 'price', 'skip', 'check'], title: '다시 받으면 되는 것은 두고 와요',
      body: [
        '설치한 프로그램은 폴더째 복사해도 새 컴퓨터에서 돌지 않는 경우가 많아요. Microsoft의 이사 안내도 설치한 앱과 Temp 폴더는 옮기지 않고, 원래 설치 파일이나 스토어에서 다시 깔라고 했어요.',
        '캐시, 임시 파일, node_modules, 내려받은 모델처럼 다시 만들거나 받을 수 있는 것은 크기만 크고 이사 시간을 늘려요. 이사 시간은 대부분 옮기는 양이 정해서, 두고 온 만큼 빨라져요. 저희는 107GB를 두고 왔어요.',
        '확인하는 법: 두고 오기 전에 다시 받을 곳(공식 사이트·스토어·런처·package.json 같은 목록)이 있는지만 보세요. 다시 받을 곳이 없으면 ①로 옮겨요.',
      ],
      src: ['ms-transfer', 'synk-move'],
    },
    'login-cookies': {
      component: 'redo', covers: ['what', 'why', 'trap', 'check'], title: '복사로는 로그인이 넘어오지 않아요',
      body: [
        '브라우저 비밀번호·쿠키와 자격 증명 관리자에 든 로그인은, Windows가 그 사용자·그 컴퓨터에서만 풀리게 암호화해 둬요(DPAPI). 그래서 폴더를 통째로 복사해도 새 컴퓨터에서는 열리지 않아요.',
        '크롬 동기화는 북마크·비밀번호·설정·확장 프로그램을 계정에 저장하지만, 쿠키는 그 목록에 없어요. 동기화를 켜도 사이트마다 다시 로그인하는 이유예요.',
        '확인하는 법: 옛 컴퓨터에서 브라우저 동기화가 켜져 있는지, 비밀번호가 계정에 저장되고 있는지 먼저 보세요. 그다음 새 컴퓨터에서 같은 계정으로 로그인해요.',
      ],
      src: ['ms-dpapi', 'chrome-sync', 'ms-credman'],
    },
    'login-apps': {
      component: 'redo', covers: ['why', 'skip', 'check'], title: 'AI 앱과 개발 도구도 다시 로그인해요',
      body: [
        'AI 앱과 git 도구는 로그인 정보를 자격 증명 저장소처럼 그 기기에 묶인 곳에 둬요. GitHub CLI도 토큰을 시스템 자격 증명 저장소에 둔다고 안내해요. 그래서 새 컴퓨터에서는 다시 로그인하고, 연결해 둔 서비스도 다시 허용해요.',
        '이런 건 옮기지 않아도 돼요: 대화 기록은 대부분 계정에 있어서 다시 로그인하면 보여요. 앱 폴더를 통째로 복사할 필요는 없어요. 다만 컴퓨터 폴더에 둔 지침·기억 파일은 ①에 넣으세요.',
        '확인하는 법: 로그인한 뒤 새 대화에서 「내가 정해 둔 규칙 기억해?」처럼 한 번 물어서 설정이 살아 있는지 보세요.',
      ],
      src: ['gh-auth', 'synk-move'],
    },
    'ssh-perm': {
      component: 'redo', covers: ['what', 'trap', 'check'], title: 'ssh 개인 키는 옮긴 뒤 권한을 다시 맞춰요',
      body: [
        'ssh는 개인 키 파일을 다른 사람이 읽을 수 있으면 그 키를 쓰지 않고 그냥 넘어가요(OpenSSH 설명서). 복사하면서 권한이 넓어지면 「키는 있는데 접속이 안 되는」 일이 생겨요.',
        '저희 옛 노트북도 Windows의 ssh가 키 권한 문제로 키를 거부했어요. 새 노트북에서는 옮긴 뒤 개인 키를 내 계정만 읽게 고쳤어요.',
        '확인하는 법: PowerShell에서 icacls "$env:USERPROFILE\\.ssh\\키이름" /inheritance:r /grant:r "$($env:USERNAME):R" 로 상속을 끊고 내 계정에만 읽기를 준 뒤, ssh -T 로 접속을 시험해요.',
      ],
      src: ['ssh-man', 'ms-openssh', 'synk-move'],
    },
    'env-merge': {
      component: 'redo', covers: ['why', 'trap', 'check'], title: '환경 변수는 덮지 말고 합쳐요',
      body: [
        '환경 변수 Path는 명령을 어디서 찾을지 적은 목록이에요. 새 컴퓨터에 프로그램을 깔면 그 경로가 Path에 더해져요.',
        '함정은 옛 컴퓨터의 값을 그대로 덮을 때예요. 새 컴퓨터에 깔린 프로그램 경로가 사라져서 명령이 갑자기 안 찾아져요. setx 명령은 1024자가 넘는 값을 잘라서 저장하고, 잘린 값이 원래 값을 덮을 수 있다고 공식 문서가 경고해요.',
        '확인하는 법: 옛 값은 파일로만 받아 두고, 새 컴퓨터에 없는 항목만 하나씩 더하세요. 바꾸기 전 값도 파일로 남겨 두면 되돌릴 수 있어요. 저희도 「옛 값이 없으면 넣고 Path는 합치기」로 옮겼어요.',
      ],
      src: ['ms-setx', 'synk-move'],
    },
    'clock-first': {
      component: 'clock', covers: ['what', 'why', 'trap', 'check'], title: '새 컴퓨터 시계부터 맞춰요',
      body: [
        '파일에는 만든 시각과 고친 시각이 붙어 있어요. 새 컴퓨터의 시계가 틀린 채로 파일을 넣으면, 새로 생기는 파일의 시각이 미래로 찍혀요.',
        '저희 새 노트북은 시계가 약 16시간 앞서 있어서, 시각을 고친 파일이 18만 개였어요. 시각이 틀리면 최근 파일 정렬이나, 「더 새 파일」을 고르는 백업·동기화 프로그램의 판단이 꼬일 수 있어요.',
        '확인하는 법: 시작 → 설정 → 시간 및 언어 → 날짜 및 시간에서 자동으로 시간 설정과 자동으로 표준 시간대 설정을 켜고, 표준 시간대가 서울인지 보세요.',
      ],
      src: ['ms-time', 'synk-move'],
    },
    'method-ssd': {
      component: 'method', covers: ['what', 'trap', 'check', 'price', 'skip'], title: '외장 SSD·USB로 옮길 때',
      body: [
        '인터넷이 필요 없고 가장 빨라요. 함정은 FAT32로 포맷된 USB예요. 파일 하나가 4GB를 넘으면 들어가지 않아요(NTFS·exFAT는 괜찮아요). 영상 파일이나 큰 압축 파일이 있다면 먼저 확인하세요.',
        '탐색기 복사는 중간에 끊기면 처음부터 다시예요. robocopy의 /z를 쓰면 끊긴 곳부터 이어서 복사해요. 대상에서 파일을 지우는 /mir·/purge는 쓰지 마세요.',
        '값을 정하는 것: 옮길 양보다 큰 SSD가 필요해요. 크기는 옛 컴퓨터에서 사용자 폴더 속성으로 먼저 재세요. 옮길 것이 몇 GB뿐이라면 SSD를 새로 살 필요 없이 클라우드로도 충분해요.',
      ],
      src: ['ms-fs', 'ms-robocopy'],
    },
    'method-cloud': {
      component: 'method', covers: ['what', 'price', 'trap', 'check'], title: '클라우드로 옮길 때',
      body: [
        '무료 용량부터 보세요. 구글 계정은 15GB를 Gmail·드라이브·포토가 나눠 쓰고, Microsoft는 5GB예요. 차면 새 파일을 올릴 수 없어요. 옮길 양이 크면 잠깐만 유료 용량을 쓰거나, 큰 것만 SSD로 나눠요.',
        '값을 정하는 것은 올리는 속도예요. 집 인터넷은 올리는 속도가 받는 속도보다 느린 경우가 많아요. 저희는 올리기 시작부터 새 노트북 받기 끝까지 하루 반이 걸렸어요. 다시 받을 수 있는 큰 것을 빼면 그만큼 빨라져요.',
        '함정: 받는 중에 업데이트로 재부팅되면 받기가 꺼져요. 처음부터 다시 받지 않게, 무엇을 받았는지 기록하면서 묶음 단위로 받으세요. 저희는 다시 켠 뒤 「이어하기」로 받은 묶음 다음부터 이었어요. 확인하는 법: 올린 묶음 수와 받은 묶음 수가 같은지 보세요.',
      ],
      src: ['google-storage', 'ms-quota', 'synk-move'],
    },
    'method-direct': {
      component: 'method', covers: ['what', 'trap', 'skip'], title: '두 PC를 직접 이을 때',
      body: [
        '같은 집 네트워크에 두 컴퓨터를 두고 폴더를 공유해서 옮겨요. 근처 공유는 블루투스·Wi-Fi로 가까운 PC에 파일 몇 개를 보내기 좋고, 많은 양은 폴더 공유가 나아요.',
        '함정: Microsoft가 안내하던 「새 PC로 파일과 설정 옮기기」 기능은 지원 문서 맨 위에 더 이상 사용할 수 없다고 적혀 있어요(10월 17일 확인). 그 기능을 찾느라 시간을 쓰지 마세요.',
        '이런 경우엔 직접 연결이 필요 없어요: 두 컴퓨터를 같은 곳에 오래 켜 둘 수 없다면 외장 SSD가 더 간단해요. 끝나면 이사 때문에 열어 둔 공유는 다시 꺼요.',
      ],
      src: ['ms-transfer', 'ms-share', 'ms-nearby'],
    },
    'method-unsure': {
      component: 'method', covers: ['why', 'skip', 'check'], title: '방법이 안 정해졌다면 크기부터 재요',
      body: [
        '방법은 옮길 크기가 정해요. 사용자 폴더(C: → 사용자 → 내 이름)를 오른쪽 클릭 → 속성에서 크기를 보세요. ②의 다시 받으면 되는 것을 빼면 생각보다 작아져요.',
        '크기가 무료 클라우드 용량(구글 15GB, Microsoft 5GB) 안이고 인터넷이 빠르면 클라우드, 그보다 크면 외장 SSD, 두 컴퓨터를 한 곳에 켜 둘 수 있으면 직접 연결이 편해요.',
        '이런 경우엔 고민하지 않아도 돼요: 문서·웹 위주라 파일이 대부분 계정과 클라우드에 있다면, 옮길 것은 ①과 공동인증서 정도예요.',
      ],
      src: ['google-storage', 'ms-quota', 'synk'],
    },
    'creative-license': {
      component: 'uses', covers: ['what', 'why', 'trap', 'check'], title: '영상·디자인 작업이라면: 프로젝트와 라이선스',
      body: [
        '편집 프로젝트 파일은 원본 영상·사진을 경로로 가리켜요. 프로젝트 파일만 옮기면 원본을 못 찾아 미디어가 오프라인으로 떠요. 원본 폴더를 같은 구조로 함께 옮기세요.',
        'Adobe 앱은 한 번에 두 대까지 활성화돼요. 새 컴퓨터에서 막히지 않게 옛 컴퓨터에서 로그아웃하거나, 계정 페이지에서 옛 기기를 해제하세요. 직접 넣은 폰트·프리셋·LUT도 다시 설치해야 해요.',
        '확인하는 법: 새 컴퓨터에서 프로젝트를 열어 미디어 오프라인이나 폰트 대체 경고가 없는지 보세요.',
      ],
      src: ['adobe-2', 'synk'],
    },
    'media-originals': {
      component: 'uses', covers: ['what', 'trap', 'check'], title: '사진·영상이 많다면: 원본이 하나뿐인지',
      body: [
        '휴대폰에서 옮겨 두고 휴대폰에서는 지운 원본이라면, 이 컴퓨터가 하나뿐인 사본일 수 있어요. 클라우드에 올라가 있어도 용량 절약 화질이면 원본이 아니에요.',
        '함정: 큰 영상은 FAT32 USB에 들어가지 않고(파일 하나 4GB까지), 클라우드는 무료 용량이 금방 차요. 큰 원본은 외장 SSD가 나아요.',
        '확인하는 법: 사진·영상 폴더의 파일 수를 두 컴퓨터에서 비교하고, 무작위로 몇 개를 열어 큰 영상이 끝까지 재생되는지 보세요.',
      ],
      src: ['ms-fs', 'google-storage', 'synk'],
    },
    'game-saves': {
      component: 'uses', covers: ['what', 'trap', 'check', 'skip'], title: '게임을 한다면: 세이브 파일',
      body: [
        '게임 설치 파일은 런처에서 다시 받으면 되지만, 세이브는 달라요. Steam 지원 문서는 모든 게임이 세이브를 Steam Cloud에 두는 건 아니고, 옛 컴퓨터에 접근할 수 없게 되면 그 세이브는 되살릴 수 없다고 해요.',
        '확인하는 법: 상점 페이지 오른쪽 위에 Steam Cloud 표시가 있는지 게임마다 보세요. 없는 게임은 세이브 폴더를 찾아 ①에 넣어요.',
        '새 컴퓨터에서는 런처에 로그인하고 동기화가 끝난 다음에 게임을 켜세요. 먼저 켜면 세이브가 엇갈릴 수 있어요.',
      ],
      src: ['steam-cloud'],
    },
    'work-policy': {
      component: 'uses', covers: ['what', 'why', 'check'], title: '회사 보안 프로그램이 있다면: 회사 방식이 먼저',
      body: [
        '회사 보안 프로그램이 깔린 컴퓨터는 회사가 정한 이사 방법이 있는 경우가 많아요. 개인 클라우드나 USB로 회사 자료를 옮기면 규칙에 걸릴 수 있어요. Windows 백업도 회사·학교 계정은 지원하지 않아요.',
        '보안 프로그램과 VPN, 회사 인증서는 복사해서 옮기는 게 아니라 IT 담당자가 새 컴퓨터에 다시 깔고 등록해요. 회사 계정 기기의 BitLocker 복구 키는 aka.ms/aadrecoverykey에서 찾고, 없으면 IT 담당자에게 물어요.',
        '확인하는 법: 옮기기 전에 IT 담당자에게 「회사 자료를 어디로 옮기면 되나요」를 먼저 묻고, 끝나면 회사 메일과 VPN에 접속해 보세요.',
      ],
      src: ['ms-backup', 'ms-bitlocker'],
    },
    'verify-compare': {
      component: 'verify', covers: ['what', 'why', 'trap', 'check'], title: '끝은 옛 컴퓨터와 대조로 확인해요',
      body: [
        '복사가 「완료」로 끝나도 빠진 파일이 있을 수 있어요. 경로가 너무 긴 파일, 쓰는 중이던 파일, 권한이 막힌 파일이 조용히 건너뛰어져요.',
        '확인하는 법: 중요한 폴더마다 두 컴퓨터에서 오른쪽 클릭 → 속성의 파일 수와 크기를 비교해요. 개발 도구를 쓴다면 robocopy 옛폴더 새폴더 /e /l 로 복사 없이 차이 목록만 뽑을 수 있어요.',
        '저희도 끝에 「핵심이 옛 노트북의 마지막 상태와 같다」는 대조 결과를 받고서야 끝났다고 봤어요. 옛 컴퓨터를 정리하는 건 그다음이에요.',
      ],
      src: ['ms-robocopy', 'synk-move'],
    },
    'old-sell': {
      component: 'old', covers: ['what', 'trap', 'check'], title: '옛 컴퓨터를 바로 판다면',
      body: [
        '팔고 나면 빠진 것을 꺼낼 곳이 없어요. 그래서 애매한 것도 옮기는 쪽으로 정하고, 두고 온 것의 이름 목록이라도 새 컴퓨터에 가져가요.',
        '초기화는 대조가 끝난 뒤 맨 마지막이에요. 계정과 유료 프로그램을 해제한 다음, 설정 → 시스템 → 복구 → PC 초기화에서 모든 항목 제거를 고르고 데이터 정리를 켜요. Microsoft는 판매할 때 이 옵션을 권해요.',
        '확인하는 법: 암호화된 기기는 초기화에 BitLocker 복구 키가 필요할 수 있어요. aka.ms/myrecoverykey에서 키가 보이는지 먼저 보세요.',
      ],
      src: ['ms-reset', 'ms-bitlocker'],
    },
    'old-keep2w': {
      component: 'old', covers: ['what', 'trap', 'check'], title: '2주 보관하면 과감하게 두고 와도 돼요',
      body: [
        '옛 컴퓨터를 2주 두면, 애매한 건 지우지 않고 그 자리에 두고 와도 돼요. 대신 두고 온 것의 이름 목록을 새 컴퓨터에 가져가요. 저희도 이렇게 했어요.',
        '함정은 2주가 슬쩍 지나가는 거예요. 초기화 날짜를 달력에 적어 두고, 그 전에 빠진 것을 한 번에 꺼내요.',
        '확인하는 법: 2주 동안 새 컴퓨터로 일하면서 없다고 느낀 파일을 적어 두세요. 목록이 비면 그때 초기화해요.',
      ],
      src: ['synk-move', 'synk'],
    },
    'old-keep': {
      component: 'old', covers: ['what', 'trap', 'check'], title: '옛 컴퓨터도 계속 쓴다면',
      body: [
        '옛 컴퓨터를 계속 쓰면 급하게 다 옮길 필요가 없어요. 새 컴퓨터에서 매일 쓸 것만 먼저 옮기고, 나머지는 필요할 때 꺼내요.',
        '함정은 두 컴퓨터가 같은 클라우드 폴더를 동기화할 때예요. 한쪽에서 정리한 파일이 다른 쪽에서도 사라질 수 있어요. 정리는 한 컴퓨터에서만 하고, 라이선스가 두 대까지인 프로그램은 어느 쪽에서 쓸지 정해요.',
        '확인하는 법: 두 컴퓨터에서 같은 계정의 동기화 폴더가 무엇인지 적어 두고, 정리하기 전에 다른 컴퓨터에서 그 파일이 필요한지 한 번 봐요.',
      ],
      src: ['synk', 'synk-move'],
    },
  };

  const steps = [
    {
      id: 'how', type: 'single', eyebrow: '옮기는 방법', short: '방법',
      title: '어떻게 옮기나요?',
      sub: 'Windows에서 Windows로 옮기는 경우가 기준이에요. 방법마다 막히는 곳이 달라요.',
      options: [
        { id: 'ssd', label: '외장 SSD·USB', sub: '꽂아서 복사', tip: '가장 빨라요. FAT32 USB는 4GB 넘는 파일이 안 들어가니 확인할 것과, 끊겨도 이어지는 복사법을 넣을게요.' },
        { id: 'cloud', label: '구글 드라이브 같은 클라우드', sub: '올렸다가 새 PC에서 받기', tip: '올리는 양이 곧 시간이에요. 다시 받으면 되는 건 빼고, 끊겨도 이어 받는 법을 넣을게요.' },
        { id: 'direct', label: '두 PC 직접 연결', sub: '같은 네트워크·케이블', tip: '같은 네트워크에서 폴더를 공유해 옮기는 순서를 넣고, 끝나면 공유를 다시 끄게 할게요.' },
        { id: 'unsure', label: '아직 모름', sub: '크기부터 재 볼게요', tip: '옮길 크기를 먼저 재는 법과, 크기에 맞는 방법을 골라 드릴게요.' },
      ],
      tip: { title: '방법마다 막히는 곳이 달라요', body: ['외장 SSD는 빠르지만 FAT32면 4GB 넘는 파일이 안 들어가요. 클라우드는 무료 용량(구글 15GB, Microsoft 5GB)과 올리는 속도가 시간을 정해요.', 'Microsoft가 안내하던 「새 PC로 옮기기」 기능은 지금은 쓸 수 없다고 적혀 있어요. 어떤 방법이든 마지막은 옛 컴퓨터와 대조예요.'], visual: 'methods', src: 'google-storage' },
    },
    {
      id: 'uses', type: 'multi', eyebrow: '이 컴퓨터로 하는 일', short: '하는 일',
      title: '이 컴퓨터로 무슨 일을 하나요?',
      sub: '여러 개를 골라도 돼요. 하는 일에 따라 「절대 두고 가면 안 되는 것」이 달라져요.',
      options: [
        { id: 'ai', label: 'AI 앱', sub: '대화·지침·연결 서비스', tip: '대화는 대부분 계정에 있어요. 컴퓨터에 둔 지침·기억 파일과 다시 로그인할 곳을 챙길게요.' },
        { id: 'code', label: '코딩 도구', sub: 'git·Python·Node', tip: 'ssh 키, push 안 한 코드, .env 같은 git 밖 파일을 ①에 넣고, 환경 변수는 합치는 법으로 넣을게요.' },
        { id: 'creative', label: '영상·디자인', sub: '편집 프로젝트·폰트·프리셋', tip: '편집 프로젝트와 그 원본, 직접 넣은 폰트를 챙기고, 유료 프로그램은 옛 PC에서 로그아웃하게 할게요.' },
        { id: 'media', label: '사진·영상 파일이 많음', sub: '원본 보관', tip: '클라우드에 없는 원본을 ①에 넣고, 큰 파일이 많은 이사의 함정을 알려 드릴게요.' },
        { id: 'work', label: '회사 보안 프로그램', sub: '회사 노트북·VPN', tip: '회사 자료와 보안 프로그램은 회사 방식이 먼저예요. IT 담당자에게 물을 것을 넣을게요.' },
        { id: 'game', label: '게임', sub: '런처·세이브', tip: '클라우드 저장을 안 쓰는 게임의 세이브를 챙기고, 큰 게임은 다시 받는 쪽으로 둘게요.' },
        { id: 'docs', label: '문서·웹 위주', sub: '문서·은행·쇼핑', tip: '옮길 건 적어도 로그인·공동인증서·받아 둔 서류가 빠지기 쉬워요. 그쪽을 챙길게요.' },
      ],
      tip: { title: '하는 일이 ①을 바꿔요', body: ['코딩 도구를 쓰면 ssh 키와 push 안 한 코드가, 영상·디자인이면 프로젝트와 원본이, 게임이면 세이브가 「절대」 칸에 들어가요.', '많은 게임이 세이브를 Steam Cloud에 두지 않아서, 옛 컴퓨터가 없어지면 되살릴 수 없어요.'], src: 'steam-cloud' },
    },
    {
      id: 'old', type: 'single', eyebrow: '옛 컴퓨터', short: '옛 컴퓨터',
      title: '옛 컴퓨터는 어떻게 하나요?',
      sub: '옛 컴퓨터를 언제까지 두느냐가 「과감하게 두고 오기」를 정해요.',
      options: [
        { id: 'sell', label: '바로 초기화·판매', sub: '이사가 끝나면 넘기거나 팔아요', tip: '되돌릴 수 없으니 애매한 것도 옮기고, 대조가 끝난 뒤 「데이터 정리」로 초기화하는 순서를 넣을게요.' },
        { id: 'keep2w', label: '2주쯤 보관', sub: '빠진 게 있으면 꺼내 오게', tip: '애매한 건 옛 컴퓨터에 두고 목록만 가져가게 할게요. 저희도 이렇게 했어요.' },
        { id: 'keep', label: '계속 씀', sub: '두 대를 같이 써요', tip: '두 컴퓨터가 같은 클라우드 폴더를 동기화할 때 서로 지우지 않게 하는 법을 넣을게요.' },
      ],
      tip: { title: '보관하는 동안은 「두고 오기」가 안전해요', body: ['저희는 옛 노트북을 2주 보관하기로 하고, 앞으로 안 쓸 것은 두고 왔어요. 지운 게 아니라 안 가져간 거예요.', '바로 판다면 초기화는 대조가 끝난 뒤 맨 마지막이에요. Microsoft는 판매할 때 「모든 항목 제거」에 데이터 정리를 켜라고 권해요.'], src: 'ms-reset' },
    },
  ];

  // 영상 속 실제 이사(기획.md 사실 대조 표 그대로). 결과 화면 「영상 속 실제 이사」에 보인다.
  const story = {
    title: '영상 속 실제 이사',
    rows: [
      { k: '옮길 후보', v: '160GB · 파일 96만 개' },
      { k: 'OneDrive', v: '무료 5GB가 차서 바탕화면 11GB가 이 PC에만' },
      { k: '첫 규칙', v: '「이미 드라이브에 있음」으로 보고 암호화 키·장부까지 뺌 → 검수하던 다른 AI가 잡음' },
      { k: '두 번째 규칙', v: '절대 빼지 않을 목록 2만 7천 개' },
      { k: '두고 온 것', v: '107GB(옛 노트북에 2주 보관, 목록은 새 노트북에)' },
      { k: '새 PC 시계', v: '약 16시간 빨라서 파일 18만 개의 시각을 고침' },
      { k: '끝', v: '조각 39개, 하루 반 뒤 옛 노트북과 대조 「핵심이 옛 노트북의 마지막 상태와 같다」' },
    ],
    note: 'Windows 첫 설정, 로그인, 앱 닫기는 사람이 했어요.',
  };

  return Object.freeze({
    id: 'builds.move', version: 1, checked: CHECKED,
    series: 'yuhobuilds', title: '내 PC 이사 목록',
    intro: {
      eyebrow: 'YUHOBUILDS · MOVE',
      title: '새 컴퓨터로 이사,<br><span class="hl">내 PC에 맞는 목록으로</span>',
      lead: '어떻게 옮기는지, 이 컴퓨터로 무슨 일을 하는지, 옛 컴퓨터를 어떻게 할지만 고르면 「절대 두고 가면 안 되는 것」부터 끝났는지 확인하는 법까지 내 PC에 맞춘 이사 목록을 만들어 드려요. AI한테 이사를 맡길 때 그대로 붙여 넣을 요청문도 함께요. Windows에서 Windows로 옮기는 경우가 기준이에요.',
      meta: ['약 1분', '질문 3개', 'Windows → Windows', '로그인 없음'],
      privacy: '고른 답만 이 기기에 저장돼요. 내 컴퓨터의 파일은 읽지 않아요.',
      start: '내 이사 목록 만들기',
    },
    steps, SOURCES, TIPS, COMPONENTS, ITEMS, onedrive, story,
    channels: { instagram: 'https://www.instagram.com/yuhobuilds/', youtube: 'https://www.youtube.com/@yuhobuilds' },
  });
});
