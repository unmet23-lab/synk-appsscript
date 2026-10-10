# 정적 account 모드의 로그아웃 뒤 생활 진도 연결 오류

`SYNK_WORLD_PUBLIC_PAYLOAD=C:/Users/q1212/Documents/SYNK-appsscript/.tmp/world-app-life-20261010-r3/world`로 `node --test experiences/synk-world-app/qa/account-browser.test.mjs`를 실행한 첫 결과다.

생활 학습을 실제 보기로 시작해 첫 문항을 `synk.life-korean.progress.v1`에 저장했다. 쉬기·새로고침 뒤 같은 시도의 두 번째 문항을 복원했고, 남은 두 답을 골라 완료한 뒤 재접속한 홈에 1/18과 다음 이야기 연결이 남는 것을 확인했다. 이어 이야기 두 컷의 가로·세로 상태를 확인했다. 기존 타운·계정 동의·runner/rhythm 보상·진도 충돌·한글 복귀의 선행 검사도 이 지점까지 진행됐다.

마지막 로그아웃 후 guest 생활 진도 `metrics().owner`를 기다리는 당시 테스트 174행에서 20초 timeout으로 실패했다. 출력의 JavaScript 오류·자산 오류·실제 외부 요청 목록은 모두 비어 있었다. 종료한 화면은 0/18의 guest 홈이었다.

코드에서 확인한 원인은 계정 판별과 세대 판별의 차이다. WORLD client의 `logout()`은 먼저 세대를 증가시키고 guest 상태를 emit한다. 이어 account의 `clear()`가 onInvalidate를 통해 client 세대를 한 번 더 증가시킨다. 당시 앱의 생활 진도 초기화는 owner가 바뀔 때만 일어났지만 guard는 세대까지 고정했으므로, 첫 emit에 생성한 guest 진도가 두 번째 emit 뒤 오래된 세대에 묶인다. 이 코드 근거는 root에 전달했고 제품 수정은 root가 담당한다.

이 파일은 실행 출력과 실패한 단계에 대한 관찰 기록이다. 당시 테스트에는 실패 JSON 자동 저장이 없어서, 실행을 성공한 것처럼 변환하거나 가짜 자동 보고서를 작성하지 않았다. 다음 검수부터는 실패 상태·오류·스크린샷도 별도로 자동 보존한다. 최종 결과는 수정한 새 정적 출력물의 보고서로 확인해야 한다.
