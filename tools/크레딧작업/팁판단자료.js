'use strict';
/**
 * 팁 판단 자료 — 판단하는 Claude가 저장소를 헤매지 않게 AI 없이 미리 만드는 두 가지(2026-11-16).
 *
 * 1. SYNK 지도: 참고카드 README의 대상 표, 결정 표 맨 위 줄의 제목, 트랙 진행 줄의 제목, 지금 카드 한 줄씩.
 *    전에는 판단이 결정 표(1MB) · 트랙(450KB) · 참고카드 README(95KB)를 직접 읽어 한 회차가 평균 5.8달러였다.
 *    큰 문서를 읽은 글은 뒤의 모든 호출에 다시 실려 값이 불어난다. 지도는 2만 자 안쪽이다.
 * 2. 장면 모음판: 게시물 장면(frames/*.jpg)과 장(images/*.jpg)을 여덟 칸 판으로 묶는다.
 *    장면 열두 장을 따로 보면 약 2.2만 토큰이고, 판 두 장이면 약 6천 토큰이다. 글자가 작아 못 읽는 장만 원본을 연다.
 *
 * 팁적용안.js의 사전확인이 부른다. 저장소 밖 파일은 게시물 캐시 폴더의 「판」 폴더에만 쓴다.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const 칸 = { 가로: 4, 세로: 2 };
const 칸너비 = 392;
// 영상 장면은 9:16, 사진 · 카드뉴스 장은 4:5 상자에 맞춘다(남는 곳은 검게 채운다).
const 상자 = { frames: [칸너비, 697], images: [칸너비, 490] };

function 잘라(글, 길이) {
  const s = String(글 || '').replace(/\s+/g, ' ').trim();
  return s.length > 길이 ? `${s.slice(0, 길이 - 1)}…` : s;
}

function 읽기(파일) {
  try { return fs.readFileSync(파일, 'utf8'); } catch { return ''; }
}

/** 참고카드 README의 「## 대상」 절(다음 「## 」 앞까지). */
function 대상표(루트) {
  const 글 = 읽기(path.join(루트, 'docs', '참고카드', 'README.md'));
  const 시작 = 글.indexOf('\n## 대상');
  if (시작 < 0) return '';
  const 끝 = 글.indexOf('\n## ', 시작 + 5);
  return 글.slice(시작 + 1, 끝 < 0 ? undefined : 끝).trim();
}

/** 결정 표 맨 위 n줄의 날짜와 대괄호 제목만. */
function 결정제목(루트, n = 30) {
  const 줄들 = 읽기(path.join(루트, 'docs', '_ops', '결정.md')).split(/\r?\n/);
  const 결과 = [];
  for (const 줄 of 줄들) {
    const m = 줄.match(/^\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*[^|]*\|\s*(\[[^\]]*\])?\s*([^|]*)/);
    if (!m) continue;
    결과.push(`- ${m[1]} ${잘라(m[2] || m[3], 110)}`);
    if (결과.length >= n) break;
  }
  return 결과.join('\n');
}

