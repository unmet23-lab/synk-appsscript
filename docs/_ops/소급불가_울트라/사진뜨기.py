# 라이브 시트 «사진»을 새로 뜬다 — 탭마다 첫 행(칸 이름)과 값 든 줄 수만 뽑는다.
#
# ■ 이 파일이 없으면 무슨 일이 나나
#   짝인 `헤더대조.js` 는 «떠 둔 사진»과 «지금 코드»를 맞댄다. 사진이 낡으면 그 자가 조용히 거짓말한다
#   (그 사이 배포가 세운 칸을 「아직 없다」고 말한다). 그런데 09-07 까지 «다시 뜨는 법»이 어디에도
#   코드로 없어서, 사진이 나흘 낡은 채로 판정에 쓰였다. 이 파일이 그 구멍을 메운다.
#
# ■ 쓰는 법 (두 걸음)
#   ① 세션이 구글 드라이브 통로로 스프레드시트 `SYNK_앱데이터` 를 읽는다(읽기만 · 시트를 안 만진다).
#      → 결과가 너무 커서 파일로 떨어진다. 그 경로를 아래 인자로 준다.
#   ② python docs/_ops/소급불가_울트라/사진뜨기.py <그 파일 경로>
#   그 다음 재기: node docs/_ops/소급불가_울트라/헤더대조.js
#
# ■ 🔴 밟았던 함정 셋 (전부 09-07 실측)
#   ⓐ 드라이브가 주는 것은 «마크다운 표»이고, 밑줄 앞에 역슬래시를 넣는다 — 걷지 않으면
#      `student_id` 가 `student\_id` 라는 딴 칸이 되어 「없는 칸」이 거짓으로 부풀었다.
#   ⓑ 역슬래시는 heredoc 안에서 먹힌다 ⇒ 이 처리는 반드시 «파일로 된 스크립트»가 한다
#      (memory heredoc-eats-backslashes).
#   ⓒ 마크다운에는 «탭 이름»이 안 실린다 ⇒ 옛 사진과 헤더 겹침으로 이름을 되붙인다.
#      못 붙인 것은 `이름모름_NN` 으로 남는다 — 대조 자체는 이름과 무관하게 돌므로 판정은 산다.
import json
import subprocess
import datetime
import sys

OUT = 'docs/_ops/소급불가_울트라/라이브시트_헤더.json'
BS = chr(92)   # 역슬래시 하나 (리터럴로 적으면 heredoc 에서 먹힌다)


def 풀기(c):
    """마크다운이 넣은 역슬래시를 걷는다."""
    out = []
    i = 0
    while i < len(c):
        if c[i] == BS and i + 1 < len(c):
            out.append(c[i + 1]); i += 2
        else:
            out.append(c[i]); i += 1
    return ''.join(out).strip()


def 표뽑기(s):
    """마크다운 본문에서 표를 갈라 [[셀,…],…] 목록으로."""
    표들 = []
    cur = None
    for ln in s.split('\n'):
        if ln.startswith('|'):
            if cur is None:
                cur = []
            cur.append([풀기(c) for c in ln.strip().strip('|').split('|')])
        else:
            if cur:
                표들.append(cur); cur = None
    if cur:
        표들.append(cur)
    return 표들


def main():
    if len(sys.argv) < 2:
        print('쓰기: python docs/_ops/소급불가_울트라/사진뜨기.py <드라이브가 떨어뜨린 JSON 파일>')
        return 2
    s = json.load(open(sys.argv[1], encoding='utf-8'))['fileContent']
    표들 = 표뽑기(s)
    # 표 모양: 1행 빈칸 · 2행 정렬표시 · 3행이 진짜 헤더 · 그 뒤가 값
    새 = [([c for c in (t[2] if len(t) > 2 else [])], max(0, len(t) - 3)) for t in 표들]

    옛raw = subprocess.run(['git', 'show', 'HEAD:' + OUT], capture_output=True).stdout.decode('utf-8')
    옛맵 = json.loads(옛raw) if 옛raw.strip() else {}
    옛 = [(n, [str(x).strip() for x in (v.get('headers') or [])])
          for n, v in 옛맵.items() if not n.startswith('_')]

    쌍 = []
    for i, (h, _) in enumerate(새):
        a = set(x for x in h if x)
        best = (-1.0, None)
        for j in range(len(옛)):
            b = set(x for x in 옛[j][1] if x)
            if not a or not b:
                continue
            sc = len(a & b) / len(a | b)
            if sc > best[0]:
                best = (sc, j)
        쌍.append((i, best[0], best[1]))
    쌍.sort(key=lambda x: -x[1])
    남은 = set(range(len(옛)))
    붙임 = {}
    for i, sc, j in 쌍:
        if j is not None and j in 남은 and sc >= 0.4:
            붙임[i] = 옛[j][0]; 남은.discard(j)

    결과 = {'_뜬때': {
        'when': datetime.datetime.now().astimezone().isoformat(timespec='seconds'),
        'how': '구글 드라이브 통로로 SYNK_앱데이터 를 읽어 표의 첫 행을 뽑았다(읽기만 · 시트를 안 만졌다)',
        'note': '마크다운 변환이 밑줄 앞에 역슬래시를 넣는다 — 걷지 않으면 student_id 가 딴 칸이 된다',
        'caveat': '탭 이름은 마크다운에 안 실린다 — 옛 사진과 헤더 겹침으로 붙였고, 못 붙인 것은 이름모름_NN 이다',
    }}
    for i, (h, rows) in enumerate(새):
        결과[붙임.get(i, '이름모름_%02d' % i)] = {'headers': h, 'filled_rows': rows}

    open(OUT, 'wb').write((json.dumps(결과, ensure_ascii=False, indent=1) + '\n').encode('utf-8'))
    print('표 %d · 이름 붙인 탭 %d · 저장 %s' % (len(새), len(붙임), OUT))
    return 0


if __name__ == '__main__':
    sys.exit(main())
