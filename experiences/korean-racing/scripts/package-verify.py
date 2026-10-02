"""Byte-check the declared three-game build and write the 2026-10-02 handoff ZIP."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import hashlib
import json
import re
import sys
import zipfile

root=Path(__file__).resolve().parents[1]
package=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root/'site-package'
zip_path=Path(sys.argv[2]).resolve() if len(sys.argv)>2 else root/'SYNK-LAB-PLAY-시안-20261002.zip'
build_file=package/'build-manifest.json'
build=json.loads(build_file.read_text(encoding='utf-8'))
assert build.get('version')==1, 'Run build-site.mjs to produce the current declared build.'
assert {(g['id'],g['prefix']) for g in build['games']}=={
    ('korean-racing',''),('korean-rhythm','play/rhythm'),('korean-runner','play/runner')}

def digest(data):
    return hashlib.sha256(data).hexdigest()

def inside(base, relative):
    target=(base/relative).resolve()
    assert target.is_relative_to(base.resolve()), relative
    return target

records=[]
paths=set()
for entry in build['files']:
    relative=entry['path']
    assert relative not in paths, ('duplicate path',relative)
    paths.add(relative)
    if relative.startswith('play/rhythm/'):
        expected='korean-rhythm/'+relative.removeprefix('play/rhythm/')
    elif relative.startswith('play/runner/'):
        expected='korean-runner/'+relative.removeprefix('play/runner/')
    else:
        expected='korean-racing/'+relative
    assert entry['source']==expected, ('wrong source game',relative)
    assert not set(Path(relative).parts)&{'audio-source','qa','tests','node_modules','site-package','__pycache__'},relative
    assert not relative.endswith(('.wav','.zip','.pyc')),relative
    file=inside(package,relative)
    data=file.read_bytes()
    assert data==inside(root.parent,expected).read_bytes(), ('source/package mismatch',relative)
    assert len(data)==entry['bytes'] and digest(data)==entry['sha256'], ('stale build',relative)
    records.append({'path':relative,'source':expected,'bytes':len(data),'sha256':digest(data)})

# Include the provenance file itself, and exclude any undeclared old/user files
# without deleting them from the destination directory.
build_bytes=build_file.read_bytes()
records.append({'path':'build-manifest.json','generated':True,'bytes':len(build_bytes),'sha256':digest(build_bytes)})
paths.add('build-manifest.json')
excluded=sorted(p.relative_to(package).as_posix() for p in package.rglob('*') if p.is_file() and p.relative_to(package).as_posix() not in paths)

def js_tokens(source):
    """Ignore comments and string contents so classic bundles cannot invent imports."""
    i=0
    while i<len(source):
        c=source[i]
        if c.isspace():
            i+=1;continue
        if source.startswith('//',i):
            end=source.find('\n',i+2);i=len(source) if end<0 else end+1;continue
        if source.startswith('/*',i):
            end=source.find('*/',i+2);assert end>=0,'unterminated JavaScript comment';i=end+2;continue
        if c in "'\"`":
            quote=c;i+=1;text=[]
            while i<len(source):
                c=source[i]
                if c=='\\':
                    if i+1<len(source):text.append(source[i+1]);i+=2;continue
                if c==quote:
                    i+=1;break
                text.append(c);i+=1
            yield ('template' if quote=='`' else 'string',''.join(text));continue
        if c.isalpha() or c in '_$':
            start=i;i+=1
            while i<len(source) and (source[i].isalnum() or source[i] in '_$'):i+=1
            yield ('word',source[start:i]);continue
        yield ('punctuation',c);i+=1

def module_imports(source):
    tokens=list(js_tokens(source))
    for i,(kind,value) in enumerate(tokens):
        if kind!='word' or value not in {'import','export'}:continue
        if i>0 and tokens[i-1]==('punctuation','.'):continue
        rest=tokens[i+1:]
        if not rest:continue
        if value=='import' and rest[0][0]=='string':
            yield rest[0][1];continue
        if value=='import' and rest[0][1]=='(':
            if len(rest)>2 and rest[1][0]=='string' and rest[2][1]==')':yield rest[1][1]
            continue
        if rest[0][1]=='.' or value=='export' and rest[0][1] not in {'{','*'}:continue
        for j,token in enumerate(rest):
            if token[1]==';' or token==('word','import'):break
            if token==('word','from') and j+1<len(rest) and rest[j+1][0]=='string':
                yield rest[j+1][1];break

def resolve_local(file,name):
    parsed=urlsplit(name)
    if parsed.scheme or parsed.netloc or name.startswith(('#','data:')):return None
    target_path=unquote(parsed.path)
    if not target_path:return file
    target=inside(package,target_path.lstrip('/')) if target_path.startswith('/') else inside(package,file.parent.relative_to(package)/target_path)
    return target/'index.html' if target_path.endswith('/') or target.is_dir() else target

def require_declared(file,name):
    target=resolve_local(file,name)
    if target is None:return
    assert target.is_file(), ('missing local dependency',file.relative_to(package).as_posix(),name)
    assert target.relative_to(package).as_posix() in paths, ('undeclared dependency',name)

imports_checked=0
for relative in sorted(paths):
    file=package/relative
    if file.suffix not in {'.js','.mjs'}:continue
    for name in module_imports(file.read_text(encoding='utf-8')):
        if name.startswith(('.', '/')):
            require_declared(file,name);imports_checked+=1
        elif name=='three':
            prefix='play/runner/' if relative.startswith('play/runner/') else 'play/rhythm/' if relative.startswith('play/rhythm/') else ''
            assert prefix+'vendor/three.module.js' in paths, ('missing three import map target',relative)
            imports_checked+=1
        elif not urlsplit(name).scheme:
            raise AssertionError(('unresolved bare module import',relative,name))

class Links(HTMLParser):
    def __init__(self):
        super().__init__();self.links=[]
    def handle_starttag(self,tag,attrs):
        for key,value in attrs:
            if key in {'src','href'} and value:self.links.append((tag,key,value))

links_checked=0
for relative in sorted(paths):
    file=package/relative
    if file.suffix!='.html':continue
    html=Links();html.feed(file.read_text(encoding='utf-8'))
    for tag,attribute,name in html.links:
        # Existing individual games retain their public navigation link; their
        # collection adapter replaces it with the correct local shared path.
        if attribute=='href' and name.startswith('/try/'):continue
        if resolve_local(file,name) is not None:
            require_declared(file,name);links_checked+=1

for relative in sorted(paths):
    file=package/relative
    if file.suffix=='.css':
        for name in re.findall(r'''url\(\s*["']?([^"')]+)["']?\s*\)''',file.read_text(encoding='utf-8')):
            require_declared(file,name.strip())

with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED,compresslevel=7) as archive:
    for relative in sorted(paths):archive.write(package/relative,relative)
with zipfile.ZipFile(zip_path) as archive:
    assert archive.testzip() is None, 'ZIP CRC failed'
    assert set(archive.namelist())==paths
    for relative in paths:assert archive.read(relative)==(package/relative).read_bytes(),relative

manifest={'verifiedFiles':len(records),'games':build['games'],'importsChecked':imports_checked,'htmlLinksChecked':links_checked,
          'excludedUndeclaredFiles':excluded,'files':records,
          'zip':{'path':zip_path.name,'bytes':zip_path.stat().st_size,'sha256':digest(zip_path.read_bytes())}}
(root/'qa/package-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'verifiedFiles':manifest['verifiedFiles'],'importsChecked':imports_checked,'htmlLinksChecked':links_checked,
                  'excludedUndeclaredFiles':len(excluded),'zipBytes':manifest['zip']['bytes'],'sha256':manifest['zip']['sha256']}))
