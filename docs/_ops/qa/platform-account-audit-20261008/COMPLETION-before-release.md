# 남은 1–5번 구현·출시 후보 · 2026-10-08

사용자 요청은 기존 검수에 이어 최신 공개/PC 반영, 두 기기 기록 연결, 종료 뒤 알림, 플랫폼 계정 라이브러리, 개인 앱 보강을 마치는 것이다. 사용자는 현재 휴대폰을 사용할 수 없다고 답했다. 아래는 구현·로컬 검증·배포 대기를 나눠 기록한다.

## 구현한 내용

- 계정 라이브러리: 명시적으로 연결하고 저장을 켠 뒤 즐겨찾기·최근 열기·직접 적은 이어쓰기 메모만 같은 SYNK ID에 저장한다. 기기 기록은 별도 확인 후 옮긴다. 앱 원문이나 이용 권한은 가져오지 않는다. 두 세션 CAS, 계정별 미저장 임시 기록 선택, 늦은 응답 폐기, 삭제 후 저장 끄기를 기존 공통 노트북에 연결했다.
- 실제 화면에서 다시 불러오기 뒤 편집 버튼이 계속 잠기는 문제를 재현하고, 공통 노트북의 상태 알림으로 잠금을 해제했다. A 계정의 미저장 입력을 B 계정 화면에서 다시 수집하던 문제도 수정했다. 삭제 안내는 라이브러리 내용에 맞게 바꿨다.
- ‘싱크 플랫폼 사용자 경험 개선’ 작업과 사용자의 허락을 받아 같은 파일의 최종본을 조율했다. 미제출 이어쓰기 메모를 PC 종료·로그아웃 확인에 포함하고, 기존 홈 초안과 함께 취소/폐기/초점 복귀를 처리한다. `pagehide` 중 재렌더를 멈추고 `pageshow`에서 복구한다. 이후 신규 기능의 배포·설치는 이 작업 한 곳에서 진행하기로 했다.
- Care: CSV/Care JSON에서 이름·관계·그룹만 미리 보고 선택한 연락처를 가져온다. 처음에는 모두 미선택이며 동명이름/기존 기록은 건너뛴다. 전화번호·이메일·대화·일정은 가져오지 않는다.
- 대화 리허설: 면접/부탁/거절의 상대·목표 12조합과 연습 방향 36경로. 선택값을 결과·재시도·작품집·JSON·계정 기록에 보존하며 옛 기록도 읽는다. 입력문을 AI로 분석하는 기능은 아니다.
- 운세: 한국 날짜 기준 오늘~6일 전의 저장된 메모와 완료 행동을 모으는 회고. 기록 다시 보기·수정·명시 저장. 공개 하위 경로 OAuth callback 지원과 중복 heading ID 수정.
- 출시 연결: 공개 후보의 운세/리허설 진입 URL을 플랫폼에 연결했다. 웹 링크는 care/fortune/rehearsal의 ID별 정확한 HTTPS 주소만 허용하며 설치 권한이나 네이티브 실행 기록을 만들지 않는다. 웹 이어쓰기 버튼은 가능한 공개 페이지를 연다.

## 최종 후보 위치

| 대상 | 고정 후보 | 현재 상태 |
|---|---|---|
| Care / SYNK ID 운영·리허설 / 웹 플랫폼 | `.tmp/platform-completion-web-1791468931049/` | Care49·웹플랫폼37·ID각14파일. 현재 공개 config의 등록된 platform callback을 보존하고 fortune/rehearsal 계획을 병합. 이 후보 전체는 미게시 |
| 운세 / 대화 리허설 | `.tmp/platform-completion-personal-final-20261008/` | 운세17·리허설21파일. 실제 기존 public client 설정, 자체 자산/라이선스/번들. callback 미등록·미게시 |
| PC Windows x64 Preview | `desktop/artifacts/platform-continuity-candidate-2026-10-08T14-12-34-974Z/` | WORLD·Messenger·Platform 3종. 동시 작업의 최종 종료 보호 반영. 미설치 |
| 개인 기록 서버 / 새 CHECK migration | `C:/Users/q1212/Documents/SYNK-platform-completion-backend-20261008` | 격리 브랜치 `codex/platform-continuity-20261008`, 기존 공개 release `d4acb29` 기반. 미배포 |

PC sourceHash는 `8a87e0386fff7f1db5a88e86cf183c90b0177ebdb06f43f1c4a1ac556d8db8f7`이다. 입력144개와 시험 의존14개를 고정했고 ASAR별 런타임86개, x64·아이콘·공개 인증 설정, 동봉 WORLD/Messenger 설치 파일과 executable/ASAR pin을 모두 대조했다. 검증 시점 `sourceStableAfterBuild:true`, `sharedChanges:[]`다. 이전 `13-15`, `13-22`, `14-03`, `14-07` 후보는 동시 작업의 종료 보호 보완 전 중간본으로 보존한다. 설치 파일 생성·검증은 실제 설치나 업데이트 증거가 아니다.

