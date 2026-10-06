# SYNK 공통 계정 최종 검수 재개 자료

2026-10-06. 로컬 수정과 회귀 검증까지 완료한 후보이며 원격 적용·사용자 로그인은 미실행이다. 아래는 Claude 검수 통과를 대신하는 기록이 아니다.

## 공식 Claude Code 세션

- 코어·저장 검수: `6cb7dc22-d83c-4ebc-a039-d3c1ae44e306`, [기존 결과](unified-account-review-20261006.json). `is_error=false`, 결론은 수정 필요.
- 등록·설정 검수: `4ba6e7a6-ac59-430f-ac12-7afe9a1258a4`, [요청](../../../tools/synk-id/qa/unified-provisioning-final-review-20261006.txt) / [결과](../../../tools/synk-id/qa/unified-provisioning-final-review-20261006.json). `is_error=true`, session limit, 2026-10-06 22:50 Asia/Seoul 재설정 안내.

다음 작업에서 공식 `claude` CLI의 기존 세션을 이어 읽기 검수를 요청한다. **2026-10-06 사용자 요청으로 `--model claude-opus-5-5 --effort max`를 반드시 명시한다.** 기존 두 결과의 `modelUsage`는 `claude-opus-5`이며 당시 사용자 기본 설정은 `effortLevel: xhigh`였다. 과거 검수가 Opus 5.5/max였다고 소급해서 표시하지 않는다. [검수 전용 공식 설정 파일](claude-review.settings.json)도 같은 값이며 일반 작업의 사용자 기본 설정은 변경하지 않았다.

읽기 도구 `Read,Glob,Grep`만 사용하고 파일 수정·원격 쓰기·유료 API·배포를 허용하지 않는다. 토큰·키·비밀 파일을 읽거나 출력하지 않는다. 쿼터 재설정 안내만으로 검수를 완료한 것으로 간주하지 않는다. 재개 시 명령의 핵심 옵션은 다음과 같다. 공급자 한도로 막히면 다른 모델로 대체하지 않고 미완료로 남긴다.

```powershell
claude --resume 6cb7dc22-d83c-4ebc-a039-d3c1ae44e306 -p --model claude-opus-5-5 --effort max --tools 'Read,Glob,Grep' --allowedTools 'Read,Glob,Grep' --permission-mode plan --add-dir 'C:/Users/q1212/Documents/SYNK-talk' 'C:/Users/q1212/Documents/SYNK-talk-care-release-20261006' --output-format json
```

요청 본문은 stdin으로 전달하고 출력은 새 결과 파일에 보존한다. 등록 도구 검수는 두 번째 세션 ID를 사용한다. 실행 결과의 실제 `modelUsage`와 `is_error`, 지적 사항을 확인하기 전에는 통과로 기록하지 않는다. 명시한 max는 공식 CLI 인자로 확인하고, 응답이 이를 별도 증명하지 않으면 응답 자체가 max를 보고했다고 표현하지 않는다.

21:55에 위 코어 세션을 [새 요청](unified-account-opus55-review-20261006.txt)과 명시한 모델/추론 옵션으로 재개했으나 [사용량 제한](unified-account-opus55-review-20261006.json)을 다시 받았다. 세션의 새 assistant 행은 API 오류용 `<synthetic>` 응답이며 새 모델 추론은 실행되지 않았다. 결과 `modelUsage`의 Opus 5는 이전 세션 누적 기록이므로 Opus 5.5로 실행됐다는 증거가 아니다. 제한이 풀린 뒤 같은 명시 옵션으로 다시 검수해야 한다.

## 지적별 수정 근거

1. **P1-1 가족 앨범 원본 수명·쿼터**
   - `SYNK-talk/lib/synk-personal-store.js`: 계정 잠금과 성공한 CAS 저장 안에서 이전 문서가 참조했지만 새 문서가 참조하지 않는 원본만 삭제 대기 상태로 이동한다. 다른 페이지에서 계속 쓰는 파일, 충돌한 저장의 파일, 방금 업로드되어 아직 문서에 포함되지 않은 파일은 이 경로로 지우지 않는다.
   - 한 번도 커밋되지 않은 confirmed 원본은 7일 유예 뒤 정리하며 현재 문서 참조 여부를 다시 확인한다. 기존 staging 만료 및 실제 Storage 부재 확인·정리 영수증 계약을 유지한다.
   - `experiences/family-album/app.mjs`: 계정 앨범 전체 삭제를 확인 대화상자와 `notebook.remove()`에 연결했다. 원본을 찾지 못한 대기본은 현재 화면의 바이트로 다시 업로드하고, 원본을 불러오지 못한 복구 대기본은 서버본으로 자동 덮지 않는다.
   - 20MiB 한도 자체는 유지한다. 꽉 찬 계정에서 교체 파일을 먼저 올릴 수 없을 때 기존 원본 제거→저장 성공→새 파일 추가를 안내한다. 전체 교체용 임시 초과 용량을 제공하지 않는다.
   - `SYNK-talk/tests/synk-personal.test.js`, `synk-personal-media.test.js`에서 참조 차집합·공유 참조·CAS 충돌·유예 만료·서명 업로드·SHA 확인·정리 실패 재시도 검증. 실제 공급자 검증은 아직 아니다.
