#!/usr/bin/env bash
set -euo pipefail

if ! command -v ffmpeg >/dev/null || ! command -v ffprobe >/dev/null; then
  apt_options=(-o Acquire::Retries=1 -o Acquire::http::Timeout=15 -o Acquire::https::Timeout=15 -o DPkg::Lock::Timeout=30)
  # The hosted Noble runner's regional mirror can spend nearly the whole job downloading FFmpeg.
  # Other distributions and architectures keep their own configured package sources.
  if [[ $(lsb_release -is 2>/dev/null) == Ubuntu && $(lsb_release -cs 2>/dev/null) == noble && $(dpkg --print-architecture) == amd64 ]]; then
    sources="$RUNNER_TEMP/synk-media-ubuntu.list"
    printf '%s\n' \
      'deb [signed-by=/usr/share/keyrings/ubuntu-archive-keyring.gpg] https://archive.ubuntu.com/ubuntu noble main restricted universe multiverse' \
      'deb [signed-by=/usr/share/keyrings/ubuntu-archive-keyring.gpg] https://archive.ubuntu.com/ubuntu noble-updates main restricted universe multiverse' \
      'deb [signed-by=/usr/share/keyrings/ubuntu-archive-keyring.gpg] https://security.ubuntu.com/ubuntu noble-security main restricted universe multiverse' > "$sources"
    apt_options+=(-o "Dir::Etc::sourcelist=$sources" -o Dir::Etc::sourceparts=- -o APT::Get::List-Cleanup=0 -o Acquire::ForceIPv4=true)
  fi

  apt_bounded() {
    local limit=$1 attempt status
    shift
    for attempt in 1 2; do
      if timeout --kill-after=5s "$limit" sudo apt-get "${apt_options[@]}" "$@"; then
        return 0
      else
        status=$?
      fi
      echo "::warning::APT attempt $attempt failed ($status): $*"
    done
    return "$status"
  }

  apt_bounded 90s update -o APT::Update::Error-Mode=any
  apt_bounded 120s install -y --no-install-recommends ffmpeg
fi

ffmpeg -version >/dev/null
ffprobe -version >/dev/null
