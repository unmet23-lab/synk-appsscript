'use strict';
const CLIENTS=Object.freeze({
  platform:Object.freeze({id:'platform',name:'SYNK Platform',appId:'im.synk.platform',executable:'SYNKPlatform'}),
  world:Object.freeze({id:'world',name:'SYNK WORLD',appId:'im.synk.world',executable:'SYNKWorld'}),
  messenger:Object.freeze({id:'messenger',name:'SYNK Workspace',appId:'im.synk.messenger',executable:'SYNKMessenger'}),
});
const MESSENGER_CLOUD_PREVIEW_ENTRY='https://workspace.synk.im/?tab=messenger';
const WORLD_CLOUD_PREVIEW_ENTRY='https://synk.im/world/';
const WORLD_ACCOUNT_ENTRY='https://synk.im/account/client.html?product=world';
const PLATFORM_ENTRY='synk-desktop://platform/index.html';
const DEV_URLS=Object.freeze({platform:PLATFORM_ENTRY,world:'http://127.0.0.1:4280/synk-account/client.html?product=world',messenger:'http://127.0.0.1:4191/?tab=messenger'});
function client(id) { if(typeof id!=='string'||!Object.hasOwn(CLIENTS,id))throw new Error('UNKNOWN_CLIENT');return CLIENTS[id]; }
// 패키징 안 된 소스 실행(--synk-dev, 교사·제품 미리보기 포함)은 설치된 Preview와 같은 개발 모드여도 저장 폴더·단일 실행 잠금·
// 작업 표시줄 ID·Suite 선택을 따로 쓴다. 설치 앱은 Care 알림 때문에 늘 켜져 있어, 같이 쓰면 개발 창이 못 뜨고 설치 앱의 로그인·설정을 바꾼다.
// 명시한 false만 소스 실행으로 본다. 빌드 도구처럼 packaged를 넘기지 않으면 설치 앱 이름 그대로다.
// 둘이 같이 켜질 수 있게 됐으니 이름(트레이 툴팁·창 제목)도 갈라, 늘 켜 둬야 하는 설치 앱을 잘못 끄지 않게 한다.
function sourceScope(value,packaged) { return packaged===false?value+'.source':value; }
function identity(id,mode,{packaged=true}={}) { const c=client(id),preview=mode==='development',appId=sourceScope(c.appId+(preview?'.preview':''),packaged);return {...c,appId,productName:c.name+(preview?' Preview':'')+(packaged===false?' (소스 실행)':''),executableName:c.executable+(preview?'Preview':''),sessionScope:appId}; }
module.exports={CLIENTS,DEV_URLS,PLATFORM_ENTRY,MESSENGER_CLOUD_PREVIEW_ENTRY,WORLD_CLOUD_PREVIEW_ENTRY,WORLD_ACCOUNT_ENTRY,client,identity,sourceScope};
