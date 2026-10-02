const fs=require('fs'),path=require('path'),cp=require('child_process');
const sourcePath=path.join(__dirname,'../평면도_20260929/공간과_편의시설_좌표_6안.json');
const fragment='C:/Users/q1212/.codex/visualizations/2026/09/27/01a0e247-e6df-7b72-af5d-20238b73ce68/synk-academy-3d-concept.html';
const preview=path.join(__dirname,'synk-academy-3d-preview.html');
const data=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
let html=fs.readFileSync(fragment,'utf8');
html=html.replace(/(<script type="application\/json" id="s3-data">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+JSON.stringify(data)+b);
fs.writeFileSync(fragment,html);
if(Buffer.byteLength(html)>1000000)throw new Error('Inline fragment exceeds1MB');
cp.execFileSync('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',['C:/Users/q1212/.codex/plugins/cache/openai-bundled/visualize/1.0.45/skills/visualize/scripts/render.py',fragment,preview,'--force'],{stdio:'pipe'});
console.log(JSON.stringify({fragment,preview,bytes:Buffer.byteLength(html),sourceRevision:data.revision}));

// Keep the standalone entry explicit about the historical geometry.
const currentNotice='<aside id="current-scope" style="max-width:72rem;margin:0 auto 1rem;font:14px/1.6 system-ui"><strong>이전6안 전체3D · 현재 A+B 가변 교실 미반영</strong><p>81평·A20평 형상의 비교 자료입니다. 현재는 신청25명 댄스·A+B32세트 외부수납을 검토하며 새 전체3D/CAD/견적은 미완료입니다. 무료 자습은 빈 교실 예약이고 하루 약2~3시간은 예상입니다. <a href="../오프라인_운영기준_20261002.md">현행 운영 기준</a> · <a href="../평면도_20260929/공간과_촬영_통합설계.md#flex-classroom-20261002">현재 A+B 구획</a></p></aside>';
let standalone=fs.readFileSync(preview,'utf8');
standalone=standalone.replace('<body>','<body>'+currentNotice);
fs.writeFileSync(preview,standalone);
