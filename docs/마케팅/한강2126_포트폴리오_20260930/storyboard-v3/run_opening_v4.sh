#!/usr/bin/env bash
# 오프닝 15초 480p v4 — 릴스 유행 「불릿타임 커피 폴」 구조 + 실사 영화 화면(10-03 밤). Wan 3.0(15) · Seedance 2.5 초안(45).
# 곡이 아직 없어서 소리 참고는 넣지 않고, 지시문으로 효과음과 게임 목소리 「학교!」만 만들게 했다.
# 다시 시도는 작업이 만들어지기 전(올리기·서버 5xx)에만 한다. 작업이 만들어진 뒤 응답을 잃으면 `generate list`에서 찾아 받는다(중복 주문 방지).
H="$APPDATA/npm/higgsfield.exe"
R="C:/Users/q1212/AppData/Local/Temp/claude/C--Users-q1212-Documents-SYNK-appsscript/e01eab5a-9585-4a28-83ac-e5bac16b35c9/scratchpad/hanref"
P="C:/Users/q1212/Documents/SYNK-appsscript/docs/마케팅/한강2126_포트폴리오_20260930/prompts"
OUT="C:/Users/q1212/Documents/SYNK-appsscript/docs/마케팅/한강2126_포트폴리오_20260930/video"
# 1 인물 카드(뒤 전신) 2 얼굴 카드(VR 올림) 3·4 정면 얼굴 5 오른쪽 45도 6 90도 7 게임 8 산책로·건물 9 까몽
REFS=(--image-references "$R/P2_crop.png" --image-references "$R/P1n_c.png" --image-references "$R/FO_B.png" --image-references "$R/FO_C.png"
      --image-references "$R/FO_R45.png" --image-references "$R/S01.png" --image-references "$R/R01.png"
      --image-references "$R/K.png")
run() {   # run <이름> <job_type> <지시문 파일> [모델 인자…]
  local name="$1" jt="$2" pf="$3"; shift 3
  for attempt in 1 2 3; do
    "$H" generate create "$jt" "$@" "${REFS[@]}" --prompt "$(cat "$pf")" --wait --wait-timeout 60m --json > "$OUT/$name.json" 2> "$OUT/$name.err"
    if [ -s "$OUT/$name.json" ]; then break; fi
    if ! grep -q "upload_url\|HTTP 5" "$OUT/$name.err"; then break; fi
    sleep 20
  done
  python - "$OUT" "$name" <<'PY'
import json, subprocess, sys, os
out, k = sys.argv[1], sys.argv[2]
try:
    d = json.load(open(os.path.join(out, f'{k}.json'), encoding='utf-8')); d = d[0] if isinstance(d, list) else d
    u = d.get('result_url') or ''
    if u: subprocess.run(['curl', '-sSL', '--retry', '3', '-o', os.path.join(out, f'{k}.mp4'), u])
    print(k, d.get('id') or d.get('job_id'), d.get('status'), 'saved' if u else 'no result')
except Exception as e:
    print(k, 'no json', e)
PY
  echo "$name err: $(tail -c 300 "$OUT/$name.err" | sed 's#https://[^ ]*#<url>#g')"
}
run v4-opening-bullettime-wan-480p wan3_0 "$P/v4-01-opening-bullettime-wan.txt" --duration 15 --resolution 480p --aspect_ratio 9:16 --generate_audio true &
sleep 5
run v4-opening-bullettime-seedance-480p seedance_2_5 "$P/v4-01-opening-bullettime-seedance.txt" --mode omni_reference --draft true --duration 15 --aspect_ratio 9:16 --generate_audio true &
wait
