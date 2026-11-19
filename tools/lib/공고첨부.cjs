'use strict';
/**
 * 공모 공고의 첨부 · 본문 그림에서 글을 얻는다(2026-11-20).
 *
 * 왜: 공고 본문이 포스터 그림 한 장이거나 응모 자격 · 마감 · 제출물이 첨부 PDF · HWP에만 있는 공고가 많다.
 *   11-20 자격 확인에서 「확인 필요」 33건 가운데 22건이 그랬다(유호님 11-20 「다섯 개 다 해」 가운데 둘째).
 *
 * 하는 일:
 *   1. 공고 쪽 HTML에서 첨부 링크(.pdf · .hwp · .hwpx · 게시판 내려받기)와 본문 그림을 찾는다.
 *      로고 · 아이콘 · 단추 같은 틀 그림은 뺀다. 모집 공고 · 요강을 앞에, 신청서 · 서식을 뒤에 둔다.
 *   2. 쪽을 볼 때 받은 쿠키와 그 쪽 주소(referer)를 붙여 받는다. 게시판 첨부는 쪽을 본 세션으로만 받힌다.
 *   3. tools/공고첨부글.py가 이 PC 안에서 글을 뽑는다(PDF 글 · HWP · 윈도우 글자 인식). 파일은 바깥 AI로 보내지 않는다.
 * 시험: node --test tests/공고첨부.test.js
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const 첨부글도구 = path.join(ROOT, 'tools', '공고첨부글.py');
const 첨부꼴 = /\.(pdf|hwpx?|png|jpe?g|webp)(\?|$)|download|filedown|file_down|fileDown|atchFile|getFile|attach/i;
const 틀그림 = /logo|icon|ico_|_ico|btn|bullet|banner|theme\/|skin\/|common\/|layout|sns|blank|spacer|arrow|top_|sub_top|footer|header|\.svg|\.gif|qr|instagram|youtube|facebook|kakao|twitter|naver|(^|\/)x\.png|sidebar|newsletter|avatar|profile/i;
const 앞이름 = /공고|모집|요강|안내|공모|포스터|개요/;
const 뒷이름 = /신청서|서식|양식|동의서|확인서|서약서|위임장/;

const 풀기 = s => String(s || '').replace(/&amp;/g, '&').replace(/&#0?38;/g, '&').trim();
const 글만 = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** HTML에서 첨부 링크와 본문 그림을 찾는다. → [{ url, 이름, 종류: '첨부'|'그림' }] (첨부 먼저). */
function 첨부찾기(html, 기준주소, { 최대첨부 = 3, 최대그림 = 3 } = {}) {
  const h = String(html || '');
  const 첨부 = [], 그림 = [], 본 = new Set();
  const 넣기 = (목록, href, 이름, 종류) => {
    let url;
    try { url = new URL(풀기(href), 기준주소).href; } catch { return; }
    if (!/^https?:/i.test(url) || 본.has(url)) return;
    본.add(url);
    목록.push({ url, 이름: 이름.slice(0, 120), 종류 });
  };
  for (const m of h.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]{0,400}?)<\/a>/gi)) {
    const href = m[1], 이름 = 글만(m[2]);
    if (/^(javascript|mailto|tel):/i.test(href)) continue;
    if (!(첨부꼴.test(href) || /\.(pdf|hwpx?)\b/i.test(이름))) continue;
    if (/\.(zip|xlsx?|docx?|pptx?|mp4|mov)\b/i.test(href + ' ' + 이름) || /whale|chrome|browser|브라우저|뷰어 내려받기|viewer/i.test(이름)) continue;
    넣기(첨부, href, 이름, '첨부');
  }
  for (const m of h.matchAll(/<img\b[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const src = m[1];
    if (/^data:/i.test(src) || 틀그림.test(src)) continue;
    넣기(그림, src, path.basename(src.split('?')[0]), '그림');
  }
  const 순서 = x => (앞이름.test(x.이름) ? 0 : 뒷이름.test(x.이름) ? 2 : 1);
  첨부.sort((a, b) => 순서(a) - 순서(b));
  // 그림은 편집기 · 올림 자리를 앞에 둔다(본문에 붙인 공고 포스터).
  그림.sort((a, b) => Number(!/editor|upload|data\/|attach|board|bbs|files?\//i.test(a.url)) - Number(!/editor|upload|data\/|attach|board|bbs|files?\//i.test(b.url)));
  return [...첨부.slice(0, 최대첨부), ...그림.slice(0, 최대그림)];
}

/** 파일 머리로 형식을 가린다. 글을 뽑을 수 없는 형식이면 ''. */
function 형식가리기(몸) {
  const b = Buffer.from(몸 || []);
  if (b.subarray(0, 4).toString('latin1') === '%PDF') return 'pdf';
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return 'hwp';
  if (b[0] === 0x50 && b[1] === 0x4b) return b.includes(Buffer.from('hwpml')) || b.includes(Buffer.from('Contents/')) ? 'hwpx' : '';
  if (b[0] === 0x89 && b.subarray(1, 4).toString('latin1') === 'PNG') return '그림';
  if (b[0] === 0xff && b[1] === 0xd8) return '그림';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return '그림';
  return '';
}

/** 받은 파일에서 글을 뽑는다(tools/공고첨부글.py). 파일은 새 빈 임시 폴더에 둔다. */
function 파일글(몸, 형식, { 시한 = 180000 } = {}) {
  return new Promise((resolve, reject) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-att-'));
    const file = path.join(dir, '첨부.bin');
    fs.writeFileSync(file, 몸);
    const py = process.env.SYNK_PYTHON || 'python';
    const 자식 = spawn(py, ['-I', '-X', 'utf8', 첨부글도구, file, '--형식', 형식], { cwd: dir, windowsHide: true });
    const 나온 = [], 오류 = [];
    const 시계 = setTimeout(() => 자식.kill(), 시한);
    자식.stdout.on('data', c => 나온.push(c));
    자식.stderr.on('data', c => 오류.push(c));
    자식.on('error', e => { clearTimeout(시계); fs.rmSync(dir, { recursive: true, force: true }); reject(e); });
    자식.on('close', code => {
      clearTimeout(시계);
      fs.rmSync(dir, { recursive: true, force: true });
      if (code === 0) return resolve(Buffer.concat(나온).toString('utf8'));
      return reject(Error('첨부 글 뽑기 실패: ' + Buffer.concat(오류).toString('utf8').trim().split('\n').pop().slice(0, 160)));
    });
  });
}

/**
 * 공고 쪽(이미 읽은 HTML과 쿠키)의 첨부 · 본문 그림을 차례로 받아 글을 뽑는다.
 * 고르기(글)가 참을 돌려주는 글이 나오면 거기서 멈춘다(자격 문장을 찾으면 그만 받는다).
 * → { 글, 출처: { url, 이름, 종류 } | null, 본: [{ 이름, 까닭? }] }
 */
async function 첨부글읽기(page, 기준주소, { fetchPage, 뽑기 = 파일글, 고르기 = t => !!t, until = Infinity, 최대첨부, 최대그림 } = {}) {
  if (!fetchPage) fetchPage = require('./공개쪽읽기.js').읽기;
  const 본 = [];
  for (const 것 of 첨부찾기(page?.글, 기준주소, { 최대첨부, 최대그림 })) {
    if (Date.now() > until) { 본.push({ 이름: 것.이름, 까닭: '시간이 모자라 건너뜀' }); break; }
    const r = await Promise.resolve(fetchPage(것.url, { 전체시한: 40000, 시한: 20000, 최대바이트: 15_000_000, 받을형식: ['*/*'], 쿠키: page?.쿠키 || {}, 참조: 기준주소 })).catch(() => null);
    if (!r?.됨 || !r.바이너리) { 본.push({ 이름: 것.이름, 까닭: r?.까닭 || '받지 못했다' }); continue; }
    const 형식 = 형식가리기(r.몸);
    if (!형식) { 본.push({ 이름: 것.이름, 까닭: '글을 뽑을 수 없는 형식' }); continue; }
    let 글 = '';
    try { 글 = await 뽑기(r.몸, 형식); } catch (e) { 본.push({ 이름: 것.이름, 까닭: e.message }); continue; }
    본.push({ 이름: r.파일이름 || 것.이름 });
    if (고르기(글)) return { 글, 출처: { url: 것.url, 이름: r.파일이름 || 것.이름, 종류: 것.종류 }, 본 };
  }
  return { 글: '', 출처: null, 본 };
}

module.exports = { 첨부찾기, 형식가리기, 파일글, 첨부글읽기 };
