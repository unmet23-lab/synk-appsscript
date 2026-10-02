# 반별 수업 라이브·복습 어댑터

**현재 상태: 로컬 구현과 mock 검증.** 실제 SYNK LAB 채널의 생성·업로드·송출, 학생 재생, OBS 실기기 이벤트, 서버 배포는 아직 실행하지 않았다. 추가 유료 서비스 가입이나 결제가 없다. Node 22 이상, OBS 29 이상과 기존 YouTube OAuth 자격을 사용한다.

장비 선정·스마트폰·착용 마이크·OBS 설정·교사 운영 순서는 [교실 세팅 안내](교실세팅.md)를 따른다. 사용자 확인상 장비는 아직 미정이며 원격 학생은 영상과 소리만 시청하므로 이번 운영에는 화상회의가 필요 없다.

## 동작

1. 수업 전 `prepare`가 해당 반의 방송을 만들고 지정한 교실의 stream ID에 연결한다. 재생목록은 반마다, 스트림은 교실마다 하나씩이다. DVR, 시작부터 녹화, 송출에 따른 자동 시작·종료를 설정한다.
2. 교실 OBS에서 송출과 로컬 녹화를 시작한다. `watch`가 기본 60초 간격으로 상태를 조회하고 앱의 수업 항목을 갱신한다.
3. 송출이 끝나면 같은 YouTube 영상 ID의 아카이브를 복습 영상으로 사용한다. `processed`와 `processingStatus=succeeded`, 기대한 공개설정을 모두 확인해야 `ready`로 보낸다.
4. OBS 녹화 종료 이벤트가 `.ready.json`을 원자적으로 만든다. 방송이 있는 수업은 파일을 백업으로만 보존한다. 녹화만 한 수업은 자동 업로드한다. 녹화 중인 파일을 크기 안정만으로 업로드하지 않는다.
5. 라이브 영상이 명시적으로 실패한 경우에만 운영자가 `seal ... --fallback`을 실행해 백업 파일을 업로드할 수 있다. 같은 수업의 영상 ID를 교체한다. 라이브 아카이브와 로컬 파일을 중복 업로드하지 않는다.

현재 요청은 YouTube 영상·음성 시청으로 충족한다. 추후 학생이 말하고 교사가 듣는 양방향 참여가 필요해지면 앱의 선택적 Meet 등 회의 입구를 사용할 수 있다. 이 어댑터가 영상회의 계정이나 회의 링크를 생성하지 않는다.

## 무료 시청 보호 방식

예제는 각 반의 `videoPrivacy: "private"`를 기본으로 둔다. 영상과 방송은 비공개, 재생목록은 일부공개다. **비공개 영상별로** YouTube Studio에서 수강생 Google 계정을 초대해야 한다. 영상당 최대 50개 이메일, 학생은 초대한 계정으로 로그인해서 본다. 비공개 라이브도 수업 시작 전에 초대해야 한다. 방송이 복습 아카이브가 되면 같은 영상 ID를 유지한다.

YouTube Data API에는 비공개 영상의 시청자 초대 ACL을 자동 관리하는 공식 기능이 없다. 업로드·앱 상태 반영은 자동이며 **초대는 매 영상 수동 단계**다. Studio 초대 완료 후 앱의 관리자 확인 절차로 `private_access_confirmed_at`을 설정해야 학생 재생 버튼이 열린다. worker는 이 확인값을 보내거나 덮어쓰지 않는다. 새 fallback 영상은 새로 초대·확인이 필요하다. 일부공개 목록에 추가하는 것만으로 비공개 영상의 시청 권한이 생기지 않는다.

운영자가 `videoPrivacy: "unlisted"`로 선택하면 초대 단계 없이 링크로 시청한다. 앱은 반별 수강권으로 입구를 제한하지만 YouTube 링크를 전달받은 외부인도 재생할 수 있으므로 수강생 전용 보호라고 표현하면 안 된다. 이 설정은 서버의 반 설정과 반드시 일치시킨다. 반·학생 정보가 드러나는 영상 제목은 사용하지 않는다.

## 최초 연결

