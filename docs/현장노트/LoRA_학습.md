# 현장 노트 · LoRA 학습·검증

> 판: `C:\SYNK-LoRA` · AI-Toolkit 0.13.26(화면 localhost:8675) · ComfyUI 0.41.0 · Z-Image Turbo + training adapter v2(qfloat8, low_vram) · MediaPipe 1.1.1(측정 도구) · RTX 5090 Laptop 24GB
> 마지막 확인: 2026-10-17(하린 v2 33장 학습 중)
> 쓴 AI: Claude Code(Claude Opus 5.5)

실행 방법은 `C:\SYNK-LoRA\먼저 읽기.md`, 무엇을 학습할지는 [AI 광고영상 제작 규칙](../마케팅/제작양식/AI광고영상_제작규칙.md)과 모델 명세서(예: [하린](../마케팅/PULSE_AI모델_캐스팅_20260930/명세서/F02_하린.md))를 본다. 틀은 [README](README.md)를 따른다.

## 먼저 볼 것

> 도구를 쓰기 전에 여기와 목차만 읽고, 걸리는 절은 `rg -n "^###" docs/현장노트/LoRA_학습.md`로 제목을 찾아 그 항목만 읽는다.

- 학습이 스텝당 4~7초로 느리면 → 충전기를 꽂고 `nvidia-smi -q -d POWER`로 전력 한도를 본다(전원 설정은 유호님) ([자세히](#학습이-시험-때보다-느리다스텝당-47초))
- 트리거 없는 「a young Korean woman」에도 학습한 얼굴이 샌다 → 한 장면에는 그 모델 LoRA 하나만 쓴다 ([자세히](#트리거-없는-a-young-korean-woman에도-학습한-얼굴이-샌다))

## 목차

[설치·받기](#설치받기) · [학습](#학습) · [지난 기록](지난기록/LoRA_학습.md)

## 설치·받기

### 큰 모델 파일 받기가 멈추거나, 망이 끊기면 처음부터 다시 받는다
- 증상: 허깅페이스 xet 받기가 128MB에서 멈췄고, 와이파이가 끊기자 받던 조각을 지웠다(10-16).
- 원인: 허깅페이스 받기 도구가 끊긴 조각을 이어 쓰지 않는다.
- 고침: `C:\SYNK-LoRA\tools\download_resumable.py`(curl `-C -` 이어받기 + sha256 확인)로 받는다. 텍스트 인코더는 ComfyUI 쪽 파일을 하드링크로 같이 쓰니 공식 조각 목록(index.json)을 다시 받지 않는다.
- 다시 확인: 받는 중 망을 끊었다 이어도 이어서 받는지.

## 학습

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
