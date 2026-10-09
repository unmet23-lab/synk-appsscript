import path from 'node:path';
import {createStore} from '../synk-town/server.mjs';

// This host only runs behind the local WORLD synthetic-account authentication.
// It does not grant TOPIK access or join the independent 4288 developer fixture.
export function createAccountTownHost({directory,create=createStore}={}) {
  const stores=new Map();
  function forAccount(accountId) {
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(accountId||''))throw Object.assign(Error('AUTH_REQUIRED'),{status:401});
    if(!stores.has(accountId))stores.set(accountId,create({file:path.join(directory,`${accountId}.json`)}));
    return stores.get(accountId);
  }
  return {
    handle(accountId,operation,method,input) {
      const store=forAccount(accountId);
      try {
        let result;
        if(operation==='state'&&method==='GET')result=store.read();
        else if(operation==='presence'&&method==='POST')result=store.presence(input);
        else if(operation==='command'&&method==='POST')result=store.execute(input);
        else return {status:405,body:{error:'METHOD_NOT_ALLOWED'}};
        return {status:200,body:{...result,rehearsal:true,accountScoped:true}};
      } catch(error) {
        let current={};try{current=store.read();}catch{}
        return {status:error.status||503,body:{...current,error:error.code||'TOWN_UNAVAILABLE',message:error.status?error.message:'동네 기록을 확인하지 못했어요.',rehearsal:true}};
      }
    }
  };
}