2. **P1-2 계정 사본의 기기 잔존**
   - `experiences/synk-account/src/document-sync.mjs`: pending만 저장한다. 서버 읽기/저장 ACK/삭제/닫기에서 완료 사본을 제거하고, 이전 버전의 완료 캐시도 시작 시 제거한다.
   - 오프라인 pending은 계정별로 보존하되 화면에서 잔존 사실을 표시한다. `localRecords`, `exportLocalRecords`, `clearLocalRecords`를 제공하며 삭제는 로그아웃 상태에만 허용하고 해당 앱 prefix만 대상으로 한다.
   - care 앱과 공통 `account-notebook.mjs`에 복구 내보내기·확인 후 기기 임시 기록 삭제를 연결했다. 비회원 기기 수첩과 다른 앱 기록은 이 삭제 범위가 아니다.
3. **P2-1 영구 거절의 오류 분류**
   - 공통 동기화에서 `PAYLOAD_TOO_LARGE`, `INVALID_PERSONAL_STATE`, `PERSONAL_DATA_TOO_LARGE`, `REVISION_CAPACITY`, `ASSET_NOT_FOUND`, `ASSET_NOT_CONFIRMED`, `MEDIA_QUOTA_EXCEEDED`를 연결 대기가 아닌 오류로 표시한다. 내보내기·용량 확보·원본 재시도 등 다음 행동을 설명한다.
   - 별도의 care JSONB 상한 지적은 현재 모델에서 재현되지 않았다. `SYNK-talk/tests/synk-care.test.js`에서 최대 컬렉션의 추가 공백 상한 775,008byte를 계산하고 실제 postgres 직렬화기/PGlite로 4,194,304byte 유효 JSON 저장→4,702,190byte JSONB를 확인했다. DB 5,242,880byte 상한을 늘리지 않았다. 모델 컬렉션 상한 변경 시 이 증명을 다시 실행한다.
4. **P2-2 손상 캐시 경고·원문 소실**
   - 손상 원문은 같은 키에 그대로 보존하고 읽기 성공 뒤에도 경고를 유지한다. 새 서버본이나 저장 ACK로 손상 raw를 덮어쓰지 않는다.
   - 사용자가 원문 그대로 복구 파일을 내려받거나 로그아웃 뒤 확인하여 제거할 수 있다. 저장소 읽기·열거·삭제 실패도 숨기지 않는다.

## 후속 읽기 검토에서 발견한 자료 손실 수정

- 같은 계정의 두 탭이 단일 localStorage 키를 사용하면 A의 늦은 저장 ACK가 닫힌 B 탭의 미전송 원문을 지웠다. [수정 전 실제 Chrome 재현](shared-cache-20261006/before-fix.json)을 남겼다. 이제 각 변경을 고유한 초안 키로 쓰고 ACK가 포함한 초안만 정리한다. 이전 사본은 새 초안 쓰기가 성공한 뒤에만 정리하며 다른 탭의 초안을 덮어쓰지 않는다.
- 새로 열 때 서로 다른 초안이 여러 개면 `local-conflict`로 자동 저장을 멈춘다. `localDrafts` 목록에서 작성 시각을 보고 `selectLocalDraft`로 고른다. 선택하지 않은 초안과 원격 기록을 열면서 남겨 둔 초안은 계속 복구할 수 있다. 이전 v1 단일키 읽기는 유지한다.
- 기기 용량 부족 등으로 계정에도 기기에도 저장하지 못한 편집은 로그아웃 경고에 포함했다. 플레저의 아직 수첩에 보관하지 않은 초안·대화 입력도 확인하며, 새로고침/닫기 전에 브라우저 이탈 경고를 요청한다. 취소하면 편집을 유지한다.
- 공통 수첩은 초안 선택 요청의 늦은 응답이 그사이 새로 편집한 내용을 비우지 않도록, 세대·화면 버전 검사를 거쳐 실제 화면이 교체되는 시점에만 이전 미전송 입력을 정리한다.
- [수정 후 실제 Chrome 공유 캐시 검증](shared-cache-20261006/result.json): 24/24. 동일 context 두 탭의 실제 localStorage를 사용하며 계정 통로·문서 스키마만 합성이다. 서빙 모듈의 시작/종료 SHA를 확인했고 사용자 브라우저 프로필·실제 계정·원격 저장소는 사용하지 않았다.

## 현재 검증과 후보

