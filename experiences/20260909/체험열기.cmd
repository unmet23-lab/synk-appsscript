@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set "SYNK_PREVIEW_NODE=node"
where node >nul 2>nul
if not errorlevel 1 goto run
set "SYNK_PREVIEW_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%SYNK_PREVIEW_NODE%" goto run
echo Node.js를 찾지 못했습니다. Node.js 20 이상을 설치하거나 Codex에서 체험 서버를 열어 달라고 요청해 주세요.
echo 자동 설치는 진행하지 않았습니다.
pause
exit /b 1
:run
"%SYNK_PREVIEW_NODE%" "%~dp0start.cjs"
if errorlevel 1 goto failed
start "" "http://127.0.0.1:4399/"
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo 위 안내를 확인해 주세요. 창을 닫으려면 아무 키나 누르세요.
pause >nul
exit /b 1
