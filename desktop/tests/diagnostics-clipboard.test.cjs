'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {diagnosticSummary,copyDiagnostics}=require('../src/diagnostics-clipboard.cjs');
test('native diagnostic copy strips arbitrary secrets and uses authoritative environment/account flags',()=>{
  let copied;const result=copyDiagnostics({clipboard:{writeText:value=>{copied=value;}},input:{format:'secret-token',platform:'secret-path',version:'secret-token',signedIn:false,account:{name:'secret-name'},body:'secret-draft',online:true,view:'settings',clients:[{id:'world',status:'installed',canLaunch:true,preparation:'ready',path:'secret-path',token:'secret-token'},{id:'secret-app',status:'installed'}]},environment:{platform:'win32',arch:'x64',version:'0.4.0',mode:'development'},account:{signedIn:true,configured:true,refreshToken:'secret-token'}});
  assert.equal(result.ok,true);assert.doesNotMatch(copied,/secret-/);const value=JSON.parse(copied);assert.equal(value.signedIn,true);assert.equal(value.version,'0.4.0');assert.deepEqual(value.clients,[{id:'world',status:'installed',canLaunch:true,preparation:'ready'}]);
});
test('raw clipboard text and oversized client lists are rejected, unavailable clipboard reports failure',()=>{
  const clipboard={writeText:()=>assert.fail('must not write')};for(const input of ['C:\\private\\token',null,[],{clients:Array(11).fill({id:'world'})}])assert.equal(copyDiagnostics({clipboard,input}).code,'INVALID_DIAGNOSTICS');assert.equal(copyDiagnostics({clipboard:{writeText(){throw Error('unavailable');}},input:{clients:[]}}).code,'CLIPBOARD_UNAVAILABLE');
});
test('unrecognized enum values and path-like versions do not appear in diagnostics',()=>{
  const value=diagnosticSummary({online:'private',view:'private/path',clients:[{id:'world',status:'private/path',preparation:'private/token'}]},{environment:{version:'C:/private/0.4.0.exe'},account:{}});assert.doesNotMatch(JSON.stringify(value),/private/);assert.equal(value.version,'unknown');assert.equal(value.clients[0].status,'unknown');
});
