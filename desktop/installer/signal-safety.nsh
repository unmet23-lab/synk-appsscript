; A silent installer must never terminate an open application or its unsaved work.
; nsProcess: 0 = found, 603 = no matching process. Fail closed on other results.
!macro customCheckAppRunning
  nsProcess::_FindProcess /NOUNLOAD "${APP_EXECUTABLE_FILENAME}"
  Pop $0
  ${If} $0 != 603
    SetErrorLevel 20
    Quit
  ${EndIf}
!macroend
