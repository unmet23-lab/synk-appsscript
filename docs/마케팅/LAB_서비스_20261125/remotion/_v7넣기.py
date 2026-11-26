# E64 「서비스」 v7 — 칸 10과 11 사이에 계산서 칸(b1)을 넣고 뒤를 2.6초 미룬다(유호님 11-27 「고친 뒤 바꿔」).
# 이해 시험 v6-2 · v6-3 「반전이 작은 글씨에만」 → 반전 줄을 빼고 그림(₩0 셋 · 동그라미 친 ₩8,000)으로 보인다.
# python -I -X utf8 remotion/_v7넣기.py  (편 폴더에서)
import os
import sys

p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src', 'e64', 'data.ts')
t = open(p, encoding='utf-8', newline='').read()
crlf = '\r\n' in t
t = t.replace('\r\n', '\n')


def s(o, n):
    global t
    if t.count(o) != 1:
        sys.exit('찾은 수 %d: %s' % (t.count(o), o[:80]))
    t = t.replace(o, n)


s("// 칸 열하나(26.8초): 쌓임 셋(만두 → 탕수육 → 짬뽕 · 지갑 → 동전 → 동전 더미) · 반전(「서비스는 공짜야~!」) · 풀림(납작해진 몽글) · 끝 새 사건(「서비스 더 주세요~!」 → 계산서).",
  "// 칸 열둘(29.4초): 쌓임 셋(만두 → 탕수육 → 짬뽕 · 지갑 → 동전 → 동전 더미) · 반전(「서비스는 공짜야~!」) · 풀림(납작해진 몽글) · 끝 새 사건(「서비스 더 주세요~!」 → 계산서 → 조른 접시만 ₩8,000).\n"
  "// v7(11-27 유호님 「고친 뒤 바꿔」): 끝 반전을 글이 아니라 그림으로 — 칸 10과 11 사이에 계산서를 가까이 잡은 칸(b1)을 넣었다.")
s("  { at: 24.8, to: 26.8, vid: 'a11.mp4', from: 0.6, o: [540, 1150], z: 1.12 }, // 11 가깝게",
  "  { at: 24.8, to: 27.4, vid: 'b1.mp4', from: 0.3, o: [540, 1560], z0: 1.24, z: 1.32 }, // 12 아주 가깝게 · 위에서(위 300px 늘린 띠를 처음부터 화면 밖으로) — 계산서: 공짜 세 접시는 ₩0, 조른 빈 접시 한 줄만 동그라미 친 ₩8,000(사장님 손끝이 두 번 두드림)\n"
  "  { at: 27.4, to: 29.4, vid: 'a11.mp4', from: 0.6, o: [540, 1150], z: 1.12 }, // 11 가깝게")
s("export const FILM = 26.8;", "export const FILM = 29.4;")
s("export type Cell = { at: number; to: number; vid: string; from: number; o: [number, number]; z: number; shake?: boolean };",
  "export type Cell = { at: number; to: number; vid: string; from: number; o: [number, number]; z: number; z0?: number; shake?: boolean };")
s("  [26.4, 'slide.wav', 0.16], // 머리 위 접시가 기욺", "  [29.0, 'slide.wav', 0.16], // 머리 위 접시가 기욺")
s("  [24.9, 'boing.wav', 0.16], // 계산서를 보고 깜짝 튀어 오름", "  [25.4, 'tok.wav', 0.34], // 계산서 칸 — 사장님 손끝이 동그라미 친 값 옆을 두드림(하나)\n  [25.75, 'tok.wav', 0.34], // (둘)\n  [27.5, 'boing.wav', 0.16], // 계산서를 보고 깜짝 튀어 오름")
s("  [25.15, 'freeze.wav', 0.18], // 입이 벌어진 채 굳음", "  [27.75, 'freeze.wav', 0.18], // 입이 벌어진 채 굳음")
s("  { at: 23.3, to: 26.8, ko: ['계산서~'], mean: 'Your bill~ 🧾\\nAsked for it? Not 서비스!', 한문장: true,",
  "  // v7: 반전 줄을 빼고 다음 칸의 계산서 그림으로 보인다 — 말풍선은 칸 10 끝까지\n  { at: 23.3, to: 24.8, ko: ['계산서~'], mean: 'Your bill~ 🧾',")
s("// 배우는 말 칸(칸 7)의 말풍선은 칸 8 끝까지(5.3초 — 제작 절차 lab-learn-pace), 칸 10의 「계산서~」는 칸 11 끝까지 남는다",
  "// 배우는 말 칸(칸 7)의 말풍선은 칸 8 끝까지(5.3초 — 제작 절차 lab-learn-pace), 칸 10의 「계산서~」는 칸 10 끝까지(v7 — 다음 칸 계산서 그림을 가리지 않게)")
open(p, 'w', encoding='utf-8', newline='').write(t.replace('\n', '\r\n') if crlf else t)
print('ok')
