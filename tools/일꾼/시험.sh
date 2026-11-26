#!/bin/bash
# 일꾼 서버에서 시험 한 판을 돈다(2026-11-26). PC의 tools/일꾼시험.js가 SSH로 이 글을 넘겨 부른다.
# 받는 값(글 머리의 셸 변수): JOB(작업 이름) · HEAD_SHA(시험할 커밋) · TESTS_B64(시험 파일 목록, 줄마다 하나, base64)
#   · NEW_JSON(이번 push의 새 파일 → SYNK_새파일) · CONC(동시 수) · LIMIT(시험 한도 초) · SLOT_WAIT(자리 기다림 초)
#   · DEADLINE(이 스크립트 시작부터 초 — PC의 SSH 한도보다 앞선다. 설치 · 시험 · 환경 셈 한도를 그 안으로 줄인다)
# 꾸러미는 ~/jobs/$JOB.bundle에 먼저 올라와 있다(refs/synk-worker/$JOB 하나 · 바탕은 origin/master에 있는 커밋).
# 시험은 그 커밋의 tools/lib/관련시험몰이.cjs로 PC와 똑같이 파일마다 돈다. PC가 몰이 장부와 파일별 TAP을 받아 같은 몰이판정으로 가른다.
# 표준 출력: 「@@결과 <몰이 종료 코드>」 한 줄, 장부 · TAP · 환경(이 PC가 봐야 할 파일 — 그 커밋의 관련시험.js 환경시험으로 셈, 못 셈이면 null)을
#   담은 JSON을 gzip한 base64 한 줄, 맨 끝 「@@끝」 한 줄.
#   끝 표가 없으면 PC는 응답이 끊긴 것으로 보고 자기 자리에서 돈다.
# 종료 코드 뜻: 몰이의 종료 코드, 124 = 바깥 timeout이 몰이를 끊음, 200번대 = 준비 실패(시험은 안 돌았다 — PC가 자기 자리에서 돈다).
set -uo pipefail
export PATH="$HOME/py/bin:/usr/local/bin:$PATH" CI=1 SYNK_REQUIRE_TALK_SOURCE=0 ELECTRON_SKIP_BINARY_DOWNLOAD=1
log() { echo "[일꾼] $*" >&2; }
: "${DEADLINE:=900}"
남은() { echo $((DEADLINE - SECONDS)); }   # 마감까지 남은 초(SECONDS = 스크립트 시작부터)
몰이몫() { echo $((LIMIT + 60 + 130)); }    # 시험 한도 · 몰이 끝 기다림 · 환경 셈(120초)과 여유 — 설치 전에 남겨 둘 몫
bundle=~/jobs/$JOB.bundle
ref=refs/synk-worker/$JOB
jd=~/jobs/$JOB.d
d=
ntests=0
finish() {
  echo "@@결과 $1"
  if [ -n "$d" ] && [ -d "$jd" ]; then
    node -e '
      const fs = require("fs"), path = require("path");
      const [dir, n, slot] = process.argv.slice(1);
      const f = path.join(dir, "장부.jsonl");
      const 장부 = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null;
      let 환경 = null;
      try { const v = JSON.parse(fs.readFileSync(path.join(dir, "환경.json"), "utf8")); if (Array.isArray(v) && v.every((x) => typeof x === "string")) 환경 = v; } catch {}
      const taps = {}, 앞 = slot.replace(/\/?$/, "/");
      for (let i = 0; i < Number(n); i++) { const t = path.join(dir, i + ".tap"); if (fs.existsSync(t)) taps[i] = fs.readFileSync(t, "utf8").split(앞).join(""); }
      // gzip해서 보낸다 — TAP은 잘 줄어 느린 회선에서도 SSH 한도 전에 닿는다(일꾼몰이-8 GA3). 상한은 두지 않는다 — 버리면 서버에서 본 실패까지
      // 잃는다(일꾼몰이-9 GA1). 그래도 한도를 넘기면 PC는 응답이 끊긴 것으로 보고 이 PC에서 돈다(일꾼 이전과 같다)
      process.stdout.write(require("zlib").gzipSync(Buffer.from(JSON.stringify({ 장부, taps, 환경 }))).toString("base64") + "\n");
    ' "$jd" "$ntests" "$d" || exit 1
  fi
  echo "@@끝"
  exit 0
}
trap 'rm -rf "$bundle" "$jd"; git -C ~/repo update-ref -d "$ref" 2>/dev/null || true' EXIT

timeout 60 git -C ~/repo fetch -q origin master || log "origin fetch 실패 — 있는 판으로 간다"
git -C ~/repo bundle verify -q "$bundle" >/dev/null 2>&1 || { log "꾸러미 확인 실패"; finish 201; }
git -C ~/repo fetch -q "$bundle" "$ref:$ref" || { log "꾸러미 받기 실패"; finish 202; }
[ "$(git -C ~/repo rev-parse "$ref")" = "$HEAD_SHA" ] || { log "꾸러미 커밋이 다르다"; finish 203; }

