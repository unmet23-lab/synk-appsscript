# 한 테이크 판의 구도 · 깜빡임 · 움직임을 재는 도구(2026-10-31). 쓰는 법: python 구도깜빡임재기.py <영상> [--시작 <시작 그림>] [--구간 0.45-4.37 ...] [--시트 <나갈.png>]
# 구도: 프레임마다 YuNet 얼굴 너비 ÷ 화면 너비. 시작 그림과 첫 화면을 견준다(앞 판은 28% → 60%).
# 깜빡임: 두 눈 자리 잘라 낸 조각의 어두운 화소 비율을 얼굴 크기로 맞춰 재고, 자기 중앙값보다 내려간 2~10프레임 골을 센다.
#   눈을 감으면 눈동자 · 속눈썹의 어두운 덩어리가 위아래로 줄어든다. 웃어서 가늘어지는 것은 천천히 변하므로 긴 창 중앙값을 빼서 걸러 낸다.
#   후보 수는 어림이다 — 앞머리 · 고개 때문에 빠지거나 더 잡힌다(10-31 한 테이크 3판: 후보 7 ↔ 눈으로 9). 횟수는 --시트의 눈 띠(시각이 찍힌 눈 자리 조각, 3프레임마다)로 센다.
# 움직임: 가장자리 띠(가운데 60%×60%를 뺀 곳)의 프레임 차 — 카메라 · 뒤 학생이 살아 있는지. 끝 2초가 앞보다 크게 줄면 끝 그림에 굳은 것이다.
import argparse, os, sys
from collections import Counter
import cv2, numpy as np

sys.stdout.reconfigure(encoding='utf-8')
MODEL = os.path.join(os.environ['USERPROFILE'], '.rembg', 'models', 'yunet', 'face_detection_yunet_2023mar.onnx')


def 얼굴(fd, 그림):
    h, w = 그림.shape[:2]
    fd.setInputSize((w, h))
    _, 찾음 = fd.detect(그림)
    if 찾음 is None or not len(찾음):
        return None
    return max(찾음, key=lambda f: f[2] * f[3])


def 눈조각(회색, 점, 얼굴폭):
    # 눈 자리 둘레를 얼굴 폭의 0.26 × 0.15로 잘라 같은 크기로 맞춘다
    반w, 반h = 얼굴폭 * 0.13, 얼굴폭 * 0.075
    x, y = 점
    a, b = int(max(0, y - 반h)), int(min(회색.shape[0], y + 반h))
    c, d = int(max(0, x - 반w)), int(min(회색.shape[1], x + 반w))
    if b - a < 4 or d - c < 4:
        return None
    return cv2.resize(회색[a:b, c:d], (64, 36), interpolation=cv2.INTER_AREA)


def 어두운비율(조각):
    # 조각의 위 절반은 앞머리 그늘이 섞여 눈꺼풀 아래쪽 2/3만 본다
    아래 = 조각[10:, :]
    기준 = np.percentile(조각, 75)
    return float((아래 < 기준 * 0.55).mean())


