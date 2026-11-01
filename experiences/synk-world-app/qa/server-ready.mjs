// 띄운 시험 서버가 health에 답할 때까지 기다린다. 정해진 횟수(8~15초) 뒤 그냥 넘어가던 고리는 바쁜 PC에서 서버가 아직 안 떠
// 다음 단계가 연결 거부·시간 초과로 깨졌다(11-02 로컬 조건부 시험 642e2b0188 · 2b25426721). 서버가 먼저 끝나면 그 출력을 던지고,
// 끝은 시험 한도가 정한다 — 시험의 t.signal을 꼭 넘긴다(한도에 걸리면 이 고리도 멈춘다).
export async function serverReady(url,{signal,exited,output=()=>''}){
 if(!signal)throw Error('serverReady에는 시험의 t.signal을 넘긴다');
 for(;;){
  if(exited?.())throw Error(`시험 서버가 준비 전에 끝났다: ${output()}`);
  signal.throwIfAborted();
  try{const r=await fetch(url,{signal:AbortSignal.timeout(5000)});if(r.ok)return r;}catch{}
  await new Promise(r=>setTimeout(r,100));
 }
}
