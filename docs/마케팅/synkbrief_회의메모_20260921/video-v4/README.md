# 회의 메모 → 할 일 표 · v4 전체 무음 검토본

2026-09-22 · 사용자 후속 구성과 “확정 전 소리 제외” 요청을 적용했다. **83초·13장면의 전체 검토 영상**이며 승인·발행 완료본은 아니다.

[실행 중인 미리보기](http://127.0.0.1:5197/video-v4/preview.html?revision=4) · [MP4](synkbrief-meeting-v4.mp4) · [제공 자료](../follow-along/README.md)

2026-09-23 재생 복구: 5197 포트의 미리보기 서버가 종료된 상태였으며 영상 파일은 보존돼 있었다. 기존 `preview-server.cjs`를 숨김 백그라운드 프로세스로 다시 실행했다. HTML 200, 영상 구간 요청 206과 인앱 브라우저의 재생 시간 진행을 확인했다. 영상 내용·소리는 변경하지 않았다. 컴퓨터 재시작 뒤에는 서버를 다시 실행해야 한다.

## 영상에서 따라 하는 순서

| 시간 | 내용 |
|---|---|
| 0–6초 | 회의 메모를 일일이 정리하는 상황과 ChatGPT로 만들 결과 |
| 6–12초 | ChatGPT 주소·새 채팅·실제 입력창 위치 |
| 12–19초 | 제공된 prompt.txt 전체 복사와 붙여넣기 |
| 19–26초 | 마지막 메모 자리만 교체하고 위 요청문 유지 |
| 26–38초 | 네 칸의 역할, 근거 문장과 ‘확인 필요’ 조건의 이유 |
| 38–43초 | 실제 입력창의 보내기 버튼 |
| 43–63초 | 담당자·날짜 대조, 회의 날짜와 작업 기한 구분, 제안 확인 |
| 63–75초 | 빠진 기한 묻기·확인한 표 복사·팀 문서 활용 안내 |
| 75–83초 | 실제 PDF·파일 미리보기와 댓글 synk 엔딩 |

자막과 장면을 [scenes.json](scenes.json), [build.mjs](build.mjs), [captions.srt](captions.srt)에 보존한다. 엔딩은 실제 4쪽 PDF와 파일 3종을 보여준다. 미리보기의 다운로드 버튼에서 PDF와 ZIP을 받을 수 있다. 공개 댓글에 대한 수동 전달 경로·자동 DM은 아직 구축하지 않았다.

## 현재 시연과 확인

- 가상 메모를 현재 ChatGPT에 다시 입력해 실제 표·질문과 표 복사를 확인했다. [연구·시연·자산 기록](research.md), assets/current의 캡처·접근성 텍스트·실제 복사 결과를 보존한다.
- 영상은 실물 캡처의 편집·확대·포인터 표시이며 연속 녹화가 아니다. 흰색 설명 그래픽과 검은 앱 캡처를 구분한다. 다른 문서 앱에 붙여넣어 저장하는 장면은 실제 시연하지 않았다.
- [HyperFrames 검사](verification/hyperframes-check.json): 오류 없음, 레이아웃 경고 0, 검사한 텍스트 대비 44/44 통과. 단일 파일 장면 구성·중복 이미지 탐색 관련 구조 권고 16건은 남아 있다. 자동 검사만으로 초보자 이해도나 최종 미감을 확정하지 않는다.
- 13장면의 중간 화면을 직접 검사했다. 첫 검사에서 요청문 장면의 자막이 하단에 가까워 자막 영역을 위로 조정하고 최종 렌더의 입력·엔딩 프레임을 다시 확인했다.
- [MP4 규격](verification/ffprobe.json): 1080×1920, H.264, 30fps, 83초. 전체 디코딩 오류 없음. **오디오 스트림이 없다.** 내레이션·BGM·효과음 모두 사용자 요청에 따라 제외했다.
- [플레이어 확인](verification/player-qa.json): 데스크톱 1440×1050 및 모바일 크기 390×844에서 재생·일시정지·장면 이동과 가로 넘침을 확인했다. 두 자료 다운로드 모두 정상 응답·파일 존재 확인. 실제 휴대폰 기기 테스트는 아니다.
- Impeccable의 dark-glow 1건은 실제 검은 캡처의 아래쪽 그림자에 대한 것으로 시각 확인 후 장식용 광채로 판단하지 않았다. [검사 원본](verification/impeccable.json).

## 재현

이 폴더에서 npm 의존성을 복원한 뒤 실행한다. v3의 의존성과 기존 영상은 보존했다.

```powershell
npm.cmd ci --ignore-scripts
node build.mjs
node build-preview.mjs
$env:HYPERFRAMES_NO_TELEMETRY = '1'
npm.cmd run hf -- check --json --snapshots
npm.cmd run hf -- render --quality delivery --fps 30 --workers 2 --output synkbrief-meeting-v4.mp4
ffmpeg -i synkbrief-meeting-v4.mp4 -vf scale=720:1280 -an -c:v libvpx-vp9 -crf 28 -b:v 0 -cpu-used 5 -row-mt 1 preview.webm
```

HyperFrames는 v3의 0.8.58에서 이번 폴더의 0.8.60으로 갱신해 렌더를 확인했다. GSAP와 승인 폰트는 로컬 파일이다. 공식 스킬 업데이트가 사용자 범위 스킬도 갱신한 사실은 research.md에 기록했다. 미리보기는 상위 preview-server.cjs를 Node로 실행한다. 기존 서버가 5197 포트에 있으면 중복 실행하지 않는다.
