// 공개본 위에 AI 구독 계정판 소개 문구 고침(10-18, desktop/renderer/benefits.mjs와 같은 글)만 얹는다.
// 10-18 계정판이 「한눈에 보기 + 계정 관리」로 바뀌어 소개 첫 칸(옛 「지금 볼 것」)·설명(「한 화면에」)이 낡았고, 셋째 칸
// 「로그인 정보는 이 PC 밖으로 나가지 않아요」는 기획 「정보 품질」과 어긋났다. 각 원문이 공개본에 정확히 한 번 있는지 보고 바꾸고,
// platform.html의 platform.js ?v=를 새 번들 sha256 앞 12자로 바꾼다(현장 노트 배포·공개 「?v=도 같이」).
//   node patch-live-subscription-intro.cjs <공개본 platform.js> <공개본 platform.html> <후보 폴더>
//   → <후보 폴더>/account/dist/platform.js · <후보 폴더>/account/platform.html (check.mjs의 SYNK_CANDIDATE_DIR로 그대로 쓴다)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const [jsPath, htmlPath, outDir] = process.argv.slice(2);
if (!jsPath || !htmlPath || !outDir) throw Error('사용: node patch-live-subscription-intro.cjs <platform.js> <platform.html> <후보 폴더>');
const once = (s, a, b) => { const n = s.split(a).length - 1; if (n !== 1) throw Error(`expected one occurrence, found ${n}: ${a.slice(0, 50)}`); return s.replace(a, () => b); };
const sha12 = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);

let js = fs.readFileSync(jsPath, 'utf8');
const liveSha = sha12(fs.readFileSync(jsPath));
for (const [a, b] of [
  ['연결한 AI 계정의 남은 한도와 초기화 시각, 결제일과 구독료를 한 화면에 모아요.',
   '연결한 AI 계정의 남은 사용량과 초기화 시각을 한눈에 보고, 결제일과 구독료도 함께 챙겨요.'],
  ['"title":"지금 볼 것만 맨 위에","body":"다 쓴 계정, 90% 넘은 한도, 부족한 크레딧, 3일 안 결제만 먼저 보여 줘요."',
   '"title":"지금 쓸 계정부터","body":"서비스마다 남은 게 가장 많은 계정을 먼저 보여 주고, 다 쓴 계정이 언제 풀리는지 가까운 순서로 알려 줘요."'],
  ['설치 확인부터 로그인 코드 붙여넣기까지 단계마다 알려 줘요. 로그인 정보는 이 PC 밖으로 나가지 않아요.',
   '설치 확인부터 로그인까지 단계마다 알려 줘요. 토큰 파일은 열지 않고, 각 서비스가 공식으로 알려 주는 숫자만 모아요.'],
  ['자동으로 읽을 계정은 해당 서비스의 공식 프로그램을 PC에 설치하고 연결해요.',
   '자동으로 읽을 계정은 해당 서비스의 공식 프로그램을 PC에 설치하거나 API 키를 넣어 연결해요.'],
]) js = once(js, a, b);
new Function(js); // 문법 확인
const jsOut = Buffer.from(js, 'utf8');
const newSha = sha12(jsOut);

let html = fs.readFileSync(htmlPath, 'utf8');
html = once(html, `platform.js?v=${liveSha}`, `platform.js?v=${newSha}`);

fs.mkdirSync(path.join(outDir, 'account/dist'), { recursive: true });
fs.writeFileSync(path.join(outDir, 'account/dist/platform.js'), jsOut);
fs.writeFileSync(path.join(outDir, 'account/platform.html'), html);
console.log(JSON.stringify({ bundle: { from: liveSha, to: newSha, bytes: [Buffer.byteLength(fs.readFileSync(jsPath)), jsOut.length] }, html: `platform.js?v=${newSha}` }));
