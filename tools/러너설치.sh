#!/usr/bin/env bash
# 러너설치 — 셀프호스티드 리눅스 러너를 «한 줄»로 세우고 스위치까지 켠다.
#
# 왜 있나 (유호 지시 2026-08-18 「원격으로 다 해주면 안돼?」):
#   러너는 유호님 기계 «안»에서 도는 프로그램이라 클라우드 세션이 대신 세울 수 없다. 그런데
#   그 사실이 「유호님이 클릭 20번을 하셔야 한다」로 번역되면 안 된다 — 이 저장소의 철학이
#   「사람 손을 늘리는 해법을 쓰지 않는다」이고, 사람이 누르는 칸은 판단이 필요한 자리 하나뿐이다.
#   그래서 손이 가는 전부(토큰 발급·다운로드·검증·등록·서비스·스위치)를 여기로 옮긴다.
#   남는 사람 몫은 **이 한 줄을 실행하는 것** 하나다.
#
# 어디서 도나 — **WSL2 안의 Ubuntu**(리눅스)에서 돈다. 윈도우에서 직접 돌리면 안 된다:
#   워크플로가 `runs-on: [self-hosted, linux]` 로 리눅스 라벨을 요구한다. 그 이유는 F617 이다 —
#   윈도우에서 초록이던 검사 3건이 리눅스에서 무너졌고, 그 축을 지키려고 리눅스로 세운다.
#
# 쓰는 법:
#   bash tools/러너설치.sh                 설치 + 스위치 켜기
#   bash tools/러너설치.sh --확인          아무것도 안 바꾸고 «지금 상태»만 본다
#   bash tools/러너설치.sh --sha256 <값>   릴리스에서 체크섬을 못 읽었을 때 손으로 준다
#   bash tools/러너설치.sh --스위치만      러너는 이미 있고 변수만 켠다
#
# 🔴 **식별자는 ASCII 다** (2026-08-18 실측): bash 변수 이름에 한글을 쓰면 `이름=값` 이
#    «명령 실행»으로 읽혀 `No such file or directory` 로 죽는다. 그런데 `bash -n` 은 그것을
#    문법 오류로 안 본다 — 즉 **구문검사가 초록을 내는 거짓 초록**이다. 이 저장소의 다른 코드는
#    전부 JS 라 한글 식별자가 되므로 그 습관이 그대로 넘어오기 쉽다. 한글은 주석·문구에만 쓴다.
#    회귀 `tests/러너설치.test.js` 가 이 규칙을 기계로 막는다.
#
# 🔴 자격증명 취급: 등록 토큰은 **변수에만** 담고 화면·파일·로그에 남기지 않는다.
#    `set -x` 를 켜지 않는 이유가 이것이다.
#
# ⚠ 안 잰 것 — 이 스크립트는 **끝까지 실행해 보지 못했다.** 클라우드 컨테이너에는 러너를 세울 수
#    없고(세션이 끝나면 사라진다) 프록시가 `actions/runner` 릴리스 API 를 막는다. 그래서 모든
#    단계를 fail-closed 로 짰다 — 못 읽거나 못 맞추면 **멈추고 따를 수 있는 처방을 낸다**
#    (조용히 건너뛰지 않는다 · CLAUDE.md 신뢰성 · F103). 막히면 그 문구를 그대로 알려 주면 된다.

set -euo pipefail

REPO="unmet23-lab/synk-appsscript"
SWITCH="SYNK_SELFHOSTED"
LABEL="linux"
DIR="$HOME/actions-runner"

CHECK_ONLY=0
SWITCH_ONLY=0
SHA_EXTRACT_ONLY=0
LABEL_TEST_ONLY=0
MANUAL_SHA=""
while [ $# -gt 0 ]; do
  case "$1" in
    --확인)      CHECK_ONLY=1 ;;
    --스위치만)   SWITCH_ONLY=1 ;;
    --sha256)    MANUAL_SHA="${2:-}"; shift ;;
    --sha추출)   SHA_EXTRACT_ONLY=1 ;;
    --라벨판정)   LABEL_TEST_ONLY=1 ;;
    *)
      # 🔴 모르는 인자를 조용히 삼키면 「딴 과녁을 재고 초록」이 된다(F400 계열).
      printf '🔴 모르는 인자: %s\n' "$1" >&2
      printf '   이 스크립트가 아는 것은 --확인 --스위치만 --sha256 --sha추출 --라벨판정 뿐이다.\n' >&2
      exit 2 ;;
  esac
  shift
