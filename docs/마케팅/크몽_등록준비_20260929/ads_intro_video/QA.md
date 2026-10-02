# 서비스 소개 영상 확인

- 최종 파일: `../서비스소개_AI제품광고.mp4`
- H.264, 1920×1080, 30fps, 20초, 600프레임, 922,690바이트. 무음.
- `npx hyperframes check --at 2,7,12,17 --snapshots`: lint/runtime/layout/motion 오류 0, 경고 0, WCAG AA 59/59 통과.
- 각 장면 스냅샷을 직접 확인했다. 한글 글자, 패키지 10초+1컷 / 15초+3컷 / 30초+5컷, 제작 절차, 상담 준비 자료가 잘리지 않고 표시된다.
- 실제 MP4에서 뽑은 `rendered_contact_sheet.jpg`를 직접 확인했다. 각 장면이 원본 구도와 일치한다.
- 전체 FFmpeg 디코드 검사 오류 없음.
- 렌더: HyperFrames 0.8.91, screenshot capture, hardware GPU, 35.2초.
- 로컬 플레이어: http://127.0.0.1:4342/ (PID `player-server.pid`, 시작 당시 45772)
- Studio: http://localhost:4341/#project/ads_intro_video
- 루트 에이전트 확인: 로컬 브라우저에서 실제 20초 전체 재생 완료(`ended=true`), 재생 오류 없음. 크몽 초안 #830107에 동영상 1/6 첨부 후 임시저장 완료.
- 재생 확인 후 이번 작업의 플레이어(PID 45772, 4342)와 이 프로젝트 Studio(PID 32468, 4341)만 종료했다. 두 포트에서 더 이상 대기하지 않음을 확인했다.

실제 제품 광고 결과물 샘플이 아니라 서비스 구성 안내 영상이다. 가격과 성과 주장은 넣지 않았다. 심사 제출·판매 등록은 하지 않았다.
