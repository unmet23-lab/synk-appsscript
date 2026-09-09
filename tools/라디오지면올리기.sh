#!/usr/bin/env bash
# 라디오 지면(bots/오버레이)과 라디오 전용 DJ 그림을 서버에 올린다.
#
# ■ 왜 있나 (09-08)
#   서버에는 git 이 없어서 `git pull` 이 안 된다. 그래서 09-08 에 방송지킴이를 고치고
#   손으로 scp 했는데, 손으로 하면 «같이 가야 하는 파일»을 빠뜨린다. 그날 실제로
#   간판(라디오간판.js)을 안 올렸으면 봇이 그 자리에서 죽었다.
#   ⇒ 폴더째 올리고, 올린 뒤 서버에서 구문까지 재는 통로를 하나로 만든다.
#
# ■ 서버가 쥔 것 (09-08 실측)
#   /opt/synk-radio/지면/ 아래에는 `bots` 와 `docs` 뿐이다. `tools` 는 없다.
#   그래서 서버에서 도는 것이 읽는 파일은 반드시 bots 안에 있어야 한다.
#
# 쓰는 법:
#   bash tools/라디오지면올리기.sh          # 올리고 잰다
#   bash tools/라디오지면올리기.sh --재기만  # 안 올리고 지금 서버 상태만 본다
set -euo pipefail

KEY="$HOME/.ssh/synk_radio"
HOST="synk@34.71.111.97"
SRC="bots/오버레이"
DEST="/opt/synk-radio/지면/bots/오버레이"
DJ_SRC="docs/Loom_자산/라디오DJ"
DJ_DEST="/opt/synk-radio/지면/docs/Loom_자산/라디오DJ"
SSHOPT=(-i "$KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=15)

if [ ! -d "$SRC" ]; then
  echo "🔴 $SRC 가 없다 — 저장소 뿌리에서 돌려라"; exit 1
fi
if [ ! -d "$DJ_SRC" ]; then
  echo "🔴 $DJ_SRC 가 없다 — python tools/라디오DJ층작게.py 를 먼저 돌려라"; exit 1
fi

if [ "${1:-}" != "--재기만" ]; then
  echo "■ 올린다 — 지면 + 라디오 DJ"
  ssh "${SSHOPT[@]}" "$HOST" "mkdir -p '$DEST' '$DJ_DEST'"
  # shellcheck disable=SC2086
  scp "${SSHOPT[@]}" "$SRC"/* "$HOST:$DEST/"
  scp "${SSHOPT[@]}" "$DJ_SRC"/* "$HOST:$DJ_DEST/"
  echo "  ✅ 보냈다"
fi

echo "■ 서버에서 잰다"
ssh "${SSHOPT[@]}" "$HOST" "cd '$DEST' && \
  echo '  파일 '\$(ls -1 | wc -l)'개' && \
  for f in *.js; do node --check \"\$f\" || { echo \"  🔴 구문 깨짐: \$f\"; exit 1; }; done && \
  echo '  ✅ js 구문 전부 통과' && \
  test \$(find '$DJ_DEST' -maxdepth 1 -name '*.webp' | wc -l) -eq 8 && \
  echo '  ✅ 라디오 DJ 1024 WebP 8컷' && \
  node -e \"const g=require('$DEST/라디오간판.js'); console.log('  간판:', g.방송제목); console.log('  꼬리표', g.꼬리표.length, '개')\""

echo "✅ 끝. 봇은 크론이 5분마다 부른다 — 다음 부름부터 새 값이 선다."