def main():
    p = argparse.ArgumentParser()
    p.add_argument('영상')
    p.add_argument('--시작')
    p.add_argument('--구간', nargs='*', default=[])
    p.add_argument('--시트')
    a = p.parse_args()

    모델 = cv2.FaceDetectorYN.create(MODEL, '', (320, 320), 0.55, 0.3, 50)
    if a.시작:
        그림 = cv2.imdecode(np.fromfile(a.시작, np.uint8), cv2.IMREAD_COLOR)
        f = 얼굴(모델, 그림)
        print(f"시작 그림 얼굴 너비 {f[2] / 그림.shape[1] * 100:.1f}%" if f is not None else '시작 그림 얼굴 못 찾음')

    cap = cv2.VideoCapture(a.영상)
    fps = cap.get(cv2.CAP_PROP_FPS) or 24
    폭들, 눈값, 띠차, 온차, 눈칸 = [], [], [], [], []
    앞띠 = None
    while True:
        ok, 화면 = cap.read()
        if not ok:
            break
        h, w = 화면.shape[:2]
        회색 = cv2.cvtColor(화면, cv2.COLOR_BGR2GRAY).astype(np.float32)
        띠틀 = np.ones((h, w), bool)
        띠틀[int(h * .2):int(h * .8), int(w * .2):int(w * .8)] = False
        if 앞띠 is not None:
            띠차.append(float(np.abs(회색 - 앞띠)[띠틀].mean()))
            온차.append(float(np.abs(회색 - 앞띠).mean()))
        앞띠 = 회색
        f = 얼굴(모델, 화면)
        if f is None:
            폭들.append(np.nan)
            눈값.append(np.nan)
            continue
        폭 = float(f[2])
        폭들.append(폭 / w)
        if a.시트 and len(폭들) % 3 == 1:
            ex, ey = (f[4] + f[6]) / 2, (f[5] + f[7]) / 2
            칸 = cv2.resize(화면[max(0, int(ey - 폭 * .26)):int(ey + 폭 * .26), max(0, int(ex - 폭 * .62)):int(ex + 폭 * .62)], (216, 92), interpolation=cv2.INTER_CUBIC)
            cv2.putText(칸, f'{(len(폭들) - 1) / fps:.2f}', (4, 14), cv2.FONT_HERSHEY_SIMPLEX, .42, (0, 255, 255), 1, cv2.LINE_AA)
            눈칸.append(칸)
        회8 = cv2.cvtColor(화면, cv2.COLOR_BGR2GRAY)
        값 = []
        for i in (4, 6):
            조각 = 눈조각(회8, (f[i], f[i + 1]), 폭)
            if 조각 is not None:
                값.append(어두운비율(조각))
        눈값.append(float(np.mean(값)) if 값 else np.nan)
    cap.release()

    폭들 = np.array(폭들)
    눈값 = np.array(눈값)
    n = len(눈값)
    print(f"프레임 {n} · {n / fps:.2f}초 · {fps:.0f}fps · 얼굴 못 찾은 프레임 {int(np.isnan(폭들).sum())}")
    print(f"얼굴 너비: 첫 화면 {폭들[0] * 100:.1f}% · 끝 화면 {폭들[-1] * 100:.1f}% · 가운데값 {np.nanmedian(폭들) * 100:.1f}% · 최소 {np.nanmin(폭들) * 100:.1f}% · 최대 {np.nanmax(폭들) * 100:.1f}%")

    # 긴 창(1.5초) 중앙값을 빼서 웃음으로 눈이 가늘어지는 느린 변화를 걷어 낸다
    값 = np.where(np.isnan(눈값), np.nanmedian(눈값), 눈값)
    창 = int(fps * 1.5) | 1
    바닥 = np.array([np.median(값[max(0, i - 창 // 2):i + 창 // 2 + 1]) for i in range(n)])
    차 = (값 - 바닥) / max(바닥.mean(), 1e-3)
    문턱 = -0.28
    골 = []
    i = 0
    while i < n:
        if 차[i] < 문턱:
            j = i
            while j + 1 < n and 차[j + 1] < 문턱:
                j += 1
            길이 = j - i + 1
            if 2 <= 길이 <= 10:
                k = i + int(np.argmin(차[i:j + 1]))
                골.append((k, 길이, float(차[k])))
            i = j + 1
        else:
            i += 1
    print(f"깜빡임 후보 {len(골)}번: " + (' · '.join(f"{k / fps:.2f}초({l}프레임, {d * 100:.0f}%)" for k, l, d in 골) or '없음'))

    구간들 = [tuple(float(x) for x in s.split('-')) for s in a.구간]
    for s, e in 구간들:
        c = sum(1 for k, _, _ in 골 if s <= k / fps <= e)
        print(f"  {s:.2f}~{e:.2f}초 안 깜빡임 후보 {c}번")

    띠 = np.array(띠차)
    끝 = 띠[-int(fps * 2):]
    앞 = 띠[:-int(fps * 2)]
    print(f"가장자리 움직임(프레임 차): 전체 {띠.mean():.2f} · 끝 2초 {끝.mean():.2f} · 그 앞 {앞.mean():.2f} · 끝/앞 {끝.mean() / max(앞.mean(), 1e-3):.2f}")

    # 붙들린 프레임: 앞뒤 프레임 차의 0.4배 아래인 장. 간격으로 꼴을 가른다 — 1초마다(24) 끼는 복제(현장노트 higgsfield)와 4프레임마다 붙드는 3:4 꼴(10-31 한 테이크 3판 49장).
    # 값 하나로 자르면(차 1.0 아래) 붙들린 장의 차가 움직임 크기를 따라가 놓친다(10-31 Fable).
    온 = np.array(온차)
    붙들림 = [i + 1 for i in range(1, len(온) - 1) if 온[i] < 0.4 * min(온[i - 1], 온[i + 1])]
    print(f"붙들린 프레임 {len(붙들림)}장 · 간격(프레임, 번) {Counter(np.diff(붙들림).tolist()).most_common(4)}")

    if a.시트 and 눈칸:
        행 = [np.hstack(눈칸[i:i + 8] + [np.zeros_like(눈칸[0])] * (8 - len(눈칸[i:i + 8]))) for i in range(0, len(눈칸), 8)]
        ok, 버퍼 = cv2.imencode('.png', np.vstack(행))
        버퍼.tofile(a.시트)
        print('시트', a.시트)


if __name__ == '__main__':
    main()
