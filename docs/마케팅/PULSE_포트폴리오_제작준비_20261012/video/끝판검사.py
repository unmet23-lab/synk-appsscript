# 끝 판 검사 — 끝 몇 초에 화면을 가로지르는 납작한 색 판이 있나 잰다(유호님 11-04 「너무 슬롭같은데」, 제작양식/광고영상_슬롭점검표.md 1번).
# 장면은 줄마다 색이 고르지 않지만 판은 글자 밖이 한 색이다. 줄마다 가장 흔한 색의 몫을 재서 이어진 띠를 찾는다.
# 경고만 한다 — 판이 잡히면 프레임을 눈으로 보고 판단한다.
#   python -X utf8 끝판검사.py <영상.mp4> [영상.mp4 …]
import json
import subprocess
import sys

import numpy as np

W = 270        # 이 폭으로 줄여 잰다
SECONDS = (3.0, 2.0, 1.0, 0.1)   # 끝에서 몇 초 앞을 볼지
MIN_HEIGHT = .08  # 화면 높이의 몫 — 이보다 얇은 띠는 판으로 보지 않는다
SHARE_COLOR = .55 # 색이 있는 판: 줄의 이만큼이 한 색(글자가 나머지)
SHARE_PLAIN = .92 # 흰 · 회색 · 검정: 벽 · 하늘 · 어두운 여백과 헷갈리니 거의 다 한 색일 때만
CHROMA = 40       # RGB 최대 - 최소가 이 값 이상이면 색이 있다고 본다


def probe(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', path], capture_output=True, encoding='utf-8', check=True).stdout
    data = json.loads(out)
    return data['streams'][0]['width'], data['streams'][0]['height'], float(data['format']['duration'])


def frame(path, at, w, h):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-ss', f'{at:.3f}', '-i', path, '-frames:v', '1', '-vf', f'scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.uint8).reshape(h, w, 3)


def rows_of(img):
    """줄마다 (가장 흔한 색, 그 몫)."""
    q = (img.astype(np.int32) >> 3)   # 압축 잡음을 무시할 만큼만 뭉갠다
    keys = (q[..., 0] << 10) | (q[..., 1] << 5) | q[..., 2]
    result = []
    for line, key in zip(img, keys):
        values, counts = np.unique(key, return_counts=True)
        top = values[counts.argmax()]
        result.append((line[key == top].mean(axis=0), counts.max() / len(key)))
    return result


def bands(img):
    found, start, base = [], None, None
    rows = rows_of(img)

    def close(end):
        if start is not None and (end - start) / len(rows) >= MIN_HEIGHT:
            found.append({'위': start / len(rows), '아래': end / len(rows), '색': base})

    for y, (color, share) in enumerate(rows):
        chroma = color.max() - color.min()
        flat = share >= (SHARE_COLOR if chroma >= CHROMA else SHARE_PLAIN) and color.mean() >= 28   # 검은 여백 · 글자 없는 어둠은 판이 아니다
        same = flat and base is not None and np.abs(color - base).max() <= 12
        if flat and not same:
            close(y)
            start, base = y, color
        elif not flat:
            # 글자가 많은 줄은 몫이 떨어진다 — 같은 색이 그 줄에도 넓으면 이어 준다
            if start is not None and (np.abs(img[y].astype(np.int32) - base).max(axis=1) <= 14).mean() >= .3:
                continue
            close(y)
            start, base = None, None
    close(len(rows))
    return found


def check(path):
    width, height, duration = probe(path)
    h = round(W * height / width) // 2 * 2
    hits = []
    for back in SECONDS:
        at = max(0, duration - back)
        for band in bands(frame(path, at, W, h)):
            hits.append({'초': round(at, 2), '화면 높이': f"{band['위'] * 100:.0f}~{band['아래'] * 100:.0f}%", '색': '#%02x%02x%02x' % tuple(int(c) for c in band['색'])})
    return hits


def main(paths):
    caught = 0
    for path in paths:
        hits = check(path)
        name = path.replace('\\', '/').split('/')[-1]
        if hits:
            caught += 1
            print(f'⚠ {name}: 끝에 납작한 판 — 프레임을 보고 판단한다(슬롭 점검표 1번)')
            for hit in hits:
                print(f"    {hit['초']}초 · 화면 높이 {hit['화면 높이']} · {hit['색']}")
        else:
            print(f'  {name}: 끝에 납작한 판 없음')
    return caught


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__ or '영상 경로를 주세요')
        sys.exit(2)
    main(sys.argv[1:])
