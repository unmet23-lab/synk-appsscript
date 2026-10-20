# 반별 수업 라이브·복습 어댑터

**현재 상태: 2026-10-09 리허설·운영 DB 및 수업 API 반영 완료, 교실 프로그램은 로컬 검증 단계.** 실제 SYNK LAB 채널의 생성·업로드·송출, 학생 재생, OBS 실기기 이벤트는 아직 실행하지 않았다. 서버의 반 영상 설정·이용권·전용 sync 비밀도 아직 없으며, 학생 앱과 교실 프로그램 설치가 남았다. [배포·검증 기록](../../docs/_ops/qa/classroom-release-20261009/README.md)에 완료 범위를 구분했다. 추가 유료 서비스 가입이나 결제가 없다. Node 22 이상, OBS 29 이상과 기존 YouTube OAuth 자격을 사용한다. 이전 버전의 시험 통과를 새 버전의 운영 검증으로 사용하지 않는다.

장비 선정·스마트폰·착용 마이크·OBS 설정·교사 운영 순서는 [교실 세팅 안내](교실세팅.md)를 따른다. 사용자 확인상 장비는 아직 미정이며 원격 학생은 영상과 소리만 시청하므로 이번 운영에는 화상회의가 필요 없다.

## 동작

1. 수업 전 `check`로 로컬 설정을 확인하고 `prepare`로 해당 반의 방송을 지정 교실의 stream ID에 연결한다. `prepare`와 녹화 전용 `arm`도 실행 직전에 로컬 사전검사를 한다. 재생목록은 반마다, 재사용 스트림은 교실마다 하나씩이다. DVR, 시작부터 녹화, 송출에 따른 자동 시작·종료를 설정한다.
2. 교실 OBS에서 송출과 로컬 녹화를 시작한다. `watch`가 기본 60초 간격으로 상태를 조회하고 앱의 수업 항목을 갱신한다.
3. 송출이 끝나면 같은 YouTube 영상 ID의 아카이브를 복습 영상으로 사용한다. `processed`와 `processingStatus=succeeded`, 기대한 공개설정을 모두 확인해야 `ready`로 보낸다.
4. OBS 녹화 종료 이벤트가 `.ready.json`을 원자적으로 만든다. 방송이 있는 수업은 파일을 백업으로만 보존한다. 녹화만 한 수업은 자동 업로드한다. 녹화 중인 파일을 크기 안정만으로 업로드하지 않는다.
5. 라이브 영상이 명시적으로 실패한 경우 `seal ... --fallback`으로 백업을 올릴 수 있다. 종료된 아카이브가 짧게 잘렸으면 운영자가 전체 파일을 검토한 뒤 `replace-replay ... --confirmed-complete`로 완본을 지정한다. 두 경로 모두 같은 수업의 영상 ID를 교체하며, 정상 아카이브의 로컬 백업을 자동으로 중복 업로드하지 않는다.

현재 요청은 YouTube 영상·음성 시청으로 충족한다. 추후 학생이 말하고 교사가 듣는 양방향 참여가 필요해지면 앱의 선택적 Meet 등 회의 입구를 사용할 수 있다. 이 어댑터가 영상회의 계정이나 회의 링크를 생성하지 않는다.

## 무료 시청 보호 방식

예제는 각 반의 `videoPrivacy: "private"`를 기본으로 둔다. 영상과 방송은 비공개, 재생목록은 일부공개다. **비공개 영상별로** YouTube Studio에서 수강생 Google 계정을 초대해야 한다. 영상당 최대 50개 이메일, 학생은 초대한 계정으로 로그인해서 본다. 비공개 라이브도 수업 시작 전에 초대해야 한다. 방송이 복습 아카이브가 되면 같은 영상 ID를 유지한다.