# 빈 자리를 잡는다. 셋 다 차 있으면 SLOT_WAIT 초만 0번 자리를 기다리고, 못 잡으면 PC로 돌린다.
# 준비.sh도 같은 잠금을 잡고 자리를 고치므로 시험 중에 자리가 바뀌지 않는다.
slot=
for n in 0 1 2; do exec 9>~/slot/$n.lock; if flock -n 9; then slot=$n; break; fi; done
if [ -z "$slot" ]; then exec 9>~/slot/0.lock; flock -w "${SLOT_WAIT:-120}" 9 || finish 204; slot=0; fi
s=~/slot/$slot
git -C "$s" checkout -q -f --detach "$HEAD_SHA" || { log "자리 $slot 꺼내기 실패"; finish 205; }
git -C "$s" clean -q -ffdx -e node_modules || true
# CI wide-tests · syntax-check가 시험 전에 까는 폴더와 같다(.github/workflows/wide-tests.yml 「install dependencies」)
for p in . desktop experiences/synk-account experiences/solo-backup experiences/solo-backup-rust/engine packages/atlas 영상; do
  [ -f "$s/$p/package-lock.json" ] || continue
  h=$(sha256sum "$s/$p/package-lock.json" | cut -c1-16)
  if [ "$(cat "$s/$p/node_modules/.synk-lock" 2>/dev/null)" != "$h" ]; then
    log "npm ci $p"
    t=$(( $(남은) - $(몰이몫) )); [ "$t" -ge 20 ] || { log "마감 안에 설치할 시간이 없다"; finish 211; }
    (cd "$s/$p" && timeout "$t" npm ci --ignore-scripts --no-audit --no-fund --loglevel=error >&2) || { log "npm ci 실패 $p"; finish 206; }
    if [ "$p" = "." ]; then
      t=$(( $(남은) - $(몰이몫) )); [ "$t" -ge 20 ] || { log "마감 안에 설치할 시간이 없다"; finish 211; }
      (cd "$s" && timeout "$t" npm install --no-save --no-audit --no-fund --ignore-scripts --loglevel=error source-map@0.5.7 >&2) || { log "source-map 설치 실패"; finish 206; }
    fi
    echo "$h" > "$s/$p/node_modules/.synk-lock"
  fi
done
mapfile -t tests < <(printf '%s' "$TESTS_B64" | base64 -d)
ntests=${#tests[@]}
[ "$ntests" -gt 0 ] || finish 207
# node --test는 없는 파일을 말없이 건너뛴다 — 하나라도 없으면 PC에서 돈다(작업본과 커밋이 다르다는 뜻이다)
for t in "${tests[@]}"; do [ -f "$s/$t" ] || { log "커밋에 시험 파일이 없다: $t"; finish 208; }; done
[ -f "$s/tools/lib/관련시험몰이.cjs" ] || { log "커밋에 관련시험몰이가 없다"; finish 209; }
rm -rf "$jd" && mkdir -p "$jd"
# 마감 안에서 시험 한도를 줄인다 — 몰이 끝 기다림(50초) · 환경 셈(120초) · 여유를 남긴다
l=$(( $(남은) - 60 - 130 )); [ "$l" -ge 30 ] || { log "마감 안에 시험할 시간이 없다"; finish 211; }
[ "$l" -lt "$LIMIT" ] && LIMIT=$l
TESTS_B64="$TESTS_B64" node -e '
  const fs = require("fs");
  const [file, dir, conc, limit] = process.argv.slice(1);
  const 시험 = Buffer.from(process.env.TESTS_B64, "base64").toString("utf8").split("\n").filter(Boolean);
  fs.writeFileSync(file, JSON.stringify({ 시험, 동시: Number(conc), 한도ms: Number(limit) * 1000, 폴더: dir, 고정: ["--test", "--test-timeout=120000", "--test-reporter=tap"] }));
' "$jd/일.json" "$jd" "$CONC" "$LIMIT" || finish 210
log "자리 $slot · 시험 $ntests개 · 동시 $CONC · 한도 ${LIMIT}초"
d=$s
cd "$s"
# 몰이는 한도에 닿으면 자기가 띄운 실행기만 끈다. 리눅스에서는 시험 파일이 그 실행기의 따로 된 자식이라 남을 수 있다 — 몰이가 끝나면
# 이 작업 표(SYNK_일꾼작업)를 물려받은 프로세스를 다 끈다. 다음 시험이 같은 자리를 쓸 때 옛 시험이 돌지 않게(일꾼몰이 GPT GA9)
env "SYNK_새파일=${NEW_JSON:-[]}" "SYNK_일꾼작업=$JOB" timeout --kill-after=10 "$((LIMIT + 40))" node tools/lib/관련시험몰이.cjs "$jd/일.json" >&2
rc=$?
for p in $(pgrep -u "$(id -u)"); do
  [ "$p" = "$$" ] && continue
  tr '\0' '\n' < "/proc/$p/environ" 2>/dev/null | grep -qxF "SYNK_일꾼작업=$JOB" && kill -KILL "$p" 2>/dev/null
done
# 이 PC가 봐야 할 파일을 이 커밋 그대로 셈한다 — PC 작업본은 다시 쌓은 새 머리를 품지 않는다(일꾼몰이-5 GA3). 못 셈이면 파일을 쓰지 않는다(null)
et=$(( $(남은) - 10 )); [ "$et" -gt 120 ] && et=120; [ "$et" -ge 5 ] || et=5
TESTS_B64="$TESTS_B64" timeout "$et" node -e '
  const 관련 = require(process.argv[1] + "/tools/관련시험.js");
  if (typeof 관련.환경시험 !== "function") process.exit(3);
  const 시험 = Buffer.from(process.env.TESTS_B64, "base64").toString("utf8").split("\n").filter(Boolean);
  require("fs").writeFileSync(process.argv[2], JSON.stringify(관련.환경시험(process.argv[1], 시험)));
' "$s" "$jd/환경.json" >&2 || { log "환경 셈 실패"; rm -f "$jd/환경.json"; }
finish $rc
