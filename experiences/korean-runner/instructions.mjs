// Original beginner practice; these are not official TOPIK questions or grade mappings.
const lane=(target)=>({action:'lane',target});
const jump=()=>({action:'jump'}),slide=()=>({action:'slide'}),stay=()=>({action:'stay'});
export const INSTRUCTIONS=[
  {id:'left',text:'왼쪽 길로 가세요.',skill:'방향',explanation:'왼쪽 길의 표시선을 지나가요.',steps:[lane(0)]},
  {id:'jump',text:'낮은 울타리를 뛰어넘으세요.',skill:'동작',explanation:'울타리 가까이에서 점프해요.',steps:[jump()]},
  {id:'right',text:'오른쪽 길로 가세요.',skill:'방향',explanation:'오른쪽 길의 표시선을 지나가요.',steps:[lane(2)]},
  {id:'slide',text:'표지판 아래로 몸을 숙여 지나가세요.',skill:'위치 · 동작',explanation:'표지판 가까이에서 슬라이딩해요.',steps:[slide()]},
  {id:'middle',text:'가운데 길로 가세요.',skill:'방향',explanation:'양쪽 끝에서 한 칸 이동하면 가운데예요.',steps:[lane(1)]},
  {id:'no-jump',text:'이번에는 뛰지 말고 그대로 달리세요.',skill:'부정 지시',explanation:'뛰지 말고는 점프하지 말라는 뜻이에요. 표시선까지 그대로 달려요.',steps:[stay()]},
  {id:'left-jump',text:'왼쪽으로 간 다음, 울타리를 뛰어넘으세요.',skill:'순서',explanation:'첫 표시선은 왼쪽, 다음 울타리에서는 점프해요.',steps:[lane(0),jump()]},
  {id:'middle-slide',text:'가운데로 간 뒤, 몸을 숙이세요.',skill:'순서 · 위치',explanation:'가운데 표시선을 지난 뒤, 다음 표지판에서는 숙여요.',steps:[lane(1),slide()]},
  {id:'not-right',text:'오른쪽으로 가지 말고 왼쪽으로 가세요.',skill:'부정 · 방향',explanation:'가지 말고 뒤의 행동을 따라요. 목적지는 왼쪽이에요.',steps:[lane(0)]},
  {id:'jump-right',text:'울타리를 뛰어넘은 뒤, 오른쪽으로 가세요.',skill:'순서',explanation:'먼저 점프, 다음 표시선에서는 오른쪽으로 가요.',steps:[jump(),lane(2)]},
  {id:'slide-left',text:'몸을 숙인 다음, 왼쪽으로 가세요.',skill:'순서',explanation:'먼저 슬라이딩, 다음 표시선에서는 왼쪽으로 가요.',steps:[slide(),lane(0)]},
  {id:'not-left',text:'왼쪽으로 가지 말고 가운데로 가세요.',skill:'부정 · 방향',explanation:'왼쪽은 피하고 가운데 길로 가요.',steps:[lane(1)]},
  {id:'right-slide',text:'오른쪽으로 간 다음, 표지판 아래로 지나가세요.',skill:'순서 · 위치',explanation:'첫 표시선은 오른쪽, 다음 표지판에서는 슬라이딩해요.',steps:[lane(2),slide()]},
  {id:'jump-stay',text:'한 번 뛰어넘고, 다음 표시선에서는 뛰지 마세요.',skill:'순서 · 부정',explanation:'첫 울타리에서 점프한 뒤 착지해요. 다음 표시선에서는 그대로 달려요.',steps:[jump(),stay()]},
  {id:'right-middle',text:'오른쪽으로 갔다가 가운데로 돌아오세요.',skill:'순서 · 방향',explanation:'첫 표시선은 오른쪽, 두 번째 표시선은 가운데예요.',steps:[lane(2),lane(1)]},
  {id:'not-slide',text:'이번에는 몸을 숙이지 말고 그대로 달리세요.',skill:'부정 지시',explanation:'숙이지 말고는 슬라이딩하지 말라는 뜻이에요. 표시선까지 그대로 달려요.',steps:[stay()]}
];
export const actionLabel=step=>step.action==='lane'?['왼쪽으로','가운데로','오른쪽으로'][step.target]:step.action==='jump'?'뛰어넘기':step.action==='slide'?'몸 숙이기':'그대로 달리기';
