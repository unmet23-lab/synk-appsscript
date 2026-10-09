const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const file=path.join(root,'report/src/data.json'),s=read(file);
const n=read(path.join(__dirname,'native-evidence.json')),a=read(path.join(__dirname,'alternatives-evidence.json')),c=read(path.join(__dirname,'costume-evidence.json'));
const rows=[
 {id:'unity',engine:'Unity 6.6 + URP',role:'이번 조건의 1순위',strength:'모바일·PC 네이티브, 리깅·의상·장면·프로파일링·에디터 자동화를 한 제작 체계로 구성',cost:'버전/패키지 고정·자산 규격·기기별 품질검수 필요',change:'앱 주력·꾸미기 지속 추가·작은 제작팀이라는 현재 조건',urls:n.versions[0].sources},
 {id:'unreal',engine:'Unreal Engine 5.8',role:'PC 표현력·UE 숙련팀에 강한 대안',strength:'시네마틱·동적 월드·모듈 캐릭터·Cloth 제작 도구',cost:'iOS 공통 화질을 Lumen에 기대지 못함. 모바일 경로와 자산 예산 별도 설계',change:'PC 중심이 되거나 UE 숙련 인력이 제작을 담당할 때',urls:n.versions[1].sources},
 ...a.candidates.map((v,i)=>({id:'alt'+i,engine:v.engine,role:v.role,strength:v.authoringEfficiency,cost:v.whyNotDefault,change:v.beatsUnityWhen,urls:v.sourceIds.map(id=>a.sources.find(s=>s.id===id)?.url).filter(Boolean)}))
];
const sourceList=[...n.sources,...a.sources,...c.sources].map(v=>({...v,url:v.url.replace('/6000.7/manual/analysis/profiler/','/6000.6/manual/analysis/profiler/')}));
const rootSources=[
 ['Unity 공식 CLI와 AI 도구','https://unity.com/features/ai'],['Unity CLI 전환과 기능','https://docs.unity.com/en-us/unity-cli/replace-mcp-server-unity-cli'],['Unity 공식 플러그인','https://docs.unity.com/en-us/ai/unity-plugin/about-unity-plugin'],['UI 비교','https://docs.unity.com/en-us/engine/6000.6/manual/uitoolkits/ui-system-compare'],['Addressables','https://docs.unity.com/en-us/engine/6000.6/manual/packages-list/packages-all/pack-safe/com-unity-addressables'],['VideoPlayer','https://docs.unity3d.com/6000.6/Documentation/ScriptReference/Video.VideoPlayer.html'],['iOS 빌드','https://docs.unity.com/en-us/engine/6000.6/manual/platform-specific/iphone/getting-started/ios-environment-setup'],['Apple 성능 분석','https://developer.apple.com/documentation/xcode/analyzing-the-performance-of-your-metal-app/']
].map(([title,url])=>({title,url,type:'공식 1차 출처',checkedAt:'2026-10-09'}));
const sources=[...new Map([...sourceList,...rootSources].map(v=>[v.url,v])).values()];
s.title='SYNK WORLD의 제작 방식: 모바일 3D와 모듈식 코스튬';s.buildStatus=process.argv.includes('--complete')?'complete':'updating';
s.research.engineering={checkedAt:'2026-10-09',legacyPrototypeWeight:0,native:n,alternatives:a,costume:c,sources};
delete s.research.tech;
s.queries.engines={rows,source:{type:'file',name:'최신 공식 엔진·제작 도구 문서',files:['native-evidence.json','alternatives-evidence.json','costume-evidence.json'].map(f=>path.join(__dirname,f)),evidenceFlow:[{title:'조건',detail:'S25/iPhone15 기본형, native 앱 주력+PC. 기존 시제품과 코드재사용 가산점0. 브라우저 필수 미확정.'},{title:'방법',detail:'출시버전·개별기능 성숙도·자산제작·자동화·기기검수·배포 유지비를 비교한 정성 판단. 엔진 간 실제 FPS나 제작시간 벤치마크는 미수행.'}],metricDefinitions:[]}};
s.queries.engineeringSources={rows:sources.map((v,i)=>({id:'source'+i,title:v.title||v.id||new URL(v.url).hostname,url:v.url,checkedAt:v.checkedAt||'2026-10-09'})),source:{type:'file',name:'엔진·공정 조사 공식 출처 목록',files:[path.join(__dirname,'sources.json')]}};
fs.writeFileSync(path.join(__dirname,'sources.json'),JSON.stringify(sources,null,2));
fs.writeFileSync(file,JSON.stringify(s,null,2));console.log(JSON.stringify({engines:rows.length,sources:sources.length,status:s.buildStatus,artifactId:s.id}));
