# LAB tight review v1 — edit log

## Scope

- New, independent 6.125-second review cut. The parent 58-second film remains on hold.
- Source: `../../video/lab-cinema-action-8s-seedance25-v1.mp4`.
- Target: `../../video/lab-cinema-action-tight-review-v1.mp4`.
- HyperFrames 0.8.96, 1080×1920, 24fps.
- Only hard cut/trim. No new media generation, effects, music, text, end card or playback-rate change.

## Frame-accurate edit

| Output frames | Source frames, inclusive | Source interval, end exclusive | Length |
|---|---|---|---|
| 0–102 | 0–102 | 0 to 103/24 seconds | 103 frames |
| 103–146 | 148–191 | 148/24 to 192/24 seconds | 44 frames |

Total: 147 frames / 24fps = 6.125 seconds. Source frames 103–147 and 192 are omitted. The two audio elements use identical source offsets and durations. No edge fade has been added.

## Verification

- Source ffprobe confirmed 1080×1920, 24fps, HEVC video and AAC audio; 193 source video frames.
- HyperFrames check, render, output ffprobe, full decode and cut-frame inspection: pending.
