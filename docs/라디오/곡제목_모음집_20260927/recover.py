import io,zipfile,pathlib,bisect,json
base=pathlib.Path('G:/내 드라이브/PC_공간확보_20260920/추가공간확보_20260921/추가백업정리_20260921/옛작업과_다운로드_20260921')
class Parts(io.RawIOBase):
 def __init__(self,files):
  self.files=files;self.bounds=[0];self.pos=0
  for f in files:self.bounds.append(self.bounds[-1]+f.stat().st_size)
 def seekable(self):return True
 def tell(self):return self.pos
 def seek(self,n,whence=0):
  self.pos=n if whence==0 else self.pos+n if whence==1 else self.bounds[-1]+n
  return self.pos
 def read(self,n=-1):
  if n<0:n=self.bounds[-1]-self.pos
  out=[]
  while n and self.pos<self.bounds[-1]:
   i=bisect.bisect_right(self.bounds,self.pos)-1
   size=min(n,self.bounds[i+1]-self.pos)
   with self.files[i].open('rb') as f:f.seek(self.pos-self.bounds[i]);b=f.read(size)
   out.append(b);self.pos+=len(b);n-=len(b)
  return b''.join(out)
out=pathlib.Path('docs/라디오/곡제목_모음집_20260927')
with zipfile.ZipFile(Parts(sorted(base.glob('*.zip.part*')))) as z:
 names=[x for x in z.namelist() if any(k in x for k in ['Phantom','환한','audio-verification','곡목록','blok9'])]
 print(json.dumps(names,ensure_ascii=False),flush=True)
 for name in names:
  if name.endswith('.wav') or name.endswith('.json') or name.endswith('.txt'):
   p=out/pathlib.Path(name).name
   with z.open(name) as src,p.open('wb') as dst:
    import shutil;shutil.copyfileobj(src,dst)
   print(str(p),flush=True)