done

say()  { printf '%s\n' "$*"; }
step() { printf '\n▶ %s\n' "$*"; }
die()  { printf '\n🔴 %s\n' "$1" >&2; shift; for l in "$@"; do printf '   %s\n' "$l" >&2; done; exit 1; }

# ── 릴리스 JSON 에서 linux-x64 체크섬을 뽑는다 ─────────────────────────────
# 🔴 왜 «마커»로 잡나 (2026-08-18 실측 · 유호님 노트북 첫 실행에서 터졌다).
#    첫 판은 `tr ',' '\n' | grep -A2 'linux-x64' | grep -oE '[a-f0-9]{64}' | head -1` 이었다.
#    그런데 릴리스 JSON 의 body 는 **한 줄**이다 — 개행이 `\n` 리터럴로 이스케이프돼 있어
#    `grep -A2`(뒤 2줄)가 아무것도 좁히지 못한다. 그래서 `head -1` 이 목록 **맨 위** 형제
#    (win-x64)의 체크섬을 집었고, 멀쩡히 받은 파일이 남의 값과 대조돼 검증이 터졌다.
#    ⚠ 급소는 「안 돌았다」가 아니라 **돌면서 남의 값을 냈다**는 것이다 — 맞는 얼굴로 틀린 값을
#    내는 자리다(CLAUDE.md 신뢰성 맹점 ④). 게다가 그때 낸 처방이 「지우고 다시 받아라」라서
#    215MB 를 다시 받아도 똑같이 틀린다 — 따를수록 멀어지는 처방이었다(F103).
#    그래서 형제와 섞일 수 없는 마커(`BEGIN SHA linux-x64 -->`)로 잡는다.
# 🔑 stdin 으로 읽는다 — 회귀가 이 함수를 **실물 그대로** 재게 하려고(로직을 테스트에 베끼면
#    두 곳이 갈라진다 · F063). 통로는 아래 `--sha추출`.
sha_of_linux_x64() {
  grep -oE 'BEGIN SHA linux-x64 -->[0-9a-f]{64}' | head -1 | grep -oE '[0-9a-f]{64}' || true
}

# 🔑 테스트 통로 — stdin 의 릴리스 JSON 에서 값만 찍고 끝난다(네트워크·상태 무접촉).
if [ "$SHA_EXTRACT_ONLY" = "1" ]; then sha_of_linux_x64; exit 0; fi

# ── 러너 목록에서 라벨을 찾는다 ────────────────────────────────────────────
# 🔴 왜 `grep -q` 한 줄이 아닌가 (2026-08-19 실측 · 유호님 노트북에서 잡혔다).
#    첫 판은 `grep -q "$LABEL"` 이었고 `LABEL="linux"`(소문자)인데, GitHub 가 러너에 실제로
#    붙이는 기본 라벨은 **`Linux`**(대문자)다 — `self-hosted,Linux,X64`. grep 은 기본이
#    대소문자 구분이라 **못 찾았고**, 러너가 online 으로 job 을 돌리는 «중»에도 `--확인` 이
#    「리눅스 러너 없음 · 세우려면 설치하라」를 냈다.
#    ⚠ 급소는 **워크플로가 멀쩡하다**는 것이다 — Actions 의 `runs-on` 라벨 매칭은 대소문자를
#    무시한다. 즉 러너는 정상인데 **확인 도구만 눈이 멀었다**(F642 와 같은 형태 — 안 도는 게
#    아니라 «돌면서 남의 답»을 낸다). 그리고 그 처방을 따르면 멀쩡한 러너를 215MB 다시 깐다.
# 🔑 경계도 본다 — 부분일치로 찾으면 `linux-arm` 라벨을 단 러너를 x64 로 오인한다.
#    라벨은 콤마로 갈린 목록이라 그 경계로 맞춘다(대소문자는 무시하되 «낱말»은 정확히).
# 인자: $1=찾을 라벨 · $2 가 `--online` 이면 「그 라벨을 단 러너가 online 인가」까지 본다.
# stdin: `이름|상태|라벨,라벨,…` 줄들.
has_label() {
  awk -F'|' -v want="$1" -v need_online="${2:-}" '
    {
      n = split($3, a, ",")
      for (i = 1; i <= n; i++) {
        lab = a[i]; gsub(/^[ \t]+|[ \t]+$/, "", lab)
        if (tolower(lab) == tolower(want)) {
          if (need_online != "--online" || tolower($2) == "online") { found = 1 }
        }
      }
    }
    END { exit found ? 0 : 1 }'
}

