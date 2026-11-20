; 플랫폼 설치기에만 끼우는 NSIS 스크립트다(build-signal.cjs의 nsisInclude). 세 제품이 함께 쓰는 실행 중 확인(signal-safety.nsh)을
; 그대로 가져오고, 앱을 지울 때 솔리오 「사무실」이 Claude Code 설정 파일에 더한 훅 줄을 지운다
; (docs/디자인/솔리오_사무실_20261119/구현설계.md 12.3 「앱을 지울 때」).
; WORLD와 워크스페이스에는 끼우지 않는다. 그 앱은 --office-unhook을 받지 않아(main.cjs가 플랫폼에서만 받는다) 그 인자로도 창을 연다.
!include "${__FILEDIR__}\signal-safety.nsh"

; 훅 지우기를 기다리는 상한(밀리초). 넘기면 이 지우기가 띄운 실행만 멈추고 지우기를 이어 간다.
!define SYNK_OFFICE_UNHOOK_LIMIT_MS 10000
; 앱이 끝나거나 멈춘 뒤 Windows가 실행 파일을 놓기를 더 기다리는 시간(밀리초)
!define SYNK_OFFICE_UNHOOK_STOP_MS 3000

; 아래 구조체 크기와 배치는 32비트 설치기의 것이다. electron-builder는 x86-unicode로 짓는다
!if ${NSIS_PTR_SIZE} > 4
  !error "office-unhook.nsh의 STARTUPINFOW 배치는 32비트 설치기만 맞습니다"
!endif

