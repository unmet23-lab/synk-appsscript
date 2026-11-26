#!/bin/bash
# 일꾼 서버(tools/일꾼서버.js)의 시험 환경을 맞춘다. synk 사용자로 돌고, 몇 번 돌려도 같다(2026-11-26).
#   PC에서: node tools/일꾼서버.js --명령 "bash -s" < tools/일꾼/준비.sh
# 저장소는 공개라 열쇠 없이 받는다. 내용(blob)은 쓸 때 받는 판이다(CI syntax-check와 같은 filter=blob:none).
# 자리 셋(~/slot/0..2)이 저마다 작업본이다. 받는 파일은 CI wide-tests와 같은 무늬다(큰 PNG 셋 폴더만 뺀다).
set -euo pipefail
cd ~
export PATH="/usr/local/bin:$PATH" ELECTRON_SKIP_BINARY_DOWNLOAD=1
REPO_URL=https://github.com/unmet23-lab/synk-appsscript.git
GIT_V=2.56.1

# 0) git — 바로올리기와 그 시험은 merge-file --object-id(2.43+), 검수증명은 cat-file --batch의 %(objectmode)를 쓴다.
#    Debian 13의 git 2.47에는 %(objectmode)가 없어 소스로 지어 /usr/local에 둔다(유호님 11-26 「응, 깔아줘」). 2.56은 기본이 Rust 빌드라 NO_RUST=1.
git_ok() {
  local t m
  t=$(mktemp -d)
  git -C "$t" init -q && printf x > "$t/a" && git -C "$t" add a && git -C "$t" -c user.name=x -c user.email=x@x.invalid commit -qm x &&
    m=$(printf 'HEAD:a\n' | git -C "$t" cat-file --batch-check='%(objectmode)' 2>/dev/null) || m=
  rm -rf "$t"
  [ "$m" = 100644 ] && case "$(git merge-file -h 2>&1 || true)" in *object-id*) true ;; *) false ;; esac
}
if ! git_ok; then
  echo "git $GIT_V을 짓는다(지금 $(git --version))" >&2
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -q build-essential libssl-dev libcurl4-gnutls-dev libexpat1-dev zlib1g-dev gettext >/dev/null
  rm -rf "/tmp/git-$GIT_V"
  curl -fsSL "https://mirrors.edge.kernel.org/pub/software/scm/git/git-$GIT_V.tar.xz" | tar xJ -C /tmp
  make -C "/tmp/git-$GIT_V" -j"$(nproc)" prefix=/usr/local NO_TCLTK=1 NO_RUST=1 all > /tmp/git-build.log 2>&1 || { tail -15 /tmp/git-build.log >&2; exit 1; }
  sudo make -C "/tmp/git-$GIT_V" prefix=/usr/local NO_TCLTK=1 NO_RUST=1 install > /tmp/git-install.log 2>&1 || { tail -8 /tmp/git-install.log >&2; exit 1; }
  hash -r
  git_ok || { echo "git $GIT_V을 지었지만 %(objectmode) · merge-file --object-id가 없다: $(command -v git)" >&2; exit 1; }
fi

# 1) 파이썬 3.14와 영상 시험 라이브러리 — CI syntax-check와 같은 판
if [ ! -x ~/.local/bin/uv ]; then curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null; fi
# 가상 환경은 만든 자리의 절대 경로를 품는다 — 집 폴더를 옮겼으면 다시 만든다
if ! ~/py/bin/python -c "import sys; assert sys.prefix == sys.argv[1]" "$HOME/py" 2>/dev/null; then rm -rf ~/py; ~/.local/bin/uv venv -q --python 3.14 ~/py; fi
~/.local/bin/uv pip install -q --python ~/py/bin/python numpy==2.5.2 pillow==12.3.0 opencv-python-headless==5.0.0.93

# 2) 저장소
[ -d ~/repo ] || git clone -q --filter=blob:none --no-checkout "$REPO_URL" ~/repo
git -C ~/repo fetch -q origin master

