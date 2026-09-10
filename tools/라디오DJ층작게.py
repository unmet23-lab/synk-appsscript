"""확정한 통합 의상 까몽을 라디오용 1024 WebP 표정 세트로 줄인다.

정본 4K PNG는 옷과 표정이 한 몸으로 구워진 판이다. 라디오에서는 4096px 이미지를
여덟 장 펼치면 메모리를 많이 쓰므로, 같은 정사각 액자를 유지한 채 1024px로만 줄인다.

쓰는 법: python tools/라디오DJ층작게.py
"""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

try:
    from mascot_originals import ensure_files
except ModuleNotFoundError:
    from tools.mascot_originals import ensure_files


루트 = Path(__file__).resolve().parent.parent
이름 = '까몽_여름델+전설의팻말'
든곳 = 루트 / 'docs/Loom_자산/옷/GPT_표정_누끼_틀'
낼곳 = 루트 / 'docs/Loom_자산/라디오DJ'
표정들 = ['본체', '눈감음', '눈웃음', '궁금함', '집중', '안도', '응원', '놀람']


def main():
    ensure_files(든곳 / f'{이름}_{표정}.png' for 표정 in 표정들)
    낼곳.mkdir(parents=True, exist_ok=True)
    판 = {}
    for 표정 in 표정들:
        원본 = 든곳 / f'{이름}_{표정}.png'
        if not 원본.exists():
            raise FileNotFoundError(f'라디오 DJ 원본이 없다: {원본}')
        with Image.open(원본) as 열린:
            그림 = 열린.convert('RGBA')
        if 그림.size != (4096, 4096):
            raise ValueError(f'4K 정사각 액자가 아니다: {원본.name} {그림.size}')
        작은 = 그림.resize((1024, 1024), Image.Resampling.LANCZOS)
        결과 = 낼곳 / f'{이름}_{표정}.webp'
        작은.save(결과, 'WEBP', quality=92, method=6)
        판[표정] = {
            '파일': 결과.name,
            '바이트': 결과.stat().st_size,
            'sha256': hashlib.sha256(결과.read_bytes()).hexdigest(),
        }

    (낼곳 / '판.json').write_text(json.dumps({
        '만든때': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'DJ': 이름,
        '크기': 1024,
        '표정': 판,
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'✅ 라디오 DJ {len(표정들)}컷 · 1024² WebP → {낼곳}')


if __name__ == '__main__':
    main()