YouTube Data API에는 비공개 영상의 시청자 초대 ACL을 자동 관리하는 공식 기능이 없다. 업로드·앱 상태 반영은 자동이며 **초대는 매 영상 수동 단계**다. Studio 초대 완료 후 관리자가 [앱 운영 문서의 반과 이용권 설정](../../../SYNK-talk/docs/수업영상_운영.md#반과-이용권-설정)에 있는 SQL 절차로 해당 영상 ID의 `private_access_confirmed_at`을 설정해야 학생 재생 버튼이 열린다. 이 확인을 누르는 관리자 앱 화면은 아직 없다. worker는 이 확인값을 보내거나 덮어쓰지 않는다. fallback·완본 교체·이어송출로 새 영상 ID가 생기면 모두 새로 초대·확인해야 한다. 같은 수업의 영상 ID가 교체될 때 서버는 이전 초대 확인을 초기화한다. 일부공개 목록에 추가하는 것만으로 비공개 영상의 시청 권한이 생기지 않는다.

운영자가 `videoPrivacy: "unlisted"`로 선택하면 초대 단계 없이 링크로 시청한다. 앱은 반별 수강권으로 입구를 제한하지만 YouTube 링크를 전달받은 외부인도 재생할 수 있으므로 수강생 전용 보호라고 표현하면 안 된다. 이 설정은 서버의 반 설정과 반드시 일치시킨다. 반·학생 정보가 드러나는 영상 제목은 사용하지 않는다.

**TOPIK 4급 온라인 반은 일부공개로 한다**(10-20 유호님 결정, [결정 표](../../docs/_ops/결정.md)).
- 원격 학생만 있는 반이라 화면에는 선생님과 자료만 나온다. 일부공개면 수업마다 하던 Studio 초대와 확인 SQL이 없어진다.
- 설정은 [config.online.example.json](config.online.example.json)을 쓴다. 교실 하나(`online`), 반 하나, `videoPrivacy: "unlisted"`다. 서버의 반 설정 SQL([앱 운영 문서](../../../SYNK-talk/docs/수업영상_운영.md#반과-이용권-설정))도 `video_privacy`를 그 예제의 `'private'` 대신 `'unlisted'`로 넣는다.
- 기수가 끝나면 아래 「기수 마치기」로 그 반 영상과 재생목록을 비공개로 돌린다.
- 오프라인 교실처럼 학생 얼굴이 나오는 반은 비공개를 유지한다.

<a id="close-cohort"></a>
## 기수 마치기 — 일부공개 반을 비공개로 닫기

`close-cohort`는 한 기수가 끝난 반의 영상을 비공개로 돌리고, worker가 그 반을 더 건드리지 않게 닫는다.

```powershell
# 1) 미리 보기: 바뀔 영상(제목과 함께)과 재생목록만 보여 주고 아무것도 바꾸지 않는다
node tools/classroom-media/cli.js close-cohort CONFIG CLASS_ID --human
# 2) 실행: 미리 보기를 확인한 뒤에만
node tools/classroom-media/cli.js close-cohort CONFIG CLASS_ID --confirmed-cohort-ended --human
```

- **순서:** 마지막 수업의 복습 영상이 `ready`가 되고, 서버의 그 반 이용권이 끝난 뒤(`ends_at`이 지났거나 `revoked_at`) 실행한다. 이용권이 남아 있으면 학생 앱·WORLD에 링크는 보이는데 영상은 열리지 않는다.
- **실행할 때:** 명령은 worker와 같은 잠금을 쓴다. `watch`가 돌고 있으면 잠깐 멈추거나, 잠금 오류가 나면 조금 뒤 다시 실행한다. 할당량은 바꿀 영상 V편에 약 50×V + 55유닛이다(8주 기수 8~16편이면 하루 한도 10,000 가운데 455~855).
- **거절하는 때:**
  - 그 반에 끝나지 않은 수업이 있다(예정·방송 중·처리 중, 동기화 일시정지). → `CLASS_HAS_UNFINISHED_SESSIONS`. 단, 예정 시각에서 12시간이 지났는데 열리지 않은(녹화도 없는) 라이브 수업은 「열리지 않은 수업」으로 보여 주고, 실행하면 작업 기록에 실패로 남긴다(서버로는 보내지 않는다). 실제로 열었던 수업이면 먼저 `once`로 상태를 맞춘다. 그 수업의 예정 방송이 비공개로 바뀌지 않았다고 나오면 Studio에서 그 예정 방송을 지운다.
  - 아직 읽지 않은 녹화 완료 파일이 있다. → `CLASS_HAS_PENDING_RECORDING`. 버릴 파일이면 담당자가 확인한 뒤 inbox 밖 보관 폴더로 옮긴다.
  - OBS가 그 반으로 녹화 중이다. → `OBS_RECORDING_IN_PROGRESS`
  - 아직 끝나지 않은 수업이 그 반으로 준비(arm)돼 있다. → `CLASS_ARMED`. 녹화하지 않을 수업이면 담당자가 그 `active-*.json`을 보관 폴더로 옮긴다. 이미 끝난 수업의 준비 파일(방송만 하고 녹화하지 않은 날)은 실행할 때 `….closed.<시각>.json`으로 이름을 바꿔 OBS가 닫힌 반에 새 녹화를 붙이지 못하게 한다. OBS가 정상 완료 뒤 남기는 `….in-use.completed.<시각>.json`은 기록일 뿐이라 막지 않는다.
- **바꾸는 것:**
  - 대상은 worker가 기록한 그 반의 영상(완본으로 교체된 라이브 포함)과 반 재생목록에 든 영상(Studio에서 직접 넣은 것 포함)이다. 이 가운데 반의 공개설정과 같은 영상(온라인 반이면 일부공개)을 `private`로 바꾼다.
  - 이미 비공개라도 예약 공개 시각(`publishAt`)이 걸린 영상은 그 예약을 푼다. 남겨 두면 그 시각에 공개된다.
  - 다른 공개설정 칸(라이선스·퍼가기 허용·아동용 표시 등)은 그대로 둔다.
  - 반 재생목록도 제목·설명을 그대로 둔 채 비공개로 돌린다.
- **건드리지 않는 것:**
  - 다른 채널의 영상, 다른 반 수업이 쓰는 영상, 이미 비공개(예약 없음)인 영상은 바꾸지 않는다.
  - 재생목록에 참고 자료로 넣은 **공개 영상**도 바꾸지 않는다. 미리 보기에 「공개 영상 · 그대로」로 보이니, 필요하면 Studio에서 사람이 판단한다.
  - 서버 DB와 이용권은 바꾸지 않는다. 영상을 지우지도 않는다.
- **닫힌 반:**
  - 작업 기록 폴더에 `class-closed-<CLASS_ID>.json`이 생기고, 그 반 작업에 닫은 시각이 적힌다.
  - 그 반은 `once/watch`의 조회·동기화, `verify`에서 빠진다. `prepare/arm/seal`·`recover`·`retry-*`는 `CLASS_CLOSED`로 거절한다. inbox에 남은 그 반의 녹화 완료 파일은 읽지 않고 건너뛴다.
  - 실행 중 끊겨도 표시는 먼저 남는다. `status --human`에 「닫는 중 · 남은 문제 N개」로 보이고, 같은 명령을 다시 실행하면 남은 것만 바꾼다.
  - 끝났다고 보는 기준은 바꾼 뒤 YouTube를 다시 읽어 `private`이고 예약이 없는 것이다. 아니면 `VIDEO_STILL_NOT_PRIVATE`·`VIDEO_STILL_SCHEDULED`·`PLAYLIST_STILL_NOT_PRIVATE`를 남기고 종료 코드 1로 끝난다.
- **새 기수:** 새 반 ID, 새 일부공개 재생목록, 새 이용권으로 시작한다. 닫힌 반을 다시 여는 명령은 두지 않았다. 다시 열어야 하면 담당자가 Studio와 작업 기록을 직접 확인한다.

## 최초 연결

- [config.example.json](config.example.json)을 Git 밖에 복사한다. LAB channel ID는 2026-09-27 읽기 전용 확인된 `UCmZplYKuNHLPng4iL2AbLLg`다. `rooms`에는 교실별 `roomId`와 서로 다른 `streamId`, `classes`에는 실제 앱 class UUID와 반별 playlist ID를 넣는다. 예제의 `REPLACE_...` 값은 운영값이 아니다. 각 OBS에 그 교실의 스트림 키를 YouTube Studio에서 직접 설정한다. 코드는 스트림 키를 조회하거나 출력하지 않는다.
- YouTube Studio에서 반별 일부공개 재생목록과 교실별 재사용 스트림을 준비한다. 실제 교실·반이 확정되기 전에는 운영값을 채우지 않는다. 교실 PC별 config에는 담당 교실과 그 교실을 쓰는 반만 넣는다. 같은 세션을 여러 worker가 처리하지 않게 stateDir/inboxDir을 한 작업자가 소유한다. 기존 `classes[].streamId` 형식은 호환을 위해 유지하지만 여러 반이 한 교실을 쓰는 신규 구성은 `rooms`를 사용한다.
- `stateDir`, `inboxDir`, `recordingsRoot`는 Git 밖의 절대 경로다. 운영자가 먼저 세 폴더를 만들고 읽기·쓰기 권한을 준비한다. `check`는 폴더를 생성하거나 시험 파일을 쓰지 않는다. `stateDir`에는 재개용 업로드 URL이 있어 일반 사용자 접근을 제한한다. Windows에서는 폴더 ACL로 해당 교실 운영자 계정만 접근하도록 설정한다. `mode: 0600`만으로 Windows ACL을 대체할 수 없다. 원본은 자동 삭제하지 않는다.
- 기존 `tools/lib/sns-publisher.js`가 읽는 Windows Credential Manager의 `lab-youtube` OAuth 자격을 사용한다. legacy `.env` 자동 탐색은 끈다. 기존 자격이 없는 교실 PC는 운영 계정 연결이 필요하다. 라이브 관리에는 `youtube`/`youtube.force-ssl` 범위, 업로드에는 `youtube.upload` 등 관련 범위가 필요하다. `verify`가 채널 ID까지 확인한다.
- 환경변수 `SYNK_SUPABASE_ANON_KEY`에는 공개 anon/publishable key, 반마다 `SYNK_CLASSROOM_1_KEY` 등에는 32자 이상의 전용 비밀을 넣는다. 서버의 `CLASSROOM_SYNC_KEYS`와 대응시킨다. **service_role 키를 교실 PC에 넣지 않는다.** 비밀값을 명령행·예제·로그에 쓰지 않는다.
- 서버 마이그레이션·함수, 반 설정, 수강권 설정이 먼저 배포되어 있어야 한다. 이 문서의 CLI는 서버를 배포하지 않는다.

```powershell
node tools/classroom-media/cli.js check C:/SYNK-Classroom/config.json
node tools/classroom-media/cli.js verify C:/SYNK-Classroom/config.json
node tools/classroom-media/cli.js prepare C:/SYNK-Classroom/config.json C:/SYNK-Classroom/lesson.json
```

`lesson.json`은 [session.example.json](session.example.json) 형식이다. `roomId`는 촬영 교실, `classId`는 영상을 받을 반이다. `sessionKey`는 반 안에서 수업마다 고유하며 같은 준비 작업을 재시도할 때는 바꾸지 않는다. 제목은 YouTube 제한에 맞춰 100자 이내다. 시간은 시간대가 포함된 ISO 8601을 쓴다. 아직 종료되지 않은 세션의 `prepare` 재시도는 기존 영상을 재사용하지만, 종료된 방송은 `BROADCAST_ALREADY_ENDED`로 거절한다. 같은 교실에 아직 예정/진행 중인 수업이 있거나 OBS 녹화가 점유 중이면 다른 반이어도 다음 방송 생성을 막는다. 이전 방송과 로컬 녹화가 종료되고 아카이브만 처리 중이면 새 `sessionKey`로 다음 수업을 준비한다.

## 수업 전 자동 사전검사

운영자가 읽을 때는 `node tools/classroom-media/cli.js check CONFIG --human`을 사용한다. 항목별 한국어 조치 안내와 설정된 최소 여유 공간을 보여준다. `--human` 없이 실행하는 기존 JSON 출력은 유지한다.

`check CONFIG`는 네트워크나 파일 쓰기 없이 `YOUR_PROJECT`·`REPLACE_...` 자리표시자, 공개키·반별 동기화 키, 세 폴더의 존재·디렉터리 여부·읽기/쓰기 접근, 녹화 디스크의 사용 가능한 여유 공간을 검사한다. 설정 구조가 유효하더라도 실제 값과 폴더가 준비되지 않으면 통과하지 않는다. 출력에는 비밀값과 스트림 키를 넣지 않는다.

기본 여유 공간은 **20GiB의 잠정 안전선**이다. config의 `minimumFreeBytes`에 양의 정수 바이트 값을 지정할 수 있으며 수업 길이·실측 녹화 용량·보존 기간에 맞춰 운영자가 정한다. 20GiB는 하루 전체 녹화·백업 용량을 보장하지 않는다. `ok: true`와 `scope: "local-automatic-only"`는 이 자동 검사만 통과했다는 뜻이다. 실제 쓰기 지속성·Windows ACL·OBS 연결·카메라·마이크·완성 녹화 재생·비공개 학생 초대는 별도 확인한다. `manualChecksRequired`에도 장비·재생 확인이 남는다.

`verify`는 별도의 YouTube 읽기 전용 검사다. 채널·반 목록과 교실 스트림 소유권, 재사용 가능 여부, 상태·health를 확인한다. 교실 스트림은 `isReusable=true`여야 하며 명시적인 오류가 있으면 준비를 중단한다. 송출 전의 입력 없는 상태를 실제 송출 성공으로 보지 않는다. 방송 중에는 매 상태 조회에서 현재 스트림 입력이 `active`이고 health가 `good` 또는 `ok`인지 확인한다. 이 값도 검은 화면·마이크 음소거·판서 가독성을 직접 판정하지 못한다.

## OBS 녹화 완료 연결

OBS → 도구 → 스크립트에서 [obs-completed.lua](obs-completed.lua)를 추가한다. `prepare` 출력의 `activeSessionFile`과 `inboxDir`을 스크립트 설정에 넣는다. 녹화만 할 수업은 `prepare` 대신 아래 `arm`을 쓴다.

`rooms` 구성의 active 경로는 `active-room-<roomId>.json`이다. OBS에서 한 번 설정하면 다음 교시에 반이 바뀌어도 경로·스트림 키를 교체하지 않는다. 스마트폰 기본 카메라 앱에서 따로 녹화한 파일은 이 OBS 종료 이벤트 경로로 자동 업로드되지 않는다.

`roomId`는 소문자 영문·숫자·밑줄·하이픈만 사용한다. 예제 `room-1`의 경로는 `active-room-room-1.json`이다. Windows에서 대소문자만 다른 교실이 같은 파일을 점유하는 설정을 허용하지 않는다.

```powershell
node tools/classroom-media/cli.js arm C:/SYNK-Classroom/config.json C:/SYNK-Classroom/lesson.json
node tools/classroom-media/cli.js watch C:/SYNK-Classroom/config.json
```

OBS 녹화 시작 때 지정된 수업 파일을 `.in-use`로 점유한다. 따라서 녹화 중 다른 수업으로 지정해도 기존 녹화에 새 반 정보가 섞이지 않는다. 완료 manifest에는 OBS의 실제 녹화 시작·종료 이벤트 시각과 마지막 녹화 경로를 기록한다. 예정 시각보다 일찍 끝나도 실제 구간을 사용하며, 잘못된 시각을 예정값으로 대신 채우지 않는다. 녹화 시작/종료가 자동 시간표로 제어되는 장비라면 그 장비의 시작 전에 수업 `prepare`/`arm`을 호출해야 한다. 현재 실제 장비와 시간표 연동은 미확정이다.

**OBS 자동 remux와 자동 파일 분할은 끈다.** 이 스크립트는 수업당 하나의 완성된 파일을 처리한다. 중간 분할파일이나 remux 중인 파일은 이 경로로 처리하지 않는다. MKV 등 OBS가 직접 닫는 녹화 파일을 보존한다. OBS가 비정상 종료되어 `RECORDING_STOPPED`가 없으면 자동 업로드하지 않는다. 파일을 복구하고 재생 확인한 뒤 운영자가 `seal`을 사용한다. 해당 `.in-use` 파일도 녹화가 끝났는지 확인한 뒤 보관·정리하고 다음 수업을 arm한다.

완료 폴더 쓰기·닫기·rename 또는 완료 경로 확인이 실패하면 첫 종료 이벤트만 소비하고 이전 수업을 점유한 상태로 남긴다. 이후 녹화 파일을 이전 반에 연결하지 않는다. 운영자는 **OBS 녹화 종료와 원본 확인 → 올바른 수업·파일로 수동 `seal` → 해당 `.in-use` 확인·보관 → OBS 스크립트 재로드 → 다음 수업 `prepare/arm`** 순서로 복구한다. 다음 녹화를 누르거나 폴더 권한만 고치는 것으로 이전 완료 처리가 재시도되지는 않는다. Lua의 메모리 상태도 재로드로 해제하기 전에는 다음 수업을 시작하지 않는다.

```powershell
# 녹화 프로그램이 파일을 닫은 것을 확인한 뒤에만 실행
node tools/classroom-media/cli.js seal C:/SYNK-Classroom/config.json C:/SYNK-Classroom/lesson.json D:/SYNK-Classroom/recordings/lesson.mkv
# 실패한 라이브의 백업 파일을 명시적으로 대체 업로드
node tools/classroom-media/cli.js seal C:/SYNK-Classroom/config.json C:/SYNK-Classroom/lesson.json D:/SYNK-Classroom/recordings/lesson.mkv --fallback
```

`watch`를 상시 운영 계정의 기존 작업 스케줄러/서비스로 실행한다. 중복 watch는 stateDir 잠금으로 차단한다. 앱의 live 표시는 최근 heartbeat가 있어야 유지되므로 PC 종료나 네트워크 장애가 오래 지속되면 재생 입구가 사라질 수 있다. 테스트 때 `once`로 한 번만 처리할 수 있다. 업로드는 8 MiB 단위로 최대 두 건씩 진행하며 다음 청크는 1초 뒤 계속 보낸다. 업로드 중에도 영상·방송·스트림 상태 조회와 앱 heartbeat는 각 작업의 기본 60초 주기를 유지한다. 전송이 끝난 새 영상은 즉시 처리 상태를 한 번 확인한다. 일시 오류인 개별 작업·공통 인증·메타데이터 조회 실패는 저장된 재시도 시각을 따르며 최대 5분 지수 backoff로 재시도한다. 아래의 동기화 충돌이나 서버가 자동 재시도를 금지한 작업은 `syncPaused`로 보존하고 해당 작업의 외부 요청을 중단한다.

YouTube 조회는 같은 worker의 `videos`·`liveBroadcasts`·`liveStreams`를 각각 최대 50개 ID로 묶는다. 준비가 끝난 네 교실의 라이브를 한 worker가 같은 주기에 조회하면 기본 GET은 3회다. 교실별 worker 네 개면 각 3회, 합계 12회다. 이전의 영상·방송 2종 조회에 현재 스트림 health 조회가 추가된 계산이며, 채널·목록 캐시 갱신과 생성·목록 추가·업로드·오류 재시도는 별도다. 채널 신원과 반 목록 검증은 10분간 캐시하지만 방송 중 health는 그 캐시만으로 판단하지 않는다.

YouTube가 명백한 HTTP 401을 반환한 요청은 인증 캐시를 갱신하고 채널 소유권을 다시 확인한 뒤 한 번만 다시 보낸다. 재인증·채널 확인이 실패하거나 다시 401이면 오류로 남긴다. 네트워크 단절·시간초과·5xx처럼 서버 처리 여부가 불명확한 응답에는 이 인증 재전송을 적용하지 않는다. 기존 생성·업로드 복구 절차와 중복 방지 기록을 그대로 사용한다.

중앙 worker는 조회를 줄일 수 있지만 각 PC의 로컬 녹화 경로를 그대로 읽을 수 없다. 공유 경로 또는 완료 파일 전달·경로 변환이 검증되기 전에는 교실별 worker로 운영하고 기본 60초 간격을 유지한다. 실제 할당량은 해당 Google Cloud 프로젝트에서 확인한다. `verify`는 캐시와 관계없이 다시 검사한다.

## 장애 복구와 검증

2026-10-09 추가 보강: 예정 시각보다 일찍 끝난 시험 방송도 YouTube가 보고한 실제 시작·종료 시각을 함께 사용한다. 실제 구간을 아직 확인할 수 없으면 `BROADCAST_ACTUAL_TIMES_PENDING`으로 재조회하며 임의 시각을 만들지 않는다.

동기화에는 수업별 `sync_sequence`가 필수다. worker는 요청 전에 `syncSequence`를 증가시켜 파일에 저장하고, 서버는 마지막 반영 번호 이하의 요청을 거절한다. 따라서 시간초과된 옛 정상 요청이 뒤늦게 도착해 최신 재생 차단을 풀지 못한다. 응답 유실·프로그램 재시작·완본 교체에도 번호를 이어 쓴다. 상태 파일 유실·이전 백업 복원·중복 교실 설정으로 `STALE_SYNC_SEQUENCE`가 계속되면 작업 기록을 삭제하거나 번호를 임의로 올리지 말고 담당자가 서버와 원본 기록을 대조한다. 비정상 번호와 번호 범위 소진도 외부 요청 전에 멈춘다. 구버전 worker는 새 서버에 연결하지 않는다.

기존 영상이 재생 차단 중이거나 차단 동기화가 실패했다면 fallback·완본 교체를 보류하고 원본 작업과 녹화를 보존한다. 먼저 원영상의 공개설정·연결 문제를 복구하고 서버에도 차단 해제가 반영됐는지 확인한다. 서버가 이미 ready를 저장한 뒤 응답만 잃었더라도 같은 영상의 차단 요청은 진행 상태·동기화 시각을 바꾸지 않고 반영한다. 차단 해제에는 정상 상태 전이 검사를 그대로 적용한다.

자동 복구의 남은 한계: 교체한 업로드 영상 자체가 `failed`이면 다른 영상으로 다시 교체하거나 이전 라이브로 되돌리는 명령은 아직 없다. `failed` 수업을 `scheduled/live`로 되돌리는 상태 전환도 거절하므로 실제 방송이 진행 중이면 입력이 정상이어도 차단 해제가 실패할 수 있다. 종료 후 실제 `processing/ready`로 확인되는 전환은 허용한다. 담당자가 Studio와 서버·로컬 기록을 함께 확인해 복구해야 하며, 파일·작업 기록을 지우거나 source를 바꿔 이 제한을 우회하지 않는다.

### 동기화가 일시정지된 수업

`VIDEO_ALREADY_LINKED`·`SESSION_IDENTITY_CONFLICT`·`STALE_STATE`·`BLOCKED_VIDEO_REPLACEMENT_REQUIRES_RECOVERY`, 또는 서버가 `retryable: false`로 응답한 작업은 자동 반복을 중단한다. worker는 원인 코드·응답 상태·발생 시각을 `syncPaused`에 저장하며, 재시작해도 해당 작업의 조회·동기화·업로드를 재개하지 않는다. 다른 정상 작업은 계속 처리한다. 이 일시정지가 OBS 송출·녹화를 중지하는 것은 아니므로 현장 상태도 직접 확인한다.

1. `status CONFIG --human`으로 일시정지 이유를 확인하고 서버의 반·교실·수업·영상 연결, Studio의 실제 영상 상태, 로컬 작업 기록을 대조한다. 다른 worker의 중복 실행과 다른 수업에 이미 연결된 영상도 확인한다.
2. 담당자가 원인을 해결한 후 아래 `retry-sync`를 실행한다. 이 명령은 로컬 일시정지만 해제하며 서버 기록·영상·수업 키·동기화 순서를 초기화하지 않는다. 작업 JSON을 지우거나 숫자를 임의로 바꾸어 재시도를 강제하지 않는다.
3. `once/watch`의 소유권 재확인과 정상 상태 동기화가 끝났는지 확인한다. 원인이 남아 있으면 다시 일시정지된다. 재생 차단 중인 원영상을 교체하려던 경우에는 원영상의 정상 조회와 **서버 차단 해제 확인 뒤** 교체를 다시 접수한다. 새 영상 초대와 실제 학생 재생 확인은 별도다.

```powershell
node tools/classroom-media/cli.js status C:/SYNK-Classroom/config.json --human
# 담당자가 서버·로컬·Studio의 충돌 원인을 해결했음을 확인한 뒤
node tools/classroom-media/cli.js retry-sync C:/SYNK-Classroom/config.json C:/SYNK-Classroom/lesson.json --confirmed-resolved
node tools/classroom-media/cli.js once C:/SYNK-Classroom/config.json
```

`node tools/classroom-media/cli.js status CONFIG --human`은 저장된 작업을 한국어로 설명한다. 최근 150초 이내의 앱 반영·스트림 확인과 정상 입력이 함께 있어야 ‘최근 확인: 방송 신호 수신 중’이라고 표시하며, 오래된 live 기록은 ‘방송 상태 미확인’으로 표시한다. 서버 차단 반영 실패와 로컬 차단도 구분한다. 일시정지된 작업은 저장 시각·원인·명시적 재개 절차를 표시하며 이전 정상 신호나 자동 재시도 예정으로 안내하지 않는다. 이 명령은 외부 상태를 새로 조회하지 않으므로 실제 방송·학생 재생 완료의 증거가 아니다. 오류별 다음 행동을 안내하지만 복구 명령을 자동 실행하지 않는다.

2026-10-09 화면·운영 안내·DB 검사 후속 보완의 확인 범위는 [후속 검증 기록](../../docs/_ops/qa/classroom-followup-20261009/README.md)에 있다.

```powershell
node tools/classroom-media/cli.js status C:/SYNK-Classroom/config.json
node tools/classroom-media/cli.js once C:/SYNK-Classroom/config.json
node --test tests/classroom-media.test.js tests/classroom-preflight.test.js
```

- 네트워크가 끊긴 업로드는 저장된 resumable URL의 서버 offset을 조회한 뒤 이어 올린다. 원본 SHA-256이 달라지면 중단한다. 최초 확인과 재시작 때 전체 파일을 해시하며 같은 프로세스에서는 크기/수정시각을 다시 검사한다.
- 방송 생성 또는 업로드 세션 생성 직후 응답을 잃으면 `*_CREATE_AMBIGUOUS_MANUAL_RECOVERY`로 멈춘다. Studio에서 생성된 영상이 있으면 아래 `recover`로 실제 ID를 연결한다. 방송의 채널·공개설정·stream 대응을 확인한 뒤 복구한다.
- 재개 URL이 만료되면 새 영상을 자동 생성하지 않는다. Studio에서 영상이 **생성되지 않았음을 확인한 운영자만** `retry-create ... --confirmed-no-video`를 실행한다. 라이브는 그 뒤 `prepare`, 녹화 업로드는 `once/watch`로 재개한다. 기존 영상이 있는데 초기화하면 중복이 생기므로 먼저 `recover`를 사용한다.
- 재생목록 삽입 응답을 잃으면 `playlistItems.list`로 기존 항목을 찾는다. 계속 없으면 추가를 반복하지 않고 수동 점검을 요구한다. Studio에서 해당 영상이 그 목록에 있는지 확인·추가하면 다음 조회 때 자동 복구한다.
- 비정상 종료 후 `worker.lock`이 남으면 기록된 PID가 실제로 종료됐는지 확인한 뒤 잠금파일만 제거한다. state JSON을 지우면 중복 방지 정보가 사라진다.
- 영상 공개설정·교실 매핑·스트림 입력/health 이상은 `playback_blocked=true`로 학생의 재생 입구를 막고 기존 `scheduled/live/processing/ready` 상태는 유지한다. 일시 오류를 종결 상태 `failed`로 바꾸지 않는다. 설정·입력이 정상으로 돌아오면 다음 성공 조회가 차단을 해제한다. 동기화가 일시정지된 작업은 위의 담당자 확인·`retry-sync` 절차가 먼저 필요하다. 서버 연결도 끊겼으면 즉시 차단 반영을 보장할 수 없으므로 운영자가 `status`와 학생 화면을 함께 확인한다.

```powershell
node tools/classroom-media/cli.js recover C:/SYNK-Classroom/config.json C:/SYNK-Classroom/lesson.json VIDEO_ID_11
node tools/classroom-media/cli.js retry-create C:/SYNK-Classroom/config.json C:/SYNK-Classroom/lesson.json --confirmed-no-video
```

최종 운영 확인은 네 반 각각의 서로 다른 화면·음성이 올바른 앱 수업에 도착하는지, 방송 중 DVR 시청, 종료 후 동일 영상 복습, 비공개 초대 계정 재생, 미초대 계정 차단, 업로드 중 네트워크 복구까지 실제 학생 계정으로 한다. mock 통과는 이 운영 검증을 대신하지 않는다.

### 자동 종료된 방송과 완본 복구

방송에는 `enableAutoStop=true`를 설정한다. 회선 단절 등으로 YouTube 방송이 종료된 뒤 같은 세션을 다시 `prepare`해도 기존 방송을 재개하지 않는다. 자동으로 새 방송을 만들거나 학생을 새 방송으로 옮기는 기능은 없다. 운영자는 Studio에서 실제 종료를 확인하고 이전 로컬 녹화도 정상 종료·완료 처리한 뒤, 새 `sessionKey`와 현재 시간으로 이어송출 수업을 준비한다. 새 비공개 영상에 학생을 초대하고 앱 초대 확인 후 새 방송 입구로 안내한다. 기존 영상·로컬 원본은 보존한다.

YouTube의 `ready`는 영상 처리 성공이며 전체 수업 길이 검증을 뜻하지 않는다. 운영자가 로컬 녹화의 처음·중간·끝과 장애 전후 구간을 직접 보고 들어 완본인지 판단한다. 파일도 여러 개로 나뉘었으면 모두 보존하고 누락을 확인한다. 이 도구는 영상 병합이나 누락 구간 복원을 하지 않는다.

종료된 live 수업의 상태가 `processing/ready/failed`이고 완본 파일을 확인했을 때만 아래 명령으로 기존 수업의 복습 영상을 교체한다. 진행 중인 라이브에는 허용하지 않는다. `--confirmed-complete`는 운영자가 실제 파일을 확인했다는 선언이며 자동 완전성 판정이 아니다. 기존 `--fallback`은 계속 `failed` 전용이다.

```powershell
node tools/classroom-media/cli.js replace-replay C:/SYNK-Classroom/config.json C:/SYNK-Classroom/lesson.json D:/SYNK-Classroom/recordings/lesson-full.mkv --confirmed-complete
```

이미 같은 수업의 `.fallback.ready.json`이 대기 중이면 `PENDING_FALLBACK_REQUIRES_REVIEW`로 완본 교체 접수를 거절한다. 두 요청 중 파일 이름순으로 일부 녹화가 먼저 업로드되는 일을 막는다. 운영자가 이전 fallback 요청을 확인하고 완료 폴더 밖에 보관한 뒤 완본 교체를 다시 접수한다. 원본 녹화와 작업 state는 지우지 않는다.

새 영상의 처리·앱 반영 뒤에는 비공개 학생 초대와 앱의 초대 확인을 다시 끝내야 재생할 수 있다. 교체 확인 전까지 원본과 기존 아카이브를 삭제하지 않는다. 교시 시간표 실행·OBS 시작/종료 제어·무인 이어송출은 현재 CLI의 기능이 아니다.

Lua 회귀시험은 `SYNK_LUA_BIN`에 Lua 실행 파일 또는 `fengari-node-cli/src/lua-cli.js`를 지정한 뒤 `node --test tests/classroom-obs.test.js`로 실행한다. 설치된 런타임이 없으면 명시적으로 skip되므로 통과 건수에 포함하지 않는다. 실제 OBS 동작 시험은 이 합성 이벤트 시험과 별도다.

## 서버 계약과 근거

`POST /functions/v1/classroom-sync`: `apikey`는 공개키, `x-classroom-key`는 반별 비밀. body는 `class_id`, `session_key`, `title`, `starts_at`, `ends_at`, `status`, `playback_blocked`, `youtube_video_id`, `youtube_playlist_id`, `youtube_channel_id`, `youtube_privacy_status`, `source`이며 명시적 완본 교체에는 `replace_replay=true`를 사용한다. status는 `scheduled/live/processing/ready/failed`, source는 `live/upload`다. 서버는 활성 반·채널·목록·공개설정을 다시 대조하고 `(class_id, session_key)`로 upsert한다. 실패한 live→upload fallback 또는 종료된 live의 명시적 완본 교체일 때 영상 ID 변경을 허용하며, 새 영상의 초대 확인은 초기화한다. 새 worker·서버 계약·마이그레이션을 함께 검증·배포하기 전에는 운영에 적용하지 않는다.

- [YouTube 방송 옵션](https://developers.google.com/youtube/v3/live/docs/liveBroadcasts): DVR, 시작부터 녹화, 자동 시작·종료.
- [YouTube resumable upload](https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol): 서버 offset 조회, 308 재개, 만료 처리.
- [OBS Frontend API](https://docs.obsproject.com/reference-frontend-api): 녹화 종료 이벤트와 마지막 녹화 경로.
- [YouTube 동시 라이브](https://support.google.com/youtube/answer/2474026): 채널의 활성 스트림 수와 스트림 키 구분.
- [YouTube 라이브 아카이브](https://support.google.com/youtube/answer/6247592): 12시간 미만 방송의 자동 아카이브와 로컬 백업.
