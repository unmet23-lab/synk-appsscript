'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{parse}=require('acorn');
const text=fs.readFileSync(require.resolve('../experiences/synk-world-app/world-learning-ui.mjs'),'utf8'),functions=new Map();
function walk(node,parent=null){if(!node||typeof node!=='object')return;if(node.type==='FunctionDeclaration'){if(parent?.id?.name==='createWorldEducation'&&['openPosition','openPlan','repaint'].includes(node.id.name))functions.set(node.id.name,text.slice(node.start,node.end));parent=node;}for(const value of Object.values(node))if(value&&typeof value==='object')for(const child of Array.isArray(value)?value:[value])walk(child,parent);}walk(parse(text,{ecmaVersion:'latest',sourceType:'module'}));assert.equal(functions.size,3);
function fixture(){
 let release,enteredResolve,resource=null,shown=0,redrawn=0,kind='life-plan';const gate=new Promise(r=>release=r),entered=new Promise(r=>enteredResolve=r);
 const home={openPanel:()=>kind,attachPanelResource(value){const old=resource;resource=value;old?.dispose();}};
 const context={home,positionOpen:0,position:{showsHangulBoard:()=>false},check(){},prepare:async()=>{},target:{SYNKLearningHost:{ready:async()=>{}}},readCoach:()=>null,getProgress:()=>({hangulReading:()=>null}),hangulStage:async()=>null,panelNode:selector=>selector==='[data-plan-board]'?{}:null,showBoard(){shown++;resource?.dispose();return{plan:{status:'unavailable',items:[]}};},startDiagnostic(){throw Error('No diagnostic should start');}};
 const scope=vm.createContext(context);vm.runInContext([...functions.values()].join('\n')+'\nthis.open=openPosition;this.paint=repaint;this.plan=openPlan;',scope);
 scope.openPlan=()=>{redrawn++;resource?.dispose();};
 scope.bankReady=async()=>{enteredResolve();await gate;queueMicrotask(()=>scope.paint());};
 return{scope,entered,release,close(){kind='';resource?.dispose();},shown:()=>shown,redrawn:()=>redrawn};
}
test('a bank completion repaint does not cancel an in-flight position request',async()=>{const f=fixture(),pending=f.scope.open({start:true});await f.entered;assert.equal(await f.scope.plan({keepScroll:true}),'skipped');f.release();await pending;assert.equal(f.redrawn(),0);assert.equal(f.shown(),1);assert.equal(f.scope.open.pending,0);});
test('closing the originating panel cancels the request and clears its pending marker',async()=>{const f=fixture(),pending=f.scope.open();await f.entered;f.close();f.release();await pending;assert.equal(f.shown(),0);assert.equal(f.scope.open.pending,0);});
