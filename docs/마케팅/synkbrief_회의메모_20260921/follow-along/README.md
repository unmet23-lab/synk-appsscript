# 회의 메모 → 할 일 표 · 따라 하기 키트

2026-09-22 · 실제 제공 파일. 영상과 함께 줄 초보자용 가이드다.

[전체 ZIP 받기](synkbrief-meeting-kit.zip) · [4쪽 가이드 PDF](../output/pdf/synkbrief-meeting-guide.pdf) · [엔딩 시안](ending.png)

## 파일과 사용 순서

1. PDF를 열어 ChatGPT 입력창을 찾는다.
2. [prompt.txt](prompt.txt) 전체를 복사해 입력창에 붙여넣는다.
3. 마지막 메모 자리만 [practice-memo.txt](practice-memo.txt)로 바꿔 연습한다.
4. 요청문과 메모를 함께 보내고, PDF 4쪽 및 [expected-result.txt](expected-result.txt)로 결과를 대조한다.
5. 자기 메모로 다시 진행하고 빠진 정보를 확인한 뒤 팀 문서에 사용한다.

PDF에는 단계별 이유·복사할 내용·결과의 확인 기준·막혔을 때 후속 요청문을 넣었다. 별도 설치형 스킬이나 자동 업무 배정 프로그램은 아니다. ZIP에는 PDF와 TXT 3개, 간단 사용 안내가 들어 있다.

## 확인과 출처

- 원본 요청문: 상위 폴더 prompt-template.txt. 내용과 조건을 바꾸지 않고 복사용 파일로 제공한다.
- 연습 메모·응답: 기존 가상 메모 시연 prompt-v2-demo.txt, demo-response-v2.txt. 이번에 새로 실행한 결과로 기록하지 않는다.
- 화면: 기존 실제 시연 assets/v2/blank-input.png. PDF에 실제 캡처임과 화면 배치의 차이 가능성을 표시했다.
- 공식 근거: 2026-09-22 [OpenAI 공식 프롬프팅 가이드](https://developers.openai.com/cookbook/examples/chatgpt/chatgpt_prompt_guide/chatgpt_prompt_guide)를 다시 열람. 결과 형식 지정·미지정 정보 표시·원문 대조 원칙을 반영했다.
- PDF 4페이지를 PNG로 렌더해 직접 확인했다. [파일·텍스트 검증](verification.json)에 페이지 수·폰트·문자·ZIP 검사를 남긴다.

## 엔딩과 전달 상태

엔딩 문구: “이대로 따라 할 PDF와 복사용 요청문, 연습 메모까지 준비했어요. 회의 정리 템플릿이 필요하시면 댓글에 synk를 남겨주세요.”

ending.png는 실제 PDF 페이지를 사용한 1080×1920 정지 시안이다. 이 자료 소개를 [83초 v4 전체 무음 검토본](../video-v4/README.md)의 마지막 8초에 반영했다. 로컬 미리보기에서 PDF와 ZIP 다운로드를 확인했다. 공개 다운로드 URL·댓글 수동 전달 경로·자동 DM 설정·실제 발행은 미완료다. 게시하기 전에 선택한 전달 경로에서 실제로 파일을 받을 수 있는지 확인한다.

## 제작 파일

build_guide.py가 PDF와 TXT 파일을 만든다. tmp의 정적 SUIT TTF는 기존 승인 SUIT Variable에서 400·750 가중치로 변환한 제작용 서체다. build_ending.py는 실제 PDF 미리보기로 엔딩 정지 시안과 ZIP·검증 기록을 만든다. PDF 검수 PNG와 서체 중간 파일은 tmp에 둔다.
