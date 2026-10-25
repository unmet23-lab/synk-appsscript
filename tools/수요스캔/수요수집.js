'use strict';
/**
 * 수요 스캔 — 읽어 오는 부분. 유튜브·틱톡 공개 화면의 메타데이터·댓글만 yt-dlp로, 유튜브 새 편은 공개 RSS로 읽는다.
 * 로그인·게시·좋아요·댓글 쓰기·구독을 하지 않고 영상 파일은 받지 않는다(모든 yt-dlp 호출에 --skip-download·--ignore-config).
 *
 * 10-22 조사에서 본 막힘: 검색·댓글의 다음 쪽(continuation)에서 「HTTP Error 403」이 잦았다. 그래서
 *   - 호출을 하나씩 순서대로, 서비스마다 간격(기본 2.5초 + 흔들림)을 두고 부른다
 *   - 목록은 첫 쪽만(검색 20편, 쇼츠 탭 30편) 읽는다
 *   - 막히면(403·429·봇 확인) 그 대상은 「못 잼」으로 적고 30초 쉬었다가 다음으로 가며, 연달아 세 번 막히면 그 서비스는 이번 회차에서 멈춘다
 */
const { spawn } = require('node:child_process');
const { 가리기, utc날짜 } = require('./수요판정.js');
const { seconds } = require('../lib/평소배수.js');

const YT = 'https://www.youtube.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const 공통인자 = Object.freeze(['--ignore-config', '--no-warnings', '--no-progress', '--skip-download']);
const 영상시도 = Object.freeze([
  { 클라이언트: 'web_safari', 건너뜀: 'webpage' },
  { 클라이언트: 'web_safari', 건너뜀: null },
  { 클라이언트: 'web_embedded', 건너뜀: null },
]);

// ── 명령 인자(순수) ─────────────────────────────────────────────────

function 채널주소(대상) {
  return 대상.id ? `${YT}/channel/${대상.id}` : `${YT}/${encodeURI(대상.핸들)}`;
}

function 검색주소(어, 필터) {
  return `${YT}/results?search_query=${encodeURIComponent(어)}${필터 ? `&sp=${필터}` : ''}`;
}

function rss주소(채널id, 갈래) {
  return 갈래 === '쇼츠'
    ? `${YT}/feeds/videos.xml?playlist_id=UUSH${채널id.slice(2)}`
    : `${YT}/feeds/videos.xml?channel_id=${채널id}`;
}

/** yt-dlp 인자 — 종류: 탭 · 검색 · 영상 · 틱톡 */
function yt인자(종류, 값) {
  switch (종류) {
    case '탭':
      return [...공통인자, '--flat-playlist', '--dump-single-json', '--playlist-end', String(값.수 || 30), `${채널주소(값)}/shorts`];
    case '검색':
      return [...공통인자, '--flat-playlist', '--dump-json', '--playlist-end', String(값.수 || 20), 검색주소(값.어, 값.필터)];
    case '영상': {
      const 시도 = 영상시도[값.시도 || 0] || 영상시도[0];
      const 칸 = [`player_client=${시도.클라이언트}`];
      if (시도.건너뜀) 칸.push(`player_skip=${시도.건너뜀}`);
      if (값.댓글수 > 0) 칸.push('comment_sort=top', `max_comments=${값.댓글수},all,0`);
      // 댓글을 받으면 yt-dlp가 comment_count를 「받은 개수」로 덮는다. 전체 수(「Downloading ~N comments」)는 --verbose 오류 출력에만 나온다
      return [...공통인자, '--dump-json', '--no-playlist', '--ignore-no-formats-error', '--extractor-args', `youtube:${칸.join(';')}`,
        ...(값.댓글수 > 0 ? ['--write-comments', '--verbose'] : []), `${YT}/shorts/${값.id}`];
    }
    case '틱톡':
      return [...공통인자, '--flat-playlist', '--dump-json', '--playlist-end', String(값.수 || 35), `https://www.tiktok.com/@${값.핸들}`];
    default:
      throw new Error(`모르는 yt-dlp 종류: ${종류}`);
  }
}

/** yt-dlp 오류 글 → '막힘' | '없음' | '실패'
 * 틱톡 「Unable to extract secondary user ID」는 없는 계정이 아니다 — 같은 계정이 앞뒤 회차엔 읽혔고, 흉내내기(curl_cffi) 없이 받은 페이지에서
 * 잦다(10-24 PC 27곳 중 8곳, 10-25 서버 실측). 「실패」로 둔다. */
