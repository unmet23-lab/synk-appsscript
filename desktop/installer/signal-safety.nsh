; A silent installer must never terminate an open application or its unsaved work.
; The app is installed per Windows account, so only a copy running in this
; installer's own Windows session can hold these files: another account's SYNK
; must not block this account. tasklist prints a quoted CSV row for a match and
; only a plain notice (in any language) otherwise. Fail closed on any error.
!macro customCheckAppRunning
  ; Keep the caller's registers: this runs inside electron-builder's own install flow.
  Push $0
  Push $1
  Push $2
  Push $3
  Push $4
  Push $5
  Push $6
  System::Call 'kernel32::GetCurrentProcessId()i.r0'
  System::Call 'kernel32::ProcessIdToSessionId(ir0,*i.r1)i.r2'
  ${If} $2 == 0
    SetErrorLevel 20
    Quit
  ${EndIf}
  nsExec::ExecToStack '"$SYSDIR\tasklist.exe" /NH /FO CSV /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /FI "SESSION eq $1"'
  Pop $0
  Pop $2
  ${If} $0 != 0
    SetErrorLevel 20
    Quit
  ${EndIf}
  StrCpy $3 '"${APP_EXECUTABLE_FILENAME}",'
  StrLen $4 $3
  StrCpy $5 0
  ${Do}
    StrCpy $6 $2 $4 $5
    ${If} $6 == $3
      SetErrorLevel 20
      Quit
    ${EndIf}
    IntOp $5 $5 + 1
  ${LoopUntil} $6 == ''
  Pop $6
  Pop $5
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0
!macroend
