'use strict';
// 조건 1(설계 주인 11-23): 깃발이 잘못 켜져 새 길 입구가 없을 때(404) — 면은 지금 판으로 가고(부르는 곳이 이미 그렇다), 입구 실패는 계기에
// 한 번만 남긴다(load · ENTRY_IMPORT). 입구를 받기 전의 계기는 셸의 health()로도 읽는다(window.__synkWorld.atlas()).
//   node edit-entry404.cjs <app-shell.mjs가 있는 폴더(master experiences/synk-world-app 또는 후보 원본 world)>
const fs = require('node:fs'), path = require('node:path');
const file = path.join(process.argv[2], 'app-shell.mjs');
let s = fs.readFileSync(file, 'utf8');
const crlf = s.includes('\r\n'), eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
const rep = (find, repl) => { const f = eol(find); const n = s.split(f).length - 1; if (n !== 1) throw Error(`${n}번: ${find.slice(0, 90)}`); s = s.replace(f, () => eol(repl)); };

rep(`// 새 길 코치 · 호스트가 남지 않게(11-12 화면 검수 A6). 받기가 실패하면 다음에 다시 받는다.
`, `// 새 길 코치 · 호스트가 남지 않게(11-12 화면 검수 A6). 받기가 실패하면 다음에 다시 받는다. 첫 실패는 계기에 한 번 남긴다(load · ENTRY_IMPORT —
// 깃발이 잘못 켜져 입구가 없을 때(404)도 부르는 곳은 지금 판으로 가고, 브라우저는 실패한 모듈을 문서 안에서 다시 받지 않는다. 설계 주인 11-23 조건 1).
`);
rep(` let made=null,loading=null,disposed=false,gaveOld=false;const reopeners=new Set(),early=[];`,
 ` let made=null,loading=null,disposed=false,gaveOld=false,entryFailed=false;const reopeners=new Set(),early=[];`);
rep(`error=>{loading=null;gaveOld=true;throw error;});`,
 `error=>{loading=null;gaveOld=true;if(!entryFailed&&!disposed){entryFailed=true;early.push(['load',{ok:false,code:'ENTRY_IMPORT'}]);}throw error;});`);
rep(`  health:()=>made?.health()??null,`,
 `  // 계기 — 입구를 받기 전(못 받았을 때 포함)에는 모은 계기를 입구의 health()와 같은 꼴(early)로 준다.
  health:()=>made?.health()??{early:early.map(([kind,outcome])=>({kind,...outcome}))},`);
rep(`window.__synkWorld={client,screen:()=>screen,wardrobe:()=>wardrobeStudio?.metrics(),life:()=>life.ui?.metrics()};`,
 `window.__synkWorld={client,screen:()=>screen,wardrobe:()=>wardrobeStudio?.metrics(),life:()=>life.ui?.metrics(),atlas:()=>life.atlasNext?.health?.()??null};`);
fs.writeFileSync(file, s);
console.log('입구 실패 계기 고침:', file);