- [config.example.json](config.example.json)을 Git 밖에 복사한다. LAB channel ID는 2026-09-27 읽기 전용 확인된 `UCmZplYKuNHLPng4iL2AbLLg`다. `rooms`에는 교실별 `roomId`와 서로 다른 `streamId`, `classes`에는 실제 앱 class UUID와 반별 playlist ID를 넣는다. 예제의 `REPLACE_...` 값은 운영값이 아니다. 각 OBS에 그 교실의 스트림 키를 YouTube Studio에서 직접 설정한다. 코드는 스트림 키를 조회하거나 출력하지 않는다.
- YouTube Studio에서 반별 일부공개 재생목록과 교실별 재사용 스트림을 준비한다. 실제 교실·반이 확정되기 전에는 운영값을 채우지 않는다. 교실 PC별 config에는 담당 교실과 그 교실을 쓰는 반만 넣는다. 같은 세션을 여러 worker가 처리하지 않게 stateDir/inboxDir을 한 작업자가 소유한다. 기존 `classes[].streamId` 형식은 호환을 위해 유지하지만 여러 반이 한 교실을 쓰는 신규 구성은 `rooms`를 사용한다.
- `stateDir`, `inboxDir`, `recordingsRoot`는 Git 밖의 절대 경로다. `stateDir`에는 재개용 업로드 URL이 있어 일반 사용자 접근을 제한한다. Windows에서는 폴더 ACL로 해당 교실 운영자 계정만 접근하도록 설정한다. `mode: 0600`만으로 Windows ACL을 대체할 수 없다. 원본은 자동 삭제하지 않는다.
- 기존 `tools/lib/sns-publisher.js`가 읽는 Windows Credential Manager의 `lab-youtube` OAuth 자격을 사용한다. legacy `.env` 자동 탐색은 끈다. 기존 자격이 없는 교실 PC는 운영 계정 연결이 필요하다. 라이브 관리에는 `youtube`/`youtube.force-ssl` 범위, 업로드에는 `youtube.upload` 등 관련 범위가 필요하다. `verify`가 채널 ID까지 확인한다.
- 환경변수 `SYNK_SUPABASE_ANON_KEY`에는 공개 anon/publishable key, 반마다 `SYNK_CLASSROOM_1_KEY` 등에는 32자 이상의 전용 비밀을 넣는다. 서버의 `CLASSROOM_SYNC_KEYS`와 대응시킨다. **service_role 키를 교실 PC에 넣지 않는다.** 비밀값을 명령행·예제·로그에 쓰지 않는다.
- 서버 마이그레이션·함수, 반 설정, 수강권 설정이 먼저 배포되어 있어야 한다. 이 문서의 CLI는 서버를 배포하지 않는다.

```powershell
node tools/classroom-media/cli.js verify C:/SYNK-Classroom/config.json
node tools/classroom-media/cli.js prepare C:/SYNK-Classroom/config.json C:/SYNK-Classroom/lesson.json
```

`lesson.json`은 [session.example.json](session.example.json) 형식이다. `roomId`는 촬영 교실, `classId`는 영상을 받을 반이다. `sessionKey`는 반 안에서 수업마다 고유하며 재시도 중에는 바꾸지 않는다. 제목은 YouTube 제한에 맞춰 100자 이내다. 시간은 시간대가 포함된 ISO 8601을 쓴다. `prepare`는 같은 세션을 다시 실행해도 영상 하나를 재사용한다. 같은 교실에 아직 예정/진행 중인 수업이 있거나 OBS 녹화가 점유 중이면 다른 반이어도 다음 방송 생성을 막는다. 이전 방송과 로컬 녹화가 종료되고 아카이브만 처리 중이면 다음 수업을 준비할 수 있다.

## OBS 녹화 완료 연결

OBS → 도구 → 스크립트에서 [obs-completed.lua](obs-completed.lua)를 추가한다. `prepare` 출력의 `activeSessionFile`과 `inboxDir`을 스크립트 설정에 넣는다. 녹화만 할 수업은 `prepare` 대신 아래 `arm`을 쓴다.

`rooms` 구성의 active 경로는 `active-room-<roomId>.json`이다. OBS에서 한 번 설정하면 다음 교시에 반이 바뀌어도 경로·스트림 키를 교체하지 않는다. 스마트폰 기본 카메라 앱에서 따로 녹화한 파일은 이 OBS 종료 이벤트 경로로 자동 업로드되지 않는다.

