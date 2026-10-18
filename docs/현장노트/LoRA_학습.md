# 현장 노트 · LoRA 학습·검증

> 판: `C:\SYNK-LoRA` · AI-Toolkit 0.13.26(화면 localhost:8675) · ComfyUI 0.41.0 · Z-Image Turbo + training adapter v2(qfloat8, low_vram) · MediaPipe 1.1.1(측정 도구) · RTX 5090 Laptop 24GB
> 마지막 확인: 2026-10-17(하린 v2 33장 학습 중)
> 쓴 AI: Claude Code(Claude Opus 5.5)

실행 방법은 `C:\SYNK-LoRA\먼저 읽기.md`, 무엇을 학습할지는 [AI 광고영상 제작 규칙](../마케팅/제작양식/AI광고영상_제작규칙.md)과 모델 명세서(예: [하린](../마케팅/PULSE_AI모델_캐스팅_20260930/명세서/F02_하린.md))를 본다. 틀은 [README](README.md)를 따른다.

## 설치·받기

### npm 12가 설치 스크립트를 막아 AI-Toolkit 화면이 안 돈다
- 증상: `npm install` 뒤 prisma·sqlite3·sharp가 동작하지 않아 화면 서버가 뜨지 않는다(10-16).
- 원인: npm 12는 패키지 설치 스크립트를 기본으로 막는다.
- 고침: `npm install-scripts approve prisma sqlite3 @prisma/client @prisma/engines sharp` 뒤 `npm rebuild`(ui/package.json에 allowScripts가 남는다).
- 다시 확인: `AI-Toolkit_실행.cmd` 뒤 `http://localhost:8675/api/jobs`가 응답하는지.

### 큰 모델 파일 받기가 멈추거나, 망이 끊기면 처음부터 다시 받는다
- 증상: 허깅페이스 xet 받기가 128MB에서 멈췄고, 와이파이가 끊기자 받던 조각을 지웠다(10-16).
- 원인: 허깅페이스 받기 도구가 끊긴 조각을 이어 쓰지 않는다.
- 고침: `C:\SYNK-LoRA\tools\download_resumable.py`(curl `-C -` 이어받기 + sha256 확인)로 받는다. 텍스트 인코더는 ComfyUI 쪽 파일을 하드링크로 같이 쓰니 공식 조각 목록(index.json)을 다시 받지 않는다.
- 다시 확인: 받는 중 망을 끊었다 이어도 이어서 받는지.

## 학습

### 배터리로 돌리면 학습 중에 노트북이 잠든다
- 증상: 학습이 밤사이 멈춰 있었다(10-16, 카페 와이파이·배터리).
- 원인: Windows 절전.
- 고침: 충전기를 꽂고 `C:\SYNK-LoRA\AI-Toolkit_실행.cmd`로 띄운다. 같이 뜨는 `tools\keep_awake_training.py`가 run.py가 도는 동안만 잠자기를 막고, 화면과 학습이 모두 꺼지면 스스로 끝난다.
- 다시 확인: `C:\SYNK-LoRA\tools\keep_awake.log`.

### 학습이 시험 때보다 느리다(스텝당 4~7초)
- 증상: 하린 33장 학습이 처음 스텝당 5~7초, 안정된 뒤 약 4.2초. GPU 사용률은 96%인데 전력은 80W대였다(10-17).
- 원인: Windows 전원 「균형 조정」과 노트북 기본 모드에서 GPU 전력이 낮게 묶인 것으로 보인다(성능 모드로 다시 재 보지는 않았다). 원본이 최대 2400px라 첫 스텝들이 더 느리다.
- 고침: 충전기를 꽂고 돌린다. 노트북 성능 모드(Legion Space)로 바꿀지는 유호님이 정한다.
- 다시 확인: `nvidia-smi --query-gpu=utilization.gpu,power.draw --format=csv -l 1`.

### 트리거 없는 「a young Korean woman」에도 학습한 얼굴이 샌다
- 증상: 학습 중 샘플에서 트리거 없이 쓴 「a young Korean woman …」도 250스텝부터 앞머리·갈색 단발로 바뀌었다(10-17 하린 v2).
- 원인: 캡션마다 「[trigger], a young Korean woman」을 넣어 그 낱말도 같이 배운다.
- 고침: 한 장면에는 그 모델 LoRA 하나만 쓴다(제작 규칙의 「두 사람은 따로 만든 장면」). 막아야 하면 AI-Toolkit `diff_output_preservation`(분류 person)을 켜고 다시 학습한다(시간이 늘고, 아직 시험하지 않았다).
- 다시 확인: 검증 표의 「트리거 없음」 줄(`C:\SYNK-LoRA\validation\F02_harin\validate_v2.py`).

## 측정 도구

### 옆모습에서 얼굴 점을 못 찾아 등신이 틀린다
- 증상: MediaPipe 얼굴 점은 90° 옆얼굴에서 못 찾았고, 몸 자세 점의 입은 옆모습에서 턱 쪽으로 밀려 턱을 30px쯤 낮게 잡았다(등신 6.4로 틀림, 실제 6.8~6.9).
- 원인: 얼굴 검출기는 정면~70°용이고, 자세 점의 얼굴 부위는 옆에서 부정확하다.
- 고침: `C:\SYNK-LoRA\tools\measure\inspect_shot.py`는 옆모습이면 얼굴 앞쪽 윤곽이 가장 가파르게 물러나는 줄을 턱으로 잡는다(매끄럽게 할 때 가장자리를 0으로 채우면 첫 줄이 턱으로 잡히니 끝값으로 채운다). 뒷모습은 등신을 재지 않고, 몸·고개를 기울였거나 팔이 머리에 붙으면 비율은 참고만 적는다. 정수리는 이마에서 위로 끊기지 않고 이어진 영역의 맨 위로 잡아, 머리 위로 올린 팔에 안 걸리게 한다.
- 다시 확인: 하린 A1 옆모습이 정면 기준과 같은 등신(6.8~6.9)으로 나오는지.
