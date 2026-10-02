from pathlib import Path
import json
import sys
from gradio_client import Client
if hasattr(sys.stdout,'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
base=Path(__file__).resolve().parent
for space in sys.argv[1:]:
    try:
        client=Client(space, verbose=False, download_files=str(base/'실험'/'hf-downloads'))
        api=client.view_api(return_format='dict', print_info=False)
        (base/'조사'/(space.replace('/','-')+'-api.json')).write_text(json.dumps(api,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({'space':space,'endpoints':{k:[{'name':p['parameter_name'],'default':p.get('parameter_default'),'type':p.get('python_type')} for p in v['parameters']] for k,v in api.get('named_endpoints',{}).items()}},ensure_ascii=False),flush=True)
    except Exception as e:
        print(json.dumps({'space':space,'error':str(e)},ensure_ascii=False),flush=True)
