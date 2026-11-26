'use strict';
// 솔리오 「사무실」의 움직임을 브라우저에서 눌러 보는 자리(합성 자료, 로그인 · 네트워크 없음). 제품은 이 파일을 싣지 않는다.
//   node desktop/tools/office-talk-preview.cjs [포트]   → http://127.0.0.1:<포트>/?tasking=1 (맡기기 켜짐) · ?tasking=0 (배포판처럼 꺼짐)
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { createNativeContent } = require('../src/native-content.cjs');
const root = path.resolve(__dirname, '..'), port = Number(process.argv[2] || 4991);
const content = createNativeContent({ appRoot: root });
const fixture = fs.readFileSync(path.join(__dirname, 'orb-face-fixture.cjs'), 'utf8');
const shim = `(()=>{const process={argv:[]};const require=()=>({contextBridge:{exposeInMainWorld:(k,v)=>{Object.defineProperty(window,k,{value:v,configurable:true});}}});\n${fixture}\n})();`;
const boot = `
const B=String.fromCharCode(92),P=(...a)=>['C:','qa',...a].join(B);const MKT=P('문서','마케팅'),SHOP=P('코드','shop'),PLAN=P('문서','기획');
const q=new URLSearchParams(location.search),tasking=q.get('tasking')!=='0';
const now=Date.now();
const depts=[{id:'qmkt',name:'마케팅부',folder:MKT},{id:'qdev',name:'개발부',folder:SHOP},{id:'qplan',name:'기획부',folder:PLAN}];
// 지금 제품의 직원은 모두 기록으로만 선다(11-21 훅을 뺐다). 승인 물음을 아는 직원 하나는 나중을 위해 두었다(?hooked=1)
const hooked=q.get('hooked')==='1';
const sessions=[
  {id:'sess-qa-mkt-01',cwd:MKT,kind:'work',hooked:false,ago:20e3,toolName:'Write',detail:'블로그_11월.md',title:'11월 블로그 글 쓰기'},
  {id:'sess-qa-mkt-02',cwd:MKT,kind:'work',hooked:false,ago:8*60e3,title:'가게 소개 보고서 다듬기'},
  {id:'sess-qa-dev-01',cwd:SHOP,kind:hooked?'ask':'work',hooked,ago:hooked?180e3:4*60e3,title:'주문 합계 오류 고치기'},
  {id:'sess-qa-cdx-01',tool:'codex',cwd:SHOP+B+'api',kind:'work',ago:30e3},
  {id:'sess-qa-plan-01',cwd:PLAN,kind:'work',hooked:false,ago:25*60e3,title:'회의록 한 장으로 줄이기'},
  {id:'sess-qa-lob-01',cwd:P('회의록'),kind:'work',hooked:false,ago:40e3,toolName:'Read',detail:'회의록_1118.txt',helpers:2},
];
const tasks=[
  {id:'t-mkt-0001',prompt:'11월 블로그 글 하나를 써 주세요.',provider:'claude',departmentId:'qmkt',status:'completed',answer:'「겨울 빵 세 가지」로 초안을 썼습니다. 블로그_11월.md에 두었습니다.',createdAt:now-3600e3,updatedAt:now-3400e3},
  {id:'t-dev-0001',prompt:'주문 쪽의 합계가 틀립니다. 고쳐 주세요.',provider:'claude',departmentId:'qdev',status:'completed',answer:'배송비가 두 번 더해지고 있었습니다. 한 번만 더하게 고치고 시험 세 개를 돌렸습니다.',createdAt:now-7200e3,updatedAt:now-7000e3},
  {id:'t-plan-0001',prompt:'회의록을 한 장으로 줄여 주세요.',provider:'codex',departmentId:'qplan',status:'completed',answer:'결정 넷과 할 일 여섯으로 줄였습니다.',createdAt:now-9000e3,updatedAt:now-8800e3},
];
const office={available:true,departments:depts,sessions,assignments:{},settings:{view:'tilted',manualCap:null},roots:{claude:[],codex:[],added:[]},pc:{cores:16,totalMemGb:31.7,freeMemGb:19,cpuPercent:38},...(tasking?{tasking:{tasks,code:null,mail:{providers:[]}}}:{})};
window.__orbFixture.configure({office,subs:{ok:true,rows:[]}});
window.__orbFixture.restore({configured:true,status:'signed-in',signedIn:true,sessionGeneration:11,accountGeneration:'90000000-0000-4000-8000-000000000001',account:{synk_user_id:'20000000-0000-4000-8000-000000000002',display_name:'합성 회원'},onboarding:{purpose:'none'},library:{status:'ready',appIds:['messenger']}});
const enter=()=>{const o=document.querySelector('#portal-entry [data-orb-prog="office"]');if(o&&!o.hidden&&document.documentElement.dataset.orbClient==='app'){o.click();return;}setTimeout(enter,200);};
enter();
`;
http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (u.pathname === '/__shim.js') { res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' }); res.end(shim); return; }
    if (u.pathname === '/__boot.js') { res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' }); res.end(boot); return; }
    const r = await content({ method: req.method, url: 'synk-desktop://platform' + (u.pathname === '/' ? '/index.html' : u.pathname) });
    const headers = Object.fromEntries(r.headers); delete headers['content-security-policy'];
    let body = Buffer.from(await r.arrayBuffer());
    if (u.pathname === '/') body = Buffer.from(body.toString('utf8').replace('<link rel="stylesheet" href="./launcher.css">', '<script src="/__shim.js"></script><link rel="stylesheet" href="./launcher.css">').replace('</body>', '<script type="module" src="/__boot.js"></script></body>'));
    res.writeHead(r.status, headers); res.end(body);
  } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
}).listen(port, '127.0.0.1', () => console.log('http://127.0.0.1:' + port + '/'));
