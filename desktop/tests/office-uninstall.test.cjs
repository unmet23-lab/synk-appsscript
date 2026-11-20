'use strict';
// 솔리오 「사무실」: 앱을 지울 때 지우는 프로그램(NSIS)이 앱을 --office-unhook으로 한 번 돌려 훅 줄을 지운다(구현설계.md 12.3 「앱을 지울 때」).
// 실제로 지우고 다시 설치하는 시험은 desktop/installer/tests/test.cjs(Tests.cs)다. 여기서는 설치기를 굽지 않고 스크립트와 빌드 설정, 고정한 electron-builder의 차례를 본다
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const installer=path.join(__dirname,'..','installer');
const signal=require(path.join(installer,'build-signal.cjs'));
const script=fs.readFileSync(path.join(installer,'office-unhook.nsh'),'utf8');
const macro=(/^!macro customUnInstall\r?\n([\s\S]*?)^!macroend/m.exec(script)||[])[1]||'';
const code=text=>text.split(/\r?\n/).map(line=>line.replace(/^\s*;.*$/,'').trim()).filter(Boolean);

test('only the Platform installer runs --office-unhook; WORLD and Workspace keep the shared guard',()=>{
  // WORLD와 워크스페이스 앱은 --office-unhook을 받지 않아(main.cjs는 플랫폼에서만 받는다) 그 인자로 돌리면 창을 연다
  assert.equal(signal.nsisInclude('platform'),'office-unhook.nsh');
  for(const id of ['world','messenger'])assert.equal(signal.nsisInclude(id),'signal-safety.nsh',id);
  const main=fs.readFileSync(path.join(__dirname,'..','src','main.cjs'),'utf8');
  assert.match(main,/const officeUnhook=runtime\.clientId==='platform'&&!smoke&&process\.argv\.includes\('--office-unhook'\)/);
  const build=fs.readFileSync(path.join(installer,'build-signal.cjs'),'utf8');
  assert.match(build,/include:path\.join\(ROOT,nsisInclude\(id\)\)/);
  // 실제 앱 묶음으로 재는 측정은 실제 앱을 지운다. 훅 지우기를 끼우면 이 PC의 실제 Claude Code 설정을 고치므로 공용 확인만 쓴다
  assert.match(fs.readFileSync(path.join(installer,'tests','measure.cjs'),'utf8'),/include:path\.join\(source,'signal-safety\.nsh'\)/);
});

test('the Platform script keeps the running-app guard and runs the built executable only on a real uninstall',()=>{
  assert.match(script,/^!include "\$\{__FILEDIR__\}\\signal-safety\.nsh"\r?$/m);
  assert.ok(macro,'customUnInstall macro missing');
  const lines=code(macro);
  // 판 올리기와 다시 설치(--updated)에서는 건너뛴다. 실행 파일 이름은 빌드 설정의 executableName에서 electron-builder가 만든 값을 쓴다
  assert.deepEqual(lines.slice(0,2),['${IfNot} ${isUpdated}','${AndIf} ${FileExists} "$INSTDIR\\${APP_EXECUTABLE_FILENAME}"']);
  assert.equal(lines.at(-1),'${EndIf}');
  assert.ok(lines.includes(`StrCpy $3 '"$INSTDIR\\\${APP_EXECUTABLE_FILENAME}" --office-unhook'`));
  // 창과 콘솔 없이(CREATE_SUSPENDED | CREATE_NO_WINDOW, STARTF_USESHOWWINDOW와 SW_HIDE) 띄우고 손잡이는 물려주지 않는다
  assert.ok(lines.some(line=>/^System::Call 'kernel32::CreateProcessW\(p 0, w r3, p 0, p 0, i 0, i 0x08000004, p 0, p 0, p r1, p r2\) i \.r3'$/.test(line)));
  assert.ok(lines.includes("System::Call '*(i 68, p 0, p 0, p 0, i 0, i 0, i 0, i 0, i 0, i 0, i 0, i 1, &i2 0, &i2 0, p 0, p 0, p 0, p 0) p .r1'"));
  // 부른 쪽의 레지스터를 그대로 돌려준다
  const pushes=lines.filter(line=>/^Push \$\d$/.test(line)).map(line=>line.slice(5)),pops=lines.filter(line=>/^Pop \$\d$/.test(line)).map(line=>line.slice(4));
  assert.deepEqual(pushes,['$0','$1','$2','$3','$4','$5','$6','$7','$8','$9']);
  assert.deepEqual(pops,[...pushes].reverse());
});

