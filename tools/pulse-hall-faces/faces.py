# 쇼릴 모든 프레임에서 얼굴 상자(YuNet)를 찾아 JSON으로: python -X utf8 tools/pulse-hall-faces/faces.py <mp4> data/faces-<wide|tall>-<판>.json
import cv2, json, sys, os
src, out = sys.argv[1], sys.argv[2]
model = os.path.join(os.path.expanduser('~'), '.rembg', 'models', 'yunet', 'face_detection_yunet_2023mar.onnx')
cap = cv2.VideoCapture(src)
fps = cap.get(cv2.CAP_PROP_FPS)
W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
# 작은 얼굴(수영장 튜브 · 해변)도 잡게 원본 크기 그대로, 문턱은 낮게
fd = cv2.FaceDetectorYN.create(model, '', (W, H), 0.5, 0.3, 5000)
frames = []
i = 0
while True:
    ok, img = cap.read()
    if not ok: break
    _, faces = fd.detect(img)
    rows = []
    if faces is not None:
        for f in faces:
            x, y, w, h = [float(v) for v in f[:4]]
            lm = [float(v) for v in f[4:14]]
            rows.append({'x': x, 'y': y, 'w': w, 'h': h, 'score': float(f[14]), 'mouth': [lm[6], lm[7], lm[8], lm[9]], 'eyes': [lm[0], lm[1], lm[2], lm[3]]})
    frames.append({'i': i, 't': round(i / fps, 4), 'faces': rows})
    i += 1
json.dump({'fps': fps, 'w': W, 'h': H, 'frames': frames}, open(out, 'w'), ensure_ascii=False)
n = sum(1 for f in frames if f['faces'])
print('frames', i, 'with faces', n)
