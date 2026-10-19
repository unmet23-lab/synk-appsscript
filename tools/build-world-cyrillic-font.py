"""WORLD 몽골어 화면용 키릴 글꼴을 만든다. 실행: python -X utf8 tools/build-world-cyrillic-font.py [--check]

브랜드 한글 서체 SUIT와 지금 WORLD의 SYNK Latin(Inter Tight 라틴 조각)에는 키릴 문자가 하나도 없다(10-19 fontTools 확인).
몽골어(키릴) 화면이 시스템 서체로 떨어지지 않도록 Inter Tight 원본(docs/브랜드_폰트/InterTight, OFL·예약 이름 없음)에서
키릴 범위(U+0400-052F, 몽골어의 Ө·Ү 포함)와 № 만 떼어 WOFF2로 만든다. world-ui.css · hangul-stage/style.css ·
opening.css가 같은 글꼴 이름에 unicode-range로 붙여서, 키릴 글자가 나올 때만 받는다(SYNK Latin과 같은 방식).
결과: experiences/brand-opening/assets/SYNKCyrillic-{Regular,SemiBold,Bold}.woff2 와 hangul-stage/assets/fonts/의 같은 사본.
--check는 지금 파일이 원본에서 다시 만든 것과 같은 글자 목록·굵기인지 본다(WOFF2 압축 바이트는 판마다 다를 수 있어 글자로 비교한다).
"""
import io, pathlib, sys
from fontTools import subset
from fontTools.ttLib import TTFont

REPO = pathlib.Path(__file__).resolve().parents[1]
SOURCE = REPO / 'docs/브랜드_폰트/InterTight'
TARGETS = [REPO / 'experiences/brand-opening/assets', REPO / 'experiences/hangul-stage/assets/fonts']
WEIGHTS = {'Regular': 'InterTight-Regular.ttf', 'SemiBold': 'InterTight-SemiBold.ttf', 'Bold': 'InterTight-Bold.ttf'}
UNICODES = list(range(0x0400, 0x0530)) + [0x2116]
# CSS unicode-range(세 파일 공통). 원본에 있는 글자만 남으므로 범위는 넓게 둔다.
CSS_RANGE = 'U+0400-052F,U+2116'


def build(source):
    font = TTFont(source)
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.name_languages = ['*']
    options.notdef_outline = True
    options.hinting = False
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=UNICODES)
    subsetter.subset(font)
    buffer = io.BytesIO()
    font.flavor = 'woff2'
    font.save(buffer)
    return buffer.getvalue()


def glyph_summary(data):
    font = TTFont(io.BytesIO(data))
    cmap = font.getBestCmap() or {}
    return sorted(cmap), font['OS/2'].usWeightClass


def main():
    check = '--check' in sys.argv
    failed = []
    for weight, name in WEIGHTS.items():
        data = build(SOURCE / name)
        expected = glyph_summary(data)
        if 0x04E8 not in expected[0] or 0x04AE not in expected[0]:
            raise SystemExit(f'{name}: Mongolian Ө/Ү missing from the subset')
        for folder in TARGETS:
            target = folder / f'SYNKCyrillic-{weight}.woff2'
            if check:
                if not target.exists() or glyph_summary(target.read_bytes()) != expected:
                    failed.append(str(target.relative_to(REPO)))
                continue
            folder.mkdir(parents=True, exist_ok=True)
            temporary = target.with_suffix('.woff2.tmp')
            temporary.write_bytes(data)
            temporary.replace(target)
            print(f'{target.relative_to(REPO)}: {len(expected[0])} glyphs, weight {expected[1]}, {len(data)} bytes')
    if check:
        if failed:
            raise SystemExit('Cyrillic fonts differ from the Inter Tight source: ' + ', '.join(failed))
        print('WORLD Cyrillic fonts current')
    else:
        print('CSS unicode-range:', CSS_RANGE)


if __name__ == '__main__':
    main()