`roomId`는 소문자 영문·숫자·밑줄·하이픈만 사용한다. 예제 `room-1`의 경로는 `active-room-room-1.json`이다. Windows에서 대소문자만 다른 교실이 같은 파일을 점유하는 설정을 허용하지 않는다.

```powershell
node tools/classroom-media/cli.js arm C:/SYNK-Classroom/config.json C:/SYNK-Classroom/lesson.json
node tools/classroom-media/cli.js watch C:/SYNK-Classroom/config.json
```

OBS 녹화 시작 때 지정된 수업 파일을 `.in-use`로 점유한다. 따라서 녹화 중 다른 수업으로 지정해도 기존 녹화에 새 반 정보가 섞이지 않는다. 녹화가 완전히 끝난 이벤트에서 마지막 녹화 경로와 종료시각으로 완료 manifest를 만든다. 녹화 시작/종료가 자동 시간표로 제어되는 장비라면 그 장비의 시작 전에 수업 `prepare`/`arm`을 호출해야 한다. 현재 실제 장비와 시간표 연동은 미확정이다.

**OBS 자동 remux와 자동 파일 분할은 끈다.** 이 스크립트는 수업당 하나의 완성된 파일을 처리한다. 중간 분할파일이나 remux 중인 파일은 이 경로로 처리하지 않는다. MKV 등 OBS가 직접 닫는 녹화 파일을 보존한다. OBS가 비정상 종료되어 `RECORDING_STOPPED`가 없으면 자동 업로드하지 않는다. 파일을 복구하고 재생 확인한 뒤 운영자가 `seal`을 사용한다. 해당 `.in-use` 파일도 녹화가 끝났는지 확인한 뒤 보관·정리하고 다음 수업을 arm한다.

```powershell
# 녹화 프로그램이 파일을 닫은 것을 확인한 뒤에만 실행
node tools/classroom-media/cli.js seal C:/SYNK-Classroom/config.json C:/SYNK-Classroom/lesson.json D:/SYNK-Classroom/recordings/lesson.mkv
# 실패한 라이브의 백업 파일을 명시적으로 대체 업로드
node tools/classroom-media/cli.js seal C:/SYNK-Classroom/config.json C:/SYNK-Classroom/lesson.json D:/SYNK-Classroom/recordings/lesson.mkv --fallback
```

`watch`를 상시 운영 계정의 기존 작업 스케줄러/서비스로 실행한다. 중복 watch는 stateDir 잠금으로 차단한다. 앱의 live 표시는 최근 heartbeat가 있어야 유지되므로 PC 종료나 네트워크 장애가 오래 지속되면 재생 입구가 사라질 수 있다. 테스트 때 `once`로 한 번만 처리할 수 있다. 업로드는 8 MiB 단위로 최대 두 건씩 진행하며 다음 청크는 1초 뒤 계속 보낸다. 업로드 중에도 영상·방송 상태 조회와 앱 heartbeat는 각 작업의 기본 60초 주기를 유지한다. 전송이 끝난 새 영상은 즉시 처리 상태를 한 번 확인한다. 오류는 저장된 재시도 시각을 따르며 최대 5분 지수 backoff로 재시도한다.

YouTube quota를 줄이기 위해 같은 worker의 영상·방송 조회를 각 50개 ID까지 묶으며 채널 신원과 반의 목록·교실 스트림 검증은 10분간 캐시한다. 영상의 공개설정은 매 조회마다 확인한다. 네 교실이 별도 worker를 쓸 경우 조회를 묶을 수 없으므로 기본 60초 간격을 유지한다. 중앙 worker는 조회를 줄일 수 있지만 각 PC의 로컬 녹화 경로를 그대로 읽을 수 없다. 공유 경로 또는 완료 파일 전달·경로 변환이 검증되기 전에는 교실별 worker로 운영한다. 실제 할당량은 해당 Google Cloud 프로젝트에서 확인해야 하며 방송 생성·목록 추가·업로드 호출도 할당량을 사용한다. `verify`는 캐시와 관계없이 다시 검사한다.

## 장애 복구와 검증

```powershell
node tools/classroom-media/cli.js status C:/SYNK-Classroom/config.json
node tools/classroom-media/cli.js once C:/SYNK-Classroom/config.json
node --test tests/classroom-media.test.js
```

