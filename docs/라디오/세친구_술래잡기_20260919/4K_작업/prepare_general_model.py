"""Convert official Real-ESRGAN general-x4v3 weights for the local Vulkan runner."""
from pathlib import Path
import importlib.util
import re
import subprocess
import torch

root = Path('C:/Users/q1212/.cache/synk-media/realesrgan-general')
source = (root / 'srvgg_arch_official.py').read_text(encoding='utf-8')
source = source.replace('from basicsr.utils.registry import ARCH_REGISTRY\n', '')
source = source.replace('@ARCH_REGISTRY.register()\n', '')
module_file = root / 'srvgg_arch_standalone.py'
module_file.write_text(source, encoding='utf-8')
spec = importlib.util.spec_from_file_location('srvgg_standalone', module_file)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
model = module.SRVGGNetCompact(num_conv=32).eval()
checkpoint = torch.load(root / 'realesr-general-x4v3.pth', map_location='cpu', weights_only=True)
model.load_state_dict(checkpoint.get('params_ema', checkpoint.get('params')))
torch.set_num_threads(4)
with torch.no_grad():
    traced = torch.jit.trace(model, torch.rand(1, 3, 64, 64))
    traced.save(str(root / 'general.pt'))
subprocess.run([
    'C:/Users/q1212/.cache/synk-media/pnnx-python/pnnx/pnnx.exe',
    str(root / 'general.pt'), 'inputshape=[1,3,64,64]',
    'inputshape2=[1,3,96,96]', 'fp16=1'
], cwd=root, check=True)
param = (root / 'general.ncnn.param').read_text()
param = re.sub(r'\bin0\b', 'data', param)
param = re.sub(r'\bout0\b', 'output', param)
(root / 'realesrgan-x4plus.param').write_text(param)
(root / 'realesrgan-x4plus.bin').write_bytes((root / 'general.ncnn.bin').read_bytes())
(root / 'models').mkdir(exist_ok=True)
(root / 'models' / 'realesrgan-x4plus.param').write_text(param)
(root / 'models' / 'realesrgan-x4plus.bin').write_bytes((root / 'general.ncnn.bin').read_bytes())
print('Converted official general-x4v3. Runner compatibility alias: realesrgan-x4plus.')
