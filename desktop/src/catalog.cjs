'use strict';
const CLIENTS=Object.freeze({
  platform:Object.freeze({id:'platform',name:'SYNK Platform',appId:'im.synk.platform',executable:'SYNKPlatform'}),
  world:Object.freeze({id:'world',name:'SYNK WORLD',appId:'im.synk.world',executable:'SYNKWorld'}),
  messenger:Object.freeze({id:'messenger',name:'SYNK Messenger',appId:'im.synk.messenger',executable:'SYNKMessenger'}),
});
const PLATFORM_ENTRY='synk-desktop://platform/index.html';
const DEV_URLS=Object.freeze({platform:PLATFORM_ENTRY,world:'http://127.0.0.1:4280/synk-account/client.html?product=world',messenger:'http://127.0.0.1:4191/?tab=messenger'});
function client(id) { if(typeof id!=='string'||!Object.hasOwn(CLIENTS,id))throw new Error('UNKNOWN_CLIENT');return CLIENTS[id]; }
function identity(id,mode) { const c=client(id),preview=mode==='development';return {...c,appId:c.appId+(preview?'.preview':''),productName:c.name+(preview?' Preview':''),executableName:c.executable+(preview?'Preview':''),sessionScope:c.appId+(preview?'.preview':'')}; }
module.exports={CLIENTS,DEV_URLS,PLATFORM_ENTRY,client,identity};
