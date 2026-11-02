// 기능 시험의 페이지 전환은 시험 전체의 한도로 기다린다. 별도의 30초 기본값이
// 바쁜 PC의 정상 전환을 먼저 실패시키지 않으며, 시험 중단은 열린 페이지도 닫는다.
export async function pageReady(page,url,{signal}){
 if(!signal)throw Error('pageReady에는 시험의 t.signal을 넘긴다');
 signal.throwIfAborted();
 let abort;
 const interrupted=new Promise((_,reject)=>{
  abort=()=>{void page.close().catch(()=>{});reject(signal.reason);};
  signal.addEventListener('abort',abort,{once:true});
 });
 try{
  const response=await Promise.race([page.goto(url,{waitUntil:'domcontentloaded',timeout:0}),interrupted]);
  if(response&&!response.ok())throw Error(`시험 페이지 HTTP ${response.status()}: ${url}`);
  return response;
 }finally{signal.removeEventListener('abort',abort);}
}
