// 두 TAP(바탕 T0 · 후보 T1)의 깨진 시험을 이름으로 견준다. 시험 이름 = 파일 안 이름(숫자 빼고).
const fs=require('node:fs');
const read=f=>{const t=fs.readFileSync(f,'utf8').split('\n');const fail=new Set(),pass=new Set();for(const l of t){const m=/^(?:\s*)(not ok|ok) \d+ - (.*)$/.exec(l);if(!m)continue;const name=m[2].replace(/ # .*$/,'').trim();(m[1]==='ok'?pass:fail).add(name);}return {fail,pass};};
const [a,b]=process.argv.slice(2).map(read);
const onlyB=[...b.fail].filter(n=>!a.fail.has(n)),onlyA=[...a.fail].filter(n=>!b.fail.has(n));
console.log('T0 깨짐',a.fail.size,'통과',a.pass.size,'· T1 깨짐',b.fail.size,'통과',b.pass.size);
console.log('\nT1에서만 깨짐',onlyB.length);for(const n of onlyB)console.log('  -',n.slice(0,170),a.pass.has(n)?'(T0 통과)':'(T0에 없음)');
console.log('\nT0에서만 깨짐',onlyA.length);for(const n of onlyA)console.log('  -',n.slice(0,170),b.pass.has(n)?'(T1 통과)':'(T1에 없음)');