function 실패갈래(오류글) {
  const s = String(오류글 || '');
  if (/HTTP Error (?:403|429)|Too Many Requests|Sign in to confirm|not a bot|rate[- ]?limit/i.test(s)) return '막힘';
  if (/does not exist|does not have a (?:shorts|videos) tab|This channel does not have|terminated|Video unavailable|Private video|account is either private|Unsupported URL|This video is not available|not available in your country/i.test(s)) return '없음';
  return '실패';
}

function 오류줄(오류글) {
  const 줄 = String(오류글 || '').split(/\r?\n/).filter(l => /ERROR|Error|error/.test(l));
  return 가리기((줄.length ? 줄[줄.length - 1] : String(오류글 || '').trim().split(/\r?\n/).pop() || '')).slice(0, 200);
}

/** 댓글을 받은 호출의 --verbose 오류 출력에서 그 영상의 전체 댓글 수(「Downloading ~382 comments」) */
function 댓글총수(오류글) {
  const m = /Downloading ~([\d,]+) comments/.exec(String(오류글 || ''));
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

/** 표준출력의 JSON 줄들 */
function json줄들(글) {
  const out = [];
  for (const 줄 of String(글 || '').split(/\r?\n/)) {
    const t = 줄.trim();
    if (!t.startsWith('{')) continue;
    try { out.push(JSON.parse(t)); } catch { /* 잘린 줄은 버린다 */ }
  }
  return out;
}

// ── 응답 읽기(순수) ─────────────────────────────────────────────────

const XML글자 = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function xml풀기(s) {
  return String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, k) => {
    if (k[0] === '#') {
      const n = k[1] === 'x' || k[1] === 'X' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return XML글자[k.toLowerCase()] ?? m;
  });
}

/** 유튜브 RSS(Atom) → {채널id, 채널이름, 전체수, 편:[{id, 제목, 날짜, 쇼츠, 조회}]} — 채널이름은 피드 머리의 author(쇼츠 피드의 title은 「Short videos」라 안 쓴다) */
function rss읽기(xml) {
  const 글 = String(xml || '');
  const 채널id = (/<yt:channelId>([^<]+)<\/yt:channelId>/.exec(글) || [])[1] || null;
  const 머리 = 글.split('<entry>')[0];
  const 채널이름 = xml풀기((/<author>\s*<name>([\s\S]*?)<\/name>/.exec(머리) || [])[1] || '').trim() || null;
  const 편 = [];
  for (const m of 글.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const id = (/<yt:videoId>([^<]+)<\/yt:videoId>/.exec(e) || [])[1];
    if (!id) continue;
    const 링크 = (/<link rel="alternate" href="([^"]+)"/.exec(e) || [])[1] || '';
    const 조회 = (/<media:statistics views="(\d+)"/.exec(e) || [])[1];
    편.push({
      id,
      제목: xml풀기((/<title>([\s\S]*?)<\/title>/.exec(e) || [])[1] || '').trim(),
      날짜: ((/<published>([^<]+)<\/published>/.exec(e) || [])[1] || '').trim() || null,
      쇼츠: /\/shorts\//.test(링크),
      조회: 조회 === undefined ? null : Number(조회),
    });
  }
  return { 채널id, 채널이름, 전체수: 편.length, 편 };
}

