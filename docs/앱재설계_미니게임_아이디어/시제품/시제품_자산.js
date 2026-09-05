// 시제품용 자산 묶기 — 구운 펠트 그림을 폰 크기 webp 로 줄여 data URI JSON 으로 낸다.
// 돌리기: NODE_PATH=../SYNK-talk/node_modules node 이파일.js  (cwd = SYNK-appsscript)
'use strict';
const fs = require('fs'); const path = require('path');
const sharp = require('sharp');
const ROOT = 'C:/Users/q1212/Documents/SYNK-appsscript';
const TALK = 'C:/Users/q1212/Documents/SYNK-talk';
const 구움 = path.join(ROOT, 'docs/Loom_자산/구움');
const 자모 = path.join(ROOT, 'docs/캐릭터/요소공방_0822/자모');
const 정본 = path.join(ROOT, 'docs/캐릭터/정본_4K');
const OUT = path.join('C:/Users/q1212/AppData/Local/Temp/claude/C--Users-q1212-Documents-SYNK-appsscript/ef5867ae-272d-48fa-8e49-e0ad5b3ac9e4/scratchpad', '시제품_자산.json');

function 찾기(폴더, 이름) {
  for (const ext of ['.png', '.webp', '.avif']) { const p = path.join(폴더, 이름 + ext); if (fs.existsSync(p)) return p; }
  return null;
}
function 정본찾기(누구, 표정) {
  const files = fs.readdirSync(정본).filter((f) => f.includes(누구) && f.includes(표정) && /\.(png|webp|avif)$/i.test(f));
  files.sort((a, b) => a.length - b.length);
  return files[0] ? path.join(정본, files[0]) : null;
}
const 목록 = [
  // [키, 경로, 너비]
  ['바탕_종이', 찾기(구움, '펠트_종이바탕'), 900], ['바탕_메도우', 찾기(구움, '공방_메도우펠트'), 900], ['바탕_버터', 찾기(구움, '공방_버터펠트'), 900],
  ['바탕_라피스', 찾기(구움, '공방_라피스펠트'), 900], ['바탕_누빔', 찾기(구움, '공방_누빔퀼팅천'), 900], ['바탕_어두운판', 찾기(구움, '펠트_어두운판'), 900],
  ['화살', 찾기(구움, '공방_굽은화살'), 360], ['바늘실', 찾기(구움, '공방_바늘과실'), 360], ['실타래', 찾기(구움, '시험_펠트_실타래'), 360],
  ['깃발', 찾기(구움, '공방_작은깃발'), 240], ['반짝임', 찾기(구움, '공방_반짝임'), 240], ['폭죽', 찾기(구움, '공방_폭죽'), 320],
  ['도장', 찾기(구움, '공방_완료도장'), 320], ['참잘했어요', 찾기(구움, '공방_참잘했어요'), 360], ['체크', 찾기(구움, '공방_체크표시'), 240],
  ['물음표', 찾기(구움, '공방_물음표'), 240], ['네모말풍선', 찾기(구움, '공방_네모말풍선'), 480], ['둥근말풍선', 찾기(구움, '공방_둥근말풍선'), 480],
  ['원판', 찾기(구움, '원판'), 420], ['단추', 찾기(구움, '단추민판'), 240], ['폼폼', 찾기(구움, '요소_폼폼_몸'), 300], ['폼폼방울', 찾기(구움, '폼폼민방울'), 300],
  ['마이크', 찾기(구움, '공방_마이크'), 240], ['소리', 찾기(구움, '공방_소리'), 240], ['매듭끈', 찾기(구움, '공방_매듭끈'), 360], ['시침핀꽂이', 찾기(구움, '공방_시침핀꽂이'), 300],
  ['게이지', 찾기(구움, '요소_게이지_몸'), 420], ['말풍선요소', 찾기(구움, '요소_말풍선_몸'), 420], ['하트', 찾기(구움, '요소_하트_몸'), 200], ['별', 찾기(구움, '요소_별_몸'), 200],
  ['자_ㅅ', 찾기(자모, 'ㅅ'), 160], ['자_ㅇ', 찾기(자모, 'ㅇ'), 160], ['자_ㄱ', 찾기(자모, 'ㄱ'), 160], ['자_ㄴ', 찾기(자모, 'ㄴ'), 160], ['자_ㅎ', 찾기(자모, 'ㅎ'), 160], ['자_ㅈ', 찾기(자모, 'ㅈ'), 160], ['자_ㄲ', 찾기(자모, 'ㄲ'), 160],
  ['몽글_본체', 정본찾기('몽글', '본체'), 420], ['몽글_눈웃음', 정본찾기('몽글', '눈웃음'), 420], ['몽글_놀람', 정본찾기('몽글', '놀람'), 420],
  ['까몽_본체', 정본찾기('까몽', '본체'), 420], ['까몽_윙크', 정본찾기('까몽', '윙크'), 420],
];
const NPC = ['prof-calm', 'prof-lean', 'prof-win', 'boss-calm', 'boss-lean', 'boss-win', 'lead-calm', 'lead-lean', 'lead-win', 'insp-calm', 'insp-lean', 'insp-win'];
const 소리들 = [
  ['소_먹었어요', path.join(ROOT, 'docs/소리/발음본보기/01_연음_먹었어요.wav')],
  ['소_좋네요', path.join(ROOT, 'docs/소리/발음본보기/08_비음화_좋네요.wav')],
  ['소_책상', path.join(ROOT, 'docs/소리/발음본보기/10_경음화_책상.wav')],
  ['소_많았어요', path.join(ROOT, 'docs/소리/발음본보기/05_연음_많았어요.wav')],
  ['fx_earn', path.join(TALK, 'assets/sfx/synk-sound-earn.wav')],
  ['fx_achieve', path.join(TALK, 'assets/sfx/synk-sound-achieve.wav')],
  ['fx_notify', path.join(TALK, 'assets/sfx/synk-sound-notify.wav')],
];
(async () => {
  const out = {}; const 없음 = []; let 합 = 0;
  for (const [키, p, w] of 목록) {
    if (!p) { 없음.push(키); continue; }
    try {
      const buf = await sharp(p).resize({ width: w, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
      out[키] = 'data:image/webp;base64,' + buf.toString('base64'); 합 += buf.length;
    } catch (e) { 없음.push(키 + '(' + e.message.slice(0, 60) + ')'); }
  }
  for (const n of NPC) {
    const p = path.join(TALK, 'assets/npc', n + '.webp');
    if (!fs.existsSync(p)) { 없음.push(n); continue; }
    const buf = fs.readFileSync(p); out['npc_' + n.replace('-', '_')] = 'data:image/webp;base64,' + buf.toString('base64'); 합 += buf.length;
  }
  for (const [키, p] of 소리들) {
    if (!fs.existsSync(p)) { 없음.push(키); continue; }
    const buf = fs.readFileSync(p); out[키] = 'data:audio/wav;base64,' + buf.toString('base64'); 합 += buf.length;
  }
  fs.writeFileSync(OUT, JSON.stringify(out), 'utf8');
  console.log('자산', Object.keys(out).length, '개 · 원본 합', (합 / 1024 / 1024).toFixed(2), 'MB · base64 뒤 약', (합 * 1.37 / 1024 / 1024).toFixed(2), 'MB');
  console.log('없음:', 없음.join(' · ') || '0');
})();
