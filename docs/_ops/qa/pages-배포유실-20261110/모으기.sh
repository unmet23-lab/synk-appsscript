#!/bin/bash
# synk.im(synk-policy) Pages 실행의 deploy 작업 로그를 모아 시도마다 한 줄로 쓴다 (2026-11-10 Claude).
#   bash docs/_ops/qa/pages-배포유실-20261110/모으기.sh [부터 UTC 날짜, 기본 2026-11-01] [출력 폴더, 기본 .tmp/pages-배포유실]
# 칸: 실행 첫줄시각 · 실행 · 커밋 · 실행결론 · 시도 · deploy결론 · deploy시작 · 묶음크기(1GiB를 넘어 경고가 붙을 때만) · 상태줄 · 끝줄
# 상태줄의 「(빈칸)」은 deploy-pages가 `Current status: ` 뒤를 비워 찍은 것이다(배포 유실).
set -u
since=${1:-2026-11-01}
out=${2:-.tmp/pages-배포유실}
repo=unmet23-lab/synk-policy
mkdir -p "$out/logs"
gh run list -R "$repo" --workflow pages-build-deployment -L 2000 --json databaseId,headSha,createdAt,conclusion \
  --jq ".[] | select(.createdAt >= \"$since\") | [.databaseId, .headSha[0:8], .createdAt, .conclusion] | @tsv" > "$out/runs.tsv"
while IFS=$'\t' read -r id sha created concl; do
  gh api "repos/$repo/actions/runs/$id/jobs?filter=all&per_page=50" \
    --jq '.jobs[] | select(.name=="deploy") | [.id, .run_attempt, .conclusion, .started_at] | @tsv' |
  while IFS=$'\t' read -r jid jatt jconcl jstart; do
    f="$out/logs/$jid.log"
    [ -s "$f" ] || gh api "repos/$repo/actions/jobs/$jid/logs" > "$f"
    size=$(grep -o "Uploaded artifact size of [0-9]* bytes" "$f" | grep -o "[0-9]\{6,\}" | head -1)
    states=$(grep -o "Current status: [a-z_]*" "$f" | sed 's/Current status: //' | awk '{if($0=="")$0="(빈칸)"; print}' | uniq | paste -sd'>' -)
    ends=$(grep -o -E "Reported success!|Timeout reached, aborting!|in progress deployment|Deployment cancelled|Canceled deployment|HttpError[^\r]{0,60}" "$f" | head -2 | paste -sd'|' -)
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$created" "$id" "$sha" "$concl" "$jatt" "$jconcl" "$jstart" "${size:-}" "$states" "$ends"
  done
done < "$out/runs.tsv" | sort -u -t$'\t' -k7,7 > "$out/body.tsv"
{ printf '첫줄시각(UTC)\t실행\t커밋\t실행결론\t시도\tdeploy결론\tdeploy시작(UTC)\t묶음크기(1GiB넘을때만)\t상태줄\t끝줄\n'; cat "$out/body.tsv"; } > "$out/deploy시도.tsv"
rm -f "$out/body.tsv"
echo "$out/deploy시도.tsv"