const 수 = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** yt-dlp upload_date(YYYYMMDD) 또는 timestamp → 'YYYY-MM-DD' */
function 올린날(info) {
  const d = String(info?.upload_date || '');
  if (/^\d{8}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  if (수(info?.timestamp)) return utc날짜(info.timestamp * 1000);
  return null;
}

/** 쇼츠 탭(--dump-single-json) → {채널id, 채널이름, 핸들, 구독, 편:[{id, 제목, 조회}]} */
function 탭읽기(info) {
  if (!info || typeof info !== 'object') return null;
  const 편 = [];
  for (const e of info.entries || []) {
    if (!e || typeof e.id !== 'string' || !/^[\w-]{11}$/.test(e.id)) continue;
    편.push({ id: e.id, 제목: e.title || '', 조회: 수(e.view_count) });
  }
  const 채널id = [info.channel_id, info.playlist_channel_id, info.id].find(v => typeof v === 'string' && /^UC[\w-]{22}$/.test(v)) || null;
  return { 채널id, 채널이름: info.channel || info.uploader || '', 핸들: info.uploader_id || null, 구독: 수(info.channel_follower_count), 편 };
}

/** 검색 결과(--dump-json 줄들) → [{id, 제목, 조회, 길이, 채널id, 채널이름}] — 채널·재생목록 결과는 뺀다 */
function 검색읽기(줄들) {
  const out = [];
  for (const e of 줄들 || []) {
    if (!e || typeof e.id !== 'string' || !/^[\w-]{11}$/.test(e.id)) continue;
    if (e.ie_key && e.ie_key !== 'Youtube') continue;
    out.push({ id: e.id, 제목: e.title || '', 조회: 수(e.view_count), 길이: 수(e.duration), 채널id: e.channel_id || null, 채널이름: e.channel || e.uploader || '' });
  }
  return out;
}

/** 영상 하나(--dump-json) → 요약에 쓰는 칸만. 설명은 앞 300자를 가려서만 */
function 영상읽기(info) {
  if (!info || typeof info.id !== 'string') return null;
  return {
    id: info.id, 제목: info.title || '', 채널id: info.channel_id || null, 채널이름: info.channel || info.uploader || '',
    핸들: info.uploader_id || null, 구독: 수(info.channel_follower_count), 조회: 수(info.view_count), 좋아요: 수(info.like_count),
    댓글수: 수(info.comment_count), 길이: 수(info.duration), 날짜: 올린날(info), 설명: 가리기(info.description || '').slice(0, 300),
  };
}

/** 틱톡 공개 프로필(--dump-json 줄들) → [{id, 제목, 조회, 좋아요, 댓글수, 저장, 공유, 길이, 날짜}] */
function 틱톡읽기(줄들) {
  const out = [];
  for (const e of 줄들 || []) {
    if (!e || typeof e.id !== 'string' || !/^\d{6,}$/.test(e.id)) continue;
    out.push({
      id: e.id, 제목: (e.title || e.description || '').split(/\r?\n/)[0].slice(0, 120), 조회: 수(e.view_count), 좋아요: 수(e.like_count),
      댓글수: 수(e.comment_count), 저장: 수(e.save_count), 공유: 수(e.repost_count), 길이: 수(e.duration), 날짜: 올린날(e),
    });
  }
  return out;
}

// ── 부르기(네트워크) ────────────────────────────────────────────────

/** 명령 하나를 돌려 표준출력·오류를 글로 받는다(UTF-8 고정 — 한글·키릴이 깨지지 않게) */
function 실행(명령, 인자, 한도ms = 120000) {
  return new Promise(resolve => {
    const 시작 = Date.now();
    let 끝남 = false;
    const 출력 = [];
    const 오류 = [];
    let p;
    try {
      p = spawn(명령, 인자, { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
    } catch (e) {
      resolve({ 코드: 'spawn', 출력: '', 오류글: String(e.message || e), ms: 0 });
      return;
    }
    const 마침 = 코드 => {
      if (끝남) return;
      끝남 = true;
      clearTimeout(타이머);
      resolve({ 코드, 출력: Buffer.concat(출력).toString('utf8'), 오류글: Buffer.concat(오류).toString('utf8'), ms: Date.now() - 시작 });
    };
    const 타이머 = setTimeout(() => { try { p.kill(); } catch { /* 이미 끝남 */ } 마침('시간초과'); }, 한도ms);
    p.stdout.on('data', d => 출력.push(d));
    p.stderr.on('data', d => 오류.push(d));
    p.on('error', e => { 오류.push(Buffer.from(String(e.message || e))); 마침('spawn'); });
    p.on('close', code => 마침(code));
  });
}

const 쉬기기본 = ms => new Promise(r => setTimeout(r, ms));

/**
 * 호출 간격·막힘을 지키는 부르개. 서비스(youtube·tiktok·rss)마다 따로 센다.
 *   yt(종류, 값, 서비스) → {상태:'됨'|'일부'|'막힘'|'없음'|'실패'|'멈춤', 줄들, 오류}
 *   rss(url) → {상태, 글, 오류}
 */
class 부르개 {
  constructor({ 간격초 = 2.5, rss간격초 = 2, 막힘쉼초 = 30, 막힘한도 = 3, ytdlp = process.env.SYNK_YTDLP || 'yt-dlp',
    실행기 = 실행, fetch기 = (...a) => fetch(...a), 쉬기 = 쉬기기본, 기록 = null, 지금 = () => Date.now() } = {}) {
    Object.assign(this, { 간격초, rss간격초, 막힘쉼초, 막힘한도, ytdlp, 실행기, fetch기, 쉬기, 기록, 지금 });
    this.서비스 = {};
    this.셈 = { 호출: 0, 막힘: 0, 멈춘서비스: [] };
  }

  칸(이름) {
    if (!this.서비스[이름]) this.서비스[이름] = { 마지막: 0, 연속막힘: 0, 멈춤: false, 쉼까지: 0 };
    return this.서비스[이름];
  }

  async 차례(이름, 간격초) {
    const s = this.칸(이름);
    const 흔들림 = 간격초 > 0 ? Math.random() * Math.min(1, 간격초 / 2) : 0;
    const 기다림 = Math.max(s.마지막 + (간격초 + 흔들림) * 1000, s.쉼까지) - this.지금();
    if (기다림 > 0) await this.쉬기(기다림);
    s.마지막 = this.지금();
  }

  결과(이름, 상태) {
    const s = this.칸(이름);
    if (상태 === '막힘') {
      s.연속막힘 += 1;
      this.셈.막힘 += 1;
      s.쉼까지 = this.지금() + this.막힘쉼초 * 1000;
      if (s.연속막힘 >= this.막힘한도 && !s.멈춤) { s.멈춤 = true; this.셈.멈춘서비스.push(이름); }
    } else if (상태 === '됨' || 상태 === '일부' || 상태 === '없음') {
      s.연속막힘 = 0;
    }
  }

  남기기(줄) {
    if (typeof this.기록 === 'function') {
      try { this.기록({ 때: new Date(this.지금()).toISOString(), ...줄 }); } catch { /* 기록 실패는 스캔을 멈추지 않는다 */ }
    }
  }

  async yt(종류, 값, 서비스 = 종류 === '틱톡' ? 'tiktok' : 'youtube', 한도ms = 종류 === '영상' ? 180000 : 120000) {
    const s = this.칸(서비스);
    if (s.멈춤) return { 상태: '멈춤', 줄들: [], 오류: `${서비스}가 연달아 막혀 이번 회차에서 멈췄다` };
    await this.차례(서비스, this.간격초);
    this.셈.호출 += 1;
    const r = await this.실행기(this.ytdlp, yt인자(종류, 값), 한도ms);
    const 줄들 = json줄들(r.출력);
    // 종료 코드와 오류 갈래를 먼저 본다 — 앞쪽 JSON을 받았더라도 다음 쪽·댓글에서 403·429로 끝났으면 막힘으로 센다
    // (2차 검수 A3·GA2: 「일부」가 연속 막힘을 0으로 돌려 쉬지도 멈추지도 않았다). 받은 줄은 그대로 쓴다.
    const 갈래 = r.코드 === 0 ? null : (r.코드 === 'spawn' ? '실패' : 실패갈래(r.오류글));
    let 상태;
    let 막힘 = false;
    if (r.코드 === 0 && 줄들.length) 상태 = '됨';
    else if (줄들.length) { 상태 = '일부'; 막힘 = 갈래 === '막힘'; }
    else if (r.코드 === 0) 상태 = '없음'; // 정상 끝났는데 결과가 비었다(쇼츠 탭 없음·검색 0건)
    else 상태 = 갈래;
    this.결과(서비스, 막힘 ? '막힘' : 상태);
    const 오류 = 상태 === '됨' ? '' : (r.코드 === 'spawn' ? `yt-dlp를 못 띄웠다: ${오류줄(r.오류글)}` : 오류줄(r.오류글) || (r.코드 === '시간초과' ? '시간 초과' : ''));
    this.남기기({ 곳: 서비스, 종류, 대상: 값.id || 값.핸들 || 값.어 || '', 상태, 막힘, 코드: r.코드, ms: r.ms, 줄: 줄들.length, 오류 });
    return { 상태, 줄들, 오류, 오류글: r.오류글 || '', 막힘 };
  }

  async rss(url) {
    const s = this.칸('rss');
    if (s.멈춤) return { 상태: '멈춤', 글: '', 오류: 'RSS가 연달아 막혀 이번 회차에서 멈췄다' };
    await this.차례('rss', this.rss간격초);
    this.셈.호출 += 1;
    const 시작 = this.지금();
    let 상태;
    let 글 = '';
    let 오류 = '';
    try {
      const res = await this.fetch기(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.8' }, signal: AbortSignal.timeout(30000) });
      if (res.ok) { 글 = await res.text(); 상태 = /<feed[\s>]/.test(글) ? '됨' : '실패'; if (상태 !== '됨') 오류 = 'RSS 꼴이 아니다'; }
      else { 상태 = res.status === 404 ? '없음' : (res.status === 403 || res.status === 429 ? '막힘' : '실패'); 오류 = `HTTP ${res.status}`; }
    } catch (e) {
      상태 = '실패';
      오류 = String(e?.cause?.code || e?.name || e?.message || e).slice(0, 120);
    }
    this.결과('rss', 상태);
    this.남기기({ 곳: 'rss', 종류: 'rss', 대상: url.replace(/^.*\?/, ''), 상태, ms: this.지금() - 시작, 오류 });
    return { 상태, 글, 오류 };
  }
}

// ── YouTube Data API(10-25) ─────────────────────────────────────────
// 유튜브 채널의 쇼츠 목록·영상 숫자·구독을 공식 API로 읽는다(읽기만 — LAB YouTube 자격, tools/평소배수.js와 같은 길).
// yt-dlp는 호출마다 2.5초를 띄워 네 브랜드가 18분이고, 쇼츠 탭 조회는 반올림, RSS는 10-24부터 대부분 404·500이다(tools/수요스캔/서버.md).
// API는 채널마다 쇼츠 목록 한 번 + 영상 50편 묶음 한 번(각 1단위)이면 정확한 조회·올린 시각·길이가 다 온다.
// 검색(search.list는 한 번에 100단위)·틱톡·댓글 본문은 yt-dlp 그대로.

const API주소 = 'https://www.googleapis.com/youtube/v3/';
// 이 회차에서 API를 그만 부를 403 까닭(한도·사용 설정·권한). 그 밖의 403은 그 대상만 실패로 센다.
const API멈춤까닭 = /quotaExceeded|dailyLimitExceeded|rateLimitExceeded|accessNotConfigured|insufficientPermissions|SERVICE_DISABLED/i;

/** LAB YouTube 자격으로 액세스 토큰을 받는다(값은 찍지 않는다) — tools/평소배수.js 토큰()과 같다 */
async function lab토큰() {
  const publisher = require('../lib/sns-publisher.js');
  const 자격 = publisher.readCredential('lab-youtube', { allowLegacy: true });
  if (!자격) throw new Error('LAB YouTube 자격이 없다(tools/sns-자격.ps1)');
  return (await publisher.googleAccessToken(자격)).accessToken;
}

const api수 = v => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** channels.list 항목 → {채널id, 채널이름, 핸들, 구독} — 구독을 숨긴 채널은 null */
function api채널읽기(c) {
  if (!c || typeof c.id !== 'string') return null;
  const 주소 = c.snippet?.customUrl || '';
  return {
    채널id: c.id, 채널이름: c.snippet?.title || '', 핸들: 주소 ? (주소.startsWith('@') ? 주소 : `@${주소}`) : null,
    구독: c.statistics?.hiddenSubscriberCount ? null : api수(c.statistics?.subscriberCount),
  };
}

/** videos.list 항목 → 영상읽기와 같은 칸(조회·좋아요·댓글 수는 정확한 수, 날짜는 올린 시각의 UTC 날짜) + 올린때(ISO) */
function api영상읽기(v) {
  if (!v || typeof v.id !== 'string') return null;
  const 통계 = v.statistics || {};
  const 올린때 = typeof v.snippet?.publishedAt === 'string' ? v.snippet.publishedAt : null;
  return {
    id: v.id, 제목: v.snippet?.title || '', 채널id: v.snippet?.channelId || null, 채널이름: v.snippet?.channelTitle || '',
    핸들: null, 구독: null, 조회: api수(통계.viewCount), 좋아요: api수(통계.likeCount), 댓글수: api수(통계.commentCount),
    // 길이는 yt-dlp보다 1초 길게 올림으로 온다(10-25 같은 편 대조: 17→18 · 11→12 · 59→60초) — 3분 검사가 이 칸을 보고 1초 봐준다
    길이: seconds(v.contentDetails?.duration), 길이출처: 'api', 날짜: /^\d{4}-\d{2}-\d{2}/.test(올린때 || '') ? 올린때.slice(0, 10) : null, 올린때,
    설명: 가리기(v.snippet?.description || '').slice(0, 300),
  };
}

/**
 * Data API 부르개. 토큰은 처음 부를 때 받고, 401이면 한 번만 새로 받는다. 401이 되풀이되거나 한도·사용 설정 403이 오거나
 * 연달아 실패한도만큼 실패하면 이 회차에서 멈춘다 — 부르는 쪽은 그 뒤 채널을 yt-dlp 길(쇼츠 탭·RSS)로 읽는다.
 *   부르기(자원, 값) → {상태:'됨', 몸} | {상태:'없음'|'실패'|'멈춤', 오류}
 * 토큰은 머리에만 싣고 기록(기록.jsonl)에는 자원·대상·상태·걸린 시간만 남긴다.
 */
class API부르개 {
  constructor({ 토큰 = lab토큰, fetch기 = (...a) => fetch(...a), 기록 = null, 지금 = () => Date.now(), 실패한도 = 3 } = {}) {
    Object.assign(this, { 토큰, fetch기, 기록, 지금, 실패한도 });
    this.열쇠 = null;
    this.연속실패 = 0;
    this.채널칸 = new Map();
    this.셈 = { 호출: 0, 실패: 0, 멈춤: false, 까닭: '' };
  }

  남기기(줄) {
    if (typeof this.기록 === 'function') {
      try { this.기록({ 때: new Date(this.지금()).toISOString(), 곳: 'api', ...줄 }); } catch { /* 기록 실패는 스캔을 멈추지 않는다 */ }
    }
  }

  멈추기(까닭) {
    if (this.셈.멈춤) return;
    this.셈.멈춤 = true;
    this.셈.까닭 = 까닭;
  }

  async 열쇠받기() {
    try { this.열쇠 = await this.토큰(); return true; } catch (e) {
      this.멈추기(`토큰을 못 받았다 — ${String(e?.message || e).slice(0, 120)}`);
      return false;
    }
  }

  실패세기(자원, 대상, ms, 오류) {
    this.셈.실패 += 1;
    this.연속실패 += 1;
    this.남기기({ 종류: 자원, 대상, 상태: '실패', ms, 오류 });
    if (this.연속실패 >= this.실패한도) this.멈추기(`연달아 ${this.연속실패}번 실패 — ${오류}`);
    return { 상태: '실패', 오류 };
  }

  async 부르기(자원, 값, 대상 = '') {
    if (this.셈.멈춤) return { 상태: '멈춤', 오류: this.셈.까닭 };
    if (!this.열쇠 && !(await this.열쇠받기())) return { 상태: '멈춤', 오류: this.셈.까닭 };
    const url = API주소 + 자원 + '?' + new URLSearchParams(값);
    for (let 번 = 0; 번 < 2; 번 += 1) {
      const 시작 = this.지금();
      this.셈.호출 += 1;
      let res;
      let 몸 = {};
      try {
        res = await this.fetch기(url, { headers: { authorization: `Bearer ${this.열쇠}`, accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
        몸 = await res.json().catch(() => ({}));
      } catch (e) {
        return this.실패세기(자원, 대상, this.지금() - 시작, String(e?.cause?.code || e?.name || e?.message || e).slice(0, 120));
      }
      const ms = this.지금() - 시작;
      if (res.ok) {
        this.연속실패 = 0;
        this.남기기({ 종류: 자원, 대상, 상태: '됨', ms });
        return { 상태: '됨', 몸 };
      }
      const 까닭 = String(몸?.error?.errors?.[0]?.reason || 몸?.error?.status || '');
      const 오류 = `HTTP ${res.status}${까닭 ? ` ${까닭}` : ''}`;
      if (res.status === 401 && 번 === 0) {
        this.남기기({ 종류: 자원, 대상, 상태: '실패', ms, 오류: `${오류} — 토큰을 새로 받는다` });
        if (await this.열쇠받기()) continue;
        return { 상태: '멈춤', 오류: this.셈.까닭 };
      }
      if (res.status === 401 || (res.status === 403 && API멈춤까닭.test(까닭))) {
        this.남기기({ 종류: 자원, 대상, 상태: '멈춤', ms, 오류 });
        this.멈추기(오류);
        return { 상태: '멈춤', 오류 };
      }
      if (res.status === 404) {
        this.연속실패 = 0;
        this.남기기({ 종류: 자원, 대상, 상태: '없음', ms, 오류 });
        return { 상태: '없음', 오류 };
      }
      return this.실패세기(자원, 대상, ms, 오류);
    }
    return { 상태: '실패', 오류: 'HTTP 401' };
  }

  /** 채널 ID 여럿 → Map(id → {채널id, 채널이름, 핸들, 구독}) — 50곳에 1단위, 이 회차에 이미 읽은 채널은 다시 안 부른다 */
  async 채널들(ids) {
    const 모자람 = [...new Set((ids || []).filter(id => /^UC[\w-]{22}$/.test(id || '') && !this.채널칸.has(id)))];
    for (let i = 0; i < 모자람.length; i += 50) {
      const 묶음 = 모자람.slice(i, i + 50);
      const r = await this.부르기('channels', { part: 'snippet,statistics', id: 묶음.join(','), maxResults: '50' }, `채널 ${묶음.length}곳`);
      if (r.상태 !== '됨') break;
      for (const c of r.몸.items || []) { const 칸 = api채널읽기(c); if (칸) this.채널칸.set(칸.채널id, 칸); }
    }
    return new Map((ids || []).filter(id => this.채널칸.has(id)).map(id => [id, this.채널칸.get(id)]));
  }

  /** @핸들 → {상태:'됨', 채널} | {상태:'없음'|'실패'|'멈춤', 오류} */
  async 핸들채널(핸들) {
    const r = await this.부르기('channels', { part: 'snippet,statistics', forHandle: String(핸들 || '').replace(/^@/, '') }, String(핸들 || ''));
    if (r.상태 !== '됨') return r;
    const 칸 = api채널읽기((r.몸.items || [])[0]);
    if (!칸) return { 상태: '없음', 오류: '핸들로 채널을 못 찾음' };
    this.채널칸.set(칸.채널id, 칸);
    return { 상태: '됨', 채널: 칸 };
  }

  /** 채널의 쇼츠 목록(UUSH + 채널 ID 셋째 글자부터, 최신순) 앞 수편 → {상태:'됨', ids} | {상태:'없음'(목록 없음)|'실패'|'멈춤', 오류} */
  async 쇼츠목록(채널id, 수 = 30) {
    const r = await this.부르기('playlistItems', { part: 'contentDetails', playlistId: `UUSH${String(채널id).slice(2)}`, maxResults: String(Math.min(50, 수)) }, 채널id);
    if (r.상태 !== '됨') return r;
    return { 상태: '됨', ids: (r.몸.items || []).map(i => i?.contentDetails?.videoId).filter(id => /^[\w-]{11}$/.test(id || '')) };
  }

  /** 영상 ID 여럿 → {상태, 오류?, 상세: Map(id → 상세)} — 50편에 1단위. 비공개·지운 편은 응답에 없어 빠지고, 도중에 멈추면 받은 만큼만 */
  async 영상들(ids) {
    const 상세 = new Map();
    const 고유 = [...new Set((ids || []).filter(id => /^[\w-]{11}$/.test(id || '')))];
    for (let i = 0; i < 고유.length; i += 50) {
      const 묶음 = 고유.slice(i, i + 50);
      const r = await this.부르기('videos', { part: 'snippet,statistics,contentDetails', id: 묶음.join(','), maxResults: '50' }, `영상 ${묶음.length}편`);
      if (r.상태 !== '됨') return { 상태: r.상태, 오류: r.오류, 상세 };
      for (const v of r.몸.items || []) { const d = api영상읽기(v); if (d) 상세.set(d.id, d); }
    }
    return { 상태: '됨', 상세 };
  }
}

module.exports = {
  YT, 공통인자, 영상시도, 채널주소, 검색주소, rss주소, yt인자, 실패갈래, 오류줄, 댓글총수, json줄들,
  xml풀기, rss읽기, 올린날, 탭읽기, 검색읽기, 영상읽기, 틱톡읽기, 실행, 부르개,
  API주소, lab토큰, api채널읽기, api영상읽기, API부르개,
};
