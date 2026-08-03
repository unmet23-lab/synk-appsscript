@echo off
rem memory-push — 로컬 메모리 정본을 synk-memory(클라우드 사본)로 밀고,
rem 클라우드가 수거한 결정 답변(_큐/결정_답변.md)을 끌어온다.
rem 작업 스케줄러(SYNK_MemoryPush)가 시간마다 실행한다. PC가 꺼져 있으면 안 돌지만,
rem 클라우드 결정 큐는 이 동기화 없이도 마지막 push본으로 계속 돈다.
rem
rem git add -A 사용 근거: 이 저장소는 memory 폴더 단독 repo다(공유 작업 트리 아님).
rem 새 메모리 파일을 반드시 쓸어 담아야 해서 -A가 올바른 의미다 — git-scope-guard의
rem 전제(세션 여럿이 한 트리 공유)가 여기엔 성립하지 않는다.
cd /d "C:\Users\q1212\.claude\projects\C--Users-q1212-Documents-SYNK-appsscript\memory"
git add -A
git diff --cached --quiet || git commit -m "auto: memory sync"
git pull --rebase origin master
git push origin master
