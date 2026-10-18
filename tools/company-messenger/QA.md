# 검증 기록 · 2026-09-27

## 직원 음성 통화 백엔드 · 2026-10-17 로컬

### 통화·화면 공유 화면과 SDK 연결 · 2026-10-17

백엔드 계약 위에 Claude가 메신저 화면·LiveKit SDK·부모/iframe 정책을 연결했다. 기본 꺼짐은 그대로이고 가입·결제·운영 반영은 하지 않았다. 계약 요약은 [API의 화면·SDK 연결](API.md#화면sdk-연결--2026-10-17).

#### 구현 위치

- [public/voice.js](public/voice.js)가 통화 수명을 맡는다. 통화는 메신저 iframe 문서가 소유해 채팅 렌더링·방 이동·워크스페이스 메뉴 이동과 무관하다. SDK Room·E2EE worker·키 흐름·화면 공유·초대·개인 통화 알림·방 통화 설정 창을 포함한다. 스타일은 [voice.css](public/voice.css). [app.js](public/app.js)에는 방 머리 단추, `voice*` 실시간 신호, 알림함의 통화 초대 항목, 로그인 변경 시 정리만 연결했다.
- SDK는 [livekit-client 2.22.4 원본](public/vendor/livekit-client/README.md)(npm 무결성·SHA-256 기록)을 통화를 시작할 때만 불러온다.
- 회사 [workspace.js](../../docs/마케팅/온라인마케팅지도/engagement/company/public/workspace.js)는 통화가 켜진 회사에서만 메신저 iframe을 미리 불러 둔다. 그래서 메뉴를 옮겨도 통화가 이어지고 다른 메뉴에서도 초대가 울린다. iframe에는 `allow="microphone; display-capture; autoplay; fullscreen"`을 붙였다. 메신저 밖 메뉴에는 미니 조작(상태·마이크·공유 중지·통화 화면 열기·나가기)과 초대 카드(수락·거절)가 뜬다. 로그아웃은 iframe을 지워 SDK와 캡처를 끝낸다.
- [server.mjs](server.mjs)의 메신저 응답은 통화가 켜졌을 때만 `microphone=(self), display-capture=(self)`와 `connect-src 'self' wss://*.livekit.cloud https://*.livekit.cloud`를 연다. `worker-src 'self'`를 명시했고 카메라는 계속 `camera=()`다. 꺼진 회사는 이전과 같다.

#### 로컬 검증(합성)

- 새 [tests/voice-client.test.mjs](tests/voice-client.test.mjs) **21/21**: 순수 규칙(ACK 증명, 지원 검사, 오래된 관측을 '없음'으로 안 보이기, 자리 예약을 연결로 안 보이기, 울릴 초대), 정책 헤더·정적 전달·SDK 해시, 가짜 SDK로 E2EE 참가 순서·키 교체·화면 공유 순서·선택 취소·나가기·서버 쪽 종료·초대 알림 열기·연결 실패 재시도 간격, 아래 검수 지적 5건의 재발 방지.
- 회귀: 메신저 시험 전체와 회사 메신저·통화·워크스페이스 시험 **786개 중 785개 통과**([TAP](../../.tmp/company-voice-20261017/frontend-sdk/regression.tap)). 실패 1건(`deadline-overlaps-client`의 오늘 겹침 표시)은 HEAD의 app.js로도 같은 실패라 이번 변경과 무관하다. 회사 레일·탭 시험 3건(demo-messenger-navigation·growth-home·marin-home)도 HEAD 사본에서 같은 실패를 확인했다. Docker 정적 전달 시험 4/4(이미지 파일 592개, 새 통화 화면·SDK 파일 포함, 이미지 빌드 없음).
- 격리 실행기 합성 모드 + 헤드리스 Chrome 두 세션(가짜 마이크): 참가 전 마이크 막대, iframe 미리 불러오기, 키 교체 때 새 worker 1개·새 join 0회, 메뉴 이동 중 유지·미니 조작 음소거·나가기, 다른 메뉴의 초대 거절, 메신저 안 초대 수락, 휴대폰 폭 가로 넘침 없음, 로그아웃 때 iframe 제거·worker 전부 종료·자리 회수와 남은 사람의 키 교체([캡처·기록](../../.tmp/company-voice-20261017/frontend-sdk/local-synthetic/)). 이 과정에서 미디어 연결이 실패하면 SDK의 끊김 이벤트와 실패 처리가 겹쳐 `current`·`resume`을 초당 10회 넘게 부르던 문제를 찾아 고쳤다(같은 55초 동안 740회 → 4회, 이후 2→4→8→15초 간격).
- Fable 검수(10-17)에서 실제 통화에서 드러날 문제를 찾아 고쳤다. ① 암호화 ACK 요청이 한 번 실패하면 다시 보내지 않아 30초 뒤 통화 전원이 끊기던 문제 → proof를 ACK 성공까지 메모리에 두고 재전송. ② SDK가 스스로 끊긴 뒤 SDK가 멈춘 마이크 트랙을 그대로 재발행해 상대에게 무음이던 문제 → 끊기면 트랙을 버리고 새로 만든다. ③ 마이크 권한 창이 떠 있는 동안 누른 음소거가 무시되던 문제 → 트랙을 만든 뒤 음소거를 다시 확인. ④ `share/start` 응답의 넓은 토큰이 다음 재접속·키 교체에 쓰일 수 있던 문제 → 참가·ACK·resume 응답의 토큰만 쓴다. ⑤ 새로고침 뒤 끊긴 통화가 있을 때 초대를 수락하면 복구 카드가 사라지던 문제 → 다시 연결하거나 나가기 전에는 새 참가·수락을 막는다. 뒤로/앞으로 캐시에서 복원된 페이지도 `current`부터 다시 본다.

#### 실제 LiveKit Cloud 검증 · 한 PC의 두 브라우저 세션

`synk-voice-test` 시험 프로젝트에 실행기 livekit 모드로 붙었다. 헤드리스 Chrome의 서로 분리된 두 세션(로그인 쿠키 분리)이 가짜 마이크·가짜 화면으로 실제 Cloud를 통해 주고받았다([캡처·기록](../../.tmp/company-voice-20261017/frontend-sdk/cloud-one-pc/), 토큰은 가림).

- 첫 연결 3.8~6초. 두 번째 참가 때 첫 사람이 새 worker로 키를 바꿔 재연결했고 새 join은 없었다. 서버는 두 사람을 실제 연결로 관측했고 트랙 암호화 판정(`GCM`)을 통과해 철회하지 않았다.
- 상대 소리를 복호화해 재생했다(양방향 최대 진폭 1.0). 화면 공유는 1280×720으로 수신되어 프레임이 갱신됐고 화면 소리 트랙도 받았다. 서버 공유 상태는 `sharing` → 중지 뒤 비었고 음성은 이어졌다.
- 메뉴를 옮겨도 소리가 이어졌다. 미니 조작으로 음소거하자 상대 쪽 진폭 0과 서버의 `muted:true` 관측이 일치했고, 해제하면 돌아왔다.
- 새로고침 뒤 끊긴 통화가 보였고 '다시 연결'을 누르자 1초 만에 같은 참가로 복구됐다(새 join 0회).
- 상대가 로그아웃하자 그 iframe·worker가 끝나고 서버 자리가 회수됐으며, 남은 사람은 키를 바꿔 연결을 유지했다.
- 앱 사용량(검수 반영 뒤 마지막 실행): 자리 시간 3.41분·관측 2.91분, 추정 수신 4.71MB, 클라이언트 보고 수신 1.26MB. 앱 추정치이며 공급자 청구와 대조하지 않았다. 검수 반영 전·후 두 번 같은 순서로 돌려 모두 통과했다.
- 나간 뒤 통화가 끝나고 worker 4개가 모두 종료됐으며 정리 대기는 없었다.

키는 SYNK 서버가 관리하고 `mediaVerified:false`를 유지한다. 복호화된 소리·화면과 GCM 판정은 정당한 참가자 사이의 SDK 암호화가 동작했다는 근거이지, SYNK 서버·운영자로부터의 보호나 이전 키 차단을 입증하지 않는다. 화면에도 '암호화(서버 관리 키)'까지만 표시한다.

#### 추가 실기 확인 · 10-18

같은 시험 프로젝트에 실행기 livekit 모드로 붙고, 헤드리스 Chrome(가짜 마이크·가짜 화면)으로 확인했다.

- **HTTPS에서 워크스페이스 안 메신저:** 실행기를 `https://voice-qa.localhost:8453` 출처로 띄우고 자체 인증서 TLS 프록시를 앞에 뒀다(회사 세션 쿠키 `Secure` 확인). 로그인 직후 홈 화면에서 iframe이 `/messenger/`를 불러 준비 신호까지 받았다. 이어서 메신저 탭·통화 참가·양방향 소리, 다른 메뉴 세 곳(내 작업실·내 수업·SNS)을 옮기는 동안 소리 유지, 미니 조작 음소거(상대 진폭 0, 서버 `muted:true`), 메신저로 돌아온 뒤 새 join 0회, 나가기 정리를 확인했다([기록](../../.tmp/company-voice-20261018/https-local-repro/)). 그래서 ngrok 실행에서 본 `about:blank`는 앱의 HTTPS 처리 문제가 아니라, 아래 GPT 기록대로 자동화 도구가 문서 응답을 멈춘 탓으로 본다. ngrok을 거친 실제 기기 표시는 두 기기 시험에서 확인한다.
- **브라우저의 '공유 중지':** 공유 중인 화면 영상 트랙을 브라우저가 끝낼 때와 같은 `ended` 이벤트로 끝냈다. `share/stop` 200, 상대 화면 사라짐, 공유 단추 복귀, 음성 유지. Chrome 공유 막대의 단추를 직접 누른 것은 아니다.
- **E2EE worker 실패:** worker 파일을 막거나(로드 실패) 초기화 응답을 주지 않게 하면(8초 시간 초과) 두 경우 모두 LiveKit 소켓을 열지 않고 나가기를 보낸 뒤 '평문으로 연결하지 않아요' 안내를 띄웠다.
- **연달아 참가:** 두 명이 통화 중일 때 두 명이 2.5초 간격으로 들어와도 네 명 모두 연결됐다.

<a id="발견한-백엔드-문제--gpt-인계p1"></a>

#### 키 교체 중복 정지 문제(P1) · 10-18 수정·회귀 확인

키 교체가 끝나기 전에 참가자 구성이 다시 바뀌면, 이미 새 키를 받은 기존 참가자의 통화가 `encryption_pause_failed`로 끝난다.

- 재현(두 사람): A 혼자 통화 중 → B 참가 → B의 E2EE 준비가 8초 늦다가 실패해 나감 → A도 종료. 세 사람(A·B 연결 중, C가 참가 직후 worker 실패로 나감)에서는 두 번 실행 모두 A·B가 끝났다. 반대로 A가 새 키를 받기 전에 B가 나가면 A는 유지됐다. 타이밍에 달린 경쟁 상태다.
- 원인: 계약([API의 E2EE 필수 참가와 키 교체](API.md#e2ee-필수-참가와-키-교체) '클라이언트 연결 순서' 2~3단계)대로 화면은 새 키를 받으면 이전 Room을 버리고, 모두 ACK할 때까지 공급자 방에 없다. 그 사이 참가 집합이 바뀌면 [voice-encryption.mjs](voice-encryption.mjs)의 새 라운드가 `token_issued` 참가자 모두에게 `UpdateParticipant`(일시 정지)를 다시 보낸다. 방에 없는 참가자에게 Cloud는 404 `not_found`를 준다(시험 프로젝트에서 직접 확인했고, 같은 경우 `RemoveParticipant`+`revoke_token_ts`는 200). 서버는 이 실패를 받은 참가자를 `invalidate(row,'encryption_pause_failed')`로 끝낸다.
- 고칠 방향(백엔드 판단): 일시 정지가 `not_found`면 공급자에 흐르는 미디어가 없으니 참가를 끝내지 말고, 남은 토큰은 다른 방식으로 막는다. 예를 들어 일시 정지에 성공한 참가자는 새 토큰을 받기 전까지 다시 멈출 대상에서 빼거나, `revoke_token_ts`로 철회한다(같은 identity로 곧 새 토큰을 발급하므로 시각 경계를 확인해야 한다). 연결 중·재연결 중이라 잠시 방에 없는 참가자도 같은 경로를 탄다.
- 근거: [실기 기록](../../.tmp/company-voice-20261018/edge-cloud/)의 `rotation-s1-silent`(두 사람)·`diag-shots`(세 사람)에 참가 상태·감사 기록을 3초 간격으로 남겼다. 실행 스크립트와 Cloud 응답 확인 스크립트는 같은 폴더의 `scripts/`에 있다.

- 수정: 정지 완료 상태를 라운드 대신 **이미 발급한 자격**에 연결해 새 JWT 발급 전까지 보존했다. 참가 집합이 바뀌어도 정지를 중복 요청하지 않고 원격 트랙 확인은 계속한다. 연결 중·재연결 중 부재에 대한 첫 `UpdateParticipant`404 `not_found`는 `RemoveParticipant`+`revoke_token_ts` 성공으로 대체한다. 철회 시각 경계 전에는 모두 ACK했어도 `token:null`이며 같은 참가의 resume으로 기다린다. 다른404·401·503이나 철회 실패는 계속 오류다. 새 JWT 발급 뒤 다음 교체에서는 반드시 다시 정지한다.
- 합성 검증: 원래 A→B 참가→A의 Room 폐기→8초 뒤 B 퇴장 회귀는 수정 전 `ended !== active`로 실패했고 수정 후 통과했다. 연결 중/재연결 중 부재·철회 시각 직전/경계·다음 JWT 뒤 재정지·오류 범위까지 백엔드 **105/105**, 준비 완료 후 토큰 대기→자동 resume을 포함한 클라이언트 **22/22** 통과. 이 시험은 실제 미디어 검증과 구분한다.
- 실제 Cloud 제어 API: 수정한 어댑터로 시험용 빈 방의 `UpdateParticipant`404 `not_found`→`RemoveParticipant`200→`ListParticipants`200/0명, 경계 뒤 교체 JWT 생성과 `DeleteRoom`200 정리를 확인했다([기록](../../.tmp/company-voice-20261018/p1-fix/cloud-adapter-result.json)). 옛 JWT의 실제 연결 거절·두 기기 미디어까지 입증한 기록은 아니다.
- 실제 회사 HTTP→Cloud 연동도 확인했다. A에게 JWT 발급 후 아직 방에 없는 상태에서 B 참가→A의 새 키 ACK→8초 대기→B 퇴장 때 **같은 A 참가가 active로 유지**되고 정지가 중복되지 않았다. 다음 키 ACK 뒤 JWT를 받은 A는 C 참가 때 다시 정지/철회됐다. 원격 정리 대기 없이 격리 환경을 종료했다([기록](../../.tmp/company-voice-20261018/p1-fix/cloud-http-churn-result.json)). SDK worker·미디어를 연결하지 않은 제어 시험이다. 메신저 초기 연결 보완을 합친 관련 회귀는 **190/190**([TAP](../../.tmp/company-voice-20261018/p1-fix/combined.tap)).
- **10-18 실제 SDK 재현 통과:** Codex Chrome 확장의 정상 UI로 격리된 두 가상 계정을 연결했다. A는 원본 SDK/worker로 Cloud ACTIVE, B만 시험용 loopback 프록시에서 worker 초기화 응답을 주지 않았다. B worker 요청 뒤 **8.077초에 자동 leave200**, 그전에 A의 새 epoch ACK와 **Cloud 방에서 실제로 비어 있던 구간**을 확인했다. B 퇴장 **1.585초 뒤 A가 같은 admissionId·joinedAt으로 ACTIVE 복구**, 화면도 `connected`였다. A 재참가0·중복 정지0·`encryption_pause_failed`0, B ACK/JWT/Cloud 참가0. 복구 후74초 이상 유지됐고 정상 나가기 뒤 두 참가 ended/left·방 없음·종료 `cleanupPending:false`를 확인했다. [안전한 상태 요약](../../.tmp/company-voice-20261018/sdk-worker-followup/run-1792290217799/sdk-worker-analysis.json) · [전체 관측·정리](../../.tmp/company-voice-20261018/sdk-worker-followup/run-1792290217799/report.json) · [A 복구 화면](../../.tmp/company-voice-20261018/sdk-worker-followup/run-1792290217799/a-survives-worker-failure.png). 실제 SDK의8초 실패 경로이며 음소거 연결 시험이다. 양방향 소리·화면 공유·두 실제 기기·수정 후3인 재현을 확인한 것으로 확대하지 않는다. 프록시/장애 주입은 종료했고 제품 소스·worker 파일은 바꾸지 않았다.
- **10-18 Claude 수정 후 재현(실제 Cloud·헤드리스 Chrome 두~세 세션):** 처음 실패를 재현한 스크립트 그대로 다시 돌렸다. 두 사람(A 혼자 통화 → B 참가 뒤 worker가 응답하지 않아 8초 뒤 퇴장)에서 A는 끊기지 않고 같은 참가로 다시 연결됐다. 세 사람(A·B 연결, C가 worker 로드 실패·초기화 무응답으로 연달아 퇴장)에서도 A·B가 유지됐고 양방향 소리(최대 진폭 1.0), 화면 공유 '공유 중지' 이벤트 처리도 통과했다. 이어서 HTTPS 출처로 메뉴 세 곳 이동 중 통화 유지·미니 조작 음소거·새 join 0회를 다시 확인했다([기록](../../.tmp/company-voice-20261018/edge-cloud-after-fix/), [HTTPS](../../.tmp/company-voice-20261018/https-local-after-fix/)). 통화 관련 단위 시험 141/141.
- **Claude 검토 반영:** 메신저 첫 연결 자동 복구에서, 권한 오류 같은 영구 실패 화면이 뒤로/앞으로 캐시로 복원되면 '다시 연결' 단추가 아무 일도 하지 않던 문제를 고쳤다(`pageshow`에서 복구 단계를 풀어 둔다). [bootstrap-recovery-client 시험](tests/bootstrap-recovery-client.test.mjs)에 재발 방지 1건을 더했다.

#### 아직 확인하지 않은 범위

- 서로 다른 두 실제 기기·다른 망(휴대폰 포함), Wi-Fi·모바일망 전환. 브라우저 오프라인 흉내 6초는 이미 맺어진 연결을 끊지 못해 망 복구를 검증하지 못했다.
- Chrome 공유 막대의 단추 자체(같은 이벤트로는 확인), Safari·Firefox, 모바일 백그라운드.
- 이전 키로 새 미디어가 복호화되지 않는지(E2EE-02).
- Cloud의 옛 JWT 철회 시각, 공급자 사용량·청구 대조. 웹훅 배달은 아래 HTTPS 실행 기록(10-18 GPT)을 따른다.

실제 두 기기 시험은 [HTTPS 실행기](#voice-live-https-setup)의 공개 주소가 준비되면 같은 화면으로 진행한다. 수정 후 두 세션의 worker 실패/중첩 교체는 위에서 확인했다. 실행 스크립트는 `.tmp/company-voice-20261017/frontend-sdk/scripts/`, `.tmp/company-voice-20261018/*/scripts/`, 이번 CUA 전용 시험 프록시는 `.tmp/company-voice-20261018/sdk-worker-followup/run.mjs`에 있다.

### 실제 통화·화면 공유 검증 환경 준비

실행기는 [qa/voice-fixture.mjs](qa/voice-fixture.mjs), 시나리오 정본은 [qa/voice-scenarios.mjs](qa/voice-scenarios.mjs)다. **검증 준비이며 실제 통화/E2EE 성공 기록이 아니다.** 실제 회사 데이터를 가져오지 않고 OS 임시 폴더의 새 회사/메신저 SQLite, 가상 직원6명과 방5개를 만든다. 현재 작업본의 회사·메신저 화면을 그대로 제공하므로 Claude의 SDK 연결 뒤 같은 실행기를 사용한다. 새 npm 패키지·공개 배포는 필요 없다.

#### 실행

저장소 루트에서 Node24로 실행한다.

```powershell
# 외부 미디어 없이 현재 HTTP 계약을 검사하고 서버/임시 DB를 정리한다.
node tools/company-messenger/qa/voice-fixture.mjs --check

# 로컬 화면·API 확인용 서버를 유지한다. 종료는 실행 터미널에서 Ctrl+C.
node tools/company-messenger/qa/voice-fixture.mjs --mode=synthetic
```

출력은 접속 주소·본 프로세스 PID·임시 폴더·`credentialsFile`·`evidenceDirectory` 위치만 알려준다. 가상 계정의 무작위 비밀번호는 임시 폴더의 `accounts.private.json`에서 확인하고 다른 계정의 비밀번호를 재사용하지 않는다. 비밀번호·회사 쿠키·CSRF·LiveKit JWT·키·ACK proof·기기 주소는 증거/채팅에 옮기지 않는다. 실제 두 사람의 시험은 서로 독립된 로그인 세션이 필요하며 같은 브라우저의 일반 탭 두 개는 로그인 쿠키를 공유한다.

기본 합성 공급자는 `.invalid` 주소를 쓰며 토큰 발급만으로 미디어 접속을 꾸미지 않는다. `--check`가 주입한 ACTIVE/GCM/공유 관측은 **제어 계약용 합성 입력**이다. 브라우저 SDK·음성·화면·암호화 미디어를 확인한 결과가 아니다. 실제 미디어용 SDK를 합성 주소에 연결해 성공을 기대하지 않는다.

#### 계정과 방

| 계정 별칭 | 역할·소속 | 용도 |
|---|---|---|
| host | member·검증팀 | 사적 방 생성자·통화/공유 진행자 |
| peer | member·검증팀 | 두 번째 실제 기기 |
| third | member·검증팀 | 세 번째 참가·초대·키 교체 |
| listener | viewer·검증팀 | 기본 입장 거부·명시적 청취 허용 |
| outsider | member·다른 팀 | 사적 방 접근 거부 |
| admin | admin·다른 팀 | 직원 비활성화·사적 방 우회 거부 |

`main`·`audio`·`listening`·`locked`는 host/peer/third/listener만 선택된 사적 방이다. 기본 방은 화면 소리와 viewer 입장이 꺼져 있다. `audio`는 화면 소리만 허용하고 `listening`은 viewer 입장만 허용하며 `locked`는 새 참가를 잠근다. `public`은 전체 직원 공개 방이다. 실행마다 UUID가 바뀌므로 계정/방 ID는 `run.json`에서 확인한다. 환경에는 별도 인증 우회/QA HTTP 제어 경로가 없다.

#### 실제 LiveKit 연결 준비

실제 모드는 현재 프로세스에 지정한 **시험 전용** `SYNK_VOICE_TEST_LIVEKIT_URL`, `SYNK_VOICE_TEST_LIVEKIT_API_KEY`, `SYNK_VOICE_TEST_LIVEKIT_API_SECRET`만 읽는다. 기존 `SYNK_VOICE_LIVEKIT_*`·회사 데이터·보안 폴더의 실제 키를 자동으로 가져오지 않는다. 시험 프로젝트의 사용량/예산을 확인한 뒤 승인된 실제 연결 범위에서 실행한다. 격리 실행기의 자동 시험은 합성 입력을 사용한다. 10-17 실제 테스트 프로젝트의 키 설정·Cloud 읽기 검증 결과는 아래 통합 실행 준비에 기록했다.

```powershell
# 시험 전용 환경변수3개를 준비한 뒤 같은 PC의 실제 SDK 연결에 사용한다.
node tools/company-messenger/qa/voice-fixture.mjs --mode=livekit

# 두 물리 기기를 연결할 때: 별도 시험 HTTPS 프록시 준비 후 사용할 주소 예시다.
node tools/company-messenger/qa/voice-fixture.mjs --mode=livekit --port=4299 --origin=https://voice-qa.example.test
```

`voice-qa.example.test`는 설명용 주소이며 DNS·인증서·프록시는 구성하지 않았다. 실행기는 항상 `127.0.0.1`에만 바인딩한다. 휴대폰의 localhost는 이 PC가 아니므로 두 물리 기기에는 별도 시험 HTTPS 주소→이 프로세스의 루프백 포트 연결이 필요하다. 기존 `workspace.synk.im`/`synk.im`을 시험 origin으로 쓰지 않는다. 호스트/포트 보안·방화벽·운영 프록시를 이 실행기가 바꾸지 않는다. 실제 웹훅 목적지는 시험 HTTPS 주소의 `/messenger/api/voice/webhook`이며 시험 프로젝트에 별도로 설정한 뒤 CLOUD-01에서 확인한다.

실행기 매니페스트의 `frontendSdkStatus:'not_checked'`는 실행 시점의 초기값이다. 10-17 화면·SDK 연결과 그 검증 결과는 위 [통화·화면 공유 화면과 SDK 연결](#통화화면-공유-화면과-sdk-연결--2026-10-17)에 있다. 기기 푸시·SYNK ID·교사/고객 연동·마케팅 수집·AI·Drive는 이 환경에서 연결하지 않는다. 통화 초대의 앱 내 UI는 시험할 수 있지만 OS 푸시 실물 검증을 대신하지 않는다.

<a id="voice-live-https-setup"></a>

#### LiveKit·HTTPS 통합 실행 준비 · 2026-10-17~18

[qa/voice-live.mjs](qa/voice-live.mjs)는 위 격리 실행기를 재사용한다. 별도 테스트 LiveKit 프로젝트와 ngrok 계정/도구를 준비한 뒤, 읽기 전용 Cloud 접속 점검→임시 워크스페이스→HTTPS 터널을 시작한다. 운영 프로젝트의 키·DB는 자동으로 읽지 않는다. 신규 결제·자동충전·유료 전환은 이 실행기가 처리하지 않는다.

**현재 상태(10-18 후속):** 실제 Cloud의 시험 웹훅이 HTTPS 서버에서400으로 거절됨을 재현했다. 인증 후 형식 분류에서 `EV_…` 이벤트ID·숫자 문자열 시각을 확인했고, 클라이언트용 UUID 검사를 공급자 이벤트ID에 적용하던 오류를 고쳤다. 수정 뒤 **Cloud→ngrok→서버200**을01:20:55 KST에 확인했다. 같은 공개 주소에서 서명 없음·위조 서명은각401이다. 중복/충돌·잘못된ID·서명 검사 회귀도 통과했다. [수정 전400](../../.tmp/company-voice-20261018/https-webhook-format/webhook-receipts.json) · [수정 후200/401](../../.tmp/company-voice-20261018/https-ready/webhook-receipts.json) · [공개 음성 이벤트 거절 검사](../../.tmp/company-voice-20261018/https-ready/webhook-negative-probes.json). Cloud의 시험 이벤트는 실제 참가자 미디어나 옛JWT 철회를 입증하지 않는다.

**10-17 설정 기록:** 앱 재시작 뒤 Chrome 연결이 복구됐다. `synk-voice-test`(`p_61k3v9d3yc0`)의 Build 요금제·다음 청구 예상 $0.00·당시 사용량0을 확인하고, 사용자 승인으로 `synk-voice-test-local-qa-20261017` 키를 발급해 저장소 밖 전용 env에 저장했다. `--check-cloud`는 실제 Cloud의 임의 미존재 방 조회에 성공했다(방 생성0·참가0·미디어 미검증). 같은 키로 서명하는 테스트 웹훅도 `https://trading-fernlike-scuff.ngrok-free.dev/messenger/api/voice/webhook`에 저장했다.

ngrok 무료 계정·개발 도메인 `trading-fernlike-scuff.ngrok-free.dev`와 공식 Windows 에이전트3.39.11을 준비했다(Authenticode Valid·발행자 ngrok, Inc.). 최초 토큰의 도구 출력 노출 뒤 사용자가 직접 교체를 완료했다. 새 값이 이전 값과 다른 것을 확인해 출력 없이 전용 env에 저장했고, 설정 검사6항목과 Cloud 읽기 인증을 확인한 뒤 **HTTPS 서버를 실행했다.** 신규 결제·유료 전환은 하지 않았다. [준비 상태](../../.tmp/company-voice-20261017/cloud-https-setup/setup-progress.json) · [요금제 화면](../../.tmp/company-voice-20261017/cloud-https-setup/livekit-build-plan.png) · [개발 도메인](../../.tmp/company-voice-20261017/cloud-https-setup/ngrok-dev-domain.png) · [웹훅 저장](../../.tmp/company-voice-20261017/cloud-https-setup/livekit-test-webhook.png).

**실제 공개 접속 확인:** 10-17 Chrome에서 HTTPS 로그인·메신저 직접 주소·기본 시험 방의 통화 참가 단추·실시간 연결 표시를 확인했다. 별도 로컬 HTTP 클라이언트가 정상 로그인한 가상 동료로 보낸 메시지가 공개 HTTPS 브라우저에 새로고침 없이 나타났다([화면](../../.tmp/company-voice-20261017/cloud-https-setup/https-messenger-sse.png), [관측](../../.tmp/company-voice-20261017/https-live-20261017-ready/sse-smoke.json)). 당시 콘솔의 `Test webhook event sent`만 확인하고 수신 상태를 미확인으로 남겼으며,10-18 위 수신 기록으로 보완했다.

**현재 실행(10-18 앱 재시작 후):** 이전 PID35928/터널52208과 로컬 리스너가 모두 없음을 확인하고, 같은 P1 수정 코드를 **PID28864/터널36156**으로 다시 시작했다. 표준 프로필(동시4명·최대600초), [현재 run.json](../../.tmp/company-voice-20261018/https-refresh-restart-20261018/run.json)의 `credentialsFile`에 새 가상 계정 비밀번호가 있다. PC는 `host`, 휴대폰은 `peer` 계정을 사용한다. 비밀번호는 임시 파일에서만 확인한다. Cloud 읽기·터널 준비·Chrome의 새 진행자 HTTPS 로그인과 내장 화면 표시를 확인했다. 아래 반복 새로고침은3회 중2회 성공·1회 문서 로딩 정지였고, 이 실행의 새 웹훅/미디어 검증을 이전 실행 결과로 채우지 않는다. 이전 실행 기록은 [run.json](../../.tmp/company-voice-20261018/rekey-refresh-1792289339826/run.json)에 보존한다.

1. PC/휴대폰에서 [테스트 워크스페이스](https://trading-fernlike-scuff.ngrok-free.dev/)를 열고 ngrok의 `Visit Site` 안내를 통과한 뒤 해당 가상 계정으로 로그인한다.
2. 로그인 뒤 [메신저 직접 주소](https://trading-fernlike-scuff.ngrok-free.dev/messenger/)를 연다. `전체채팅` → `통화 검증 · 기본`에서 시작한다.
3. **워크스페이스 빈 화면 보완·실제 Chrome 확인:** 고정 iframe이 로딩 안내를 덮던 문제에 이어,12초 지연 시 안내와 `메신저만 열기` 새 탭 링크를 제공한다. 준비 완료·재시도·로그아웃은 지연 타이머/표시를 정리하며 준비 완료 전후의 같은 프레임을 유지한다. 실제 Chrome HTTPS에서 **내장 메신저·실시간 연결·메뉴 왕복 후 초안 유지·가상 계정 메시지 전송/표시**를 확인했다([화면](../../.tmp/company-voice-20261018/chrome-recheck-1792287897996/workspace-embedded-ready.png), [관측](../../.tmp/company-voice-20261018/chrome-recheck-1792287897996/chrome-observation.json)). 새로고침 때 지연이 한 번 재현돼 [복구 안내](../../.tmp/company-voice-20261018/chrome-recheck-1792287897996/workspace-delay.png)를 보여주었고 `다시 연결`로 메시지까지 복구했다. 초기 지연의 내부 원인은 미확정이다. `Fetch.requestPaused`/원시CDP 불가 오류는 정상 내장 화면에서도 남았으므로 이 신호만으로 앱의 영구 실패를 단정하지 않는다. 사용자 관측 대기는 해소했으며 실제 통화 중 메뉴 이동은 별도 미디어 시험이다. Chrome 화면·SDK 관련44/44(메뉴23·통화 클라이언트21) 통과.

**10-18 초기 연결 후속:** 첫 메시지/읽음 조회가 끝날 때까지 완성된 shell까지 부모가 숨기는 구조를 고쳤다. 이제 shell과 메시지 로더를 먼저 보이고, 같은 부모의 준비 상태 재확인 요청에 다시 응답한다. 초기 준비 신호가 없으면12초 뒤 확인 요청→1초 대기→같은 iframe 재탐색을 최대2회 수행한다. 준비 완료·활성 통화에서는 자동 재탐색하지 않고 로그아웃 시 대기 작업을 지운다. 관련 합성190/190에 대기 중 shell 표시·신호 유실 복구·자동 재시도 상한·통화 보호를 포함했다. 실제 Chrome에서는 버튼을 누르지 않고 문서 요청3회가 발생한 것까지 확인했으나, 각 `/messenger/` 문서가200 `Fetch.requestPaused`에 머물고 자식 app.js/bootstrap 요청이 시작되지 않아 **자동 복구 성공은 미확인**이다. 부모 문서는 complete였고 다른 API는200/h2라 부모 load 대기나 HTTP/1 소켓 한도로 보지 않는다. [상태/경로만 남긴 추적](../../.tmp/company-voice-20261018/chrome-recheck-1792287897996/refresh-before-sanitized.json) · [자동 재시도 관측](../../.tmp/company-voice-20261018/chrome-recheck-1792287897996/refresh-auto-observation.json). 브라우저 도구가 문서 응답을 처리 중이라는 제한을 우회하지 않았다. 이전 정상 Chrome 표시 기록과 현재 도구 차단을 구분한다.

이전 PID35928 실행에서도 수동 `다시 연결` 뒤 내장 메신저·실시간 연결·가상 방 목록·기본 방의 참가 단추가 정상 표시됐다([화면](../../.tmp/company-voice-20261018/rekey-refresh-1792289339826/workspace-ready-after-manual-recovery.png), [관측 범위](../../.tmp/company-voice-20261018/rekey-refresh-1792289339826/chrome-observation.json)). 자동 복구 성공으로 기록하지 않았으며 통화/마이크를 시작하지 않았다.

**10-18 SDK 재현과 함께 확인한 초기 연결 추가 수정:** SSE가 첫 대화 GET→읽음 POST→채널 GET 완료를 기다리던 의존성을 없앴다. shell과 초기 채널 상태 직후 실시간 연결을 시작하고 읽음 처리는 메시지 표시와 분리한다. 먼저 끝난 실시간 재조회가 있으면 늦은 초기 기록/오류가 덮지 않으며, 재조회 실패 때 초기 기록은 사용할 수 있다. 수정 전3건 실패→수정 후 관련 client101/101, 최종 직접 관련50/50([TAP](../../.tmp/company-voice-20261018/sdk-worker-followup/client-regression.tap)). 같은 Chrome에서 로컬 A 새로고침, B 워크스페이스 진입과 새로고침 후 **수동 재연결0회·내장 메신저·실시간 연결됨**을 확인했다([화면](../../.tmp/company-voice-20261018/sdk-worker-followup/run-1792290217799/workspace-local-auto-ready.png)). 단 B 최초 로그인 preload 때와 공개 ngrok HTTPS 두 탭에서는 자식 문서 로딩 정지가 다시 관측됐다. 최초 iframe src를 DOM 연결 다음 task로 미루는 실험도 효과 없어 원복했다. 따라서 **모든 HTTPS 새로고침의 자동 표시까지 완료했다고 보고하지 않는다**. 이 제한은 실제 SDK 복구 성공과 별도다.

**10-18 초기 bootstrap 자동 복구 추가:** 초기 GET이 한 번 실패하면 오류 화면이 부모에 ready를 보내 자동 복구가 끝나던 경로를 보완했다. bootstrap만10초 제한, 네트워크 오류·5xx·429·시간 초과는2→4→8→16→최대30초 간격으로 다시 요청한다. 숨겨진 화면에서는 대기하고 온라인/화면 복귀 때 재시도한다. 동시 요청은1개이며 성공·로그인 전환·페이지 종료는 타이머/요청/늦은 응답을 무효화한다. 브라우저 캐시로 돌아온 미완료 초기화도 재개한다.401은 기존 회사 로그인 이동,403/404 등은 자동 재시도하지 않는다. 직접 관련 **66/66**([TAP](../../.tmp/company-voice-20261018/sdk-worker-followup/bootstrap-regression.tap)), 클라이언트 범위 **351/352**([TAP](../../.tmp/company-voice-20261018/sdk-worker-followup/final-client-regression.tap)); 실패1건은 업무 기한 화면의 `고객 합의 기한` 기대값과 `합의한 전달일` 표시 차이로 HEAD의 app.js에서도 같은 실패를 확인했다([HEAD 비교](../../.tmp/company-voice-20261018/sdk-worker-followup/head-check/result.tap)). 시험 프록시에 `--mode=synthetic --bootstrap-failures=2`를 준비했으나 최종 Chrome 검증 시작 시 도구가 `Local browser use is disabled in Work settings`로 차단됐다. 이 **503 두 번 뒤 실제 화면 자동 복구와 공개 HTTPS 반복 새로고침은 미확인**이며 합성 시험을 실제 화면 결과로 대체하지 않는다.

**10-18 앱 재시작 뒤 실제 Chrome 후속 검증:** 로컬 브라우저 설정 차단은 해소됐다. 격리 프록시에서 bootstrap503을2회 주입하고, **재연결 클릭0회로 첫 오류 뒤6.878초에 bootstrap200·내장 대화 목록·실시간 연결됨**을 확인했다. [관측](../../.tmp/company-voice-20261018/sdk-worker-followup/run-1792291851997/ui-observation.json) · [복구 화면](../../.tmp/company-voice-20261018/sdk-worker-followup/run-1792291851997/automatic-recovery.png). 시험 프록시는 정상 종료했고 `cleanupPending:false`다. 공개 ngrok HTTPS에서도 최초 진입은 자동 복구했고, 이어진 새로고침1·2회는 수동 조작 없이 내장 화면과SSE가 표시됐다. 하지만3회째는70초 관측까지 실패했다. 부모는complete/visible, iframe 문서200이3회(최초+자동 재탐색2회)였지만 해당 자식의 `Page.frameNavigated`가 없었고 도구의 읽기 전용 `Page.getFrameTree`도 `paused document response` 처리 중이라 거절됐다. 정상1·2회에서는 같은200 뒤 자식 탐색 완료가 관측됐다. 따라서 **일시 API 오류 자동 복구는 실화면 통과, HTTPS 간헐 문서 정지는 미해결**이다. 내부 원인을 앱 또는 확장 중 하나로 확정하거나 도구의 문서 처리를 우회하지 않는다. [HTTPS3회 기록](../../.tmp/company-voice-20261018/https-refresh-restart-20261018/ui-observation.json) · [문서 탐색 기록](../../.tmp/company-voice-20261018/https-refresh-restart-20261018/refresh-network-followup.json) · [남은 지연 화면](../../.tmp/company-voice-20261018/https-refresh-restart-20261018/https-refresh-stalled.png). 이번 재검증에서 제품 코드는 추가 변경하지 않았다.

**10-18 브라우저 도구와 앱 분리·장기 초기 연결 복구 수정:** 사용자가 격리 Chrome·Playwright 비교 시험을 명시적으로 승인했다. 같은 ngrok HTTPS·Chrome155.0.8059.85·가상 진행자 계정으로, 저장된 사용자 프로필/확장 없는 Chrome에서 정상 TLS 검증을 유지했다. 수정 전 headless 새로고침 **10/10**(1.8~3.9초), 일반 창 **3/3**(2.5~3.4초)이 내장 화면·SSE·초기 기록 로딩 완료까지 통과했다. [10회](../../.tmp/company-voice-20261018/https-refresh-restart-20261018/baseline-1792292736464/report.json) · [일반 창3회](../../.tmp/company-voice-20261018/https-refresh-restart-20261018/baseline-1792292786608/report.json). 기존 CUA 경로의 문서200 뒤 탐색 미완료와 대조해, **70초 문서 정지는 도구가 연결된 Chrome 경로로 좁혔다.** 프로필/확장 내부의 직접 원인까지 확정한 것은 아니다. ngrok 최초 방문 안내에서 멈춘 실행2건은 앱 시험 전 준비 실패이며13회 집계에 포함하지 않았다.

앱에도 독립 결함이 있었다. 부모가 초기 재시도2회를 소진한 뒤 약39초에 타이머를 없애, 이후 네트워크가 회복돼도 수동 버튼이 필요했다. 이제 준비 전·통화 없음 상태에서 첫2회 뒤 **30초 간격으로 계속 재시도**하고, hidden/offline에서는 대기하며 online/visible/BFcache 복귀 시 준비 상태를 재확인한다. ready·통화·로그아웃·페이지 종료는 타이머를 취소하고 옛 콜백은 세대로 무효화한다. 수정 전4개 회귀 실패→수정 후 관련 **69/69**([수정 전](../../.tmp/company-voice-20261018/iframe-recovery-before.tap), [수정 후](../../.tmp/company-voice-20261018/iframe-recovery-related.tap)). 최종 파일 해시를 고정한 공개 HTTPS 시험에서는 문서를 **45초 동안503으로 주입**해 최초/자동2회까지 실패시킨 뒤 **61.215초에 내장 화면·SSE 자동 복구**, iframe1개·aria-busy=false·재연결 클릭0·JS오류0을 확인했다. [45초 장애와 복구](../../.tmp/company-voice-20261018/https-refresh-restart-20261018/document-outage-1792292977860/report.json) · [복구 화면](../../.tmp/company-voice-20261018/https-refresh-restart-20261018/document-outage-1792292977860/ready-1.png). 최종 수정본의 정상 새로고침도 **3/3** 통과했다([기록](../../.tmp/company-voice-20261018/https-refresh-restart-20261018/baseline-1792292925157/report.json)). CUA의 응답 처리 자체를 중지하거나 우회하지 않았고, 이 수정으로 도구 내부 정지까지 해소됐다고 보고하지 않는다. 변경은 작업본과 기존 테스트 서버에 반영됐으며 운영 배포는 하지 않았다.

이 HTTPS 실행에서는 휴대폰 접속·마이크·실제 통화/화면 공유/E2EE를 실행하지 않았고23개 시나리오는 아직 `not_run`이다. CLOUD-01 중 웹훅 배달 부분만 이전 실행에서 확인했으며, 실제 두 기기의 통과 기록으로 해석하지 않는다.

재현하거나 다른 PC에 준비할 때는 Chrome의 별도 테스트 프로젝트에서 요금제·한도를 확인하고, ngrok의 무료 도메인·토큰·공식 에이전트를 준비한다. 기존 승인 범위를 벗어난 가입·약관·접근 권한 확대는 동작 직전에 확인하며 신규 결제는 진행하지 않는다. 앱/실시간 이벤트 통과 여부는 실제 공개 주소에서 확인한다.

다음 명령은 저장소 밖 `~/SYNK_보안/voice-live-test.env`를 **최초 한 번만** 만든다. 이미 있는 파일은 덮지 않는다. 이 PC에는 아래6항목을 모두 저장하고 검사를 마쳤으므로 다시 초기화하지 않는다.

```powershell
node tools/company-messenger/qa/voice-live.mjs --init
```

해당 파일에는 아래 값을 저장한다. 키/토큰은 채팅·Git·검증 결과에 붙이지 않는다. ngrok 실행 파일은 압축을 푼 실제 파일의 절대경로를 적는다.

| 설정 | 값의 출처 |
|---|---|
| `SYNK_VOICE_TEST_LIVEKIT_URL` | 테스트 프로젝트의 `wss://…livekit.cloud` 주소 |
| `SYNK_VOICE_TEST_LIVEKIT_API_KEY` | 같은 프로젝트의 테스트 API 키 |
| `SYNK_VOICE_TEST_LIVEKIT_API_SECRET` | 위 키의 Secret |
| `SYNK_VOICE_TEST_HTTPS_ORIGIN` | ngrok에서 할당된 `https://…` 도메인, 끝의 `/` 제외 |
| `SYNK_VOICE_TEST_NGROK_BIN` | 내려받은 `ngrok.exe`의 절대경로 |
| `SYNK_VOICE_TEST_NGROK_AUTHTOKEN` | ngrok 테스트 계정의 Authtoken |

```powershell
# 로컬 값·실행 파일 존재만 확인한다. 빈 항목이 있으면 이름만 출력하고 종료코드2.
node --env-file="$env:USERPROFILE/SYNK_보안/voice-live-test.env" tools/company-messenger/qa/voice-live.mjs --check

# LiveKit의 임의 미존재 방을 1회 조회한다. 방/참가/토큰/미디어는 생성하지 않는다.
node --env-file="$env:USERPROFILE/SYNK_보안/voice-live-test.env" tools/company-messenger/qa/voice-live.mjs --check-cloud

# 두 기기용 서버 + 지정한 HTTPS 도메인 터널. 기본은 4299와 standard 프로필.
node --env-file="$env:USERPROFILE/SYNK_보안/voice-live-test.env" tools/company-messenger/qa/voice-live.mjs
```

`--profile=short`·`--profile=budget`·`--port=빈포트`·`--out=새폴더`를 지정할 수 있다. `--port=0`이면 빈 루프백 포트를 자동 선택한다. 이 실행은 LiveKit 인증 확인 후 터널 에이전트가 지정한 HTTPS 도메인과 자신의 임시 워크스페이스를 연결했는지 로컬 API로 대조한다. 다른 실행 중인 ngrok 에이전트/설정에는 붙지 않는다. HTTP 검사 기록은 `--inspect=false`로 끄며 에이전트에 LiveKit 키를 넘기지 않고 원시 에이전트 로그도 결과에 저장하지 않는다. ngrok3.39.11의 실행 옵션·격리 설정 `config check`·실제 터널 기동과 정상 종료를 확인했다. 기존 실행을 먼저 종료하고 재시작하며, 새 실행마다 계정 비밀번호·방 UUID·증거 폴더가 바뀐다.

출력의 `url`을 PC Chrome과 휴대폰에서 각각 열고 서로 다른 가상 계정으로 로그인한다. **에이전트의 연결 확인만으로 공개 HTTPS·쿠키·SSE·iframe·마이크·WSS·E2EE가 검증된 것은 아니다.** ngrok의 방문자 확인 화면이 나오면 각 기기에서 직접 통과한 뒤 로그인하고, 메시지 실시간 수신도 확인한다. LiveKit 테스트 프로젝트의 웹훅 주소를 출력된 `webhookUrl`(`/messenger/api/voice/webhook`)로 설정하고 서명에 쓰는 키가 테스트 서버 설정과 일치하는지 CLOUD-01에서 확인한다.

증거 폴더의 `environment.json`은 생성 시 Cloud 읽기 접속과 터널 설정 확인만 기록하며 `browserHttpsVerified`·`cloudWebhookConfigured`·`mediaVerified`를 `false`로 시작한다. 현재 실행에는 위 실제 브라우저/콘솔 근거를 덧붙였다. 이후 시나리오의 일부 사전 관측과 전체 통과를 구분하고, 실제 기기·웹훅·미디어 결과는 근거와 함께 `results.json`에 기록한다.

`webhook-receipts.json`은 시험 서버가 받은 정확한 웹훅 경로의POST에 대해 수신/응답 시각·상태 코드·Authorization 존재 여부를 최대64건 보존한다. `verifiedFormats`도 인증에 성공한 뒤 ID/시각의 형식 분류·이벤트 이름 존재 여부만 최대64건 남긴다. 인증값·요청 본문·이벤트 값·IP는 남기지 않는다.10-18 관련 통화/HTTPS109/109·워크스페이스 메뉴22/22시험을 통과했다([범위](../../.tmp/company-voice-20261018/iframe-webhook/verification.json)).

정상 종료는 **Ctrl+C**다. 미디어 철회를 시도한 뒤 이 실행기가 만든 터널 프로세스만 종료하고 결과를 보존한다. `cleanupPending:true`이면 원래 fixture DB를 보존하므로 위의 `--cleanup`을 같은 `--env-file`과 함께 사용한다. `httpsCleanupPending:true`가 나오면 출력된 `tunnelPid`의 명령줄을 확인해 이 실행의 ngrok인지 대조하고 해당 프로세스만 정리한다.

기존 실행기/HTTPS 시작·취소/키 격리/증거 보존14/14에 이어, 실제 Chrome에서 발견한 메신저 외부 링크403을 보완했다. 공개 HTML의 최상위 GET 탐색만 허용하며 다른 출처 API·iframe·Origin 불일치와 인증/CSRF 검사는 유지한다. 회사 메신저 통합·격리 fixture·HTTPS 실행기 **30/30** 통과([로그](../../.tmp/company-voice-20261017/cloud-https-setup/https-final-regression.log)). 자동 시험의 공급자/터널은 합성 입력이며, 실제 Cloud·HTTPS 관측은 위 현재 상태와 분리했다.

#### 시험 한도

| 프로필 | 전체 인원 | 최대 시간 | 월 참가자분 | 월 추정/보고 수신량 가드 |
|---|---:|---:|---:|---:|
| standard | 4 | 600초 | 100분 | 100MB |
| short | 4 | 60초 | 100분 | 100MB |
| budget | 4 | 600초 | 1분 | 1MB |

`--profile=short`는 최대 시간, `--profile=budget`은 한도 소진 시나리오용이다. 각 프로필은 새 환경으로 실행한다. 앱 운영 기본값을 변경하지 않으며 공급자 청구 상한을 보장하지 않는다. 기본 공유 슬롯은 전체1명이고 키 준비30초·초대45초·heartbeat25초·임대75초·재접속30초 계약은 그대로다. 합성 선행 검사의 시계 전진은 실제 소요 시간이나2시간 통화 실측으로 기록하지 않는다.

#### 시나리오와 증거

실행별 `evidenceDirectory`에 `run.json`, `scenarios.json`, `results.json`, `screen-pattern.html`을 만든다. **23개 시나리오의 최초 상태는 전부 `not_run`**이며 환경 생성이나 합성 선행 검사가 실제 시나리오를 통과로 바꾸지 않는다. 성공·실패·진행 불가·미지원(`pass`/`fail`/`blocked`/`unsupported`)과 기기/OS/브라우저/SDK 버전, 시작·종료 시각, 관측 결과·증거 파일을 기록한다. 실제 결과는 임시 DB 폴더가 아닌 내보낸 증거 폴더의 `results.json`에 남겨 종료 뒤에도 보존한다.

| 시나리오 | 확인할 결과 |
|---|---|
| ENV-01·CLOUD-01 | 지원/정책·실제 Cloud 권한/옛 JWT·GCM 필드·서명 웹훅 |
| CALL-01~04 | 양방향 청취·장치/음소거·메뉴 이동·망 전환·새로고침/중복 로그인 |
| SHARE-01~05 | 화면/창/탭·선택적 소리·브라우저 중지·대기 중 취소/재전송·전체 공유1명 |
| E2EE-01~03 | 참가 집합별 새 키·퇴장자/이전 키 차단·미지원/worker 오류/기한 종료 |
| AUTH-01~03 | 듣기 전용·사적 방/관리자·로그아웃/비활성화/방 이탈 |
| INVITE-01~02 | 동의·45초 만료·다중 기기·방해 금지/무음·재호출 제한 |
| USAGE-01·LIMIT-01~02·LIFE-01 | 통계 대조·낮은 예산/시간 소진·서버 종료/미정리 복구 |

공유할 원본은 [시험 화면](qa/voice-screen-pattern.html)을 별도 탭/창으로 연다. 바뀌는 시계·색·24/16/12px 글자와 사용자가 누르는10초 시험음만 있으며 자동 녹음·카메라·네트워크 호출은 없다. 원본 자체의 갱신과 수신 화면을 비교하고, 시험음은 마이크로 들어간 소리와 탭 소리를 구분한다. 실제 캡처/오디오 출력은 이번 준비에서 실행하지 않았다.

키는 SYNK 서버가 관리하는 방식이다. SDK ACK·GCM 메타데이터만으로 실제 프레임 암호화/복호화 또는 서버 운영자로부터의 보호를 입증하지 않는다. 기존 `mediaVerified:false`를 유지하고, 실제 E2EE·서버 신뢰 범위와 미확인 기기를 구분해 보고한다.

#### 종료·복구 정리

Ctrl+C로 정상 종료한다. 원격 철회가 확인되면 임시 계정/SQLite만 지우며 내보낸 증거는 남긴다. 실패하면 `cleanupPending:true`와 `retainedDirectory`를 출력하고 DB를 보존한다. 광범위한 node 프로세스 종료나 임시 폴더 일괄 삭제를 하지 않는다.

```powershell
# 원래 서버 종료 후, 같은 시험 프로젝트의 환경변수를 유지한 상태에서 재시도한다.
node tools/company-messenger/qa/voice-fixture.mjs --cleanup=보존된_임시폴더_절대경로
```

실행 중인 fixture·시험 프로젝트 URL이 다른 키 설정·임시 fixture 밖 경로·링크가 든 삭제 대상은 거부한다. 새 실행은 옛 키/참가를 복원하지 않는다.

#### 준비 검증 기록

실행기 시험5개와 기존 회사 실제 라우터 통화 시험1개, 총 **6/6**을 통과했다([TAP](../../.tmp/company-voice-20261017/test-environment/preparation-final.tap)). 합성 제어 흐름, 운영 키 자동 상속 차단, 가짜 시험 키를 넣은 실제 공급자 모드의 시작/정리 외부 호출0회, 미정리 DB 보존/재정리, 증거와 로그인 파일 분리/종료 후 보존, 잘못된 실행 옵션/경로를 확인했다. 별도 `--check`에서 사적 방/역할·키/CSRF·키 교체·공유 중지/재전송·초대 동의·로그아웃 철회 **6/6**을 확인했다([실행 결과](../../.tmp/company-voice-20261017/test-environment/prepared-evidence/preflight.json)). 실제 시나리오23개는 모두 `not_run`이다([기록 틀](../../.tmp/company-voice-20261017/test-environment/prepared-evidence/results.json)). Docker 정적 전달도1/1이다([TAP](../../.tmp/company-voice-20261017/test-environment/container.tap)). 실제 LiveKit/SDK/두 기기 미디어는 미실행이며 선행 검사 뒤 임시 서버/DB는 정리했다.

### 3차 후속 점검 · 동시 요청·종료·상태 보완

통화99개·회사 실제 라우터 통화1개·푸시33개·협업8개·기존 회귀61개, 총 **202/202**을 통과했다([최종 TAP](../../.tmp/company-voice-20261017/audit-followup/regression.tap), 앞선 점검201/201에 취소 요청 재전송 회귀1개 추가). 아래 3차와 같은 선택 회귀 파일을 실행했으며 전체 저장소 시험을 뜻하지 않는다. 앞선 새 회귀11개는 수정 전 소스를 메모리에서 주입한 재현에서 모두 실패했다([수정 전 TAP](../../.tmp/company-voice-20261017/audit/original-reproduction.tap), 공용 작업본을 되돌리지 않음). 첫 참가 응답의 오래된 상태도 기존 E2EE 시험에 단언을 추가해 실패를 확인하고 고쳤다.

- **공유 중지/정책 철회와 상태 조회의 경합:** 공급자에 남아 있는 기존 공유를 새 무허가 트랙으로 판단해 음성 전체를 철회했다. 공유 권한을 먼저 줄이고 트랙 정리를 확인한 뒤 미디어 정책을 대조하도록 순서를 고쳤다. 직접 서비스와 실제 HTTP 경로에서 음성 유지·공유 슬롯 반환·타인/CSRF 없는 중지 거부를 확인했다. 정리 확인 실패 시 전체 철회와 슬롯 유지도 기존 회귀로 확인했다.
- **느린 공유 시작 응답:** 원격 권한 상승 중 임대·최대 수명·월 사용량이 끝나도 넓은 JWT를 반환할 수 있었다. 반환 직전에 현재 권한/참가·시간·누적 사용량을 다시 대조하며 세 경우 모두 토큰 없이 종료하는지 확인했다.
- **퇴장/캡처 취소의 선행 처리:** leave가 원격 대기열에 묶인 동안 새 JWT를 반환하거나, 공유 예약 전 상태 조회 중의 stop을 잊고 공유를 시작했다. 퇴장은 즉시 참가·키를 차단하고 공유 중지는 아직 예약이 없는 진행 중 시작 요청도 취소한다. 늦은 권한 응답 뒤 발급이 없고 취소한 공유 자리가 남지 않는지 확인했다.
- **암호화 준비 상태:** 공급자의 이전 ACTIVE 연결이 `securing`과 키 준비 기한을 덮거나 첫 join 응답이 옛 `connecting` 상태를 반환했다. 준비 중에는 실제 연결 목록에 올리지 않고 현재 참가 행으로 응답한다. 기존 모든 참가자 ACK·기한·퇴장자 키 차단 시험도 통과했다.
- **정리 대기열 누적:** 방4개의 조회가 각각3초 걸리는 합성 공급자에서 반복 점검10개가 heartbeat를 밀어 임대를 종료했다. 대기 중 점검을 한 번으로 합치고, 실행 중 새 변경의 후속 점검은 남겨 연결 유지를 확인했다. 실제 3초 지연 호출이나 외부 트래픽을 발생시키지는 않았다.
- **취소한 공유 요청의 재전송:** 최초 조회 중 취소한 시작 요청은 진행 중 실행만 막았고 같은UUID로 다시 보내면 권한이 열렸다([수정 전 실패](../../.tmp/company-voice-20261017/audit-followup/replay-before.tap)). 기존 공유 표에 종료 영수증을 남겨 같은 요청 재전송은 차단하고 새UUID의 명시적 공유는 허용했다. 슬롯·토큰·원격 권한 상승이 없는지 확인했다.

Docker 정적 전달 검사도 **1/1** 통과했다([TAP](../../.tmp/company-voice-20261017/audit-followup/container.tap), payload586파일·전이 import145개). 런타임 수정은 `voice-service.mjs`와 `voice-sharing.mjs`이며 화면/SDK 코드는 이 점검에서 변경하지 않았다. API 경로·입력 필드는 유지한다.

공식 [RoomService](https://docs.livekit.io/reference/other/roomservice-api/)의 Cloud 권한 변경/토큰 철회와 `revoke_token_ts`, [프로토콜 원문](https://github.com/livekit/protocol/blob/main/protobufs/livekit_models.proto)의 `TrackInfo.encryption`·`Encryption.Type.GCM=1`을 사용자 Chrome에서 다시 대조했다. 앞선 확장 오류로 못 읽었던 프로토콜 원문은 이번에 Raw 보기로 확인했다. **이는 문서/코드 계약 대조이며 실제 Cloud의 철회 시각, SDK E2EE worker·두 기기 암호화/복호화·공유 소리·다른 망·실제 소비량 검증은 여전히 남아 있다.** 기본 꺼짐·가입/결제/실제 미디어/운영 반영 없음은 유지한다.

### 화면 공유·E2EE · 3차 후속

통화87개·회사 실제 라우터 통화1개·푸시33개·협업8개·기존 회귀61개, 총 **190/190**을 통과했다. [TAP 원본](../../.tmp/company-voice-20261017/phase3-final.tap). 기존1·2차 합성 회귀는 명시적인 `e2eeRequired:false` 호환 옵션으로 유지했고, 새3차 시험에서 기본 E2EE 필수 흐름을 별도로 검증했다. 임시 SQLite·합성 직원·루프백 HTTP·독립 HMAC과 가짜 미디어 공급자를 사용했다. 회사 실제 라우터도 E2EE 필수 기본값으로 키 준비 → 토큰 발급 → 로그아웃/직원 비활성화/서버 종료 철회를 확인했다.

- 지원 신고가 없는 참가의426, 키 확인 전 JWT 없음, 본인/원래 로그인/현재 방/CSRF/공개 HTTPS 검사, 다른admin/직원의 키 조회 차단, key·challenge가 DB/공개 상태/SSE에 섞이지 않는지를 확인했다. 종료 대기와 키 요청이 겹칠 때 키 반환을 막고, 잘못된 MAC·과거epoch·SDK 암호화 끄기·시간 초과·재시작을 평문 폴백으로 우회하지 않았다.
- 참가자 추가로 기존 발행/구독을 중단하고 모두 새 키를 확인한 뒤에만 토큰을 발급했다. 퇴장자의 원격 철회 실패·권한 일시 중단 실패·기존 미디어가 계속 남는 경우 새 키를 제공하지 않았고,30초 준비 만료를 확인했다. 초대의 수락 동의가 E2EE 준비를 건너뛰지 않는지, 허용된 viewer도 암호화된 듣기 준비만 하는지 확인했다.
- 전체 공유 슬롯1개·동일 요청 재전송·별도 화면 소리 허용·카메라/data 미허용, 실제 공유 트랙 관측과 브라우저 캡처 종료, 수락 대기 중 공유 취소/권한 회수·정리 실패 때 자리를 유지하는 동작을 확인했다. 공유만 정상 회수하면 음성 참가를 유지하고, 미허가/암호화 미확인 트랙은 철회했다.
- 화면 예약의1.5Mbit/s 추정이 기존 월 수신량에 추가되고 기존1GB 한도를 올리지 않는지 확인했다. 실제 프레임·bitrate·공급자 청구를 측정한 결과는 아니다. 공급자 `UpdateParticipant`의 소스별 요청 필드와 JWT의 screen_share/screen_share_audio·발행/구독 중단, 트랙 GCM 메타데이터 정규화도 합성 응답으로 확인했다.
- 새 두 모듈을 Docker COPY/ignore의 명시 목록에 추가했다. 정적 import graph **1/1**을 통과했다([원본](../../.tmp/company-voice-20261017/phase3-container.tap), payload586파일·전이 import145개). 실제 이미지 빌드·운영 배포·HA 전환 시험은 하지 않았다.

아래 명령에 기존2차와 같은 선택 회귀를 포함했다. 전체 저장소/회사 전체 시험을 통과했다는 뜻은 아니다.

```powershell
node --test tools/company-messenger/tests/voice.test.mjs tools/company-messenger/tests/web-push.test.mjs tools/company-messenger/tests/collaboration.test.mjs tools/company-messenger/tests/api.test.mjs tools/company-messenger/tests/project-membership.test.mjs tools/company-messenger/tests/project-leave.test.mjs tools/company-messenger/tests/project-deletion.test.mjs tools/company-messenger/tests/chat-categories.test.mjs tools/company-messenger/tests/bootstrap-session-client.test.mjs docs/마케팅/온라인마케팅지도/engagement/company/server-messenger.test.mjs docs/마케팅/온라인마케팅지도/engagement/company/server-voice.test.mjs
```

**아직 확인하지 않은 범위:** 실제 LiveKit Cloud/SDK가 기존 트랙·JWT를 회수하는 시각과 `TrackInfo.encryption` 호환, 새 E2EE worker/공유 키로 두 기기가 실제 미디어를 암호화·복호화하는지, 여러 브라우저/모바일·다른 망·백그라운드·공유 소리·실제 소비량. 공식 E2EE·시작 가이드·RoomService·화면 공유 본문은 사용자 Chrome에서 확인했지만 추가 SDK/프로토콜 GitHub 원문 대조는 확장 연결 오류로 완료하지 못했다. 소스 전체 검토나 실제 암호화 검증을 마쳤다고 보고하지 않는다.

기본은 꺼짐이고 가입/결제/외부 푸시/실제 미디어/유료AI/운영 반영은 실행하지 않았다. E2EE 키는 SYNK 서버가 관리하며 SYNK 서버를 신뢰하는 범위다. 키 교체마다 SDK Room/worker를 다시 준비해야 하므로 잠깐 통화가 중단될 수 있다. 다음은 Claude의 통화·공유·초대/설정 화면과 SDK/마이크/부모 iframe 수명 연결, 실제 기기/공급자 호환·미디어 보호 검증이다. [현재 API 계약](API.md#직원-음성-통화-백엔드--2026-10-17-로컬).


### 동료 초대·수락·통화 방해 금지 · 2차 후속

통화66개·회사 실제 라우터 통화1개·푸시33개·협업8개·기존 회귀61개, 총 **169/169**을 통과했다. [TAP 원본](../../.tmp/company-voice-20261017/phase2-final.tap). 아래 명령과 임시 SQLite/합성 회사 사용자·공급자만 사용했으며 실계정·실제 미디어·외부 푸시를 보내지 않았다.

```powershell
node --test tools/company-messenger/tests/voice.test.mjs tools/company-messenger/tests/web-push.test.mjs tools/company-messenger/tests/collaboration.test.mjs tools/company-messenger/tests/api.test.mjs tools/company-messenger/tests/project-membership.test.mjs tools/company-messenger/tests/project-leave.test.mjs tools/company-messenger/tests/project-deletion.test.mjs tools/company-messenger/tests/chat-categories.test.mjs tools/company-messenger/tests/bootstrap-session-client.test.mjs docs/마케팅/온라인마케팅지도/engagement/company/server-messenger.test.mjs docs/마케팅/온라인마케팅지도/engagement/company/server-voice.test.mjs
```

- 초대만으로 상대 자리/토큰을 만들지 않고 현재 호출 참여자의 현재 방에만 연결했다. 동일 요청 재전송은 새 알림을 만들지 않으며 수락한 원래 로그인/요청만 같은 참가를 다시 확인한다. 다른 기기의 수락은 충돌하고, 종료된 참가나 초대를 되살리지 않았다.
- 수락이 원격 응답을 기다리는 동안 취소·방해 금지·발신자 나가기를 처리해 상대 토큰 반환을 막았다. 거절/취소의 재시도·45초 만료·다른 통화 중/이미 수신 대기 중·현재 방 잠금·회사 로그아웃·탈퇴 후 재초대·재시작/기능 끄기를 확인했다. 수락이 끝난 통화는 이후 방해 금지만으로 끊지 않았다.
- 본인 설정의 CSRF/Origin/revision/형식·기간 검증, viewer 개인 설정 허용과 호출 금지, 다른admin/외부인의 사적 초대 조회·수락 차단, 듣기 전용 수락과 전체 인원/월 사용량 제한을 확인했다. 방해 금지/차단 상세나 다른 사람의 미디어 토큰을 응답하지 않았다.
- 무음은 앱 내 초대를 유지하면서 통화 푸시를 제외하고, 통화 알림 끄기·방 무음·방해 금지는 수신 대기를 종료했다. 기간이 끝나도 옛 호출은 복원하지 않았다. 재호출 제한은 같은 요청을 중복 계산하지 않으면서 차단된 새 요청과 다른 수신자의 연속 호출·재시작을 포함해 적용했다.
- 기존 알림함/읽음/전체 읽음을 재사용하고 읽음은 참가로 취급하지 않았다. 수락/종료/접근 철회 후 현재 알림함과 푸시 원본에서 빠지는지, 초대의45초 만료가 큐/공급자 요청 TTL에 적용되는지, 전송 직전 원본 취소가 권한 확인을 실패시키는지 확인했다. 수락 대기 중 명단 이름 변경도 별도 트랜잭션으로 동기화돼 정상 수락을 유지했다.
- `voice-invitations.mjs`를 Docker COPY/ignore의 명시 목록에 추가하고 정적 import graph **1/1**을 통과했다([원본](../../.tmp/company-voice-20261017/phase2-container.tap), payload584파일·전이 import143개). 실제 이미지 빌드·공개 반영·HA 전환 결과는 아니다.

기본 꺼짐·음성만·전체4명·계정당1참가·2시간·월1000참가자분/1GB 추정 한도를 유지했다. 설정/호출의 최소 영수증만 저장하며 직원의 활동 감시·음성 녹음·자동 요약은 추가하지 않았다. 2차 검증 당시의 다음 범위는 화면 공유/E2EE였으며, 현재 3차 상태와 남은 실기/화면 연결은 위 기록을 따른다. 실제 알림 소리·즉시 수신·이미 사업자가 접수한 푸시 회수는 검증하지 않았으며 전화 앱 수준으로 보장하지 않는다. [현재 API 계약](API.md#직원-음성-통화-백엔드--2026-10-17-로컬).


### 실제 상태·복구·권한·사용량 · 1차 후속 검증 이력

통화 관련43개와 기존 회귀61개, 총 **104/104**을 통과했다. [TAP 원본](../../.tmp/company-voice-20261017/phase1-final.tap). 실제 HTTP·임시 SQLite·독립 HMAC 서명과 합성 공급자만 사용했으며 실제 Cloud/마이크/운영 자료는 사용하지 않았다.

- 자리 예약과 신호 연결만으로 미디어 connected를 만들지 않는지, 공급자 ACTIVE 조회와 트랙/mute 관측, 웹훅 누락 시 폴링 복구를 확인했다. 늦은 입퇴장·같은ID 중복·다른 본문·다른 room SID·위조/만료/미래/다른issuer/다른alg/본문 변조를 검증했다.
- 같은 로그인에서의 resume은 자리·재접속 유예·최대 시간을 늘리지 않는다. 첫 연결/복구 유예 만료, 경계 시각 직전 복구, 상태 조회 장애 후 복구/장기 장애, 조회 대기 중 권한 회수·다른 크루 이름 변경에 따른 명단 동기화와 통화 저장 트랜잭션 분리, 미허가 참가/화면 트랙 철회와 실패 후 재시작 정리를 확인했다.
- 정책 revision/CSRF/현재 방 관리자, 사적 방에 대한 다른admin의 우회 차단, 새 입장만 막는 잠금, 방/전체 인원 상한, 발언권 변경 시 토큰 철회, 명시적 viewer 듣기 허용·비활성화와 전체 사용량 조회 제한을 확인했다.
- UTC 월 경계, 관측/미확인 시간 분리, 이전 스키마 마이그레이션과 재시작 후 미확인 시간 보존, 월 자리 시간·추정/보고 전송량 한도, 누적 바이트 중복/카운터 감소/위조 상태 필드/다른 소유자 거절을 확인했다. 실제 청구나 실제 네트워크 전송량을 검증한 결과는 아니다.
- 회사 실제 라우터의 로그아웃·직원 비활성화·종료 철회를 유지하고, 쿠키 없는 provider callback도 해당 검증 경로에 도달해 서명 없이401이 되는지 확인했다. 기존 채팅·프로젝트·SYNK ID/회사 메신저 회귀를 함께 실행했다.
- 세 런타임 모듈의 정적 Docker COPY/import graph 검사 **1/1**도 통과했다([원본](../../.tmp/company-voice-20261017/phase1-container.tap), payload583파일·전이 import142개). 실제 이미지 빌드·배포·HA 전환 시험은 하지 않았다.

기본 전체4명·2시간을 유지하며 월1000참가자분·1GB 추정 다운스트림을 낮은 앱 시험 예산으로 추가했다. 기본 꺼짐·새 런타임 패키지/가입/결제/실제 미디어 호출/운영 반영 없음. 1차 검증 당시의 다음 범위는 초대·수락·방해 금지였으며, 현재 2차 상태는 위 기록을 따른다. 남은 범위는 화면 공유/E2EE·Claude 화면 연결, 실제 두 기기/다른 망과 공급자 사용량 확인이다. [현재 API 계약](API.md#직원-음성-통화-백엔드--2026-10-17-로컬).

### 초기 참가·철회 기반 검증 이력


초기 참가·철회 기반은 새 통화 시험17개와 기존 인증·대화방·메신저 회귀61개, 총 **78/78**을 통과했다. [TAP 원본](../../.tmp/company-voice-20261017/final.tap). `tools/company-messenger/tests/voice.test.mjs`와 회사 `server-voice.test.mjs`가 새 시험이며 기존 `api`·`project-membership`·`project-leave`·`project-deletion`·`chat-categories`·`bootstrap-session-client`·회사 `server-messenger`를 함께 실행했다.

- 합성 provider와 임시 SQLite/합성 회사 계정으로 참가·같은 요청 재시도·전체 4명 상한·중복 기기·대화방 격리·CSRF·본인 나가기·임대/2시간 만료를 확인했다. 외부 제어 대기 중 로그아웃·권한 변경·방 삭제/복원 버전 변경은 토큰을 반환하지 않는다.
- 회사의 실제 라우터 코드를 이용해 로그아웃·직원 비활성화·정상 종료가 미디어 철회 요청으로 이어짐을 확인했다. 실제 운영 계정이나 회사 자료로 시험한 것이 아니다. 프로세스 재시작 복구는 같은 SQLite의 저장 상태를 새 서비스에서 읽는 합성 시험이며 실제 서버 강제 장애 시험과 구분한다.
- 철회 실패는 DB에 남고 새 참가는 차단된다. 재시작·기능 끄기 뒤 이전 자격증명을 이용한 정리와, 자격증명이 없을 때 `cleanupPending`을 유지하는 경계를 확인했다. 30일이 지난 완료 영수증 정리는 미정리 철회 건을 지우지 않는다.
- LiveKit HTTP 호출은 가짜 응답으로 검사했고 JWT는 별도의 HMAC 검증으로 서명·60초 만료·microphone만 송신·원격 관리자 권한 미노출을 확인했다. HTTPS 제어 주소·리디렉션 차단·서버 실패/404 때 정리 완료로 오인하지 않는 처리·명시적 Cloud 토큰 철회 시각을 확인했다. [공식 SDK AccessToken](https://github.com/livekit/node-sdks/blob/main/packages/livekit-server-sdk/src/AccessToken.ts)과 [grant 직렬화](https://github.com/livekit/node-sdks/blob/main/packages/livekit-server-sdk/src/grants.ts)도 10-17 원문으로 대조했다. SDK/Cloud 실제 호환 통화 시험을 대신하지 않는다.
- 기본 꺼짐에서는 통화 표·외부 호출을 만들지 않는다. 새 Runtime 의존성·외부 서비스 가입·결제·AI 호출·운영 배포는 없다. 화면·CSP/마이크/iframe 권한 연결·실제 두 기기 음성 송수신·다른 망/모바일/화면 공유·음질/사용량은 아직 확인하지 않았다. Claude 화면 연결과 LiveKit 설정 후 이 범위를 이어 검증한다.

새 두 모듈을 회사 `Dockerfile`과 `Dockerfile.dockerignore`의 명시적 목록에도 추가했다. 기존 컨테이너 전달 시험의 정적 import graph 검사 **1/1**을 별도로 통과했다([원본](../../.tmp/company-voice-20261017/container-allowlist.tap)). Docker 이미지 빌드·배포는 실행하지 않았다.

실행 명령과 계약은 [API의 음성 통화 절](API.md#직원-음성-통화-백엔드--2026-10-17-로컬)을 따른다. 전체 저장소나 회사 전체 시험 결과로 확대하지 않는다.

## 로그인 복구 대기 중 첨부 재시도 · 2026-10-09

**07:55 KST 공개 반영·기존 세션/자료 인수 완료.** 새 로그인 복구 연결에서 첨부를 키보드로 재시도한 뒤 저장 결과404와 로그인 복구 실패가 이어지면 버튼 초점이 사라지는 P2를 재현했다. 실제 Chromium의 수정 전 결과는 활성 재시도 버튼이 있어도 초점이 BODY에 남았다. 수정 전 운영 메신저 v6에는 이 신규 경로가 없어 해당 영향은 없었다. [수정 전 브라우저](../../.tmp/messenger-continuation-20261009/keyboard-before/report.json).

배포 담당이 실패 처리에 기존 초점 복원과 토큰 해제를 적용하고 실제 함수 회귀44/44를 통과했다. 협동 게임 HTTPS 경로를 보존한 통합 후보 v3 `3a2f537a…`에서 독립 Chromium으로 다시 확인했다. 실패 뒤 활성 재시도 버튼으로 초점이 돌아오며, 대기 중 사용자가 입력창으로 옮겨 쓴 초안과 초점은 유지한다. 두 흐름 모두 추가 업로드POST0·오류0·외부 요청0이고 후보444파일과 manifest의 전후 SHA가 동일하다. 임시 SQLite·합성 사용자만 사용했으며 공개 자료·기기 등록·푸시·유료AI 호출은 없다. [초점 복원](../../.tmp/messenger-continuation-20261009/keyboard-after/report.json)·[입력창 이동 보존](../../.tmp/messenger-continuation-20261009/keyboard-moved-after/report.json)·[후보 대조](../../.tmp/messenger-continuation-20261009/candidate-source-after-v3.json).

앞선 통합 후보 v1에서는 기존 전송 복구 브라우저35/35를 통과했다. 이 결과와 수정 v3의 두 흐름은 후보를 구분해 기록한다. [v1 전체 흐름](../../.tmp/messenger-continuation-20261009/browser/report.json)·[후보 v1 대조](../../.tmp/messenger-continuation-20261009/candidate-source-after-v1.json). 사용 안내의 개인용 시험 단계·운영 로그인 미적용·범위 없는 월0원 설명도 공개 서버와 독립 로컬 환경에 맞춰 정정했다. [사용 안내 정정](../../.tmp/messenger-continuation-20261009/readme-currentization.json). 실물 iPhone·Android 시험 보류는 유지한다.

정확v3 공개17파일 SHA/MIME·health ready, 직원5/고객1의 기존 session/CSRF/만료와 업무/키/첨부를 보존했다. 기존 직원·고객 탭을 새로고침해 로그인 클릭0으로 메모·111B첨부·저장초안을 확인했다. 이번 공식 보완검수는 세션 한도로 미완료이며 직접 사용자의 검수 후행 지시에 따라 반영했다. 06:42 전체클라우드 검수 완료와 이번 정확후보 보완검수 미완료를 구분한다. [최종 인수](../../.tmp/company-final-review-fixes-20261009/FINAL-ACCEPTANCE.json)·[독립 공개 검사](../../.tmp/messenger-continuation-20261009/independent-public-acceptance.json).

## 메시지·첨부 전송 복구 · 2026-10-09

**06:38 KST 공개 반영·기존 세션/자료 인수 완료.** 메시지 전송이 끊기면 **전송 확인 / 같은 내용 다시 보내기 / 전송 취소**로 이어간다. 같은 요청을 다시 보내도 메시지·첨부·알림을 중복 생성하지 않고, 확인하는 동안 고친 본문·답글·멘션·새 첨부를 보존한다. 실패한 첨부는 같은 창에서 원래 고른 파일로 재시도하며, 재접속·새로고침 뒤 자동으로 보내지 않는다.

공개 SSO 부모e696b9ef 위444파일·메신저11변경 v6 1fa6475e97eb…를 반영했다. Windows816중814통과·실패0·심볼릭링크2skip, Linux816/816·skip0, 정확 후보 실제 Chromium35/35·수동액션20개초점·1440/390/320px6화면 통과. 부모 회사199파일과 후보444개 해시/파일 수가 전후 동일하다. [전체 검사](../../.tmp/messenger-send-recovery-20261009/release-v6/verification.json)·[Linux](../../.tmp/messenger-send-recovery-20261009/linux-v6/linux-result.json)·[브라우저](../../.tmp/messenger-send-recovery-20261009/release-v6/browser-report.json)·[증거 대조](../../.tmp/messenger-send-recovery-20261009/release-v6/evidence-audit.json).

실제 Chromium XHR를60KiB/s로 제한한8MiB 합성 파일은 v5에서 진행 중120,015ms에 실패했으나 v6는136,813ms에201·파일1·POST1로 완료하고 원본 바이트 SHA가 일치했다. 2분 총시간 제한을 전송 진전 기반 무진행 감시로 바꿨으며 서버의 기존5분 요청 제한은 유지했다. 불확실한 업로드는 취소 기록으로 늦은 저장을 막고 첨부 칸을 비우되 Drive 정리 대기 기록을 보존한다. 다른 탭에서 소비한 첨부는 대화에 남기고 현재 칩만 지운다. [느린 업로드3/3](../../.tmp/messenger-send-recovery-20261009/release-v6/slow-report.json).

공식 Claude Code Opus5.5/max v5 검수에서 발견한 P2세 건(느린 업로드·첨부 칩 잔류·버튼 실행 후 초점 소실)을 고쳤고,06:23:55 공식 보완 검수에서 세 건해결·새P0/P1/P2없음을 확인했다. 실제모델·completedtrue 및 후보 불변을 확인했다. 검수자가 일부 결과 작성 전 읽어 남긴 '증거 없음' 설명은 원시결과에 보존하고, 완료후 대조를 따로 남겼다. [공식 검수](../../.tmp/messenger-send-recovery-20261009/release-v6/claude-amendment-summary.json)·[시간차와 최종 증거](../../.tmp/messenger-send-recovery-20261009/release-v6/review-evidence-reconciliation.json). v1~v5는 배포하지 않았으며 실패 재현과 원시 검증을 보존한다.

합성 업그레이드398항목·정상종료6회에서 기존 자료/키 보존·중복0을 확인했다. 운영은 백업/업로드 기록 확인 뒤 기존 담당이 단독 반영했고, 정지 사본 대조로 기존 두DB 자료·문서·첨부·키를 보존했다. 새 빈 전송기록3표만 추가했으며 동일평문의 직원세션 재암호화2건과 부팅 전 이미 만료된 토큰1건 삭제는 허용된 기존동작으로 구분했다. 직원7·고객1의 기존세션/CSRF/만료가 동일하고 기존 메모·첨부·고객 저장안내가 실제 화면에 보였다. [합성 업그레이드](../../.tmp/messenger-send-recovery-20261009/linux-v6/lifecycle-kit/lifecycle-result.json)·[운영 자료 대조](../../.tmp/messenger-send-recovery-20261009/linux-v6/operator-compare-1791495446489.json)·[세션/키 인수](../../.tmp/messenger-send-recovery-20261009/linux-v6/operator-proof-after-1791495496617.json).

독립 공개 검사06:34:18KST에서 health200/ready 및14정적파일 SHA/MIME가 같은 후보와 일치했다. 전환 중06:33:52 첫 프로브의 연결실패도 보존했다. 실제 화면은 [직원](../../.tmp/messenger-send-recovery-20261009/linux-v6/staff-after.png)·[고객](../../.tmp/messenger-send-recovery-20261009/linux-v6/customer-after.png), [공개 대조](../../.tmp/messenger-send-recovery-20261009/public-probes/2026-10-08T21-34-18-884Z.json)·[최종 인수](../../.tmp/messenger-send-recovery-20261009/FINAL-ACCEPTANCE-V6.json). 운영 임의 메시지·기기등록/푸시 시험·유료AI호출0. 실물 iPhone/Android 푸시·PC 종료 시험은 사용자 요청대로 보류하며 화면낭독기는 미검증이다.

## 재시작 후 SYNK ID 로그인 유지 · 2026-10-09

**03:56 KST 공개 서버 반영·실계정 재시작 인수 완료.** 최신 고객 수정 fb5c71 부모를 보존한 437파일 v2 `295a596d…`를 03:19 반영했다. 정기 백업·GCS 독립 다운로드 SHA 일치·업로드 후 자연 감시의 정상 판정을 확인한 뒤 서비스 정상 재시작을 한 번 수행했다. SIGTERM 뒤 exit0·새 시작 시각, 같은 이미지·환경·볼륨·타이머 보존을 확인했다. 기존 직원 브라우저에서 **재로그인 없이** 유호·메신저·원래 자기 메모·첨부가 표시됐고, 비공개 기준 대조로 동일 세션·CSRF·만료·원키·VAPID·업무 문서·설정 불변을 확인했다. 공개 health200/ready와 13파일 SHA/MIME도 재시작 뒤 일치했다. [운영 재시작](../../.tmp/messenger-session-restart-20261009/live-restart-result.json)·[동일 세션 대조](../../.tmp/messenger-session-restart-20261009/live-session-after-result.json)·[실제 화면](../../.tmp/messenger-session-restart-20261009/live-staff-after-restart-v2.jpg)·[공개 대조](../../.tmp/messenger-session-restart-20261009/public-probes/2026-10-08T18-56-04-148Z.json).

원래 암호화 키로 access/refresh/검증 대기 후보를 보존하며, 재시작 뒤 중앙 재확인을 통과해야 회사 자료·기기 알림을 허용한다. 일시 장애503은 접근·발송을 보류하면서 기존 동의/주소를 보존한다. 확정 철회·만료·비활성·로그아웃·연결 해제는 폐기하고, 회사 토큰 삭제는 암호문도 FK로 삭제한다. 최초 업그레이드만 기존 메모리 세션의 1회 재로그인이 필요하며 회사 세션의 7일 만료를 연장하지 않는다.

최종 v2 Windows704중702통과/0실패/2symlinkskip, Linux704/704/skip0, 실제 합성 컨테이너의 링크·교체·장애·복구·철회127항목 및 정상 종료4회 통과. 공식 Claude Opus5.5/max 보완 검수는03:12 완료, 실제 모델·완료와437파일 해시 불변을 확인했다. 이전P2해결·새P0/P1/P2없음. 검토자는 코드를 읽었고 시험 실행 결과는 별도로 대조했다. [Windows](../../.tmp/messenger-session-restart-20261009/release-v2/verification.json)·[Linux](../../.tmp/messenger-session-restart-20261009/linux-result-v2.json)·[합성 컨테이너](../../.tmp/messenger-session-restart-20261009/auth-result-v2.json)·[공식 검수](../../.tmp/messenger-session-restart-20261009/release-v2/claude-review-summary.json).

이전 v1 `462cc0e0…`는 종료 중 느린 본문 로그아웃 P2와 운영 부모 변경으로 배포하지 않았다. 실제 실패 재현 뒤 close(검증 drain)와 dispose(리스너 종료 후 DB 직전)를 분리해 수정했으며 v1 원시 검수·검사 결과는 보존한다. 운영 기기 구독/푸시 큐는0이므로 기기 연결 유지의 합성 검증을 실물 수신으로 표현하지 않는다. 실물폰·PC 종료 시험은 사용자 요청으로 보류. 고객 상담은 별도 인증으로 재로그인 뒤 기존23:33 저장 글을 불러왔으며, 고객의 세션 지속까지 완료로 주장하지 않는다. 기존 단발 후속 synk-2는 완료 뒤 PAUSED 처리해 반복하지 않는다. [최종 운영 인수](../../.tmp/messenger-session-restart-20261009/FINAL-ACCEPTANCE-V2.json). [최종 전달문](../../.tmp/messenger-session-restart-20261009/DEPLOYMENT-HANDOFF-V2.md).

## 예약·마감 알림 독립 실행 · 2026-10-09

01:25 KST 실제 계정 인수 완료: WORK1/BACKGROUND0/WEB_PUSH1/paidAIoff로 v2 가동, 배포 전후 두DB 전체행/스키마·원래키/설정파일 대조가 차이 없이 통과했다. 실제 직원 SYNK ID 재로그인 후 기존 본인 메모에01:22예약1개를 만들고 창을 닫았다. 알림API 조회 없이 서버 읽기 전용 확인에서01:22:01.172 전달·알림1개·미읽음을 확인했고, 다시 열어 알림함 표시→직접 읽음→배지0을 확인했다. 반복 점검 후 중복0, 기존 메모/첨부·고객 로그인/원래 상담 초안과 저장시각 보존. 마감 설정은 실행 중을 표시하고 개인 설정은 바꾸지 않았다. 운영09시 마감 도착은 미관측이며 실제 이미지 합성 시간 검증과 구분한다. 푸시 구독/큐/실물 수신0, 실물폰·PC종료 시험 보류 유지. [운영 데이터 대조](../../.tmp/company-cloud-20261008/work-v5-logical-comparison-result.json)·[실계정 인수](../../.tmp/company-cloud-20261008/work-v5-live-browser-result.json)·[창을 다시 열기 전 도착](../../.tmp/company-cloud-20261008/work-v5-reminder-delivered-before-reopen.json)·[실제 알림함](../../.tmp/company-cloud-20261008/work-v5-notification-inbox.png)·[마감 실행 화면](../../.tmp/company-cloud-20261008/work-v5-deadline-scheduler-enabled.png)·[최종 운영](../../.tmp/company-cloud-20261008/work-v5-final-runtime-snapshot.json). 시험 예약/알림 정리는 브라우저 도구 초기화 오류(`failed to write kernel assets`, os error3)로 실행하지 못했다. 재초기화와 대체 도구도 같은 오류여서 운영쓰기/직접SQL삭제는0이며, 확인된 상태는 전달1회·직접읽음·배지0이다. 원메모/첨부는 유지하고 브라우저 복구 뒤 같은 시험예약인지 재확인해 정상취소한다. [잔여 항목](../../.tmp/messenger-work-notifications-20261009/test-reminder-cleanup-status.json).

01:18 KST 최종 v2 공개 파일 확인:424파일 manifest `aeb1620ebc406c000a10b1aa14d3ffa745330ff6076e354e32f294aae9255a72`, 운영 부모 v3 보존·부모 대비19변경. Windows576중574통과·실패0·심볼릭 링크2skip, 실제Linux576/576·실패/skip0·기존 전달108항목·교체 전후24항목·시작/반복/재시작/권한철회와 원래키/VAPID 보존을 확인했다. 공식 Claude Opus5.5/max 보완 검수는01:18:20 완료, 이전 P2 해결·새 P0/P1/P2 없음, 실제 모델과424파일 해시 불변을 확인했다. 공개 HTTPS health200/readytrue 및11파일 SHA/MIME가01:18:51 같은 후보와 일치했다. [전체 Windows](../../.tmp/messenger-work-notifications-20261009/release-v2/verification.json)·[실제 Linux](../../.tmp/company-cloud-20261008/work-v5-linux-result.json)·[공식 보완 검토와 범위](../../.tmp/messenger-work-notifications-20261009/release-v2/claude-review-summary.json)·[공개 파일](../../.tmp/messenger-work-notifications-20261009/public-probes/2026-10-08T16-18-51-998Z.json)·[최종 전달문](../../.tmp/messenger-work-notifications-20261009/DEPLOYMENT-HANDOFF-V2.md). 로그인 후 실행 상태·실제 자기 예약·운영 데이터 대조는 이어 확인하며 실물폰 시험 보류는 유지한다.

푸시 P2 보완 관련4파일68/68·실패/skip0을 통과했다. 수정 전 회사 SYNK 로그인의 일시503 및 신원 확인 대기 중 `app.stop()`에서 구독 `enabled=0,endpoint=null`을 재현했고, 수정 후 동의·구독ID·주소를 보존하면서 같은 구독으로 복구 전달함을 확인했다. 세션 판정은 유효/확정무효/확인불가로 나눴고 최초·재확인·실제 전송 허가 단계와 종료 중 경쟁을 모두 검사했다. 확인불가 조회/등록은503, 전송은 보류하며 기존1시간TTL과 실제 공급자 실패 재시도 제한을 유지한다. 전송 전 신원 장애는 공급자 시도 횟수를 소모하지 않는다. 클라이언트 VM5흐름에서도 기존 구독 유지(생성1/해제0)를 확인했다. 관련 검사에서 재현한 VAPID 개인키 선행0 생략도 새 키 생성 시32바이트로 정규화했으며, scalar1 고정키의 실제 서명 회귀를 추가했다. 기존 운영키를 재생성하지 않는다. [관련 검사](../../.tmp/messenger-work-notifications-20261009/push-identity-recovery-tests.txt)·[클라이언트 계약 확인](../../.tmp/messenger-work-notifications-20261009/push-client-transient-review.json). 수정 v2의 전체 검사·공식 차이 검수·운영 반영은 별도 진행한다.

00:51 KST 공식 Claude `claude-opus-5-5 --effort max` 검수를 완료했고 실제 사용 모델과424파일 해시 불변을 확인했다. 예약·마감 독립 실행에서는 P0/P1/P2가 없었다. 기존 Web Push의 신원 확인 일시 장애를 확정 로그아웃으로 처리해 동의/endpoint를 지우는 P2를 발견해 수정·회귀 검사 중이다. 종료 중 신원 확인도 같은 경로로 확인 불가와 무효를 구분한다. 이 보완까지 새 v2 후보로 고정해 차이 검수와 Linux 검증 후 운영에 반영하며, v1은 아직 공개하지 않았다. [공식 검토 결과와 범위](../../.tmp/messenger-work-notifications-20261009/release-v1/claude-review-summary.json).

00:48 KST 고정본 검증:424파일 manifest `bd096b08a01b9ec746ee1004d38362e2b4f519f2c6389799d1281f7cdb3e2e91`로 실제 Linux556/556·실패0·skip0을 통과했다. 기존 전달108항목, 컨테이너 실제 기동/교체·업무 기록과 키/VAPID 보존·인증 경계·준비되지 않은 볼륨 차단을 확인했다. 별도 격리 이미지에서 시작 시 미전달 예약/마감 묶음 생성,15초 timer와 컨테이너 교체 후 중복0, 비활성 사용자0, Drive 삭제 큐 불변을 확인했다. 합성 프로세스 시각만 주입했고 호스트/운영 시계는 바꾸지 않았다. [Linux·재시작 결과](../../.tmp/company-cloud-20261008/work-v4-linux-result.json).

Windows 전체는553통과·1실패·2심볼릭 링크 skip이며 원실패를 통과로 바꾸지 않는다. 기존 백업27시간 경계 검사의 Bash `status:null`이 원인이었다. 같은 후보의 해당 파일만 원래10초 제한 그대로 재실행해5통과·실패0·1Windows skip, Bash23회 정상종료·최장1.03초를 확인했다. 일시적 시간초과/강제종료 가능성은 있지만 원로그에 error/signal이 없어 원인을 확정하지 않는다. 후보424파일 전후 해시 불변. [전체 원결과](../../.tmp/messenger-work-notifications-20261009/release-v1/verification.json)·[고립 재검사](../../.tmp/messenger-work-notifications-20261009/backup-watch-isolated-verification.json). 공식 Claude Opus5.5/max 검수는00:33부터 실행 중이며 공개 반영은 아직 대기다.

사용자 「이어서 해」로 예약·마감 알림을 수집·Drive 삭제 작업과 분리하고 실제 가동 상태를 UI에 표시하는 후속을 진행했다. `SYNK_COMPANY_WORK_NOTIFICATIONS_ENABLED`를 명시하면 업무 알림만 제어하며 생략하면 기존 일반 자동 작업 값을 상속한다. 회사 option은 boolean, 환경값은0/1만 허용한다. 정지 중 신규 예약·마감 켜기는503으로 쓰기 전에 거절하고, 기존 예약 취소·개인 마감 끄기는 허용한다. 새 테이블·마이그레이션은 없다.

관련 백엔드31/31에서 일반 자동 작업0·업무 알림1의 timer 전달, 수집/삭제0, 반복·재시작 중복 방지, 종료 후 callback 무해, 현재 비활성/방 접근 권한, KST09시·주말·지난 날짜 소급 생성 없음과 설정 조합을 확인했다. UI132/132에서 중지·미확인·구버전·503·로그아웃 및 같은 계정의 늦은 응답을 확인했다. 독립 검토에서 발견한 재연결 후 옛 배지 유지·늦은 조회 상태 역전, 실제 화면에서 찾은 비활성 저장 버튼의 활성 색상 문제를 수정했다. 채팅·스레드·개인 보관함 배지는 글자만 동기화하며 초안과 스크롤을 유지한다.

00:32 KST 최종 소스의 실제 Chromium15/15흐름을 통과했다. 격리된 합성 회사/메신저 DB에서 `BACKGROUND=0`을 유지하며 `WORK=1→0→1`로 재시작, 예약 저장·중지·취소·마감 끄기·다시 활성화, 구버전·조회 실패·모달과 계정 경합을 확인했다. 1440/390/320px 캡처21개, 가로 넘침·예기치 않은 오류·외부 요청0. 의도한 조회실패503은 별도 기록했다. [결과](qa-output/work-notifications-20261009/report.json)·[마감 중지320px](qa-output/work-notifications-20261009/deadline-paused-320.png)·[예약 중지320px](qa-output/work-notifications-20261009/reminder-paused-320.png). 이는 합성 데이터 검증이며 공개 서버 반영·실제 폰 수신을 뜻하지 않는다. 현재 운영 v3 `1965cf4b…`를 부모로 고정해 전체 검사·공식 검수·Linux/운영 적용을 이어간다. 실제 휴대폰 시험 보류는 유지한다.

## 기기 푸시 알림 · 2026-10-08

10-09 00:04 KST 실제 계정 인수 완료: 배포 담당의 기존 직원 SYNK 로그인·고객 로그인, 자기 메모 복원, Drive 첨부111바이트 재다운로드 해시, 고객 글만 저장한 상담 초안 복원을 확인했다. 메신저에서 기기 알림 창이 열리고 서버 준비·켜기 버튼을 확인했으며, 구독이나 권한 요청은 실행하지 않았다. [실제 계정 결과](../../.tmp/company-cloud-20261008/push-v3-live-browser-result.json)·[기기 알림 화면](../../.tmp/company-cloud-20261008/public-push-ready.jpg). 같은 manifest의 운영 health·이미지·자동 시작·점검/백업 타이머·영구 디스크 검사도 모두 통과했다. [최종 운영 상태](../../.tmp/company-cloud-20261008/push-v3-final-runtime-snapshot.json). 현재 범위의 서버 반영·공개/로그인 검증은 완료했고, 실물 기기 시험과 사용자가 미룬 공식 최종 검수는 별도로 남는다.

10-09 00:01 KST 운영 인수: 배포 담당의 정지 상태 데이터 대조에서 기존 업무·계정 행과 비DB 파일을 보존했고, 재시작 후 VAPID와 원래 암호화 키도 유지됐다. 재시작으로 이전 인증 세션1개가 무효화된 차이는 부모와 동일한 기존 인증 경로에 따른 것으로 별도 검토했다. [세션 차이 검토](../../.tmp/company-cloud-20261008/push-v3-session-delta-resolution.json)·[운영 키 보존](../../.tmp/company-cloud-20261008/push-v3-live-key-preservation-result.json). 기기 구독0·전송 큐0·실제 발송0이다. 대조 후 서버 재가동을 포함해 [공개10파일·health 재확인](../../.tmp/messenger-push-20261008/public-probes/2026-10-08T15-01-15-879Z.json)도 통과했다. 기존 자동 작업은0, 푸시만1이며 유료AI 설정은 바꾸지 않았다.

23:57 KST 공개 반영 확인: `workspace.synk.im`의 health200/readytrue와 공개10파일 SHA/MIME가 v3 `1965cf4b…`와 모두 일치했다. 회사·메신저 JS, 기기 JS/CSS/SW, HTML, manifest·아이콘을 대조했다. [공개 파일 결과](../../.tmp/messenger-push-20261008/public-probes/2026-10-08T14-57-04-016Z.json). 새 익명 Chrome에서 실제 공개1440·390·320px 로그인 화면, 알림 링크의 로그인 후 목적지 유지, 모듈 로드, 가로 넘침0·JS오류0·자동 worker 등록0·권한 기본값·변경 요청0을 확인했고 320px 캡처를 직접 검토했다. [공개 브라우저 결과](../../.tmp/messenger-push-20261008/public-browser/2026-10-08T14-57-13-327Z/report.json). 로그인 후 흐름·운영 DB·키 보존은 배포 담당의 별도 인수 결과로 확인한다. 실제 기기 수신 증거는 아니다.

10-08 후속 사용자 답 **실제 휴대폰 시험은 나중에**에 따라 iPhone·Android 직접 동의·실물 수신과 PC 종료 중 실물 사용 검증은 보류한다. 서버 배포·공개 검증은 계속 진행한다. 23:42 공개 GET에서 health200/readytrue, 기기 정적3파일404로 아직 푸시 미반영을 확인했다. [공개 응답 기록](../../.tmp/messenger-push-20261008/public-probes/2026-10-08T14-42-17-071Z.json).

23:46 KST 배포 담당의 실제 Linux 이미지 검증에서 같은 v3 manifest로 **529/529 통과·실패0·skip0**, 기존 전달 항목108개, 컨테이너 교체·준비되지 않은 볼륨 차단·인증 경계를 확인했다. Windows에서 보류한 심볼릭 링크 검사2개도 포함했다. [Linux 결과](../../.tmp/company-cloud-20261008/push-v3-linux-result.json). 이 결과는 격리된 합성 데이터 검사이며 운영 반영이나 실제 기기 수신의 증거가 아니다.

실물 시험 재개 시에는 등록 이후 **다른 계정의 새 직접 멘션**을 사용한다. 자기 메모·자기 멘션과 중지한 예약·마감 알림은 시험 트리거가 아니다. 두 폰이 같은 계정이면 모두 수신하기 전에는 원문을 읽지 않는다. 실제 도착→클릭 후 올바른 계정→명시적 읽음→로그아웃 완료 뒤 새 알림 차단→PC를 실제 끈 동안 두 폰 왕복을 확인한다. 공급자 수락과 잠금 화면 도착은 별도로 기록하며, 30초 서버 주기는 수신 보장 시간이 아니다. OS·브라우저·설치 형태·익명 역할·시각·알림 ID·구독 상태·결과만 남기고 endpoint·키·세션 값은 기록하지 않는다. 시험 계정·업무가 정해지기 전에는 운영 명단에 합성 계정을 임의 추가하지 않는다.

23:34 KST 후속: 배포 검토에서 푸시를 켜려면 기존 자동 수집·Drive 삭제·예약 알림을 모두 재개해야 하는 결합을 확인해 수정했다. 푸시 service/timer만 `SYNK_COMPANY_WEB_PUSH_ENABLED`로 독립 제어하고 `SYNK_COMPANY_BACKGROUND_JOBS_ENABLED=0`은 기존 큐를 계속 중지한다. 새 플래그는 없다. 직접 멘션·고객 알림의 timer 전송과 수집/삭제/예약/요약0, 두 설정0, 재시작·키·중복·종료를 합성 회귀로 확인했다. 고객 상담 수정 `be219dcc…`를 부모로 보존한 새399파일 후보 `1965cf4b…`의 **총529중527통과·실패0·Windows2skip**을 확인했다. UI29흐름은 동일하다. [v3 전달문](../../.tmp/messenger-push-20261008/DEPLOYMENT-HANDOFF-V3.md)·[고정본 검증](../../.tmp/messenger-push-20261008/release-v3/verification.json). 이전v2는 과거 검증본이며 활성 대상이 아니다. v3 Linux 검증·운영 반영·실물 수신·공식 최종 검수는 별도다.

사용자 「전부 이어서 진행해」와 배포 담당 대화 전달 승인을 받아 앱을 닫은 상태의 기기 알림을 구현했다. 아이폰·안드로이드 둘 다 시험 대상으로 선택했고, 사례는 「임의로 해줘」에 따라 **SYNK 홍보 영상 수정**으로 정했다. 여기의 직원·검토자·고객은 격리된 합성 계정이며 실제 사람의 업무 수행이나 시간 절약을 측정한 결과가 아니다.

- 기본 꺼짐, HTTPS와 서버 활성 설정 및 기기별 사용자 클릭이 필요하다. 회사 세션·CSRF·현재 알림 원문의 접근 권한·무음·읽음을 전송 직전에 다시 확인한다. 로그아웃/만료/비활성은 해당 기기 연결을 중단한다.
- 잠금 화면에는 고정 일반 문구만 표시한다. 서비스 워커는 인증 데이터/파일을 캐시하지 않으며 알림 클릭은 기존 알림함으로 이동하고 읽음 상태를 바꾸지 않는다. 공급자 수락은 실제 기기 수신과 구분한다.
- 신규 백엔드12·프런트10·회사 HTTP7 검사, 기존 인증11·탐색20을 통과했다. payloadless VAPID 검증·DNS/SSRF 차단·재시작 중복/재시도/TTL·구독 소유자/로그아웃·전송 전 권한 철회·등록 응답 지연을 포함한다. 실제 외부 푸시는 보내지 않았다.
- Docker COPY 누락을 보완해 `productivity-service.mjs`, `web-push-service.mjs`를 포함했다. 순수 파일 검사267개·전이 import61개와 임시 이미지 파일 묶음의 실제 로컬 기동/전달108항목이 통과했다. Linux 운영 이미지의 빌드·검증은 배포 담당의 별도 증거가 필요하다.
- 예시 업무의 실제 Chromium9흐름과 추가 기능7흐름을 새 격리 DB에서 통과했다. [영상 수정 결과](qa-output/push-20261008/business/report.json), [추가 기능 결과](qa-output/push-20261008/followup/report.json). 요청→담당 수락→결과물→검토 수정→재제출→완료, 고객12초 의견→내부 검토→고객 승인→납품 대기까지 확인했다.

기기 설정 화면과 worker 클릭은 `qa/device-notifications-acceptance.mjs`와 [기기 알림 결과](qa-output/push-20261008/report.json)로 확인한다. 초기 화면 시험에서 회사 탐색 허용 목록에 알림함이 누락된 문제를 찾아 수정하고 `marin-home-client.test.mjs`에 회귀 검사를 추가했다. 현재 단계의 구현·가짜 공급자 및 브라우저 어댑터 검사와 공개 서버 반영·실물 휴대폰 수신은 구분한다. 후자는 아직 완료로 판정하지 않는다.

배포 후보는 기존 검증된 클라우드 후보를 부모로 고정한다. 기존 고객 workflow를 숨기지 않는 옛305파일 이미지로 새 DB를 그대로 되돌리지 않는다. 호환 롤백 이미지 또는 쓰기를 멈춘 두DB·원래 키의 일관된 복구 계획이 필요하다. 새 VAPID 개인 키는 회사 암호화 저장소에서 한 번 생성하며 응답·로그·manifest에 포함하지 않는다.

23:16 KST 고정 후보 검증: 부모 클라우드 `528be58c…`를 보존한399파일 후보 `facb818fb4aafcdf98f6ad1f8ae2388874b3e0aed597c183800ac295918c67df`에서 **524통과·실패0·Windows심볼릭링크제약2skip**을 확인했다. 기기13+예시업무9+후속7, 총29브라우저흐름을 통과했다. 23:14 공식Opus5.5/max는429 사용량제한으로 미완료(10월9일00:00KST재개안내). 사용자 승인으로 「아틀라스 8종 엔진 최신화 점검」 대화에 [배포 전달문](../../.tmp/messenger-push-20261008/DEPLOYMENT-HANDOFF.md), [고정본 검증](../../.tmp/messenger-push-20261008/release-v2/verification.json), [검수 시도](../../.tmp/messenger-push-20261008/release-v2/claude-review-summary.json)를 전달했다. 그 대화의 이번 회사서버 재검수후행 사용자지시에 맞춰 적용을 연결하며, 여기서는 공개반영·실기기수신 완료로 보고하지 않는다.

## 검토 복구·고객 알림·마감 묶음 · 2026-10-08 후속

사용자 「더 이어서 할거 없어?」 뒤 「전부 다 진행해」에 따라 검토자 이탈 복구, 고객 알림, 일일 마감 묶음을 구현했다. 기존 21:31 PC 적용 5종 다음 변경이며 **사용자 「웅 괜찮아. 진행해」 승인으로 22:17 KST 현재 PC 반영을 완료했다**. 아래 격리 검증·22:02 반영 준비·22:18 운영 확인을 시간순으로 구분한다. 이전 서버와 함께 쓰이는 화면은 새 설정 API가 없는 동안 해당 입구를 숨긴다.

- 메신저 전체 **173/173**, 회사 관련16파일 **124/124** 통과. 실행 기록은 `qa-output/followup-20261008/messenger-tests.txt`, `company-tests.txt`다. 검토자 이탈·비활성·역할 하향·자기 승인 금지·동시 revision·재시작, 한국시간 09:00·평일/주말·알림 끄기·하루 중복 방지·최신 묶음·삭제된 원문과 남은 업무, 고객 알림의 현재 권한·CSRF·읽음 영속·롤백·재배정을 확인했다.
- `qa/productivity-followup-acceptance.mjs`는 별도 임시 SQLite·합성 직원4명/고객·16초 단색 MP4·가짜 Drive로 실제 Chromium **7개 흐름**을 통과했다. 요청자 UI 재배정 → 같은 결과물 유지 → 새 검토자 승인, 열려 있는 알림창의 고객 의견 SSE 도착 → 정확한 영상12초 이동, 오늘/지난 마감2개 한 묶음 → 원문, 설정 끄기/켜기 중복 없음, 모두 읽음 후 통합 배지0을 확인했다.
- 1440·390·320px 캡처와 DOM 너비를 확인했다. 가로 넘침·콘솔 오류·외부 요청은0. 작은 화면의 검토 복구는 세로 스크롤로 전체 양식을 이용하며, 마감 묶음은 업무별 원문 버튼을 유지한다. [결과 JSON](qa-output/followup-20261008/report.json), [검토 복구320px](qa-output/followup-20261008/reviewer-recovery-320.png), [마감 묶음320px](qa-output/followup-20261008/deadline-digest-320.png), [알림390px](qa-output/followup-20261008/notifications-mobile-390.png).
- 독립 코드 검토에서 `client:`/`due:` 알림 ID의 URL 디코딩 누락으로 실제 화면의 읽음 요청이404가 되는 문제를 찾아 수정했다. 실제 인코딩된 HTTP 요청과 브라우저 클릭을 함께 통과했다. 늦은 설정 저장 응답이 다른 계정의 캐시를 바꾸는 경합도 현재 사용자 확인으로 차단했다.

고객 이벤트는 원본 프로젝트와 한 번에 저장하고 읽음은 별도 사용자 기록으로 보존한다. 마감은 업무ID만 참조하는 세 SQLite 테이블(`due_digest_preferences`, `due_digests`, `due_digest_tasks`)을 추가한다. 둘 다 현재 원문·접근 권한을 다시 확인한다. 알림은 앱 내부에서 제공하며 외부 전송·유료 AI 호출은 없다. 운영 계정 데이터 주입·기존 서버 재시작·클라우드 변경·물리적 휴대폰 시험은 이 후속 검증에 포함하지 않았다.

22:02 KST 배포 준비 확인: 부모 PC 후보의 원본을 보존한357파일을 고정했고 실행 변경10파일이 공용 작업본과 일치한다. 고정 사본에서도 **297/297** 통과했다. manifest는 `8a8f0b1858b6f0955ad12d13ae30cce187b52b99b71243c99e042e9fc3b4846c`, 결과는 [반영 전 검증](qa-output/followup-20261008/preflight.json)이다. 22:00 공식 `claude-opus-5-5 --effort max` 검수는 HTTP429·10월9일00:00 KST 재개 안내로 **미완료**다. 이전 첫5종의 PC1회 예외를 이번 후속이나 공개 배포에 확대하지 않는다. 공용 로그인 파일의 다른 작업 변경1건은 따로 감지·보존했다. 기존 함수 식별자 이름 변경만임을 정규화 바이트 대조로 확인했고 해당 로그인12검사도 통과했으며, 고정 후보는 부모 파일을 유지한다. 기존 클라우드 설치·데이터도 이번 작업에서 변경하지 않았다.

### 추가 3종 현재 PC 반영 · 2026-10-08 22:18 KST

공식 Claude 검수가 사용량 한도로 미완료임과 일반 운영 원칙을 알리고 이번 추가3종의 PC1회 검수 생략 여부를 물은 뒤, 사용자 「웅 괜찮아. 진행해」를 승인으로 확인했다. 기존 서버 PID16268을 공식 종료기로 정지하고 회사·메신저 두 DB, 원래 암호화 키와 연결 설정을 백업했다. 파일8개가 해제됐음을 확인했으며 백업 원본·복구 읽기·COMPLETE·키·설정 대조7개가 모두 통과했다. 백업은 접근 제한된 개인 `SYNK/Backups/messenger-followup-20261008/`에 보관한다.

실행 원문262개(후보와 정확 일치261개와 별도 승인된 로그인 함수명 변경1개)를 확인하고 공식 런처로22:17:44 KST, PID11088을 기동했다. 4191 health ready와4197 기존 주소 리다이렉트가 정상이다. 실제 기존 계정에서 새 마감 설정·통합 알림·비로그인 거부·서비스7파일 바이트·오늘/변경/결정/마린·1440/390/320px까지 **39/39**를 확인했다. 브라우저 오류·외부 요청·업무 저장 요청은0이며 임시 검증 세션을 철회하고 쿠키 파일을 지웠다.

정지 직전에는 업무·메시지·수동 리마인더가0개였다. 최종 두DB 대조에서 **기존 모든 표와 회사 기록·키·연결 설정은 불변**, 새 마감용 빈3표만 추가됐다. 실제 미완료 마감 업무가 있다면 향후 정상 tick에서 묶음 기록이 생성된다. 합성 직원·고객·업무를 실제 데이터에 넣지 않았다. 이번 승인은 추가3종의 현재 PC 적용에 한정하며 외부 배포·실물 휴대폰 확인은 포함하지 않는다.

[반영 증거](qa-output/followup-20261008/pc-applied/release-proof.json) · [실계정39항목](qa-output/followup-20261008/pc-applied/readonly-report.json) · [현재 설정320px](qa-output/followup-20261008/pc-applied/live-deadline-settings-320.png).

## 업무 연결 5종 · 2026-10-08

최신 상태: **21:31 KST 현재 PC 반영 완료**. 아래 최초 격리 검증·반영 준비와 [현재 PC 반영](#현재-pc-반영--2026-10-08-2134-kst)을 시간순으로 구분한다.

오늘 업무함, 요청·검토·결과물, 고객 의견과 시안 장면 연결, 결정·최종본, 마린의 기록 기반 변경 안내를 구현했다. [사용법과 범위](../../docs/마케팅/온라인마케팅지도/engagement/company/WORKSPACE.md#메신저-업무-연결--2026-10-08), [API 계약](API.md#업무-연결-5종--2026-10-08)을 함께 따른다.

### 코드 검증

- 메신저 전체 검사 **156/156 통과**: `node --test tools/company-messenger/tests/*.test.mjs`. 기존 인증·권한·파일·채팅·알림 회귀와 새 업무 단계·결정 이력·확인 위치·UI 동작을 포함한다. [실행 기록](qa-output/productivity-20261008/messenger-tests.txt).
- 회사 관련 9개 검사 파일 **101/101 통과**: `server-messenger`, `server-assistant`, `client-projects`, `client-projects-server`, `client-workflow`, `client-workflow-client`, `marin-home-client`, `workspace-navigation`, `workspace-review-client`의 `.test.mjs`. 회사 폴더는 `docs/마케팅/온라인마케팅지도/engagement/company/`다. 마지막 결과물 원문 보호 반영 뒤 전체를 다시 통과했다. [실행 기록](qa-output/productivity-20261008/company-tests.txt).
- 승인 우회·기존 상태 호환·동시 수정 409·삭제/탈퇴/보관 후 원문 접근·재시작 유지·읽음과 업무 완료 분리, 담당 변경/비활성화·고객 화면 내부 메모 비노출·내부 검토 전 조기 납품 금지를 확인했다. 미지정 검토자의 최초 지정은 허용하고, 검토 중/완료/현재 최종본의 결과물 원문을 직접 편집·삭제하는 우회도 차단했다. 마린 조회는 상태를 바꾸지 않고 현재 권한만 사용한다.

### 실제 화면과 연결

`node tools/company-messenger/qa/productivity-acceptance.mjs`는 별도 임시 SQLite·합성 직원/고객·16초 단색 MP4·서로 다른 Chromium 세션으로 **9개 흐름**을 검사한다. 실계정·실제 고객·외부 AI 호출을 사용하지 않는다.

1. 메시지에서 담당자·한국 날짜 기한을 지정해 요청 생성
2. 담당자 수락 → 작업 → 미지정 검토자의 최초 지정·실제 첨부 결과물 선택 → 검토 요청
3. 검토자의 수정 요청 → 담당자 재제출 → 검토자 완료
4. 확정 최종본 기록·검색·논의 원문과 결과물 링크
5. 바뀐 것 목록 → 명시적 확인으로 개인 확인 위치만 이동
6. 고객 12초 장면 의견이 담당자 업무함에 한 번 표시되고 정확한 영상 12초로 이동
7. 새 수정본 → 내부 검토 → 합성 고객 계정의 실제 승인 API → 한 개의 납품 업무 표시
8. 홈 마린 질문 → 원문 기반 응답 → 통합 메신저 변경 화면으로 이동
9. 320·390px에서 업무함·결정·변경 목록의 가로 넘침 없음

[검사 JSON](qa-output/productivity-20261008/report.json), [PC 오늘 업무함](qa-output/productivity-20261008/workday-desktop.png), [휴대폰 업무](qa-output/productivity-20261008/active-workday-mobile-320.png), [결정·최종본](qa-output/productivity-20261008/decisions-mobile-320.png), [영상 장면 이동](qa-output/productivity-20261008/customer-scene-desktop.png)을 남긴다. 작업자가 PC·320px의 실제 캡처를 직접 열어 글자·줄바꿈·버튼·선택 상태를 확인했다. 휴대폰에서는 실제 업무를 먼저 표시하고 빈 구역을 짧게 모았으며 업무 모달은 세로로 스크롤된다.

기존 `verify-client-projects-browser.mjs`도 새 흐름에 맞춰 **28개 검사 통과**. 고객 수정 요청부터 새 시안 승인·최종 납품·원본 다운로드 바이트까지 확인하고, 직원/고객 각각1280·390·320px에서 가로 넘침·콘솔 오류·실패 요청·외부 호출이 0이었다. [고객 업무 검증 기록](../../docs/마케팅/온라인마케팅지도/engagement/company/verification/client-projects-20261008/report.json)을 따른다. 위 9개 흐름과 목적이 일부 겹치므로 독립적인 사용자 성과 수치로 합산하지 않는다.

### 운영 반영과 효과의 경계

이번 작업은 **소스 구현과 격리된 서버의 실제 브라우저 검증**이다. 기존 운영 데이터 폴더를 열어 마이그레이션하거나 운영4191을 시작/재시작하지 않았으며 클라우드 배포·외부 고객 안내를 실행하지 않았다. 휴대폰 크기는 Chromium viewport 검사이며 물리적 휴대폰·두 기기의 실사용 증거가 아니다. 실제 업무 시간 절감·놓친 요청 감소는 아직 측정하지 않았다.

### 후속 운영 반영 준비 · 2026-10-08 21:23 KST

사용자 「고생했어 이어서 해」 요청으로 실제 상태를 재확인했다. PC4191 리스너는 없었고, 다른 작업의 최신 클라우드 후보 `release-reviewed-fixes`에는 이번 기능이 분리돼 있었다. 부모 manifest `d85ffda71a765…`의305파일을 검증하고 보안·로그인·백그라운드 수정은 그대로 보존한 별도335파일 후보를 만들었다. 이번 실행 변경은15파일이며 원본의 해당15파일과 후보 해시가 일치한다. 최초14파일 후보는 고객 영상 시간 입력 파일이 빠져 `SUPERSEDED.md`로 제외했다.

완전한 새 후보 자체에서 **257/257 자동 검사·실제 Chromium9흐름**을 다시 통과했다. [정확한 후보](../../.tmp/messenger-upgrade-20261008/release-preflight-v2/candidate-manifest.json), [해시·검증·반영 상태](../../.tmp/messenger-upgrade-20261008/release-preflight-v2/verification.json), [검사 실행](../../.tmp/messenger-upgrade-20261008/release-preflight-v2/candidate-tests.txt)에 남긴다. 후보 manifest SHA-256은 `c1d54567a299328443ccfdc3c2af4728f8a9cd930bcbea74997957b66b1e9a96`다.

공식 Claude Code2.1.292에 `claude-opus-5-5 --effort max`로 읽기 전용 최종 검수를 요청했으나 **HTTP429·is_error:true·usage_limit_reached**, 10월9일00:00(Asia/Seoul) 재개 안내를 반환했다. 모델 사용 내역이 비어 있어 실제 검수 모델·검수 완료를 주장하지 않는다. [원본 응답](../../.tmp/messenger-upgrade-20261008/release-preflight-v2/claude-review.json). 현재 운영 원칙의 검수 조건은 충족되지 않았으며 이전 다른 기능의 한정 생략 승인을 재사용하지 않는다. 운영 서버 시작·원본 DB 열람/마이그레이션·다른 클라우드 후보 수정·배포는 실행하지 않았다. 남은 일은 공식 검수 완료 또는 이번 업데이트에 한정한 사용자 예외 결정 후, 최신 후보/원본·writer를 재확인하고 정지 백업→기동→실계정 읽기 확인이다. 예약은 만들지 않았다.

### 현재 PC 반영 · 2026-10-08 21:34 KST

「이번 메신저 업데이트에 한해 Claude 검수를 생략하고 현재 PC에 적용할까요?」라고 사용량 한도와 운영 원칙을 설명한 뒤 사용자 **「웅 적용해」**로 이번 업데이트의 PC 적용을 승인받았다. 공식 검수가 완료됐다는 뜻이 아니며 외부 서버·다른 변경의 검수 생략으로 확대하지 않는다.

- 4191/4197이 이미 중지된 상태를 확인하고 DB/WAL/SHM6파일의 독점 접근을 확인했다. 이 작업에서 다른 서버 프로세스를 강제 종료하지 않았다.
- 기존 통합 백업 도구로 두 DB·원래 암호화 키·계정 연결·등록 파일과 Drive 설정을 별도 보호 폴더에 보존했다. 원본/백업 논리 내용 일치·백업 전후 원본 안정·두 DB 무결성·COMPLETE를 확인했다. 백업 폴더는 현재 사용자와 SYSTEM만 접근하도록 설정했다. 개인 데이터·키·세션은 저장소 결과물에 넣지 않았다.
- 승인 후보 `c1d54567…b1e9a96`와 현재 실행 원문 **261파일 SHA-256 일치**를 기동 직전 확인했다. 기존 공식 `launch.mjs --messenger`로 **21:31:16 KST, PID16268**을 시작했고 회사 health ready 및4197의 기존 연결을 확인했다. 프로세스 번호는 이 확인 시점의 값이다.
- 실제 기존 관리자 계정으로 **읽기 검증30/30**. 오늘/바뀐 것/결정 화면, 업무·고객 업무 API, 비로그인 거절4경로, 서비스되는 정적 파일7개 원시 바이트, 마린의 실제 기록 조회와 메신저 이동, 명시적 확인 위치 불변을 확인했다. 1440·390·320px의 세 화면에서 가로 넘침0, 브라우저 오류·외부 요청·제품 저장 요청0이었다. 검증 메시지·업무·고객 기록을 넣지 않았다.
- 재기동·읽기 확인 뒤 기존 회사 업무 문서와 메신저 기존21테이블, 원래 키·통합 설정은 백업과 같았다. 새 업무 연결의 빈3테이블만 생겼고 회사 세션 토큰은 시작/만료 정리/검증용 세션 종료로 달라졌다. 사용한 검증 세션만 API로 종료하고 보호 폴더의 임시 쿠키 파일을 제거했다.

[반영·데이터 보존 증거](qa-output/productivity-20261008/pc-live/release-proof.json), [실계정 읽기 검증](qa-output/productivity-20261008/pc-live/readonly-report.json), [실제 오늘 업무함](qa-output/productivity-20261008/pc-live/live-workday-1440.png), [320px 업무함](qa-output/productivity-20261008/pc-live/live-workday-320.png), [320px 결정 검색](qa-output/productivity-20261008/pc-live/live-decisions-320.png). 보호된 상세 백업·감사 기록은 사용자 로컬 `SYNK/Backups/messenger-productivity-20261008/`에 있다. 현재 PC에서 사용할 수 있는 상태이며 클라우드 배포·외부 고객 접속·실물 두 기기·생산성 성과 측정은 완료하지 않았다.

## SYNK ID와 모바일 입구 · 2026-10-02

[SYNK ID 구현 안내](../../docs/마케팅/온라인마케팅지도/engagement/company/SYNK_ID.md)의 회사 계정 연결·브라우저 PKCE·데스크톱 교환·활성 창 갱신과 모바일 입구를 확인했다. 운영4191·실계정·실제 회사 자료는 변경하지 않았다.

- 임시 SQLite 합성 서버 `127.0.0.1:63129`에서 CUA로 검증용 직원 로그인을 완료하고 **내 워크스페이스 → SYNK ID 연결**의 미설정 안내를 확인했다. 인증 제공자의 실제 운영 설정과 실제 SSO 성공을 뜻하지 않는다.
- 휴대폰390px에서 페이지 전체 가로 폭과 scrollWidth가 모두390px였다. 콘솔 경고·오류는0개다. [모바일 화면](../../experiences/synk-account/qa/messenger-mobile-id-20261002.png)을 저장했다.
- 서버 검사는 명시적 일대일 직원 연결, 비밀번호·CSRF, 로그인 CSRF·재사용·계정 전환 차단, 비활성·중앙 철회·만료·재시작, 중앙 일시 장애 복구, 열린 메신저 연결 철회, 서버 PKCE와 콜백 입력 검사를 포함한다. 모바일 manifest·아이콘·설정 파일 비공개·no-store도 확인한다.
- 데스크톱 UI 검사는20초 갱신, 포커스 복귀, 숨김·비활성 중지, 중복 요청 방지, 로그아웃·계정 변경 뒤의 늦은 응답 차단, 일시 오류 복구를 포함한다.
- 최종 관련 7개 파일 **77/77 통과**. 브라우저 refresh 회전과 생략 응답, 중앙503 뒤 후보 보존·후보 만료 재갱신, 잘못된 access 응답 재시도, 같은 계정·연결 revision 확인, 동시 갱신과 로그아웃 경합, 중앙 종료 실패 보고를 합성 HTTP 요청으로 검사했다. 실제 desktop main 인증 서비스와 회사 UI VM을 연결해 초기 signed-out → signing-in → restoring → signed-in 및 로컬 OAuth 콜백을 확인했다. 정상 복원 대기·일시 오류 재시도·기기 자격 정보 삭제 실패 안내·새 계정 보존도 통과했다.
- 검증 후 PID27200의 정확한 `node --title=synk-company-ui-qa --input-type=module -` 명령행을 확인하고 해당 합성 프로세스만 종료했다. 데이터 파일을 삭제하지 않았다.

재현 명령(저장소 루트):

```powershell
node --test docs/마케팅/온라인마케팅지도/engagement/company/server-synk-identity.test.mjs docs/마케팅/온라인마케팅지도/engagement/company/server-auth-race.test.mjs docs/마케팅/온라인마케팅지도/engagement/company/server-messenger.test.mjs docs/마케팅/온라인마케팅지도/engagement/company/workspace-navigation.test.mjs tools/company-messenger/tests/platform-navigation.test.mjs tools/company-messenger/tests/workspace-open-ui.test.mjs docs/마케팅/온라인마케팅지도/engagement/company/synk-id-client.test.mjs
```

## 프론트 리디자인 후속 검증

홈페이지 시안의 ‘싱ㅋ’ 원본 SVG를 적용하고 로그인·탐색·채팅·파일·검색·초대·Drive 설정을 전면 개편했다. 원본의 4개 path와 viewBox가 정확히 일치하는지 대조했다. 참고 화면과 적용 범위는 [DESIGN.md](DESIGN.md)에 있다.

- `node qa/ui-smoke.mjs`: 기존 16개 사용 흐름 통과, 콘솔 오류 0.
- `node qa/redesign-review.mjs`: 1440·1280·900·768·390·320px, 화면 60장 생성. 가로 넘침·콘솔 오류·실패 요청·외부 요청 0. 최종 글자 크기·대비 수정 후 재실행해 통과했다.
- 빈 대화/실무 예시 대화/긴 파일명/검색/초대/Drive 설정/로그인/가입을 임시 DB와 가상 Drive로 확인했다. 실제 Drive와 사용자 데이터에는 검사용 내용을 넣지 않았다.
- 모바일 메뉴에서 검색으로 이동·입력·닫기, 닫힌 메뉴의 Tab 제외, 메뉴·모달의 초점 복귀, SSE 수신 중 채널 버튼 초점 유지, 대화/파일 선택 상태, 키보드 메시지 전송을 확인했다.
- 부모 작업에서 데스크톱 채팅·인증·설정, 390px 채팅·파일, 320px 설정 렌더를 직접 열어 글자·줄바꿈·여백을 점검했다.

재현 가능한 결과는 `qa-output/redesign-report.json`, 화면은 `qa-output/redesign-*.png`다. 이 화면의 대화·동료·Drive 계정은 검사용 예시이며 실제 사용 기록이 아니다. 실제 실행 중인 메신저 탭에도 새 디자인을 적용했다.

## 앞선 기능·Drive 연결 검증

로컬 Node.js 24.18.0, 설치된 Chrome에서 확인했다. 계정·대화 DB는 검사용 임시 폴더를 사용했다. 실제 `data/`에는 테스트 계정·대화·첨부 행을 넣지 않았다. Drive 실연결 검사는 아래에 별도로 기록했으며, 실제 계정의 메신저 전용 폴더에 만든 검사용 파일만 휴지통으로 옮겼다.

## 백엔드

`node --test tests/*.test.mjs` **23/23 통과**. 기존 API 9개, Drive API 통합 7개, Google 요청 모킹 기반 저장소 검사 7개다. 이 자동 검사는 임시 폴더와 가짜 Drive 응답만 사용하며 실제 Google 계정이나 네트워크에 접근하지 않는다.

- 최초 설정·로그인·로그아웃, 서버 재시작 후 데이터 보존
- 동시 초기 설정/초대 가입, 일회용 초대와 권한 제한
- 개인 메모·DM·검색·다운로드·SSE의 채널 멤버십
- 메시지 수정/삭제, 반응, 읽음, 이전 페이지
- 파일 내용 보존, HTML 첨부 다운로드 강제, 취소/삭제 후 디스크 정리
- 업로드 중 연결 중단 후 부분 파일·DB 행 정리, 후속 요청 정상 처리
- 크기 제한, Host/Origin 위조 요청 거부
- 메시지 삭제와 수정/반응 요청 경합: 이미 삭제된 경우 404
- 기존 로컬 DB 마이그레이션, 계정 전환·재시작 후 파일별 원래 저장소 유지
- 업로드 도중 저장 계정 변경 시 시작한 계정 유지, 이후 업로드만 새 계정 사용
- Drive 인증·용량 오류 시 명시적 실패, 로컬 저장으로 대체하지 않음
- 업로드 실패·브라우저 연결 중단 시 로컬 임시 파일과 원격 파일 정리
- 삭제 요청의 DB 영속 저장, 인증 오류와 재시작 이후 재시도 복구
- 관리자 전용 설정, 비로그인/일반 멤버에게 계정 정보·인증 비밀 비노출
- 인증 원본 보존, 계정 일치 확인 후 폴더 생성, 다른 폴더/표식의 파일 접근 차단
- 외부 업로드 주소 거부, 크기·MD5 원본 검증, Drive에서 수동 변경된 파일 다운로드 차단
- 같은 이메일의 다른 OAuth 클라이언트 등록 시 기존 연결·파일 접근 보존

## 실제 브라우저

`node qa/ui-smoke.mjs` **16개 흐름 통과**, 일반 사용 중 콘솔 오류 0. 네트워크 단절 시험 구간은 의도된 연결 오류를 별도로 취급한다.

관리자 설정 → 한글 조합 중 Enter/Shift+Enter → 메시지 작성·수정·삭제·반응 → 파일 업로드·원본 다운로드 바이트 일치 → 미전송 첨부 새로고침 복구 → 파일 모아보기 → 채널 생성 → 개인 메모·작성 초안 복구 → 검색 결과 이동 → 초대 가입 → 두 브라우저 세션 실시간 수신 → DM 양방향 전송 → 연결 단절 후 놓친 메시지 복구 → HTML 모양 문자의 일반 텍스트 표시 → 390/320px 화면 → 로그아웃·재로그인.

1440×960 화면과 390×844 화면을 실제 렌더해 확인했다. 320px에서도 가로 넘침이 없고, 모바일 메뉴를 통한 채널 이동을 확인했다. SUIT·Inter Tight 로컬 서체 로드를 확인했다. 최종 화면은 `qa-output/setup-desktop.png`, `setup-mobile.png`, `chat-desktop.png`, `chat-mobile.png`에 있으며 채팅 화면은 검사용 데이터다.

## 실제 Google Drive

다음 명령으로 **실제 6MiB 파일**의 업로드·원본 다운로드를 확인했다.

```powershell
node qa/live-drive.mjs --confirm-live --email unmet23@gmail.com --large
```

- 계정 `unmet23@gmail.com`, 한도 5,497,558,138,880바이트(화면 표시 5TB)
- [메신저 전용 비공개 폴더](https://drive.google.com/drive/folders/1t9EzZO-JJLTDkOamtKhd0xUbvHqUEraL)에 저장
- 브라우저 업로드·다운로드 6,291,456바이트 일치, SHA-256 및 Drive MD5 원본 검증 통과
- 관리자 설정의 실제 이메일·계정 전체 용량 표시, 데스크톱과 모바일 화면 확인
- 검사용 파일만 앱에서 삭제해 Drive 휴지통 이동 확인, 삭제 대기 0건
- 브라우저 콘솔 오류 0

화면 기록은 `qa-output/drive-chat.png`, `drive-settings.png`, `drive-settings-mobile.png`다. 이 명령은 실제 Drive에 파일을 생성하고 해당 파일을 휴지통으로 옮기는 수동 검사이므로 일반 자동 테스트에 포함하지 않는다. 휴지통 이동은 영구 삭제가 아니며 계정 용량을 즉시 돌려주지 않는다.

## 실행과 범위

Windows 시작·종료 런처를 실제 실행했다. 기본 주소 `http://127.0.0.1:4197`에서 최초 계정 설정 화면을 확인했다. 실제 바탕화면에 `SYNK 팀 메신저.lnk`를 만들었다. 사용 데이터 폴더와 검수 출력은 Git 제외를 확인했다.

최종 서버 재시작 후에는 사용자가 만든 관리자 계정과 기존 브라우저 세션이 유지되는 것을 확인했다. 실제 사용 데이터는 구성원 1명, 메시지 0개, 첨부파일 0개이며 테스트 계정을 주입하지 않았다. 실제 설정 화면에서 `unmet23@gmail.com`, 사용량 421.32GB / 한도 5TB, Drive 연결됨 표시를 확인했다. 사용량은 이 확인 시점의 계정 전체 값이며 이후 달라질 수 있다.

개인 사용용 로컬 서버와 실제 Drive 파일 저장까지 검증했다. 외부 서버 배포, Supabase 연동, 자동삭제, 모바일 푸시, 수십 명 장기 부하, 백업 복원 실전 운영은 이번 검증 범위가 아니다. 대화·계정 DB는 PC에 남으며, Drive 연결이 앱 서버의 원격 접속을 제공하지는 않는다. 앱은 사진·문서 등의 파일을 내려받는 방식이며 브라우저 내 문서 편집·영상 통화 기능은 없다.

## 2026-10-01 브랜드 리디자인

첨부 이미지에 적힌 Webcore / Masking shape / Confetti / Sketchbook collage / Embossed / Camera interface / Naive design을 각각 조사했다. 적용과 자료는 [디자인 기록](DESIGN_UPGRADE_20261001.md)에 있다. 승인된 싱ㅋ 로고·SUIT/Inter Tight/DM Mono·SYNK 색·펠트 마린과 스티커를 사용했다. 로컬 통합 화면 `http://127.0.0.1:4191/?tab=messenger`에 정적 파일 변경을 반영했다.

- `node --test tools/company-messenger/tests/*.test.mjs`: **131/131 통과**. 대화방 찾기 3개 검사를 추가해 현재 종류·안 읽음 필터·권한·문자 이스케이프·초안 보존을 확인했다.
- 회사 메신저 통합·화면 이동·홈과 대화 분류의 관련 검사: **56/56 통과**. 이 수에는 위 메신저 검사와 겹치는 대화 분류 검사도 포함된다.
- 실제 브라우저에서 별도 임시 SQLite와 가짜 Drive 공급자만 사용한 5인 검증 공간으로 개인/팀/전체 전환, 방 찾기/검색 지우기/빈 결과, 팀별 크루 필터, 메시지 검색과 원문 이동, 고정 메시지·답글·반응 표시, 파일 모아보기와 159바이트 원본 다운로드, 메시지 저장과 개인 보관함/원문 이동, 새 멘션 버튼→크루 선택→전송을 확인했다.
- 320×740 / 390×844 / 768×900 / 900×900 / 1280×960 / 1440×960에서 실제 화면과 DOM 치수를 확인했다. 바깥 화면과 메신저 프레임의 가로 넘침이 없고 입력창은 화면 안에 있다. 모바일 목록 열기·Escape 닫기와 초점 복귀, 320px 저장 패널, 좁은 화면의 아이콘 버튼 접근성 이름을 확인했다. 화면 전환 애니메이션이 끝난 기록을 사용한다.
- 조회 전용 계정은 입력창 `readOnly`, 첨부·멘션·전송 비활성화와 안내 문구를 확인했다. 신규 로고 링크의 홈 이동과 메신저 복귀 시 원래 대화 유지도 확인했다.
- 실제 계정은 데스크톱 기본 크기와 390px 빈 대화 화면을 확인했다. 실제 계정/방/메시지/파일은 **1명/5방/0개/0개**이며 검증용 메시지나 크루를 넣지 않았다. 기존 회사·메신저 원본과 Drive 설정·데모의 보존 해시 검사가 통과했다. 실제 탭과 분리 검증 탭의 오류·경고 로그는 0개다.
- 작은 안내/입력 placeholder 색을 보강했다. 입력 안내 `#626f84`는 흰 배경에서 대비 5.09:1, 주요 버튼의 밝은 파란색 `#4674cf`와 흰 글자는 4.51:1이다. 키보드 초점과 기존 reduced-motion 대응을 유지했다.

화면: `qa-output/upgrade-after.png`(실제 계정), `upgrade-live-mobile.png`(실제 계정 390px), `upgrade-chat-{320,390,768,900,1280,1440}.png`(분리된 검증 데이터). 치수와 확인 항목은 `qa-output/upgrade-report.json`에 기록한다. 브라우저 검증 크기는 원래대로 복구하고 임시 검증 서버는 종료한다. 이번에는 실제 Drive 파일 전송이나 외부 배포를 다시 수행하지 않았다. 사용자 만족도나 스타일별 성과 순위는 검증 결과로 주장하지 않는다.

## 2026-10-02 Slack 참고 전체 개편

메신저를 공통 앱 상단 바·고정 주요 탐색 메뉴에 통합했다. 채팅 분류는 대화 목록에, 개인 도구는 대화 제목 옆에 모았다. 방 목록·메시지·입력창·검색·보관함을 압축하고 크루 목록은 필요할 때 연다. 모바일 메시지는 저장·답글·반응과 더보기로 정리한다. 수정·삭제·알림·할 일의 기존 권한과 동작은 유지한다.

메신저 **131/131**와 워크스페이스 관련 **122/122** 검사 통과. 별도 3인 공간의 대화 3개를 320·390·768·958·1280·1440px에서 확인했으며 가로 넘침 0, 작성창이 프레임 안에 있다. 초안 왕복 유지·크루 목록·검색·모바일 더보기·메뉴 키보드 순환을 실제로 확인했다. 실제 계정도 PC·390px에서 확인하고 기존 1계정·5방·0메시지·0파일과 Drive 설정 해시를 보존했다. 검수 서버 종료·브라우저 크기 복원 완료. 전체 변경과 화면·검증 JSON은 [워크스페이스 검증 기록](../../docs/마케팅/온라인마케팅지도/engagement/company/WORKSPACE_QA.md)의 같은 날짜 전체 개편 항목에 있다.

## 2026-10-02 펠트 브랜드 후속 마감

승인 사진 자산으로 대화 분류·선택한 방·개인 도구·첨부·보내기 버튼과 빈 대화 안내를 마감했다. 실제 코랄 판·연코랄 칩·체크 배지를 사용하고 대화·작성 면은 흰색으로 뒀다. 작은 실땀 구분선은 일반 경계로 정리했다. `messenger-design.css`와 정적 자산에 적용했으며 이번 후속에서 메신저 동작 코드는 변경하지 않았다.

메신저 **131/131** 검사 통과. 실제 빈 대화와 별도 검수 대화 3개를 각각 320·390·768·958·1280·1440px에서 확인했다. 가로 넘침 0, 작성창이 프레임 안에 있다. 기존 회사 데이터·1계정·5방·0메시지·0파일과 Drive 설정 해시를 보존했다. 화면·자산 원본 대조·253개 관련 검사와 로컬 확인 범위는 [워크스페이스 검증 기록](../../docs/마케팅/온라인마케팅지도/engagement/company/WORKSPACE_QA.md)의 전체 펠트 브랜드 마감 항목에 있다.
