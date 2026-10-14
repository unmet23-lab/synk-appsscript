// 다운로드 화면에 거는 공개 Preview 파일. 홈페이지(synk.im) 다운로드 창과 같은 파일·안내 문구를 쓴다.
// 받을 파일은 홈페이지·설치한 플랫폼과 같은 공개 판 표(synk.im/desktop/releases/preview.json)를 읽어 따라간다.
// 아래 파일 값은 그 표를 읽지 못할 때 쓰는 판이다(이 표를 바꿀 당시 공개 판).
const RELEASES = 'https://github.com/unmet23-lab/synk-policy/releases';
export const RELEASE_FEED = '/desktop/releases/preview.json';
export const PLATFORM_DOWNLOADS = {
  version: '0.4.7',
  windows: { tab: 'Windows', label: 'Windows용 다운로드', sticker: 'Windows 64비트', need: 'Windows 10·11 64비트', sign: '정식 코드 서명 전',
    file: 'SYNK-Platform-Preview-0.4.7-Signal-win-x64.exe', bytes: 402704384, tag: 'platform-preview-0.4.7' },
  'mac-arm64': { tab: 'Mac · Apple Silicon', label: 'Mac용 다운로드', chip: 'Apple Silicon', sticker: 'macOS 13 이상', need: 'macOS 13 이상 · Apple M 시리즈', sign: 'Apple 공증 전',
    file: 'SYNK-Platform-Preview-0.4.7-Signal-mac-arm64.dmg', bytes: 461999512, tag: 'platform-preview-0.4.7' },
  'mac-x64': { tab: 'Mac · Intel', label: 'Mac용 다운로드', chip: 'Intel', sticker: 'macOS 13 이상', need: 'macOS 13 이상 · Intel 프로세서', sign: 'Apple 공증 전',
    file: 'SYNK-Platform-Preview-0.4.7-Signal-mac-x64.dmg', bytes: 479680541, tag: 'platform-preview-0.4.7' },
};
export const DOWNLOAD_OS = ['windows', 'mac-arm64', 'mac-x64'];
export const downloadHref = os => `${RELEASES}/download/${PLATFORM_DOWNLOADS[os].tag}/${PLATFORM_DOWNLOADS[os].file}`;
export const checksumHref = os => `${RELEASES}/tag/${PLATFORM_DOWNLOADS[os].tag}`;
export const downloadSize = bytes => `${Math.round(bytes / 1048576)}MB`;
export const DOWNLOAD_STEPS = {
  get windows() {
    return [
      ['받은 파일 열기', `다운로드 폴더의 ${PLATFORM_DOWNLOADS.windows.file}를 열어요. 브라우저가 경고하면 다운로드 목록에서 파일을 계속 보관하도록 골라 주세요.`],
      ['「Windows의 PC 보호」가 나오면', '「추가 정보」를 누르고 「실행」을 눌러요. 미리보기판이라 아직 정식 코드 서명 전이어서 나오는 화면이에요.'],
      ['설치 창에서 「설치하기」', '관리자 권한 없이 지금 쓰는 Windows 계정에 설치돼요. 끝나면 「SYNK 열기」로 바로 시작해요.'],
    ];
  },
  get mac() {
    return [
      ['DMG 열기', `다운로드 폴더에서 받은 SYNK-Platform-Preview-${PLATFORM_DOWNLOADS.version} DMG를 열어요.`],
      ['Applications로 옮기기', 'SYNKPlatformPreview를 Applications 폴더로 끌어 놓은 뒤 응용 프로그램에서 열어요. DMG 안에서 바로 열지 마세요.'],
      ['처음 열 때 확인 창이 나오면', '시스템 설정 → 개인정보 보호 및 보안에서 「그래도 열기」를 눌러요. 미리보기판이라 아직 Apple 공증 전이어서 나오는 화면이에요.'],
    ];
  },
};
const FEED_OS = { 'win32-x64': 'windows', 'darwin-arm64': 'mac-arm64', 'darwin-x64': 'mac-x64' };
// 홈페이지 desktop/releases/client.js의 selectDesktopRelease와 같은 검사다. 하나라도 어긋나면 null(표를 그대로 둔다).
export function releaseFromFeed(value) {
  if (!value || value.schemaVersion !== 1 || value.product !== 'platform' || value.channel !== 'preview' ||
      !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value.version) ||
      value.releaseId !== 'platform-preview-' + value.version || !Array.isArray(value.artifacts)) return null;
  const files = {};
  for (const item of value.artifacts) {
    const os = FEED_OS[item?.platform + '-' + item?.arch];
    if (!os || files[os]) return null;
    let url;
    try { url = new URL(item.url); } catch { return null; }
    const file = url.pathname.split('/').pop();
    if (url.origin !== 'https://github.com' || url.username || url.password || url.search || url.hash ||
        url.pathname !== `/unmet23-lab/synk-policy/releases/download/${value.releaseId}/${file}` ||
        !/^SYNK-Platform-Preview-[\d.]+-[A-Za-z0-9-]+\.(exe|dmg)$/.test(file) || !file.endsWith(os === 'windows' ? '.exe' : '.dmg') ||
        !Number.isSafeInteger(item.bytes) || item.bytes <= 0 ||
        !/^[a-f0-9]{64}$/.test(item.sha256) || !/^[a-f0-9]{64}$/.test(item.asarSHA256)) return null;
    files[os] = { file, bytes: item.bytes, tag: value.releaseId };
  }
  return Object.keys(files).length === DOWNLOAD_OS.length ? { version: value.version, files } : null;
}
// 공개 판 표를 읽어 PLATFORM_DOWNLOADS를 그 판으로 맞춘다. 표가 바뀌었으면 true, 못 읽었거나 같으면 false.
export async function refreshPlatformDownloads(fetcher = globalThis.fetch) {
  try {
    const response = await fetcher(RELEASE_FEED, { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(10000) });
    if (!response.ok) return false;
    const release = releaseFromFeed(await response.json());
    if (!release) return false;
    let changed = PLATFORM_DOWNLOADS.version !== release.version;
    PLATFORM_DOWNLOADS.version = release.version;
    for (const os of DOWNLOAD_OS) {
      const row = PLATFORM_DOWNLOADS[os], next = release.files[os];
      if (row.file !== next.file || row.bytes !== next.bytes || row.tag !== next.tag) changed = true;
      Object.assign(row, next);
    }
    return changed;
  } catch { return false; }
}
// 이 기기에 맞는 파일: 'windows' · 'mac-arm64' · 'mac-x64' · 칩을 모르는 Mac이면 'mac' · 휴대폰·그 밖은 null.
// 칩은 홈페이지와 같은 순서로 본다(클라이언트 힌트 → WebGL 그래픽 이름). Safari는 Apple Silicon에서도 Intel로 적어 UA 문자열은 쓰지 않는다.
export async function detectDownloadOS(nav = globalThis.navigator) {
  try {
    const ua = nav?.userAgent || '', platform = nav?.userAgentData?.platform || nav?.platform || '';
    if (nav?.userAgentData?.mobile || /iPhone|iPad|iPod|Android/i.test(ua)) return null;
    if (/Win/i.test(platform) || /Windows NT/.test(ua)) return 'windows';
    if (!/Mac/i.test(platform) && !/Macintosh/.test(ua)) return null;
    if (!nav.userAgentData && nav.maxTouchPoints > 1) return null; // 데스크톱 모드 iPad Safari(Mac처럼 적음)
    if (typeof nav.userAgentData?.getHighEntropyValues === 'function') {
      const { architecture } = await nav.userAgentData.getHighEntropyValues(['architecture']);
      if (architecture === 'arm') return 'mac-arm64';
      if (architecture === 'x86') return 'mac-x64';
    }
    const gl = globalThis.document?.createElement('canvas').getContext('webgl'), info = gl?.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    if (/Apple M\d/.test(renderer)) return 'mac-arm64';
    if (/Intel/.test(renderer)) return 'mac-x64';
    return 'mac';
  } catch { return null; }
}
