# 검수 묶음에 넣을 화면 30장 안쪽을 흐름 시험 결과에서 고른다(도구의 --캡처 꼴: 후/<기기>/<이름>.png). 새 흐름이라 「전」은 없다.
#   python -X utf8 experiences/seoul-arrival/qa/캡처묶음.py <출력 폴더>
import pathlib,shutil,sys,glob,os
OUT=pathlib.Path(sys.argv[1]);Q=pathlib.Path('.tmp/seoul-qa')
PICK={
 ('390-ko-idol','390-한국어'):['01-','02-','03-','04-','06-','09-','10-','11-','13-','14-','17-드라마','18-','19-','20-','21-','23-','25-','27-'],
 ('360-mn-idol','360-몽골어'):['05a-','05b-','05c-메일','05c-쪽지','05d-','06-','09-','14-'],
 ('320-en-idol','320-영어'):['08-','13-','14-'],
 ('1440-ko-actor','1440-한국어'):['01-','05-','13-','14-'],
}
n=0
for (src,dev),names in PICK.items():
    d=OUT/'후'/dev;d.mkdir(parents=True,exist_ok=True)
    for pre in names:
        hit=sorted(glob.glob(str(Q/src/(pre+'*.png'))))
        if not hit:print('없음',src,pre);continue
        f=hit[-1];shutil.copy(f,d/os.path.basename(f));n+=1
print('장',n,OUT)