# 🔑 테스트 통로 — stdin 의 러너 목록에서 두 판정만 찍는다(네트워크·상태 무접촉).
if [ "$LABEL_TEST_ONLY" = "1" ]; then
  RUNNERS_IN="$(cat)"
  REG=0; printf '%s\n' "$RUNNERS_IN" | has_label "$LABEL" && REG=1
  ONL=0; printf '%s\n' "$RUNNERS_IN" | has_label "$LABEL" --online && ONL=1
  printf '등록=%s 온라인=%s\n' "$REG" "$ONL"
  exit 0
fi

# ── 0. 여기가 리눅스인가 ────────────────────────────────────────────────────
step "0/7 환경 확인"
[ "$(uname -s)" = "Linux" ] || die "여기는 리눅스가 아니다 ($(uname -s))." \
  "워크플로가 'linux' 라벨을 요구한다 — 윈도우에 세우면 job 이 안 잡힌다(그게 의도다 · F617)." \
  "시작 메뉴에서 **Ubuntu** 를 열고 거기서 다시 실행한다."
say "  ✅ 리눅스"

MISSING=""
for c in curl tar git sha256sum; do
  command -v "$c" >/dev/null 2>&1 || MISSING="$MISSING $c"
done
[ -z "$MISSING" ] || die "준비물이 없다:$MISSING" \
  "아래 한 줄을 먼저 실행한다(비밀번호를 물으면 WSL 사용자 비밀번호다):" \
  "  sudo apt update && sudo apt install -y curl tar git coreutils"
say "  ✅ curl · tar · git · sha256sum"

command -v gh >/dev/null 2>&1 || die "gh(GitHub CLI)가 이 리눅스 «안»에 없다." \
  "윈도우 쪽에 깔려 있어도 WSL 안에는 따로 필요하다. 아래를 순서대로 실행한다:" \
  "  sudo apt update && sudo apt install -y wget" \
  "  sudo mkdir -p -m 755 /etc/apt/keyrings" \
  "  wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg >/dev/null" \
  "  sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg" \
  "  echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main\" | sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null" \
  "  sudo apt update && sudo apt install -y gh" \
  "그 뒤 'gh auth login' 으로 로그인하고 이 스크립트를 다시 실행한다."
say "  ✅ gh"

gh auth status >/dev/null 2>&1 || die "gh 에 로그인이 안 돼 있다." \
  "  gh auth login" \
  "브라우저가 열리면 이 저장소 계정으로 로그인한다."
say "  ✅ gh 로그인"

# ── 1. 지금 상태 ────────────────────────────────────────────────────────────
step "1/7 지금 상태"
RUNNERS="$(gh api "repos/$REPO/actions/runners" \
  --jq '.runners[] | "\(.name)|\(.status)|\([.labels[].name] | join(","))"' 2>/dev/null || true)"
if [ -n "$RUNNERS" ]; then
  say "  등록된 러너:"
  printf '%s\n' "$RUNNERS" | while IFS='|' read -r n s l; do
    [ -n "$n" ] && say "    · $n — $s — 라벨: $l"
  done
else
  say "  등록된 러너 0개"
fi

SWITCH_VAL="$(gh variable list --repo "$REPO" --json name,value \
  --jq ".[] | select(.name==\"$SWITCH\") | .value" 2>/dev/null || true)"
