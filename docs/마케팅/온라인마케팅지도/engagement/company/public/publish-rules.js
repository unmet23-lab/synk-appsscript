'use strict';
const publishRules=(()=>{
  const presets=[
    {id:'vertical',label:'세로 콘텐츠 · 9:16',detail:'SYNK 제작 권장값 · 1080 × 1920',ratio:9/16,width:1080,height:1920},
    {id:'portrait',label:'피드 카드 · 4:5',detail:'SYNK 제작 권장값 · 1080 × 1350',ratio:4/5,width:1080,height:1350},
    {id:'square',label:'정사각 카드 · 1:1',detail:'SYNK 제작 권장값 · 1080 × 1080',ratio:1,width:1080,height:1080},
    {id:'youtube-shorts',label:'YouTube Shorts',detail:'공식 분류 조건 · 정사각/세로 영상, 3분 이내',url:'https://support.google.com/youtube/answer/15424877?hl=en-GB',checkedAt:'2026-10-02'},
    {id:'tiktok-ad',label:'TikTok Non-Spark 광고',detail:'공식 규격 · 9:16 권장, 최대 10분 · 500 MB',url:'https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads',checkedAt:'2026-10-02'}
  ];
  const close=(a,b)=>Math.abs(a-b)<=.005;
  function analyze(media,presetId){
    const preset=presets.find(row=>row.id===presetId);if(!preset)throw new Error('점검 형식을 골라 주세요.');
    const rows=[],add=(label,status,detail)=>rows.push({label,status,detail});
    if(!media){add('파일 규격','unknown','파일을 고르면 크기와 재생 시간을 읽어요.');return rows;}
    const ratio=media.width/media.height;
    if(preset.ratio){add('화면 비율',close(ratio,preset.ratio)?'match':'review',`${media.width} × ${media.height} · 권장 ${preset.width} × ${preset.height}`);add('해상도',media.width>=preset.width&&media.height>=preset.height?'match':'review','권장값보다 작으면 실제 게시 크기로 열어 선명한지 봐요.');}
    else{
      add('영상 파일',media.kind==='video'?'match':'review',media.kind==='video'?'브라우저에서 영상 정보를 읽었어요.':'고른 형식은 영상용이에요.');
      if(presetId==='youtube-shorts'){
        add('화면 비율',ratio<=1?'match':'review','YouTube Shorts는 정사각이나 세로 영상이에요.');
        add('재생 시간',media.kind!=='video'?'unknown':media.duration<=180?'match':'review',media.kind==='video'?`${media.duration.toFixed(2)}초 · 180초 이내`:'재생 시간은 영상 파일에만 있어요.');
      }else{
        const sizeOK=(close(ratio,9/16)&&media.width>=540&&media.height>=960)||(close(ratio,16/9)&&media.width>=960&&media.height>=540)||(close(ratio,1)&&media.width>=640&&media.height>=640);
        add('화면 비율·최소 해상도',sizeOK?'match':'review','세로 540×960, 가로 960×540, 정사각 640×640 이상 · 9:16 권장');
        add('재생 시간',media.kind!=='video'?'unknown':media.duration<=600?'match':'review',media.kind==='video'?`${media.duration.toFixed(2)}초 · 600초 이내`:'재생 시간은 영상 파일에만 있어요.');
        add('파일 용량',media.bytes<=500000000?'match':'review',`${(media.bytes/1000000).toFixed(1)} MB · 500 MB 이내`);
        add('파일 확장자',/\.(mp4|mov|mpeg|3gp|avi)$/i.test(media.name)?'match':'review','MP4 · MOV · MPEG · 3GP · AVI · 확장자만 견줘 봤어요.');
        add('영상 비트레이트','unknown','516 kbps가 넘는지는 편집 프로그램의 내보내기 정보에서 봐요.');
      }
    }
    add('소리·자막·사용권','unknown','끝까지 보고 듣기, 사실·사용권은 아래 칸에 직접 남겨요.');
    return rows;
  }
  return {presets,analyze};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=publishRules;