# 3) 형제 저장소 자리 — 시험 몇은 ../SYNK-talk · ../SYNK-website의 node_modules에서 parse5 · postcss를 찾는다(CI는 형제 저장소를 받는다).
#    서버에는 형제 저장소 본문을 두지 않고 그 둘만 깐 폴더를 잇는다. 형제 저장소 본문에 기대는 시험은 PC가 한 번 더 돈다(관련시험.js 환경시험).
deps=~/sibling-deps
if [ ! -d "$deps/node_modules/parse5" ] || [ ! -d "$deps/node_modules/postcss" ]; then
  mkdir -p "$deps"
  (cd "$deps" && { [ -f package.json ] || npm init -y >/dev/null; } && npm install --no-audit --no-fund --ignore-scripts --loglevel=error parse5@8.0.1 postcss@8.5.28 >/dev/null)
fi
mkdir -p ~/slot ~/jobs
# 잇기는 늘 다시 건다(ln -sfn) — 집 폴더를 옮기면 옛 절대 경로를 가리키는 깨진 링크가 남는다
for s in ~/slot/SYNK-talk ~/slot/SYNK-website; do mkdir -p "$s"; ln -sfn "$deps/node_modules" "$s/node_modules"; done

# 4) 자리 셋 — 무늬는 origin/master의 wide-tests.yml 첫 sparse-checkout 덩이에서 읽는다(CI와 어긋나지 않게)
pattern=$(git -C ~/repo show origin/master:.github/workflows/wide-tests.yml | awk '
  /sparse-checkout: \|/ && !done { on=1; next }
  on && /^ *[^ ]/ { line=$0; sub(/^ +/, "", line); if (line ~ /^[\/!]/) { print line; next } else { on=0; done=1 } }')
[ -n "$pattern" ] || { echo "wide-tests.yml에서 sparse 무늬를 못 읽었다" >&2; exit 1; }
# 시험(시험.sh)이 쥔 자리는 그 시험이 끝날 때까지 기다린다 — 시험 중에 자리를 origin/master로 되돌리지 않는다.
# 의존성은 시험.sh와 같은 목록 · 같은 표(.synk-lock = package-lock.json의 해시)로 미리 깐다 — 첫 시험이 npm ci를 기다리지 않게.
for n in 0 1 2; do
  d=~/slot/$n
  exec 9>~/slot/$n.lock
  flock 9
  if [ ! -e "$d/.git" ]; then
    git -C ~/repo worktree add -q --detach --no-checkout "$d" origin/master
  fi
  git -C ~/repo worktree repair "$d" 2>/dev/null || true  # 집 폴더를 옮겼으면 작업본과 저장소의 서로 가리키는 경로를 고친다
  printf '%s\n' "$pattern" | git -C "$d" sparse-checkout set --no-cone --stdin
  git -C "$d" checkout -q -f --detach origin/master
  for p in . desktop experiences/synk-account experiences/solo-backup experiences/solo-backup-rust/engine packages/atlas 영상; do
    [ -f "$d/$p/package-lock.json" ] || continue
    h=$(sha256sum "$d/$p/package-lock.json" | cut -c1-16)
    if [ "$(cat "$d/$p/node_modules/.synk-lock" 2>/dev/null)" != "$h" ]; then
      (cd "$d/$p" && npm ci --ignore-scripts --no-audit --no-fund --loglevel=error >/dev/null)
      if [ "$p" = "." ]; then (cd "$d" && npm install --no-save --no-audit --no-fund --ignore-scripts --loglevel=error source-map@0.5.7 >/dev/null); fi
      echo "$h" > "$d/$p/node_modules/.synk-lock"
    fi
  done
  exec 9>&-
done

# 5) Codex 런타임 자리 — 브라우저 시험 몇은 Codex 앱이 까는 node_modules에서 playwright를 찾는다. 서버에는 앱이 없어 자리 0의 것을 잇는다.
#    그 시험들은 크롬이 없어 건너뛰고, PC가 한 번 더 돈다(관련시험.js 환경시험).
c=~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node
mkdir -p "$c"
ln -sfn ~/slot/0/node_modules "$c/node_modules"

echo "준비 끝 $(date -Is) · $(git -C ~/repo rev-parse --short origin/master) · $(git --version) · $(~/py/bin/python --version) · node $(node -v) · 디스크 $(df -h / | awk 'NR==2 {print $4}') 남음"