say "  스위치 $SWITCH = ${SWITCH_VAL:-<없음>}"

HAS_LINUX=0
if printf '%s\n' "$RUNNERS" | has_label "$LABEL"; then HAS_LINUX=1; fi

ONLINE=0
if printf '%s\n' "$RUNNERS" | has_label "$LABEL" --online; then ONLINE=1; fi

if [ "$CHECK_ONLY" = "1" ]; then
  say ""
  if [ "$HAS_LINUX" = "1" ] && [ "$SWITCH_VAL" = "on" ] && [ "$ONLINE" = "1" ]; then
    say "🟢 셋 다 섰다 — 원격 CI 가 돈다. 확인: node tools/원격ci.js"
  elif [ "$HAS_LINUX" = "1" ] && [ "$SWITCH_VAL" = "on" ]; then
    # 🔴 여기를 「아직이다」로 접으면 안 된다 — 세울 게 없다. 러너는 등록돼 있고 기계가 꺼져 있을
    #    뿐이라, 처방이 「설치하라」면 멀쩡한 러너를 다시 깐다. 미검증과 미설치는 다른 상태다.
    say "⏸ 러너가 **오프라인**이다 — 등록·스위치는 서 있다(다시 설치할 것 없다)."
    say "   기계를 켜면 밀린 job 을 그때 잡는다. 그동안 검사는 「초록」이 아니라 **「대기」**다."
    say "   기계가 켜져 있는데도 오프라인이면: cd \$HOME/actions-runner && sudo ./svc.sh status"
  else
    RUNNER_TXT="없음"; [ "$HAS_LINUX" = "1" ] && RUNNER_TXT="있음"
    say "⬜ 아직이다 — 리눅스 러너 $RUNNER_TXT · 스위치 ${SWITCH_VAL:-꺼짐}"
    say "   세우려면: bash tools/러너설치.sh"
  fi
  exit 0
fi

# ── 스위치만 켜는 갈래 ──────────────────────────────────────────────────────
if [ "$SWITCH_ONLY" = "1" ]; then
  step "스위치만 켠다"
  [ "$HAS_LINUX" = "1" ] || die "리눅스 라벨을 단 러너가 없다 — 스위치만 켜면 검사가 줄만 선다." \
    "먼저 러너를 세운다: bash tools/러너설치.sh"
  gh variable set "$SWITCH" --body on --repo "$REPO"
  say "  ✅ $SWITCH = on"
  exit 0
fi

if [ "$HAS_LINUX" = "1" ]; then
  say ""
  say "ℹ 리눅스 러너가 이미 등록돼 있다 — 설치를 건너뛰고 스위치만 켠다."
  gh variable set "$SWITCH" --body on --repo "$REPO"
  say "  ✅ $SWITCH = on"
  say "  확인: node tools/원격ci.js"
  exit 0
fi

# ── 2. 러너 버전·체크섬 ─────────────────────────────────────────────────────
step "2/7 러너 최신판 확인"
REL="$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest)" \
  || die "러너 릴리스 정보를 못 받았다(네트워크)." "잠시 뒤 다시 실행한다."
TAG="$(printf '%s' "$REL" | grep -o '"tag_name"[^,]*' | head -1 | cut -d'"' -f4)"
[ -n "$TAG" ] || die "릴리스 태그를 못 읽었다 — API 응답 모양이 바뀌었다." \
  "https://github.com/actions/runner/releases 에서 최신 버전을 보고 알려 주면 그 판으로 고친다."
VER="${TAG#v}"
say "  최신판 $TAG"

FILE="actions-runner-linux-x64-${VER}.tar.gz"
URL="https://github.com/actions/runner/releases/download/${TAG}/${FILE}"

# 🔴 체크섬은 **조용히 건너뛰지 않는다.** 못 읽으면 멈추고, 사람이 줄 수 있는 처방을 낸다(F103).
SHA="$MANUAL_SHA"
if [ -z "$SHA" ]; then
  SHA="$(printf '%s' "$REL" | sha_of_linux_x64)"