test('the unhook run is time-bounded and can never fail or hold the uninstall',()=>{
  const limit=Number((/^!define SYNK_OFFICE_UNHOOK_LIMIT_MS (\d+)\r?$/m.exec(script)||[])[1]);
  const stop=Number((/^!define SYNK_OFFICE_UNHOOK_STOP_MS (\d+)\r?$/m.exec(script)||[])[1]);
  assert.ok(limit>=3000&&limit<=15000,'limit '+limit);
  assert.ok(stop>0&&stop<=5000,'stop wait '+stop);
  const lines=code(macro);
  // 끝없이 기다리는 명령(ExecWait, nsExec, 무한 WaitForSingleObject)이 없고, 지우기를 멈추거나 실패로 끝내는 명령이 없다
  for(const line of lines){
    assert.doesNotMatch(line,/^(ExecWait|ExecShellWait|Exec|nsExec::|Abort|Quit|SetErrorLevel|MessageBox|Goto)\b/i,line);
    const wait=/WaitForSingleObject\(p r4, i ([^)]+)\)/.exec(line);if(wait)assert.equal(wait[1],'0',line);
  }
  // 기다림은 한 고리이고, 시작부터 상한을 넘기면 작업 묶음(없으면 그 실행)을 멈춘 뒤 STOP_MS 안에 고리를 나온다.
  // 프로세스가 끝난 뒤에도 실행 파일이 쓰기로 열릴 때까지(이미지를 놓을 때까지) 기다린다. 놓기 전에는 뒤의 RMDir이 실행 파일을 남긴다(11-20 설치기 시험에서 본 경합)
  assert.equal(lines.filter(line=>line==='${Do}').length,1);
  assert.equal(lines.filter(line=>line==='${Loop}').length,1);
  for(const expected of ['StrCpy $3 ${SYNK_OFFICE_UNHOOK_LIMIT_MS}','IntOp $8 $8 - $7','${If} $8 >= $3','${If} $1 <> 0','${OrIf} $2 <> 0',
    "System::Call 'kernel32::TerminateJobObject(p r0, i 1)'","System::Call 'kernel32::TerminateProcess(p r4, i 1)'",'StrCpy $1 1','IntOp $3 $8 + ${SYNK_OFFICE_UNHOOK_STOP_MS}','Sleep 50',
    'StrCpy $8 "$INSTDIR\\${APP_EXECUTABLE_FILENAME}"',"System::Call 'kernel32::CreateFileW(w r8, i 0x40000000, i 7, p 0, i 3, i 0x80, p 0) i .r8'",'${If} $8 <> -1'])
    assert.ok(lines.includes(expected),expected);
});

test('the pinned electron-builder runs customUnInstall before removing files and passes --updated to the old uninstaller',t=>{
  const lib=path.join(__dirname,'..','node_modules','app-builder-lib');
  if(!fs.existsSync(path.join(lib,'package.json'))){t.skip('desktop/node_modules is not installed');return;}
  assert.equal(JSON.parse(fs.readFileSync(path.join(lib,'package.json'),'utf8')).version,'26.15.3');
  const templates=path.join(lib,'templates','nsis');
  // 지우기 구역: 실행 중 확인 → customUnInstall → 설치 폴더 지우기. 앱 실행 파일이 아직 있고 손님의 앱은 꺼져 있을 때 돈다
  const uninstaller=fs.readFileSync(path.join(templates,'uninstaller.nsh'),'utf8');
  const section=uninstaller.indexOf('Section "un.${UNINSTALL_SECTION_NAME}"'),check=uninstaller.indexOf('call un.checkAppRunning',section);
  const custom=uninstaller.indexOf('!insertmacro customUnInstall',section),remove=uninstaller.indexOf('RMDir /r $INSTDIR',section);
  assert.ok(section>=0&&check>section&&custom>check&&remove>custom,[section,check,custom,remove].join(','));
  // 조용한 지우기(/S)의 실행 중 확인은 un.onInit에서, 그 밖에는 위 구역 첫머리에서 돈다. 어느 쪽이든 customUnInstall보다 먼저다
  assert.match(uninstaller,/Function un\.onInit[\s\S]*?\$\{If\} \$\{Silent\}\s+call un\.checkAppRunning[\s\S]*?FunctionEnd/);
  // 판을 올릴 때 새 설치기는 옛 지우는 프로그램을 --updated로 부른다(--delete-app-data를 받은 설치만 예외다. 이 설치기의 엔진은 /S /currentuser만 준다)
  const util=fs.readFileSync(path.join(templates,'include','installUtil.nsh'),'utf8');
  assert.match(util,/\$\{if\} \$\{isDeleteAppData\}\s+StrCpy \$0 "\$0 --delete-app-data"\s+\$\{else\}[^\n]*\n[^\n]*\n\s+StrCpy \$0 "\$0 --updated"/);
  assert.match(util,/ExecWait '"\$uninstallerFileNameTemp" \/S \/KEEP_APP_DATA \$0 _\?=\$installationDir' \$R0/);
  assert.match(fs.readFileSync(path.join(templates,'installSection.nsh'),'utf8'),/!insertmacro uninstallOldVersion SHELL_CONTEXT/);
  // ${isUpdated}는 그 --updated 인자를 보는 시험이다
  assert.match(fs.readFileSync(path.join(lib,'out','targets','nsis','NsisTarget.js'),'utf8'),/scriptGenerator\.flags\(\["updated",/);
  assert.match(fs.readFileSync(path.join(installer,'BackendProcess.cs'),'utf8'),/"\\""\+executable\+"\\" \/S \/currentuser"/);
});