23:17 KST [전체 후보 대조](completion-candidates.json)는 Care49·운세17·리허설21·웹플랫폼37·ID각14파일과 PC 설치 파일3종의 원본/출력 hash를 확인했고 불일치0이다. 서버 증분과 callback 도구 SHA도 기록했다. 재현 명령은 `node docs/_ops/qa/platform-account-audit-20261008/verify-completion-candidates.mjs`다.

## 로컬 검증

| 검사 | 결과 | 근거 |
|---|---|---|
| 계정·플랫폼 전체 | 280/280 | `completion-portal-current-tests.txt` |
| 최종 PC 고정본 | 265/265 | PC 후보의 `qa-tests.log`, `artifacts/package-verification.json` |
| Care 전체 | 440/440 | `completion-care-tests.txt` |
| 운세 전체 + 공개 개인 앱 builder | 107/107 (운세98 + builder9) | `completion-fortune-final-tests.txt` |
| 리허설·가족 앨범·공통 노트북/복구 | 161/161 | `completion-personal-tests.txt` |
| 최종 이동 연결 관련 회귀 | 75/75 | `completion-final-links-tests.txt` |
| 공개 OAuth callback 적용 도구 | 72/72 | `completion-provision-tests.txt`, `completion-provision-review.md` |
| 개인 자료/플랫폼 DB 기능 | 41/41 | `collision-feature-tests.txt` |
| 과거 후보 전체 스키마·합본 | 39/40, 선형 체인 검사 실패 | `collision-schema-tests.txt`; 아래 적용 집합 차이 참조 |

범위가 겹치는 후속 회귀는 위 수치에 합산하지 않는다.

### DB 번호 충돌과 안전한 증분 범위

이미 적용된 Drive `20261008120000`을 양 원격에서 확인하고, 아직 미적용인 플랫폼 파일을 **`20261008130000_synk_platform_library_c16.sql`**로 옮겼다. 최종 checksum은 `ce1cef2cf41107a182d78a232f66b605a5651347aa9d8655a8749fef4f8879b3`다. Drive120000 checksum과 개인 자료 원본 checksum을 선행 조건으로 확인하고, 기존 자원 CHECK가 정확히3개일 때만 platform-library를 추가한다. 독립 작업이 자원을 추가했다면 덮어쓰지 않고 거절한다.

현재 원격 적용 집합과 오래된 후보 전체 스키마가 다르므로, 실제 gate는 개인 자료 RLS/정책/권한 누출/계정 삭제 연결/삭제FK/정확한4개CHECK/신규 이력이다. 오래된 전체 스키마 판정은 참고 진단으로 명확히 분리했다. 과거 선형 체인 불일치3개와 후보 밖 Drive 이력을 참조하는 새 증분 차이1개 때문에 해당 검사1개는 계속 실패한다. 이를 전체 통과로 보고하지 않는다. 기존 적용 SQL은 수정하지 않았고, 원격 적용89개 SQL의 정확한 원본 위치와 hash도 기록했다. **전체 합본은 재적용하지 않으며 신규130000 한 파일만 배포 대상**이다. [충돌·증분 검증 기록](collision-audit.md)이 이전 migration QA보다 우선한다.

### 실제 IAB에서 확인한 범위

- 계정 라이브러리: 같은 서버 역할을 하는 합성 Map과 두 native adapter. 연결만으로 쓰기0, 동의 후 메모/즐겨찾기 저장, 두 번째 세션 다시 읽기와 입력 활성화, 서로 다른 변경의 충돌 안내, 계정 저장본 선택, A의 원시 입력이 B로 넘어가지 않음, 로그아웃 후 화면 비움. 390/320px 가로 넘침0, 브라우저 warn/error0. `completion-platform-390.png`, `completion-platform-1280.png`.
- Care: 합성 CSV 4명→선택 가능3/중복1, 유나 한 명만 선택해1명 추가. 다시 읽으면 선택 가능2/중복2, 기존 유나 비활성. 390/320px 넘침0·오류0. `experiences/relationship-care/qa/contacts-20261008/`.
- 리허설: 부탁→일정을 결정하는 상사→일정 조정→부담스러운 반응의3턴→결과→두 번째 말 다시 쓰기→작품집. 선택한 분기/원문/재작성 유지. 390 재연습·320 작품집 넘침0·오류0. `experiences/conversation-rehearsal/qa/cua-practice-390.png`. 기기 저장 재방문과 실계정 확인은 이 IAB 시나리오에 포함하지 않았다.
- 운세: 최종 공개 bundle을 localhost에서 합성 native 계정으로 열어7일·저장 기록1개 표시, 다시 보기→메모 수정→명시 저장→회고에 수정 반영을 확인했다. 390/320px 넘침0·중복ID0·warn/error0. `completion-fortune-390.png`. 실제 OAuth/서버 왕복이 아니다. 이전 `reflection-browser-smoke`는 별도 headless Chrome 합성 검사였으며 IAB와 구분한다.
- 전체 웹 플랫폼: 실제 공개 후보의 홈 안에 들어간 라이브러리 화면을 1280/390/320px에서 확인했다. 로그아웃 상태의 연결 단추는 로그인 안내로 전환하고 메모 입력은 노출하지 않는다. 가로 넘침·깨진 이미지·warn/error0. `completion-whole-platform-ui.json`과 `completion-whole-platform-*.png`. 이 화면 검수는 `1791468172621` 후보 기준이며, 뒤의 `pageSuspended` 보완은 현재 후보와 자동 회귀에서 검증했다.

