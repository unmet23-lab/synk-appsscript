# -*- coding: utf-8 -*-
"""구운 목소리 받아쓰기 확인 — 원고와 다른 말·지시문이 섞인 소리·긴 침묵을 찾는다.

    python art-source/voice_check.py [이름접두사] [--보고 경로]

로컬 faster-whisper(large-v3-turbo, CPU)로 받아쓴다. 비용 0원.
판정: 글자 오차율(CER)과 영어 섞임, 소리 길이(글자 수에 비해 너무 길면 지시문을 읽었거나 쉬었다).
"""
import json, os, re, sys, unicodedata

GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE = os.path.join(GAME, 'assets', 'voice')


def norm(s):
    s = unicodedata.normalize('NFC', s)
    return re.sub(r'[^0-9A-Za-z가-힣]', '', s)


def cer(ref, hyp):
    r, h = norm(ref), norm(hyp)
    if not r:
        return 0.0 if not h else 1.0
    d = list(range(len(h) + 1))
    for i, rc in enumerate(r, 1):
        prev, d[0] = d[0], i
        for j, hc in enumerate(h, 1):
            cur = min(d[j] + 1, d[j - 1] + 1, prev + (rc != hc))
            prev, d[j] = d[j], cur
    return d[len(h)] / len(r)


def main():
    argv = sys.argv[1:]
    report_path = None
    if '--보고' in argv:
        i = argv.index('--보고')
        report_path = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    only = None
    if '--만' in argv:
        i = argv.index('--만')
        only = set(argv[i + 1].split(','))
        argv = argv[:i] + argv[i + 2:]
    args = [a for a in argv if not a.startswith('--')]
    prefix = args[0] if args else ''
    manifest = json.load(open(os.path.join(VOICE, 'voices.json'), encoding='utf-8'))
    from faster_whisper import WhisperModel
    model = WhisperModel('large-v3-turbo', device='cpu', compute_type='int8')
    rows = []
    for vid, meta in sorted(manifest['lines'].items()):
        if not vid.startswith(prefix) or (only and vid not in only):
            continue
        path = os.path.join(VOICE, vid + '.mp3')
        spoken = meta.get('spoken', meta['text'])
        chars = len(norm(spoken))
        short = chars <= 6
        # 짧은 줄(네? 왜요? 등)은 언어 감지가 흔들려 일본어로 받아쓴다(2026-10-02 1차) → 한국어로 고정. 긴 줄은 감지로 영어 섞임을 잡는다.
        segs, info = model.transcribe(path, beam_size=5, vad_filter=False, condition_on_previous_text=False,
                                      language='ko' if short else None, word_timestamps=True)
        segs = list(segs)
        text = ''.join(s.text for s in segs).strip()
        e = cer(spoken, text)
        # 숫자를 받아쓴 경우(다섯 시 → 5시)는 원고 화면 글과도 비교해 더 나은 쪽
        e = min(e, cer(meta['text'], text))
        rate = chars / max(meta['dur'], 0.1)
        latin = bool(re.search(r'[A-Za-z]{3,}', text))
        words = [w for s in segs for w in (s.words or [])]
        gaps = [round(b.start - a.end, 2) for a, b in zip(words, words[1:]) if b.start - a.end > 1.5]
        bad = e > 0.12 or latin or (not short and rate < 2.0) or (not short and info.language != 'ko') or bool(gaps)
        rows.append({'id': vid, 'ok': not bad, 'cer': round(e, 3), 'lang': info.language, 'dur': meta['dur'],
                     'chars_per_sec': round(rate, 2), 'gaps': gaps, 'heard': text, 'script': spoken})
        print(('  ' if not bad else '✗ ') + f"{vid:28s} cer={e:.2f} {info.language} {meta['dur']:5.2f}s {rate:4.1f}자/초 {text}", flush=True)
    bad = [r for r in rows if not r['ok']]
    print(f'확인 {len(rows)}줄 · 다시 볼 것 {len(bad)}줄: {",".join(r["id"] for r in bad)}')
    if report_path:
        json.dump(rows, open(report_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