fi
[ -n "$SHA" ] || die "릴리스에서 linux-x64 체크섬을 못 읽었다 — 검증 없이 설치하지 않는다." \
  "https://github.com/actions/runner/releases/tag/$TAG 를 열면" \
  "  '$FILE' 옆에 SHA256 값이 적혀 있다." \
  "그 값을 그대로 붙여 다시 실행한다:" \
  "  bash tools/러너설치.sh --sha256 <그 값>"
say "  체크섬 확보(앞 8자리: ${SHA:0:8}…)"

# ── 3. 내려받기 · 검증 ──────────────────────────────────────────────────────
step "3/7 내려받기"
mkdir -p "$DIR"
cd "$DIR"
if [ -f "$FILE" ]; then say "  이미 받아 둔 파일을 쓴다"; else curl -fSL -o "$FILE" "$URL"; fi
say "  검증 중…"
printf '%s  %s\n' "$SHA" "$FILE" | sha256sum -c - >/dev/null \
  || die "체크섬이 안 맞는다 — 받은 파일을 신뢰할 수 없다." \
     "받다 만 파일일 수 있다. 아래로 지우고 다시 실행한다:" \
     "  rm -f '$DIR/$FILE'"
say "  ✅ 체크섬 일치"
tar xzf "$FILE"
say "  ✅ 풀었다 → $DIR"

# ── 4. 등록 토큰 (화면에 안 찍는다) ─────────────────────────────────────────
step "4/7 등록 토큰 발급"
REG_TOKEN="$(gh api -X POST "repos/$REPO/actions/runners/registration-token" --jq .token 2>/dev/null || true)"
[ -n "$REG_TOKEN" ] || die "등록 토큰을 못 받았다 — 이 저장소에 관리자 권한이 필요하다." \
  "gh auth status 로 어느 계정인지 보고, 저장소 소유 계정으로 로그인돼 있는지 확인한다."
say "  ✅ 받았다(화면에 찍지 않는다)"

# ── 5. 등록 ─────────────────────────────────────────────────────────────────
step "5/7 러너 등록"
./config.sh --unattended --replace \
  --url "https://github.com/$REPO" \
  --token "$REG_TOKEN" \
  --name "synk-wsl-$(hostname)" \
  --labels "$LABEL" \
  --work _work
unset REG_TOKEN
say "  ✅ 등록 완료 (라벨: $LABEL)"

# ── 6. 항상 켜져 있게 ───────────────────────────────────────────────────────
step "6/7 서비스로 올리기"
SVC_OK=0
if sudo ./svc.sh install "$USER" >/dev/null 2>&1 && sudo ./svc.sh start >/dev/null 2>&1; then
  SVC_OK=1
  say "  ✅ 서비스로 등록했다 — WSL 이 뜨면 자동으로 돈다"
else
  say "  ⚠ 서비스 등록에 실패했다(WSL 에 systemd 가 꺼져 있으면 그렇다)."
  say "     이 창을 열어 두는 방식으로 돌린다:"
  say "       cd $DIR && ./run.sh"
  say "     항상 켜 두고 싶으면 /etc/wsl.conf 에 아래를 넣고 'wsl --shutdown' 뒤 다시 연다:"
  say "       [boot]"
  say "       systemd=true"
fi

# ── 7. 스위치 ───────────────────────────────────────────────────────────────
step "7/7 스위치 켜기"
if [ "$SVC_OK" = "1" ]; then
  gh variable set "$SWITCH" --body on --repo "$REPO"
  say "  ✅ $SWITCH = on — 다음 푸시부터 검사가 돈다"
else
  say "  ⏸ 러너가 아직 안 돌고 있어 스위치는 **안 켰다**(켜면 검사가 줄만 선다)."
  say "     위 ./run.sh 로 러너를 띄운 뒤 아래 한 줄을 실행한다:"
  say "       bash tools/러너설치.sh --스위치만"
fi

say ""
say "확인: node tools/원격ci.js   (✅초록 / ⏳대기 / 🔴건너뜀 중 하나를 말해 준다)"
say "상태: bash tools/러너설치.sh --확인"
