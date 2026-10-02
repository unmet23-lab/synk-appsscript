import fs from 'node:fs';
let source=fs.readFileSync('../video-v4/build.mjs','utf8');
const scenes=`
const workScenes=[
{id:'work',duration:7,step:'반복해서 쓰는 방법',title:'다음 회의에도 쓸 거라면<br>Work를 활용해보세요.',caption:'Work는 자료를 읽고, 표나 문서 같은 결과물을 만드는 작업 모드예요.',body:\`<div class="work-screen">\${shot('work-home',275,5,780,470,76,530,928)}</div><div class="work-flow"><div>회의 메모</div><span>→</span><div>Work</div><span>→</span><div>검토할 표</div></div>\${note('이번에는 회의 정리 방법을<br>다음에도 쓸 수 있게 저장해볼게요.',76,1230)}\`},
{id:'skill',duration:7,step:'Work와 스킬은 달라요',title:'스킬은 저장해 두는<br>작업 지침이에요.',caption:'Work가 일하는 공간이라면, 스킬은 그때 꺼내 쓰는 작업 지침이에요. 긴 요청을 반복하지 않아도 되죠.',body:\`<div class="recipe"><div class="recipe-label">회의 정리 스킬</div><div class="recipe-rule">① 할 일 · 담당자 · 기한 · 근거</div><div class="recipe-rule">② 없는 정보는 ‘확인 필요’</div><div class="recipe-rule">③ 제안은 질문으로 분리</div></div><div class="repeat-row"><div>한 번 저장</div><span>→</span><div>다음엔 메모만</div></div>\${label('Work를 켜는 것만으로 지침이 저장되지는 않아요.',76,1310,'blue')}\`},
{id:'work-open',duration:7,step:'한 번만 설정하기 · 데스크톱 앱 기준',title:'Work에서<br>스킬 만들기를 시작해요.',caption:'데스크톱 앱에서 Work를 열고, 입력창에 @를 쳐서 skill-creator를 찾아 선택하세요.',body:\`\${label('공식 문서에 따른 설정 순서 · 화면 재현이 아닌 설명 도식',76,533)}<div class="setup-step"><span>1</span><div>ChatGPT 데스크톱 앱 열기</div></div><div class="setup-step second"><span>2</span><div>Work 선택</div></div><div class="mention"><small>입력창에서 @ 입력 → 목록에서 선택</small><b>@skill-creator</b><p>스킬을 만드는 도우미</p></div>\${label('보이지 않으면 PDF의 ‘막혔을 때’를 확인하세요.',76,1328,'blue')}\`},
{id:'create-skill',duration:9,step:'한 번만 설정하기 · 생성 요청',title:'이 요청을 보내면<br>저장할 지침을 만들어요.',caption:'work-setup.txt를 한 번만 보내세요. 무엇을 만들지 물으면 “글로 된 지침만, 회의 정리용”이라고 답하면 돼요.',body:\`<div class="setup-request"><small>work-setup.txt · 전문은 제공 파일에 있어요</small><p>회의 메모를 할 일 표로 정리하는<br><b>meeting-actions 스킬</b>을 만들어줘.</p><p>담당자·기한·근거를 정리하고,<br>없는 정보는 확인 필요로 표시해줘.</p><p>메모마다 따로 처리하고,<br>결과를 내가 확인하게 해줘.</p><div>스크립트 없이 · 글로 된 지침만</div></div>\${label('기존 요청문을 스킬로 바꾸는 생성 요청이에요.',76,1328,'blue')}\`},
{id:'enable-skill',duration:7,step:'저장 여부 확인하기',title:'이름이 목록에 보여야<br>다시 꺼내 쓸 수 있어요.',caption:'생성된 지침을 읽고 저장·설치를 마치세요. Skills 목록과 새 작업의 @ 목록에서 스킬을 확인하세요.',body:\`<div class="save-check"><div class="save-item"><span>1</span><p>지침 내용 검토</p></div><div class="save-item"><span>2</span><p>안내에 따라 저장·설치</p></div><div class="save-item"><span>3</span><p>새 작업의 @ 목록에서 확인</p></div></div>\${note('SKILL.md 파일만 받았다면?<br><b>아직 설치된 것인지 확인하세요.</b>',76,1098)}\${label('데스크톱 앱 기준 · 계정과 버전에 따라 메뉴가 다를 수 있어요.',76,1328)}\`},
{id:'reuse',duration:8,step:'다음 회의에서 다시 쓰기',title:'이제 스킬을 고르고<br>새 메모만 넣으세요.',caption:'Work의 새 작업에서 @로 meeting-actions를 선택하세요. 이번 메모를 넣고, 나온 표를 원문과 대조하면 됩니다.',body:\`<div class="reuse-input"><small>스킬 선택 + 이번 회의 메모</small><b>@meeting-actions</b><p>이번 회의 메모를 정리해줘.</p><p>수진: 견적서는 제가 10월 2일까지 보낼게요.<br>도윤: 자료 조사는 제가 할게요. 기한은 미정이에요.</p></div><div class="reuse-result"><small>연습 결과의 확인 기준 · 실제 실행 응답 아님</small><div><b>견적서 발송</b><span>수진 · 10월 2일</span></div><div><b>자료 조사</b><span>도윤 · 확인 필요</span></div></div>\`}
];
scenes.splice(scenes.findIndex(s=>s.id==='ending'),0,...workScenes);
scenes[0].caption='먼저 할 일 표를 만들고, 다음 회의에도 꺼내 쓸 수 있게 저장하는 방법까지 알려드릴게요.';
scenes.find(s=>s.id==='ending').body='<div class="end-heading"><small>회의 정리, 다음 회의에도 바로 쓰세요</small><h2>따라 할 자료까지<br>준비했어요.</h2></div><div class="pdf-fan"><img src="assets/guide-6.png"><img src="assets/guide-5.png"><img src="assets/guide-1.png"></div><div class="end-description"><b>PDF 8쪽 + Work 설정 파일</b><p>복사용 요청문 · 연습 메모 · 스킬 지침</p></div><div class="end-cta">필요하시면 댓글에 <b>synk</b>를 남겨주세요</div>';
`;
source=source.replace('let cursor=0;',scenes+'\nlet cursor=0;');
source=source.replace('const html=`',`const cueList=[['click',8.4],['whoosh',15.8],['click',19.5],['click',21.2],['click',26.5],['click',27.05],['click',27.6],['click',28.15],['success',34.1],['click',41.1],['whoosh',44.3],['click',52],['click',64.6],['click',65.15],['click',65.7],['click',71.4],['whoosh',75.3],['click',83.2],['click',84.4],['click',85.6],['whoosh',89.3],['click',93.1],['click',98.0],['success',114.0],['whoosh',116.2],['success',122.8]];
const audioAssets={click:['.media/audio/sfx/sfx_001.mp3',.4,.45],whoosh:['.media/audio/sfx/sfx_002.mp3',.6,.32],success:['.media/audio/sfx/sfx_003.mp3',2.5,.25]};
fs.writeFileSync(path.join(dir,'sound-cues.json'),JSON.stringify(cueList));
const audioHTML=cueList.map(([name,time],i)=>{const [src,dur,vol]=audioAssets[name];return '<audio id="sfx-'+i+'" src="'+src+'" data-start="'+time+'" data-duration="'+dur+'" data-track-index="10" data-volume="'+vol+'"></audio>';}).join('');
const html=\``);
source=source.replace('assets/current/${file}.png',"assets/${file==='work-home'?'work':'current'}/${file}.png");
source=source.replace('</style></head>',fs.readFileSync('v5-style.css','utf8')+'\n</style></head>');
source=source.replace('<div class="progress">','${audioHTML}<div class="progress">');
source=source.replace('2026.09.22 실제 시연 · 가상 메모',"${s.id.startsWith('work')||['skill','create-skill','enable-skill','reuse'].includes(s.id)?'2026.09.23 공식 문서 기반 안내':'2026.09.22 실제 시연 · 가상 메모'}");
source=source.replace("tl.fromTo('#ending .ending-art'", "tl.fromTo('#ending .end-heading'");
source=source.replace("ease:'power3.out'},75);","ease:'power3.out'},120);");
source=source.replace("tl.fromTo('#progress-fill'",fs.readFileSync('v5-motion.js','utf8')+"\ntl.fromTo('#progress-fill'");
source=source.replace('audio:false','audio:true');
source=source.replace("shot('work-home',275,5,780,470,76,530,928)","shot('work-home',550,6,232,43,76,565,650)}${label('실제 Work 선택 화면 · 웹',76,725,'blue')}${shot('work-home',278,238,774,238,76,800,928)");
source=source.replace('필요하시면 댓글에 <b>synk</b>를 남겨주세요','<span>필요하시면 댓글에</span><b>synk</b>를 남겨주세요');
fs.writeFileSync('build.mjs',source);
