'use strict';
// 기존 radio-live 내부의 진행 시각 검사. 새 서비스나 별도 감시 프로세스를 만들지 않는다.
function 만들기({ 지금 = Date.now, 초기유예ms = 60000, 멈춤한계ms = 30000 } = {}) {
  const 시작 = 지금();
  const 상태 = { speed: '?', drop_frames: '?', dup_frames: '?', out_time: '?' };
  let 남은줄 = '', 긴줄버림 = false, 앞시각 = -Infinity, 마지막진전 = 시작;
  function 받기(chunk) {
    let 글 = String(chunk);
    if (긴줄버림) {
      const 끝 = 글.indexOf('\n');
      if (끝 < 0) return [];
      글 = 글.slice(끝 + 1); 긴줄버림 = false;
    }
    남은줄 += 글;
    const 줄들 = 남은줄.split(/\r?\n/); 남은줄 = 줄들.pop();
    const 경고 = [];
    for (const 줄 of 줄들) {
      const m = /^(speed|drop_frames|dup_frames|out_time)=(.*)$/.exec(줄);
      if (m) {
        상태[m[1]] = m[2].trim();
        if (m[1] === 'out_time') {
          const t = /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(상태.out_time);
          if (t) {
            const 초 = +t[1] * 3600 + +t[2] * 60 + +t[3];
            if (초 > 앞시각 + .001) { 앞시각 = 초; 마지막진전 = 지금(); }
          }
        }
      } else if (줄 && !/^[a-z_0-9]+=/.test(줄)) 경고.push(줄);
    }
    // 줄 끝 없는 오류 출력도 무한히 쌓지 않는다.
    if (남은줄.length > 16384) { 경고.push('[지나치게 긴 오류 줄 생략]'); 남은줄 = ''; 긴줄버림 = true; }
    return 경고;
  }
  function 확인() {
    const now = 지금(), 멎은ms = now - 마지막진전;
    return { 재시작: now - 시작 >= 초기유예ms && 멎은ms >= 멈춤한계ms, 멎은ms, out_time: 상태.out_time };
  }
  return { 상태, 받기, 확인 };
}
module.exports = { 만들기 };
