# v7 사람 컷 3개 · Seedance 2.5 지시문(크레딧 승인 뒤에만 돌린다)

> 2026-10-21 준비. 유호님 「힉스필드 크레딧은 쓰지말고 나머지 전부 준비해봐」 — 아래는 돌리지 않았다. 견적은 [브리프 · 샷표](../00_브리프_샷표.md) 「크레딧 견적」.
> 방식: 한강 S08 · S14와 같은 Seedance 2.5 omni_reference, 이미지 → 영상(시작 그림 = 그 컷 키프레임), 소리 끔(`generate_audio=false`), 9:16. 컷마다 4초 생성에서 1.5초만 쓴다. 480p로 2번씩 뽑아 고르고, 고른 것만 1080p로 다시(제작 규칙 「생성과 선택」).
> 참고 그림: ① 그 컷 키프레임(최종은 Gemini 2.1로 다시 뽑은 판) ② 지유 얼굴 정면 `C:\SYNK-LoRA\validation\F04_jiyu\refs\01_hero.jpg` ③ 옆 `02_left90.jpg` ④ 45도 `03_right45.jpg`.

## 모든 컷 머리(그대로 붙인다)

```
GLOBAL STYLE: a premium Korean skincare commercial, shot on a cinema camera with an 85mm lens, natural morning window light from the left, warm pale neutrals (warm greige limewashed plaster, frost-white), calm and minimal.
TEXTURE AND REALISM: photoreal documentary-plate realism, light 35mm film grain, faint halation, natural micro motion blur, skin with pores and no retouching; no teal, no HDR, no added sharpening, no plastic sheen.
CHARACTER: the woman is exactly the person in @Image 1, whose face matches @Image 2, @Image 3 and @Image 4 — same face shape, eyes, nose, lips, jaw and age in every frame. White terry-cloth headband, long straight black hair worn down with a center part, plain white crew-neck T-shirt, fresh bare skin after washing. She is alone; no hands, no products in frame.
CAMERA: locked-off tripod feel with only the move described below; no zoom, no cuts.
```

## 컷 2 · 시선을 든다(1.5초 사용)

```
SHOT: start exactly on @Image 1. Shoulder-up close-up. Her eyes are lowered toward the basin; over two seconds she slowly lifts her gaze to just beside the lens and holds it, calm and relaxed, a faint softness at the mouth corners, lips closed, relaxed brows — never serious or tense. Only her eyelids and gaze move; head almost still. The camera pushes in very slowly by about 2%.
```

## 컷 5 · 눈 감고 숨(1.5초 사용)

```
SHOT: start exactly on @Image 1. Close-up of her left profile facing the window on the left of the picture, eyes closed. She takes one slow, quiet breath in: her shoulders rise a little and settle, the band of morning light across her profile stays where it is. Lips stay closed, face relaxed and content. Nothing else moves except one or two strands of hair. The camera tilts down very slowly by a few degrees.
```

## 컷 7 · 미소(1.5초 사용, 이 컷만은 꼭 생성)

```
SHOT: start exactly on @Image 1. Frontal close-up, she looks straight into the lens. Her soft closed-mouth smile deepens just slightly and her eyes smile gently, then she holds it — warm and quietly content, not an advertising smile, lips stay closed, no teeth at any moment. The camera moves on a very small arc to the right (about 5 degrees).
```

## 받은 뒤 볼 것

- 고르는 다섯 기준: 얼굴 · 손(없어야 함) · 소품(없어야 함) · 움직임 · 빛(제작 규칙).
- 입이 벌어지거나 이가 보이는 프레임, 찡그림 · 긴장으로 읽히는 프레임이 없는지(v5b 「짜증나 보인다」).
- 키프레임과 얼굴이 같은지 대표 사진과 얼굴 띠로 맞대 본다.
