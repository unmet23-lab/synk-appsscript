'use strict';
const path=require('node:path');
const fs=require('node:fs');
const {parseHistory,KEEP:HISTORY_KEEP,sampleOf}=require('./ai-usage.cjs');
const {DAY_MS}=require('./subscription-common.cjs');
// 계정판·사용 기록의 읽기와 원자 저장을 소유한다.
function createSubscriptionStore({root,now,normalizeRow}) {
  const boardFile=path.join(root,'board.json'),historyFile=path.join(root,'history.jsonl');
  let board=null,history=null;
  /* 저장 */
  function emptyBoard(){return {version:1,rows:[],settings:{usdKrw:1400},check:null};}
  // 파일이 없을 때만 빈 판으로 시작한다. 다른 프로그램이 잠깐 잡고 있어 못 읽으면 빈 판을 만들지 않고 BOARD_BUSY로 알린다
  // (빈 판으로 시작하면 다음 저장이 회원이 넣은 줄을 모두 덮어쓴다). 깨진 파일은 옆에 남긴 뒤에만 새로 시작한다.
  const boardBusy=()=>Object.assign(new Error('board file is busy'),{code:'BOARD_BUSY'});
  function load(){
    if(board)return board;
    let text=null;
    try{text=fs.readFileSync(boardFile,'utf8');}catch(error){if(error.code!=='ENOENT')throw boardBusy();}
    let raw=null;
    if(text!==null){try{raw=JSON.parse(text);}catch{}if(!raw||typeof raw!=='object'){try{fs.copyFileSync(boardFile,`${boardFile}.broken-${now()}`);}catch{throw boardBusy();}raw=null;}}
    board=raw?{...emptyBoard(),...raw,rows:Array.isArray(raw.rows)?raw.rows.map(normalizeRow).filter(Boolean):[]}:emptyBoard();
    return board;
  }
  function persist(){
    load();
    fs.mkdirSync(root,{recursive:true});
    const tmp=boardFile+'.'+process.pid+'.tmp';
    fs.writeFileSync(tmp,JSON.stringify(board,null,1));fs.renameSync(tmp,boardFile);
  }
  // 사용 기록: 읽기마다 숫자 한 줄을 덧붙인다(이 PC에만, 180일). 못 읽거나 못 쓰면 기록만 건너뛰고 계정판은 그대로 돈다.
  function loadHistory(){
    if(history)return history;
    let text='';
    try{text=fs.readFileSync(historyFile,'utf8');}catch{}
    history=parseHistory(text,now()-HISTORY_KEEP);
    return history;
  }
  // 오래된 줄과 지운 계정의 줄을 뺀 판으로 다시 쓴다(임시 파일 → 바꿔 넣기).
  function compactHistory(){
    const ids=new Set(load().rows.map(row=>row.id)),from=now()-HISTORY_KEEP;
    history=loadHistory().filter(s=>s.t>=from&&ids.has(s.id));
    try{fs.mkdirSync(root,{recursive:true});const tmp=historyFile+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,history.map(s=>JSON.stringify(s)+'\n').join(''));fs.renameSync(tmp,historyFile);}catch{}
  }
  function remember(row){
    const sample=sampleOf(row,row.live?.readAt||now());if(!sample)return;
    const h=loadHistory();h.push(sample);
    try{fs.mkdirSync(root,{recursive:true});fs.appendFileSync(historyFile,JSON.stringify(sample)+'\n');}catch{}
    if(h[0].t<now()-HISTORY_KEEP-DAY_MS)compactHistory();
  }

  return {load,persist,loadHistory,compactHistory,remember};
}
module.exports={createSubscriptionStore};
