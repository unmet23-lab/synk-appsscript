'use strict';
// 숨은 Electron 시험(*-native-smoke.cjs 등)은 node로 띄운다. node 쪽이 임시 폴더에 일회용 프로필과 인자를 만들어
// Electron 자식에게 넘기고, 자식은 그것이 맞는지 맨 먼저 확인한다.
// `npx electron tools/<시험>.cjs`처럼 Electron으로 바로 띄우면 그 확인에 걸린다. 그 자리에서 throw하면 Electron이
// 화면 가운데에 「A JavaScript error occurred in the main process」 창을 띄우고, 누가 닫을 때까지 멈춘다(2026-11-08).
// 그래서 Electron 안에서는 고칠 명령을 한 줄 남기고 코드 2로 끝낸다. node 쪽에서 부르면 예전처럼 throw한다.
const fs=require('node:fs'),path=require('node:path');

function refuse(file,reason){
  if(!process.versions.electron)throw Error(reason);
  const shown=path.relative(process.cwd(),file).split(path.sep).join('/')||file;
  const line=`${reason} — ${path.basename(file)}는 Electron으로 바로 띄우지 않는다. node ${shown} 로 띄우면 일회용 프로필을 만들어 숨은 창으로 돌린다.\n`;
  try{fs.writeSync(2,line);}catch{/* 표준 오류가 닫혀 있어도 창 없이 끝내는 것이 먼저다. */}
  process.exit(2);
}

module.exports={refuse};
