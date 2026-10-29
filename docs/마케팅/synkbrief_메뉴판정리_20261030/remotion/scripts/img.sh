#!/usr/bin/env bash
# 영상용 그림 사본(public/img, git 밖)을 원본(그림/ · 화면/)에서 다시 만든다. 쓰는 법: bash scripts/img.sh
#   전 · 전_종이 · 전_쪽지 · 후_벽은 자료/뜯기층.py가 1080×1920으로 만들고(후_벽 원본은 자료/벽에앉히기.py), 나머지는 옮기거나 키운다.
set -e
cd "$(dirname "$0")/../.."
mkdir -p remotion/public/img
python 자료/뜯기층.py > /dev/null
python -c "from PIL import Image; Image.open('그림/전_들림.png').resize((1080, 1920), Image.LANCZOS).save('remotion/public/img/전_들림.png')"
cp 그림/후_한줄만.png remotion/public/img/후_한줄.png
cp 그림/후_결과_카드빠짐.png remotion/public/img/후_카드빠짐.png
cp 화면/말_한줄만.png 화면/말_그것만.png remotion/public/img/
echo "public/img 다시 만듦"
