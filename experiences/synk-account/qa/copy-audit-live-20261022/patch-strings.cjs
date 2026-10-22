// 공개 중인 계정 묶음(synk-policy origin/main 318a90b)에 플랫폼 글 전수조사의 남은 글만 얹는다.
// 배포 담당(641fb16·bb5126e)이 모듈 단위로 옮기지 못한 자리 — 공개본 앱 목록(WORLD·Workspace)·WORLD 소개의 게임 줄·계정 라이브러리 안내·제품 이름.
// 코드는 그대로 두고 문자열 값만 master 원천(experiences/synk-account/src) 글로 바꾼다. 자리마다 정한 횟수만큼 있어야 바꾼다.
// 묶음이 바뀌면 그 묶음을 부르는 HTML의 ?v=(sha256 앞 12자)도 새 값으로 맞춘다(공개.js도 「토큰」으로 갱신한다).
// node patch-strings.cjs <바탕 폴더> <후보 폴더> — 바탕은 공개본 넷(account__dist__platform.js·account__platform.html·id__dist__app.js·id__index.html,
// `git -C ../synk-policy show origin/main:<경로>`로 받은 바이트 그대로). 10-22 공개: synk-policy 7f62c9c, 확인은 같은 폴더 compare-live.cjs candidate.
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const [baseArg, outArg] = process.argv.slice(2);
if (!baseArg || !outArg) throw Error('node patch-strings.cjs <바탕 폴더> <후보 폴더>');
const base = path.resolve(baseArg), out = path.resolve(outArg);
fs.mkdirSync(out, { recursive: true });
const sha12 = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);
const read = n => fs.readFileSync(path.join(base, n), 'utf8');
const edits = {
  'account__dist__platform.js': [
    // 앱 목록 — WORLD (applications.mjs world: subtitle·description·available)
    ['subtitle:"놀면서 배우는 나의 세계"', 'subtitle:"한국어 게임과 TOPIK 연습"', 1],
    ['description:"레이싱에서 익힌 말이 마을의 대화로 이어지는 곳. 미니게임, SYNK TOWN, 숙제와 AI 코칭을 한 앱에서 만나요."', 'description:"TOPIK 진단부터 쓰기 연습, 한국어 게임까지 들어 있어요. 내 연습 기록에 맞춰 다음 연습을 골라 줘요."', 1],
    ['available:"네 가지 미니게임의 웹 체험을 사용할 수 있어요. Town·숙제·AI 코칭의 데스크톱 제공 시점은 별도 안내합니다."', 'available:"미니게임은 설치 없이 웹에서 바로 할 수 있어요."', 1],
    // 앱 목록 — Workspace (applications.mjs messenger: name·subtitle·audience·tags·description·available)
    ['name:"SYNK 사내 메신저",category:"work",subtitle:"대화에서 시작되는 팀의 하루",audience:"초대받은 회사 구성원",image:"laptop-felt.webp",tags:["업무","팀 대화","파일","협업"],description:"팀 대화, 공유 파일, 업무 협업을 연결하는 회사의 공간. 회사가 초대한 구성원이 자신의 권한 안에서 함께 일해요.",available:"기존 회사 웹 서비스에 연결해요. 회사 초대·로그인이 필요하며, 일반 SYNK 회원 가입만으로 접근 권한을 주지 않아요."',
     'name:"SYNK Workspace",category:"work",subtitle:"팀이 대화하고 일하는 업무 앱",audience:"SYNK 회사 구성원과 담당 교사",image:"laptop-felt.webp",tags:["워크스페이스","업무","내 수업","교사","팀 대화","파일","협업"],description:"채널 대화와 회사 자료, 작업실이 한 앱에 있어요. 교사는 「내 수업」에서 맡은 반을 챙겨요.",available:"회사 일은 회사 초대를 받아야, 내 수업은 반을 맡은 교사로 등록돼야 열려요. SYNK ID만으로는 들어갈 수 없어요."', 1],
    // WORLD 소개의 게임 줄(platform.mjs — 레이싱은 끝난 게임, 지금 게임 셋은 바람길·말의 리듬·한글 만나기)
    ['<span>레이싱, 말의 리듬, 주문 폭주 같은 게임을 웹에서 바로 해요.</span>', '<span>바람길·말의 리듬·한글 만나기 같은 게임을 웹에서 바로 해요.</span>', 1],
    // 계정 라이브러리 안내 — 로그인 전·연결 전 모두에 맞는 한 줄(master의 nextStep() 로그인 뒤 줄과 같은 글)
    ['"즐겨찾기와 다음에 할 일을 같은 SYNK ID로 이어가세요."', '"즐겨찾기와 할 일 메모를 계정에 저장해 다른 기기에서도 봐요."', 1],
    // 제품 이름(core.mjs PRODUCTS) — 사이드바·새소식과 같은 SYNK Workspace
    ['messenger:"SYNK 사내 메신저"', 'messenger:"SYNK Workspace"', 1],
  ],
  'id__dist__app.js': [
    ['messenger:"SYNK 사내 메신저"', 'messenger:"SYNK Workspace"', 1],
  ],
};
const result = {};
for (const [name, list] of Object.entries(edits)) {
  let s = read(name);
  const before = sha12(fs.readFileSync(path.join(base, name)));
  for (const [a, b, count] of list) {
    const c = s.split(a).length - 1;
    if (c !== count) throw Error(name + ': expected ' + count + ' of ' + a.slice(0, 60) + ', found ' + c);
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path.join(out, name), s);
  result[name] = { before, after: sha12(Buffer.from(s, 'utf8')), edits: list.length };
}
// HTML의 ?v= 맞추기
const html = [['account__platform.html', './dist/platform.js?v=', 'account__dist__platform.js'], ['id__index.html', './dist/app.js?v=', 'id__dist__app.js']];
for (const [name, prefix, bundle] of html) {
  let s = read(name);
  const from = prefix + result[bundle].before, to = prefix + result[bundle].after;
  const c = s.split(from).length - 1;
  if (c !== 1) throw Error(name + ': expected one ' + from + ', found ' + c);
  fs.writeFileSync(path.join(out, name), s.replace(from, to));
  result[name] = { from, to };
}
console.log(JSON.stringify(result, null, 1));
