"""독립 CPU 시험: 기존 까몽 장면을 그대로 만들고 프레임/숫자 깊이만 낸다.

호출: blender --background --python tools/까몽깊이시험_blender.py --
      저장소=<repo> 출력=<new-output.png> 표정=본체 너비=1024 비율=1.0 품질=조율 장치=CPU 투명=1
원본 도구/자산은 쓰지 않는다. 카메라 위치·렌즈·몸은 불변, 캔버스 높이만 839→1024.
깊이는 보이는 메시 표면이며 잔털/투명 반사 표면을 포함한 실측 몸 두께가 아니다.
"""
import json
import math
import os
import sys
import time
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding='utf-8')
    except Exception:
        pass

args = dict(a.split('=', 1) for a in sys.argv[sys.argv.index('--') + 1:])
repo = Path(args['저장소']).resolve()
out = Path(args['출력']).resolve()
expected = repo / 'docs' / '_ops' / '삼디문지기' / '깊이시험'
if out.parent != expected or args.get('장치') != 'CPU':
    raise SystemExit('새 깊이시험 폴더와 CPU만 허용한다.')
out.parent.mkdir(parents=True, exist_ok=True)
started = time.time()

# 기존 wrapper의 함수와 정본 부품을 재사용한다. 렌더 진입 직전까지 별도 메모리에서 실행.
wrapper_path = repo / 'tools' / '몽글친구굽기.py'
wrapper = wrapper_path.read_text(encoding='utf-8')
end = "exec(compile(본문, os.path.join(REPO, 'tools', '요소굽기.py'), 'exec'), ns)"
assert wrapper.count(end) == 1
scope = {'__file__': str(wrapper_path), '__name__': '__experiment__'}
exec(compile(wrapper.replace(end, ''), str(wrapper_path), 'exec'), scope)
source = scope['본문']
anchor = 'if 투명 and not 그림자받이:'
assert source.count(anchor) == 1
exec(compile(source.split(anchor)[0], str(repo / 'tools' / '요소굽기.py'), 'exec'), scope['ns'])
scene = bpy.context.scene
scene.cycles.device = 'CPU'
assert not scope['ns']['켠것']
camera = scene.camera
bpy.context.view_layer.update()

def label(obj):
    mats = [m.name for m in obj.data.materials if m] if hasattr(obj.data, 'materials') else []
    return mats[0] if mats else obj.name

objects = [o for o in scene.objects if o.type == 'MESH' and not o.hide_render]
labels = {o.name: i + 1 for i, o in enumerate(objects)}
object_meta = []
for obj in objects:
    projected = [world_to_camera_view(scene, camera, obj.matrix_world @ Vector(c)) for c in obj.bound_box]
    object_meta.append({'id': labels[obj.name], 'object': obj.name, 'part': label(obj),
                        'center_world': list(obj.location),
                        'bbox_uv': [min(p.x for p in projected), min(p.y for p in projected),
                                    max(p.x for p in projected), max(p.y for p in projected)]})

# Camera.view_frame의 꼭짓점 범위에서 픽셀 중심 광선을 만든다.
# Scene.ray_cast는 evaluated mesh 교차점. 입체 좌표를 임의 이미지 워프로 만들지 않는다.
size = 512
frame = camera.data.view_frame(scene=scene)
x0, x1 = min(v.x for v in frame), max(v.x for v in frame)
y0, y1 = min(v.y for v in frame), max(v.y for v in frame)
z = frame[0].z
depth = np.full((size, size), np.nan, dtype=np.float32)
part = np.zeros((size, size), dtype=np.uint16)
origin = camera.matrix_world.translation.copy()
rotation = camera.matrix_world.to_3x3()
forward = rotation @ Vector((0, 0, -1))
deps = bpy.context.evaluated_depsgraph_get()
for row in range(size):
    yy = y1 - (row + .5) / size * (y1 - y0)
    for col in range(size):
        xx = x0 + (col + .5) / size * (x1 - x0)
        direction = (rotation @ Vector((xx, yy, z))).normalized()
        hit, location, normal, index, obj, matrix = scene.ray_cast(deps, origin, direction)
        if hit:
            depth[row, col] = (location - origin).dot(forward)
            part[row, col] = labels.get(obj.name, 0)
    if row % 128 == 0:
        print('depth row', row, flush=True)
assert np.isfinite(depth).any() and np.isnan(depth).any()
np.savez_compressed(out.parent / '모델표면깊이.npz', depth_camera=depth, part_id=part)
metadata = {'createdAt': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
            'blender': bpy.app.version_string, 'device': scene.cycles.device,
            'canvas': [scene.render.resolution_x, scene.render.resolution_y],
            'camera': {'location': list(camera.location), 'rotation': list(camera.rotation_euler),
                       'lens_mm': camera.data.lens, 'sensor_width': camera.data.sensor_width},
            'depth': {'size': size, 'definition': 'camera-axis positive distance, scene world units, mesh only; NaN is no hit',
                      'min': float(np.nanmin(depth)), 'max': float(np.nanmax(depth)),
                      'pixels': int(np.isfinite(depth).sum()), 'includes_hair': False},
            'objects': object_meta,
            'source': [str(wrapper_path.relative_to(repo)), 'tools/요소굽기.py'],
            'changed': 'canvas height only; camera position/lens and geometry unchanged'}
(out.parent / '모델기록.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
print('depth export done', round(time.time() - started, 2), flush=True)
scene.render.filepath = str(out)
bpy.ops.render.render(write_still=True)
metadata['duration_seconds'] = round(time.time() - started, 3)
metadata['render_finished'] = time.strftime('%Y-%m-%dT%H:%M:%S%z')
(out.parent / '모델기록.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
print('DONE', metadata['duration_seconds'], flush=True)