/** 트랙의 진행 줄 제목(굵은 글씨 부분). 「남은 일: 없음」으로 끝난 줄은 뺀다. 절 제목 아래로 묶는다. */
function 트랙제목(루트, 최대글자 = 12000) {
  const 줄들 = 읽기(path.join(루트, 'docs', '_ops', '트랙.md')).split(/\r?\n/);
  const 나온 = [];
  let 글자 = 0;
  for (const 줄 of 줄들) {
    const 절 = 줄.match(/^## (.+)$/);
    if (절) { 나온.push(`\n[${잘라(절[1], 40)}]`); continue; }
    const m = 줄.match(/^- \*\*(.+?)\*\*/);
    if (!m || /남은 일:\s*없음/.test(줄)) continue;
    const 한줄 = `- ${잘라(m[1].replace(/[:：]\s*$/, ''), 70)}`;
    if (글자 + 한줄.length > 최대글자) { 나온.push('- (더 있음 — 트랙은 Grep으로 낱말을 찾는다)'); break; }
    나온.push(한줄);
    글자 += 한줄.length;
  }
  // 줄이 없는 절 제목은 지운다.
  return 나온.filter((x, i) => !(x.startsWith('\n[') && (i + 1 >= 나온.length || 나온[i + 1].startsWith('\n[')))).join('\n').trim();
}

/** 지금 카드 한 줄씩(제목 · 대상 · 판단 · 상태 첫 마디). */
function 카드목록(루트) {
  let 목록 = [];
  try { 목록 = require(path.join(루트, 'tools', '참고카드_목록.js')).카드들(); } catch { return ''; }
  return 목록.filter((c) => !c.오류)
    .sort((a, b) => String(b.공유일).localeCompare(String(a.공유일)))
    .map((c) => `- ${c.공유일 || ''} ${잘라(c.제목 || c.파일, 50)} · ${c.대상 || '대상 미정'} · ${c.판단 || ''} · ${잘라(String(c.상태 || '').split(/\s+—\s+/)[0], 12)} (카드/${c.파일})`)
    .join('\n');
}

/** 판단에 줄 SYNK 지도 글 하나. */
function SYNK지도(루트) {
  return [
    '## SYNK 지도(실행기가 AI 없이 만든 요약 — 결정 표 · 트랙 · README를 통째로 읽지 말고, 더 필요하면 Grep으로 낱말을 찾는다)',
    '### 대상(카드의 대상 이름은 이 표에서만 고른다)', 대상표(루트),
    '### 결정 표 맨 위 30줄의 제목(새것이 위)', 결정제목(루트),
    '### 트랙 진행 줄 제목(절마다)', 트랙제목(루트),
    '### 지금 있는 참고 카드(새것이 위 · 제목 · 대상 · 판단 · 상태)', 카드목록(루트),
  ].join('\n\n');
}

let ffmpeg경로;
/** PATH의 ffmpeg, 없으면 WinGet 설치 자리. 못 찾으면 null(판 없이 진행한다). */
function ffmpeg찾기() {
  if (ffmpeg경로 !== undefined) return ffmpeg경로;
  const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', windowsHide: true });
  if (r.status === 0) return (ffmpeg경로 = 'ffmpeg');
  const 뿌리 = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  try {
    for (const 묶음 of fs.readdirSync(뿌리).filter((d) => /^Gyan\.FFmpeg/i.test(d))) {
      for (const 판 of fs.readdirSync(path.join(뿌리, 묶음))) {
        const exe = path.join(뿌리, 묶음, 판, 'bin', 'ffmpeg.exe');
        if (fs.existsSync(exe)) return (ffmpeg경로 = exe);
      }
    }
  } catch { /* 없음 */ }
  return (ffmpeg경로 = null);
}

/**
 * 게시물 캐시 폴더의 frames/ · images/를 여덟 칸 판으로 묶어 <방>/판/에 쓴다.
 * 돌려주는 값: [{ 판: 경로, 장: [원본 파일 이름…] }]. ffmpeg가 없거나 그림이 없으면 [].
 */
function 장면판(방, { 실행 = spawnSync } = {}) {
  const exe = ffmpeg찾기();
  if (!exe) return [];
  const 판폴더 = path.join(방, '판');
  fs.rmSync(판폴더, { recursive: true, force: true });
  const 결과 = [];
  for (const 갈래 of ['images', 'frames']) {
    let 파일들 = [];
    try { 파일들 = fs.readdirSync(path.join(방, 갈래)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort(); } catch { continue; }
    if (!파일들.length) continue;
    const [w, h] = 상자[갈래];
    const 한판 = 칸.가로 * 칸.세로;
    for (let i = 0; i < 파일들.length; i += 한판) {
      const 묶음 = 파일들.slice(i, i + 한판);
      const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tip-sheet-'));
      try {
        // 크기가 다른 그림을 한 흐름에 넣으면 ffmpeg가 거름망을 다시 세워 칸이 끊긴다 — 한 장씩 같은 상자로 맞춘 뒤 묶는다.
        묶음.forEach((f, k) => {
          const r = 실행(exe, ['-y', '-loglevel', 'error', '-i', path.join(방, 갈래, f),
            '-vf', `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black`,
            '-frames:v', '1', path.join(임시, `${String(k + 1).padStart(3, '0')}.png`)], { windowsHide: true });
          if (r.status !== 0) throw new Error(`장면 맞추기 실패: ${f}`);
        });
        fs.mkdirSync(판폴더, { recursive: true });
        const 판 = path.join(판폴더, `${갈래 === 'images' ? '장' : '장면'}-${String(i / 한판 + 1).padStart(2, '0')}.jpg`);
        const r = 실행(exe, ['-y', '-loglevel', 'error', '-start_number', '1', '-i', path.join(임시, '%03d.png'),
          '-vf', `tile=${칸.가로}x${칸.세로}:padding=4:color=white`, '-frames:v', '1', '-q:v', '3', 판], { windowsHide: true });
        if (r.status !== 0 || !fs.existsSync(판)) throw new Error('판 묶기 실패');
        결과.push({ 판, 장: 묶음.map((f) => `${갈래}/${f}`) });
      } catch {
        // 판을 못 만들면 원본 장면을 그대로 보게 둔다.
      } finally {
        fs.rmSync(임시, { recursive: true, force: true });
      }
    }
  }
  return 결과;
}

/** 줄마다 판단 자료(재료 위치 · 본문 · 받아쓰기 앞부분 · 장면 판). */
function 줄자료(캐시, 줄, { 판만들기 = 장면판 } = {}) {
  const id = String(줄.게시물ID || '');
  if (!/^[\w-]+$/.test(id)) return { row: 줄.row, 게시물ID: id, 재료: '캐시 폴더 없음(장부 내용만으로 판단)' };
  const 방 = path.join(캐시, id);
  if (!fs.existsSync(방)) return { row: 줄.row, 게시물ID: id, 재료: '캐시 폴더 없음(장부 내용만으로 판단)' };
  const 판들 = (() => { try { return 판만들기(방); } catch { return []; } })();
  const 받아쓰기 = 읽기(path.join(방, 'transcript.txt'));
  return {
    row: 줄.row, 게시물ID: id, 폴더: 방.split(path.sep).join('/'),
    본문: 잘라(읽기(path.join(방, 'caption.txt')), 2500),
    받아쓰기: 받아쓰기.length > 3000 ? `${잘라(받아쓰기, 3000)} (전체: transcript.txt)` : 받아쓰기.trim(),
    영상: fs.readdirSync(방).filter((f) => /^video(-\d+)?\.mp4$/i.test(f)),
    장면판: 판들.map((p) => ({ 판: p.판.split(path.sep).join('/'), 장: p.장 })),
  };
}

module.exports = { SYNK지도, 장면판, 줄자료, 결정제목, 트랙제목, 대상표, 카드목록, 잘라 };