- 네트워크가 끊긴 업로드는 저장된 resumable URL의 서버 offset을 조회한 뒤 이어 올린다. 원본 SHA-256이 달라지면 중단한다. 최초 확인과 재시작 때 전체 파일을 해시하며 같은 프로세스에서는 크기/수정시각을 다시 검사한다.
- 방송 생성 또는 업로드 세션 생성 직후 응답을 잃으면 `*_CREATE_AMBIGUOUS_MANUAL_RECOVERY`로 멈춘다. Studio에서 생성된 영상이 있으면 아래 `recover`로 실제 ID를 연결한다. 방송의 채널·공개설정·stream 대응을 확인한 뒤 복구한다.
- 재개 URL이 만료되면 새 영상을 자동 생성하지 않는다. Studio에서 영상이 **생성되지 않았음을 확인한 운영자만** `retry-create ... --confirmed-no-video`를 실행한다. 라이브는 그 뒤 `prepare`, 녹화 업로드는 `once/watch`로 재개한다. 기존 영상이 있는데 초기화하면 중복이 생기므로 먼저 `recover`를 사용한다.
- 재생목록 삽입 응답을 잃으면 `playlistItems.list`로 기존 항목을 찾는다. 계속 없으면 추가를 반복하지 않고 수동 점검을 요구한다. Studio에서 해당 영상이 그 목록에 있는지 확인·추가하면 다음 조회 때 자동 복구한다.
- 비정상 종료 후 `worker.lock`이 남으면 기록된 PID가 실제로 종료됐는지 확인한 뒤 잠금파일만 제거한다. state JSON을 지우면 중복 방지 정보가 사라진다.

```powershell
node tools/classroom-media/cli.js recover C:/SYNK-Classroom/config.json C:/SYNK-Classroom/lesson.json VIDEO_ID_11
node tools/classroom-media/cli.js retry-create C:/SYNK-Classroom/config.json C:/SYNK-Classroom/lesson.json --confirmed-no-video
```

최종 운영 확인은 네 반 각각의 서로 다른 화면·음성이 올바른 앱 수업에 도착하는지, 방송 중 DVR 시청, 종료 후 동일 영상 복습, 비공개 초대 계정 재생, 미초대 계정 차단, 업로드 중 네트워크 복구까지 실제 학생 계정으로 한다. mock 통과는 이 운영 검증을 대신하지 않는다.

방송 중단으로 일부만 아카이브되었어도 YouTube는 처리 성공을 반환할 수 있다. 현재 `ready`는 영상 처리 성공이며 수업 전체 길이 검증을 뜻하지 않는다. 장애 수업의 완전성 확인과 이미 `ready`인 짧은 아카이브의 완본 대체는 자동화되어 있지 않다. 로컬 백업을 보존하고 운영자가 검토한다. 교시 시간표 실행·OBS 시작/종료 제어도 현재 CLI의 기능은 아니다.

## 서버 계약과 근거

`POST /functions/v1/classroom-sync`: `apikey`는 공개키, `x-classroom-key`는 반별 비밀. body는 `class_id`, `session_key`, `title`, `starts_at`, `ends_at`, `status`, `youtube_video_id`, `youtube_playlist_id`, `youtube_channel_id`, `youtube_privacy_status`, `source`다. status는 `scheduled/live/processing/ready/failed`, source는 `live/upload`다. 서버는 활성 반·채널·목록·공개설정을 다시 대조하고 `(class_id, session_key)`로 upsert한다. 실패한 live→upload일 때만 영상 ID 변경을 허용한다.

- [YouTube 방송 옵션](https://developers.google.com/youtube/v3/live/docs/liveBroadcasts): DVR, 시작부터 녹화, 자동 시작·종료.
- [YouTube resumable upload](https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol): 서버 offset 조회, 308 재개, 만료 처리.
- [OBS Frontend API](https://docs.obsproject.com/reference-frontend-api): 녹화 종료 이벤트와 마지막 녹화 경로.
- [YouTube 동시 라이브](https://support.google.com/youtube/answer/2474026): 채널의 활성 스트림 수와 스트림 키 구분.
- [YouTube 라이브 아카이브](https://support.google.com/youtube/answer/6247592): 12시간 미만 방송의 자동 아카이브와 로컬 백업.
