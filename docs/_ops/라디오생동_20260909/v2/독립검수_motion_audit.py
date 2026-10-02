"""Re-run the independently authored encoded-frame audit against v2 only."""
from pathlib import Path

previous = Path(__file__).resolve().parent.parent / '재확인/background_motion_audit.py'
source = previous.read_text(encoding='utf-8')
source = source.replace("추석_자연생동_20260909.mp4", "추석_자연생동_20260909_v2.mp4")
source = source.replace('TIMES = [0, 3, 7, 15, 30, 45, 59 + 29 / 30]', 'TIMES = [0, 3, 5, 7, 15, 30, 45, 59 + 29 / 30]')
source = source.replace("'background_audit_", "'독립검수_")
source = source.replace("['moon_core','cloud_right','tree_top','window_left_1','window_left_2']", "['moon_core','cloud_right','cloud_left','tree_top','window_left_1','window_left_2']")
exec(compile(source, str(__file__), 'exec'))

panel = np.full((620, 1000, 3), 240, np.uint8)
for i, (t, f) in enumerate(zip(TIMES[:4], frames[:4])):
    x, y = (i % 2) * 500, (i // 2) * 310
    panel[y+20:y+310, x:x+500] = f[10:300, 690:1190]
    cv2.putText(panel, f'{t:.3f}s - source size, no enlargement', (x+4,y+15), cv2.FONT_HERSHEY_SIMPLEX,.4,(30,30,30),1,cv2.LINE_AA)
(OUT/'독립검수_moon_cloud_edges.png').write_bytes(cv2.imencode('.png', panel)[1].tobytes())
print('sha256',report['sha256'])
