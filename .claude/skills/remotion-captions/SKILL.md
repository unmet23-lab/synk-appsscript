---
name: remotion-captions
description: Remotion 영상에 자막을 넣거나 움직일 때 쓴다. 받아쓰기, SRT 파일 가져오기, 자막 표시, 자막 애니메이션을 다룬다. SYNK에서는 이미 만든 Remotion 영상을 다시 렌더하거나 고칠 때만 쓴다. 새 SNS 영상의 자막은 SNS 제작 키트(docs/디자인/SNS키트, motion.js의 M.caption)로 만든다(2026-10-01). Transcribing, displaying and animating captions in Remotion.
version: 4.0.520
---

> 🔴 SYNK — **`description` 은 원본과 갈라져 있다**(09-03 · 유호 픽). 원본은 `Transcribing, displaying
> and animating captions` 한 줄이라 **「Remotion」이 없어** 영상 작업 중에 걸리지 않았다.
> 원본을 판올림할 때 이 줄을 덮어쓰지 말고 다시 붙인다. 형제 = `remotion-markup`.

All captions must be processed in JSON. The captions must use the [`Caption`](https://www.remotion.dev/docs/captions/caption.md) type which is the following:

```ts
import type { Caption } from "@remotion/captions";
```

This is the definition:

```ts
type Caption = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number | null;
  confidence: number | null;
  pageBreakAfter?: boolean;
};
```

## Generating captions

To transcribe video and audio files to generate captions, load the [transcribe-captions.md](transcribe-captions.md) file for more instructions.

## Displaying captions

To display captions in your video, load the [display-captions.md](display-captions.md) file for more instructions.

## Importing captions

To import captions from a .srt file, load the [import-srt-captions.md](import-srt-captions.md) file for more instructions.
