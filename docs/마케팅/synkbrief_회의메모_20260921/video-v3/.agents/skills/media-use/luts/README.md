# LUT library (authoring)

> SYNK 적용 범위: 기존 HyperFrames 작업본에 동봉된 공급자 기술 참고다. 이 프로젝트의 설치판은 0.8.58이며 아래 명령·무료 한도·성능·지원 버전은 이 PC에서 재검증된 사실이 아니다. 새 제작의 도구·음성·이미지 경로는 [제작 방식](../../../../../../콘텐츠_제작방식_v2_20261002.md), 담당·설치·계정·비용·외부 발송·공개는 [AI 운영 원칙](../../../../../../../AI_운영원칙.md)과 현재 요청을 따른다. 아래의 공급자 기본값이나 fallback을 SYNK의 자동 실행·결제·업로드 승인으로 해석하지 않는다.

`index.json` is the agent-consumed catalog of color-grade looks. Each entry resolves
on demand — no `.cube` bodies are committed to the repo.

Each look has:

- `id`, `description`, `tags`, `intensity` — matching + application metadata.
- `url` (optional) — a hosted `.cube` downloaded, validated, and frozen at resolve
  time, exactly like bgm/image assets.
- `params` (optional) — a deterministic `buildCube` spec used offline (`--local-only`)
  or as a fallback if the `url` download/validation fails.

An entry needs at least one of `url` or `params`; prefer both (CDN url with a params
fallback) so resolution is never blocked on the network.

## Hosting a new look (operators)

1. Generate the `.cube` (e.g. `resolve -t lut --params '{...}'` or a graded export).
2. Upload it to the public CDN origin bucket:

   ```
   aws s3 cp <id>.cube s3://heygen-public/luts/<id>.cube
   ```

   It is then served at `https://static.heygen.ai/luts/<id>.cube` (CloudFront).

3. Add an entry to `index.json` with that `url` (and ideally a `params` fallback).
