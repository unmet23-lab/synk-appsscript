// 댓글에 달린 몽골 이름을 synk.im/name 과 같은 변환으로 한글로 바꿔 답글 줄을 만든다.
// 문구가 「Нэрээ сэтгэгдэлд бичээрэй — солонгосоор нь бичээд хариулъя」(이름을 쓰면 한국어로 답해 준다)라서,
// 첫 1시간 안에 댓글마다 이 줄로 답하면 된다.
// 실행: node 게시/댓글이름.cjs Батбаяр Оюунчимэг …   또는   node 게시/댓글이름.cjs --파일 이름들.txt (한 줄에 하나)
// 변환 코드는 공개 페이지(https://synk.im/name/)에서 그때그때 읽는다 — 페이지와 답글이 어긋나지 않게.
// Node 기본 fetch는 synk.im의 새 Let's Encrypt 루트(YR) 경로를 못 따라가 실패해서(10-03) curl로 읽는다.
const vm = require('vm');
const fs = require('fs');
const { execFileSync } = require('child_process');

(async () => {
  const html = execFileSync('curl', ['-sSfL', '--max-time', '20', 'https://synk.im/name/'], { encoding: 'utf8' });
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  const cut = m ? m[1].indexOf('var $src = document.getElementById') : -1;
  if (cut < 0) throw new Error('변환 코드를 못 찾음 — synk.im/name 페이지 구조가 바뀌었다');
  const ctx = vm.createContext({});
  vm.runInContext(m[1].slice(0, cut) + '\n  globalThis.__convert = convert;\n})();', ctx);
  const args = process.argv.slice(2);
  const names = args[0] === '--파일'
    ? fs.readFileSync(args[1], 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    : args;
  if (!names.length) throw new Error('이름을 하나 이상 주세요');
  for (const nm of names) {
    const a = ctx.__convert(nm, false), b = ctx.__convert(nm, true);
    console.log(`${nm} → ${a}${b !== a ? ` (${b})` : ''} ✨`);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