검수용 탭과 이 작업에서 띄운 4332/4333/전체 웹 플랫폼 임시 서버는 종료했다. 사용자가 열어 둔 공개 Care 탭은 변경하지 않았다.

## 배포 전 남은 관문

1. **Claude Opus 5.5·max 최종 검수 미완료.** 공식 CLI `claude.exe --safe-mode --print --output-format json --tools Read,Glob,Grep --allowedTools Read,Glob,Grep --strict-mcp-config --no-chrome --no-session-persistence --permission-prompts none --model claude-opus-5-5 --effort max`에 실제 후보 검수를 요청했으나 `usage_limit_reached`, HTTP429, 세션 한도·자정 KST 초기화 응답. `modelUsage:{}`, 입력/출력토큰0으로 실제 모델 검수는 시작되지 않았다. `completion-claude-review.json`이 근거다. [공통 원칙](../../../AI_운영원칙.md)의 최종 검수를 다른 모델로 대체하지 않는다.
2. 검수 통과 뒤 현재 원격 상태를 다시 읽어 **새 platform-library 증분 migration→synk-personal runtime→미등록 개인 앱 callback→중앙 ID/개인 앱/웹 플랫폼→PC 업데이트** 순서로 적용한다. `platform-public-provision.cjs`와 `personal-public-provision.cjs` 모두 기본 dryrun이며 명시 `--apply`에만 변경한다. 잠금·mapping/client/기존 callback/운세 허용목록/journal 직전 재검사, pending→confirmed, 불명확 요청 자동 재전송 차단을 구현·합성 검증했다. 플랫폼 callback은 이미 별도 작업에서 적용됐으므로 재전송하지 않는다. 운세·리허설 두 주소는 실제 미적용이며 새 client/제품 매핑/운세 허용목록 변경은 필요 없다.
3. 원격 public 결과의 HTTP·MIME·전체 manifest SHA, 실제 로그인과 저장/로그아웃/재로그인 검증, 설치된 PC의 새 sourceHash 대조가 남았다. 공개 후보가 준비됐다는 사실을 라이브 반영으로 보고하지 않는다.
4. **휴대폰 실제 PC↔폰 기록 왕복/충돌/계정 이동, 앱 종료 후 OS 알림 수신·클릭은 미확인**이다. 기존 PC push endpoint의 전송 성공도 OS 수신 증거와 다르다. 휴대폰을 사용할 수 있을 때 별도 확인한다.

## 다른 작업에서 이미 반영한 범위

23:12 KST 공개 GET에서 `/account/platform.html` HTTP200·SHA `94edb16075bc3ed0423e711b6ef620bad45471f2715c5d69e36359bdf7db280f`, `/account/dist/platform.js` HTTP200·SHA `6ea497a30eb8789cd92c05c5c395846658156c5f54c2b77a03ff759a95cef36a`를 확인했다. 따라서 [21:50 출시 조사](release-inventory.md)의 플랫폼404·설치판 설명은 당시 기록이다.

‘싱크 플랫폼 사용자 경험 개선’ 담당의 조율 보고에 따르면 별도 공개 commit `05be3a5d5c2fbe23eca384469270652ed443cbaa`는 홈8+account36+ID config1의45파일과 플랫폼 callback1개다. 그 작업에서 Claude429 뒤 해당45파일/1callback에 한정한 사용자 예외 승인을 받았고, [그 작업 기록](../platform-experience-20261008/README.md)에 남겼다. 실제 회원의 로그인→홈→새로고침→로그아웃→재로그인도 확인했지만 개인 기록/동의 쓰기 및 신규 platform-library API 호출은0이다. 이전 PC 설치도 sourceHash `3079b9ed…`에서 완료했다고 보고했다. 이 보고를 이번 신규 동기화·DB/runtime·개인 앱·최종 PC 후보의 공개 승인이나 설치 증거로 확대하지 않는다.

이번 후보 자체는 아직 배포·설치하지 않았다. 이 문서는 예약 실행이나 자동 배포를 설정했다는 뜻이 아니다.

23:18 KST 도구의 원격 읽기 전용 재검사에서도 플랫폼 callback 등록을 확인했고, 개인 앱은 추가2개·실제 요청0·제품 매핑/운세 허용목록 변경0이었다. `completion-platform-callback-readonly.json`, `completion-personal-callback-readonly.json` 및 `.tmp/synk-id/personal-public-candidate-20261008-final/`에 정확 계획을 보존했다.
