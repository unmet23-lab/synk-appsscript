#!/usr/bin/env python3
"""
「제2의 나」 사진 — 얼굴 점수 일꾼 (2026-11-04, docs/제2의나_사진아바타_일괄처리_설계_20261103.md 3 · 8절).

talk 함수 안에서는 얼굴 모델을 못 돌린다(CPU 2초 · 메모리 256MB · 묶음 20MB, SFace 37MB). 그래서 회사 서버가 1분마다 talk에 물어
점수를 맡을 일감이 있으면 읽기 주소(5분)로 그림을 받아 메모리에서만 재고 점수만 돌려준다. 안으로 들어오는 문을 새로 열지 않는다(방화벽 · HTTPS 경로 변경 없음).
- 그림 · 얼굴 특징(SFace 벡터) · 주소를 디스크 · 기록에 남기지 않는다. 기록은 일감 수 · 걸린 시간 · 예외 이름뿐이다.
- 할 일이 없으면 모델을 올리지 않고 끝난다(cv2를 읽지도 않음) — 메모리를 쓰는 때는 일감이 있을 때뿐이다.
- 숫자는 전처리에 묶여 있다(긴 변 1200 · 얼굴 점수 0.7 · 얼굴 너비 6% · alignCrop) — experiences/drama/qa/제2의나-20261102/일괄처리/출고검사.py와 같은 값이다.
  황금 세트 시험: `worker.py --황금 <황금.json>`(그림은 git 밖, 기대 점수와 ±0.01).

    ME2_WORKER_ENDPOINT=https://<ref>.supabase.co/functions/v1/me2-photo ME2_FACE_WORKER_KEY=… ME2_MODEL_DIR=… worker.py
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

VERSION = "me2-face-1"
MAX_IMAGE = 8 * 1024 * 1024
MAX_PIXELS = 40_000_000  # 8MiB 안에도 3만×3만 단색 그림이 든다 — 풀기 전에 머리표로 거른다(MemoryMax 1200M)
UA = "synk-me2-face/1"
LONG_EDGE = 1200
FACE_SCORE = 0.7
FACE_WIDTH = 0.06


def env(name, fallback=None):
    value = os.environ.get(name, fallback)
    if value is None or value == "":
        raise SystemExit(f"{name} 없음")
    return value


def post(step, body):
    request = urllib.request.Request(f"{env('ME2_WORKER_ENDPOINT')}?worker={step}", data=json.dumps(body).encode(), method="POST",
                                     headers={"Content-Type": "application/json", "x-me2-worker-key": env("ME2_FACE_WORKER_KEY"), "User-Agent": UA,
                                              "x-region": "ap-southeast-1"})  # DB가 있는 곳에서 돌게 한다 — 서울에서 부르면 질의마다 싱가포르를 오간다(현장 노트 배포_공개)
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.loads(response.read(2_000_000))


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=45) as response:
        data = response.read(MAX_IMAGE + 1)
    if len(data) > MAX_IMAGE:
        raise ValueError("too_large")
    return data


def image_size(data):
    """JPEG · PNG 머리표의 가로 · 세로. 다른 꼴이거나 못 읽으면 None(풀지 않는다)."""
    if data[:8] == b"\x89PNG\r\n\x1a\n" and len(data) >= 24:
        return int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")
    if data[:2] != b"\xff\xd8":
        return None
    i, n = 2, len(data)
    while i + 9 < n:
        if data[i] != 0xFF:
            return None
        mark = data[i + 1]
        if mark == 0xFF:  # 채움 바이트
            i += 1
            continue
        if 0xC0 <= mark <= 0xCF and mark not in (0xC4, 0xC8, 0xCC):
            return int.from_bytes(data[i + 7:i + 9], "big"), int.from_bytes(data[i + 5:i + 7], "big")
        i += 2 + int.from_bytes(data[i + 2:i + 4], "big")
    return None


class Faces:
    """YuNet + SFace — 출고검사.py와 같은 모델 · 같은 줄임 · 같은 거르기."""

    def __init__(self, model_dir):
        import cv2  # 할 일이 있을 때만 읽는다
        import numpy as np
        self.cv2, self.np = cv2, np
        self.fd = cv2.FaceDetectorYN.create(os.path.join(model_dir, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
        self.fr = cv2.FaceRecognizerSF.create(os.path.join(model_dir, "face_recognition_sface_2021dec.onnx"), "")

    def open(self, data):
        cv2, np = self.cv2, self.np
        size = image_size(data)
        if size is None or size[0] * size[1] > MAX_PIXELS:
            return None, [], 1.0
        image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            return None, [], 1.0
        h, w = image.shape[:2]
        scale = min(1.0, LONG_EDGE / max(h, w))
        small = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA) if scale < 1 else image
        self.fd.setInputSize((small.shape[1], small.shape[0]))
        _, found = self.fd.detect(small)
        found = [] if found is None else [f for f in found if f[14] >= FACE_SCORE and f[2] >= FACE_WIDTH * small.shape[1]]
        return small, sorted(found, key=lambda f: -f[2]), scale

    def feature(self, small, face):
        return self.fr.feature(self.fr.alignCrop(small, face))

    def like(self, a, b):
        return round(float(self.fr.match(a, b, self.cv2.FaceRecognizerSF_FR_COSINE)), 3)

    def one(self, data, box=None):
        """가장 큰 얼굴, 또는 상자(「누가 나예요?」로 고른 얼굴)에 가운데가 가장 가까운 얼굴. 못 찾으면 None."""
        small, found, scale = self.open(data)
        if not found:
            return None
        if box is None:
            return self.feature(small, found[0])
        cx, cy = (box[0] + box[2] / 2) * scale, (box[1] + box[3] / 2) * scale
        face = min(found, key=lambda f: (f[0] + f[2] / 2 - cx) ** 2 + (f[1] + f[3] / 2 - cy) ** 2)
        return self.feature(small, face)

    def two(self, data):
        """왼쪽 · 오른쪽 두 얼굴(큰 것 둘을 x로 줄 세움). 둘이 안 되면 None."""
        small, found, _ = self.open(data)
        pair = sorted(found[:2], key=lambda f: f[0])
        if len(pair) != 2:
            return None
        return self.feature(small, pair[0]), self.feature(small, pair[1])


def score_base(faces, task):
    """기준 — 판마다 올린 사진과. 올린 사진에서 얼굴을 못 찾으면(「그래도 이 사진으로」) 숫자 없이 끝낸다 — 「이게 나?」로만 본다."""
    reference = faces.one(fetch(task["reference_url"]), task.get("face_box"))
    scores, features = {}, []
    for line in task["candidates"]:
        if reference is None:
            scores[line["variant"]] = None
            continue
        feature = faces.one(fetch(line["url"]))
        scores[line["variant"]] = None if feature is None else faces.like(feature, reference)
        if feature is not None:
            features.append(feature)
    # 세 판끼리 서로 닮은 정도의 가장 낮은 값 — 올린 사진과 낮은데 이 값이 높으면 자가 믿을 수 없는 것이다(어두운 피부 · 어두운 빛, 설계 3절).
    if len(features) >= 2:
        scores["agree"] = min(faces.like(features[i], features[j]) for i in range(len(features)) for j in range(i + 1, len(features)))
    return scores


def score_scene(faces, task):
    """추억 사진 — 태오는 판의 오른쪽 얼굴과 견주고, 두 얼굴을 바꿔 맞춰 태오 점수가 높은 쪽을 태오로 본다(판마다 학생 자리를 못 박지 않는다).
    기준 · 판을 못 읽으면 None(숫자 없음), 구운 판에 두 얼굴이 없으면 0(저절로 다시 굽기)."""
    reference = faces.one(fetch(task["reference_url"]))
    plate = faces.two(fetch(task["plate_url"]))
    if reference is None or plate is None:
        return {"student": None, "taeo": None}
    pair = faces.two(fetch(task["candidates"][0]["url"]))
    if pair is None:
        return {"student": 0.0, "taeo": 0.0}
    left, right = pair
    taeo_right, taeo_left = faces.like(plate[1], right), faces.like(plate[1], left)
    if taeo_right >= taeo_left:
        return {"student": faces.like(reference, left), "taeo": taeo_right}
    return {"student": faces.like(reference, right), "taeo": taeo_left}


def score_look(faces, task):
    reference = faces.one(fetch(task["reference_url"]))
    if reference is None:
        return {"score": None}
    feature = faces.one(fetch(task["candidates"][0]["url"]))
    return {"score": 0.0 if feature is None else faces.like(feature, reference)}


SCORERS = {"base": score_base, "scene": score_scene, "look": score_look}


def run_once(model_dir):
    done = failed = 0
    started = time.time()
    faces = None
    while time.time() - started < 240:
        tasks = post("claim", {"limit": 4, "version": VERSION}).get("tasks") or []
        if not tasks:
            break
        if faces is None:
            faces = Faces(model_dir)
        for task in tasks:
            try:  # 점수든 돌려주기든 한 일감의 실패가 나머지를 멈추지 않는다 — 못 돌려준 일감은 임대가 끝나면 다시 온다
                scores = SCORERS[task["kind"]](faces, task)
                post("report", {"job_id": task["job_id"], "attempt_id": task["attempt_id"], "scores": scores})
                done += 1
            except Exception as error:  # 그림 · 주소가 든 메시지를 찍지 않는다 — 이름만
                print(f"[me2-face] 일감 실패: {type(error).__name__}", file=sys.stderr)
                failed += 1
    if done or failed:
        print(f"[me2-face] 점수 {done} · 실패 {failed} · {round(time.time() - started)}초")
    return 1 if failed and not done else 0


def golden(path, model_dir):
    """황금 세트 — 전처리가 바뀌면 같은 숫자가 다른 뜻이 된다(설계 3절). {"뿌리": 폴더, "줄": [{"kind","reference","candidate","plate"?,"expect":{…}}]}, 기대 점수와 ±0.01."""
    with open(path, encoding="utf8") as file:
        spec = json.load(file)
    faces = Faces(model_dir)
    root = os.path.join(os.path.dirname(os.path.abspath(path)), spec.get("뿌리") or ".")
    read = lambda name: open(os.path.join(root, name), "rb").read()
    bad = 0
    for row in spec["줄"]:
        reference = faces.one(read(row["reference"]))
        if row["kind"] == "scene":
            plate = faces.two(read(row["plate"]))
            left, right = faces.two(read(row["candidate"]))
            tr, tl = faces.like(plate[1], right), faces.like(plate[1], left)
            got = {"student": faces.like(reference, left), "taeo": tr} if tr >= tl else {"student": faces.like(reference, right), "taeo": tl}
        else:
            got = {"score": faces.like(faces.one(read(row["candidate"])), reference)}
        for key, want in row["expect"].items():
            if abs(got[key] - want) > 0.01:
                bad += 1
                print(f"어긋남 {row['candidate']} {key}: 기대 {want} · 지금 {got[key]}")
    print(f"[황금] {len(spec['줄'])}줄 · 어긋남 {bad}")
    return 1 if bad else 0


if __name__ == "__main__":
    model_dir = os.environ.get("ME2_MODEL_DIR") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
    if len(sys.argv) >= 3 and sys.argv[1] == "--황금":
        sys.exit(golden(sys.argv[2], model_dir))
    try:
        sys.exit(run_once(model_dir))
    except urllib.error.HTTPError as error:
        print(f"[me2-face] talk 응답 {error.code}", file=sys.stderr)
        sys.exit(2)
    except urllib.error.URLError as error:
        print(f"[me2-face] 연결 실패 {type(error.reason).__name__}", file=sys.stderr)
        sys.exit(2)
