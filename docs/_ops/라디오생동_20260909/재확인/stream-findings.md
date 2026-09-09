# 송출 정체 재확인 — 2026-09-09 10:34 UTC

## 결론

실제 송출 장애가 1회 있었다. 현재는 자동 재시작 뒤 약 1시간 정상 송출 중이지만, 앞서 완료 보고 시 확인 범위로 장애를 배제할 수 없었다. 새 노래 파일 자체의 무음·반복 경계 검사는 별도 담당 범위다.

## 직접 확인한 근거

- `radio-live`는 09:24:26 UTC 수동 재시작 후 PID 137314로 시작했다.
- 처음 4분 speed 0.993~0.998x, 09:29:35 0.813x → 09:30:35 0.675x → 09:31:35 0.577x.
- 같은 때 PNG 캡처는 3.7fps에서 5.8~6.0fps로 오히려 빨라졌고, 투입 6fps·버린 영상 0이 유지됐다. 지속적인 CPU 포화만으로 설명할 근거는 약하다.
- 09:32:35 `av_interleaved_write_frame(): Broken pipe`, FFmpeg exit 1; systemd가 5초 후 자동 재시작했다. 새 MainPID 138122, NRestarts 1.
- 10:30:47까지 새 프로세스의 분단위 기록 58개에서 최소 speed 0.993x, 이후 1.0x; 0.98x 미만 0회. 최근 90분 DTS/PTS 역행·timestamp·queue warning 0회.
- YouTube 공식 계정 API `node tools/라디오방송건강.js` 10:29 UTC: 입력 active, health good, 공개 방송 `eI-5vSy5mjY` live.
- 현재 메모리 압력 0, CPU pressure some 약 30%, 송출 TCP 연결 established 및 Send-Q 0. 현재 부하·네트워크 수치로 과거 원인을 확정할 수는 없다.

## 추정과 미확인

첫 프로세스 시작 후 300/360/420초에 speed를 곱하면 243.90/243.00/242.34초로 비슷하다. 이는 방송 시각이 약 244초에서 정체하고 경과시간 분모만 늘어난 무늬에 가깝다. 그러나 당시 out_time 숫자를 일지에 남기지 않았으므로 정지 시각은 추정이다. 마지막 Broken pipe는 연결 종료를 입증하지만, 최초 원인이 상대 수신 중단인지 네트워크인지 FFmpeg 내부 정체인지는 소급 확정할 수 없다. 09:28경 읽기 전용 CDP 89회/22초 조회와 시간상 겹친다는 사실만으로 인과를 단정하지 않는다.

## 작은 수정 후보

1. 기존 FFmpeg 출력 옵션에 `-rw_timeout 15000000` 추가. 네트워크 I/O에 15초 기한을 건다. `-timeout`은 RTMP에서 수신 대기/listen 옵션이므로 쓰지 않는다.
2. 기존 1분 간격·3회 정체 판정을 같은 프로세스 안의 10초 간격·마지막 out_time 상승 후 30초 판정으로 바꾼다. 시작 시 처음 60초는 유예한다. speed 자체가 낮다는 이유로 재시작하지 않는다.
3. progress 표준 오류는 임의 조각으로 전달되므로 줄을 버퍼링하고 완성된 줄만 해석한다. 이는 현재 장애의 확정 원인은 아니지만, watchdog이 값을 안정적으로 읽기 위한 작은 보완이다.
4. 새 서비스·데몬·강제 훅은 필요 없다. 기존 systemd Restart=always, RestartSec=5s를 그대로 사용한다. 복구 시간 단축과 무중단 보장은 다르다.

## 검증한 범위

`stream-timeout-proof.cjs`는 로컬 127.0.0.1 서버가 연결을 받고 읽기를 멈추게 하는 유한 시험이다. FFmpeg 8.1.2 Windows에서 timeout 2초인 TCP 쓰기는 2.266초, RTMP 무응답 handshake는 2.254초에 자체 실패 종료했다. timeout 없는 대조군 둘은 6.5초까지 살아 있어 시험 도구가 종료했다. 서버는 FFmpeg 5.1.9 Linux이므로 같은 서버 바이너리에서의 장애 주입 실증으로 주장하지 않는다. 서버에 수정·재시작·추가 서비스는 하지 않았다.

## 원본과 공식 근거

- 기준 HEAD `b45775e31850e9a1d228571dcbdbaa1fad70cafe`.
- 읽은 원본 `bots/오버레이/겹쳐송출.js`, SHA-256 `3aa9eae43e5ec89c854b502b5909aee466636f597782978ded7f1146cc448ec9`.
- [FFmpeg 프로토콜 문서](https://ffmpeg.org/ffmpeg-protocols.html): rw_timeout 단위는 microseconds, RTMP timeout은 listen 대기.
- [FFmpeg 5.1.9 RTMP 소스](https://raw.githubusercontent.com/FFmpeg/FFmpeg/n5.1.9/libavformat/rtmpproto.c): native RTMP가 내부 TCP에 parent URLContext를 전달.
- [FFmpeg 5.1.9 AVIO 소스](https://raw.githubusercontent.com/FFmpeg/FFmpeg/n5.1.9/libavformat/avio.c): parent 옵션 복사로 rw_timeout 전달.
- [FFmpeg 5.1.9 TCP 소스](https://raw.githubusercontent.com/FFmpeg/FFmpeg/n5.1.9/libavformat/tcp.c): 네트워크 읽기·쓰기 대기에 h->rw_timeout 사용.

기록: `stream-audit.json`, 로컬 장애 주입 결과 `stream-timeout-proof.json`. RTMP 주소 및 채팅 식별자는 수집 전 필터링했다.