; electron-builder 26.15.3의 uninstaller.nsh는 지우기 구역에서 실행 중 확인(un.checkAppRunning, 우리 customCheckAppRunning) 뒤,
; 설치 폴더를 지우기(RMDir /r $INSTDIR) 전에 customUnInstall을 넣는다. 그래서 이때 앱 실행 파일은 아직 있고 손님의 앱은 꺼져 있다.
; 판을 올리거나 다시 설치할 때는 새 설치기가 옛 판의 지우는 프로그램을 --updated로 부른다(installUtil.nsh의 uninstallOldVersion).
; 그 길에서는 새 판이 훅을 이어 받으므로 지우지 않는다(${isUpdated}는 --updated 인자를 본다).
; 훅 지우기의 실패는 지우기를 막지 않는다. 돌리지 못하거나 상한을 넘겨도 아무 말 없이 다음으로 간다.
!macro customUnInstall
  ${IfNot} ${isUpdated}
  ${AndIf} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    Push $0
    Push $1
    Push $2
    Push $3
    Push $4
    Push $5
    Push $6
    Push $7
    Push $8
    Push $9
    ; $0: 작업 묶음(Job). 앱과 앱이 띄운 하위 프로세스를 함께 세고, 상한을 넘기면 묶음째 멈춘다
    System::Call 'kernel32::CreateJobObjectW(p 0, p 0) p .r0'
    ; $1: STARTUPINFOW(68바이트). STARTF_USESHOWWINDOW와 SW_HIDE로 창을 보이지 않게 연다
    System::Call '*(i 68, p 0, p 0, p 0, i 0, i 0, i 0, i 0, i 0, i 0, i 0, i 1, &i2 0, &i2 0, p 0, p 0, p 0, p 0) p .r1'
    ; $2: PROCESS_INFORMATION
    System::Call '*(p 0, p 0, i 0, i 0) p .r2'
    ; 멈춘 채로(CREATE_SUSPENDED) 띄워 묶음에 넣은 뒤에 깨운다. 콘솔 창은 만들지 않는다(CREATE_NO_WINDOW). 손잡이는 물려주지 않는다
    StrCpy $3 '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --office-unhook'
    System::Call 'kernel32::CreateProcessW(p 0, w r3, p 0, p 0, i 0, i 0x08000004, p 0, p 0, p r1, p r2) i .r3'
    ; $4: 앱 프로세스, $5: 첫 스레드. 두 구조체는 여기서 놓고, 아래에서는 $1과 $2를 표시로 쓴다
    System::Call '*$2(p .r4, p .r5)'
    System::Free $1
    System::Free $2
    ${If} $3 <> 0
      ; $6: 묶음에 넣었으면 0이 아니다. 못 넣었으면 앱 하나만 기다리고 멈춘다
      StrCpy $6 0
      ${If} $0 <> 0
        System::Call 'kernel32::AssignProcessToJobObject(p r0, p r4) i .r6'
      ${EndIf}
      System::Call 'kernel32::ResumeThread(p r5)'
      System::Call 'kernel32::CloseHandle(p r5)'
      ; $1: 상한을 넘겨 멈췄으면 1. $2: 프로세스가 다 끝난 것을 봤으면 1
      StrCpy $1 0
      StrCpy $2 0
      ; $7: 시작 시각. $3: 기다림을 끝낼 시각(시작부터 밀리초)
      System::Call 'kernel32::GetTickCount() i .r7'
      StrCpy $3 ${SYNK_OFFICE_UNHOOK_LIMIT_MS}
      ; $9: JOBOBJECT_BASIC_ACCOUNTING_INFORMATION(48바이트). 그 안의 ActiveProcesses로 묶음에 남은 프로세스를 센다
      System::Call '*(l 0, l 0, l 0, l 0, i 0, i 0, i 0, i 0) p .r9'
      ${Do}
        ; $5: 아직 도는 프로세스. 0이면 다 끝났다
        StrCpy $8 0
        ${If} $6 <> 0
          System::Call 'kernel32::QueryInformationJobObject(p r0, i 1, p r9, i 48, p 0) i .r8'
        ${EndIf}
        ${If} $8 <> 0
          System::Call '*$9(l, l, l, l, i, i, i .r5)'
        ${Else}
          ; WaitForSingleObject는 끝났으면 0, 아직이면 258을 돌려준다
          System::Call 'kernel32::WaitForSingleObject(p r4, i 0) i .r5'
        ${EndIf}
        ${If} $5 = 0
          ; 프로세스가 다 끝나도 Windows가 실행 파일의 이미지를 조금 늦게 놓는다. 놓기 전에는 뒤의 RMDir이 그 파일을 지우지 못한다.
          ; 이미지로 쓰이는 파일은 쓰기로 열리지 않으므로, 쓰기로 열리면(OPEN_EXISTING이라 바꾸지 않는다) 놓은 것이다. 반환값은 32비트 정수로 받아 INVALID_HANDLE_VALUE를 -1로 본다
          StrCpy $8 "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
          System::Call 'kernel32::CreateFileW(w r8, i 0x40000000, i 7, p 0, i 3, i 0x80, p 0) i .r8'
          ${If} $8 <> -1
            System::Call 'kernel32::CloseHandle(i r8)'
            ${ExitDo}
          ${EndIf}
          ; 처음 본 때부터 STOP_MS까지만 더 기다린다
          ${If} $2 = 0
            StrCpy $2 1
            System::Call 'kernel32::GetTickCount() i .r8'
            IntOp $8 $8 - $7
            IntOp $8 $8 + ${SYNK_OFFICE_UNHOOK_STOP_MS}
            ${If} $8 < $3
              StrCpy $3 $8
            ${EndIf}
          ${EndIf}
        ${EndIf}
        System::Call 'kernel32::GetTickCount() i .r8'
        IntOp $8 $8 - $7
        ${If} $8 >= $3
          ; 이미 멈췄거나 프로세스는 끝났는데 파일을 아직 못 놓았다. 더 기다리지 않고 지우기를 이어 간다
          ${If} $1 <> 0
          ${OrIf} $2 <> 0
            ${ExitDo}
          ${EndIf}
          ; 상한을 넘겼다. 이 지우기가 띄운 실행만 멈춘다. 손님이 연 앱은 앞의 실행 중 확인이 이미 막았다
          ${If} $6 <> 0
            System::Call 'kernel32::TerminateJobObject(p r0, i 1)'
          ${Else}
            System::Call 'kernel32::TerminateProcess(p r4, i 1)'
          ${EndIf}
          StrCpy $1 1
          IntOp $3 $8 + ${SYNK_OFFICE_UNHOOK_STOP_MS}
        ${EndIf}
        Sleep 50
      ${Loop}
      System::Free $9
      System::Call 'kernel32::CloseHandle(p r4)'
    ${EndIf}
    ${If} $0 <> 0
      System::Call 'kernel32::CloseHandle(p r0)'
    ${EndIf}
    Pop $9
    Pop $8
    Pop $7
    Pop $6
    Pop $5
    Pop $4
    Pop $3
    Pop $2
    Pop $1
    Pop $0
  ${EndIf}
!macroend