- [전체 앱 회귀](unified-account-unit-20261006.txt): 201/201. `tests/synk-document-sync.test.mjs` 23개 포함.
- [개인 3앱 브라우저](personal-apps-20261006/results.json): 66/66. [플레저 계정 브라우저](../../relationship-care/qa/account-sync-20261006/result.json): 39/39. 격리된 합성 계정·서버로 검증했으며 실제 운영 로그인은 아니다.
- [등록·복구·보호 조건](../../../tools/synk-id/qa/provision-unit-20261006.txt): 34/34. 실제 원격 쓰기는 없다.
- [릴리스 후보 검증](../../../tools/synk-id/qa/care-release-verification-20261006.txt): care 14/14 + 개인자료·미디어·합성 공급자 25/25. 두 번들 --check 통과.
- [소유 파일 SHA](../../../tools/synk-id/qa/care-release-source-sha-20261006.json): 원본 26개·외부 정본 모델 6개. 릴리스의 auth/store는 기준 HEAD이고 공유 작업본의 다른 미커밋 변경을 포함하지 않는다.

최종 배포 후보는 `C:/Users/q1212/Documents/SYNK-talk-care-release-20261006`의 `codex/synk-care-personal-20261006` 브랜치다. 아직 커밋하지 않았다. 코어 재검수는 수정된 원본과 더불어 이 후보의 auth/store·생성 runtime 차이도 확인한다. 등록 도구는 본래 검수 범위 전체를 마무리한다. 검수 중 새 변경이 생기면 필요한 회귀와 SHA 기록을 갱신한다.

## 검수 뒤 실제로 남은 단계

검수 결과를 확인하고 필요한 수정을 끝낸 뒤 후보 파일만 커밋한다. 리허설 등록/설정→최소 care/personal migration 및 함수→준비된 합성 공급자 왕복 도구를 순서대로 실행하고 원격 증거를 남긴다. 성공 결과를 근거로 운영의 기존 매핑을 보존하며 신규 public 등록·동의 포털·최소 migration/function을 적용한다. 실제 사용자 PKCE 로그인과 두 기기 저장·재조회는 별도 확인한다. 기존 공급자 시험 도구의 password-grant 합성 계정 성공을 사용자 PKCE 증거로 대체하지 않는다.

`.env`를 릴리스 후보로 복사하지 않는다. 기존 원격 배포 도구는 커밋 HEAD를 읽으며, 자격증명은 기존 canonical reader를 통해 실행할 자식 프로세스에만 제공해야 한다. 관련 없는 예전 migration 합본과 다른 제품 변경은 함께 배포하지 않는다.

## 후속 기능의 검수 범위

23시대 추가: 원문 근거를 확인한 기억을 실제 준비/문구에 쓰는 `care-personalization.mjs`, 일정 없는 `checkin` 문구·준비·복사/저장, pending followup의 명시 KST 달력 내보내기를 추가했다. 모델은 마지막 점검에서 이미 보관한 문구의 같은 기억 인용을 재생성할 때 중복하지 않도록 보완했다(신규 모델16/16). UI는 기억 적용 뒤 펼친 선택부를 접고 실제 초안에 초점을 이동하며 차단 이유가 있으면 근거를 유지한다. 이 부분은 23:19 검수 시작 뒤의 작은 보완이므로 최종 응답 전에 현재 `model.mjs`/`app.mjs`를 다시 확인한다. 앱/엔진/PC 관련208개(중복 방지 추가 전), 새 UI30/30, 계정39/39·기존제품26/26·최초UI29/29, 후보 backend40/40 통과. [새 UI 증거](../../relationship-care/qa/personalization-20261006/result.json), [후보 backend](../../relationship-care/qa/personalization-backend-20261006.txt).

계정 등록은 운세가 먼저 적용되어 현재 기존 등록 운영4개/리허설3개, 신규15개다. 원격 매핑과 확정 운세 원본 SHA가 일치하며 운세 `SYNK_FORTUNE_CLIENT_IDS`도 그대로다. 등록 Opus5.5 검수는 완료했으나 수정 필요이며 별도 담당이 옛 overwrite 명령·현재 포털 보존·중간실패 복구를 보완 중이다. 원격 읽기상 care/personal 테이블·함수는 아직 없다. 실제 운영 쓰기·신규 로그인 성공으로 해석하지 않는다.

22시대 사용자 승인으로 플레저 행동 준비와 후속 기록을 구현했다. 다음 최종 검수에는 `relationship-care/model.mjs`의 `followups`/`preparations`, `care-planner.mjs`/`care-support.mjs`/`care-outcomes.mjs`/`memory-card.mjs`, UI의 명시 확인·계정 이탈 보호, `desktop/src/account-requests.cjs`와 `product-preview.cjs`의 추가 계약도 포함한다. 원본/후보 backend care 번들은 각각 현재 모델로 다시 빌드했다. [현재 모델·후보 SHA](../../../tools/synk-id/qa/engine-upgrade-release-sha-20261006.json), [기능·검증](../../relationship-care/qa/ENGINE-UPGRADE.md)이 확장 전 증거보다 최신이다. Opus 5.5/max 검수 완료로 취급하지 않는다.
