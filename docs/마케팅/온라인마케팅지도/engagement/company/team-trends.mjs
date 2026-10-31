import { METRICS, dateRange, shiftDate, metricIndex, compareMetric } from '../analytics.mjs';

const known = value => typeof value === 'number' && Number.isFinite(value);
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;

// Company-wide, authenticated aggregates. Never return channel, post, owner or credential records.
export function buildTeamTrends({teams, channels, records, ownTeamId, query, today}) {
  const metric = query.get('metric') || 'likes', definition = METRICS.find(row => row.key === metric);
  if (!definition) throw Object.assign(new Error('추이 지표를 확인해 주세요.'),{status:400});
  const end = query.get('end') || today;
  dateRange(end,end);
  if (end > today) throw Object.assign(new Error('오늘 뒤 날짜는 볼 수 없어요.'),{status:400});
  const activeTeams = teams.filter(team => team.active === true), teamIds = new Set(activeTeams.map(team => team.id));
  const accounts = channels.filter(channel => teamIds.has(channel.teamId)), channelIds = new Set(accounts.map(channel => channel.id));
  const posts = records.posts.filter(post => channelIds.has(post.channelId) && validDate(post.publishedDate) && post.publishedDate <= end);
  const postIds = new Set(posts.map(post => post.id));
  const snapshots = records.snapshots.filter(row => postIds.has(row.postId) && validDate(row.date) && row.date <= end);
  const accountSnapshots = records.channelSnapshots.filter(row => channelIds.has(row.channelId) && validDate(row.date) && row.date <= end);
  const first = (metric === 'followers' ? accountSnapshots : snapshots).filter(row => known(row[metric])).map(row => row.date).sort()[0];
  const earliest = shiftDate(end,-365), start = query.get('range') === 'all' ? (first && first > earliest ? first : first ? earliest : end) : query.get('start') || shiftDate(end,-29);
  const dates = dateRange(start,end), postIndex = metricIndex(snapshots,'postId'), accountIndex = metricIndex(accountSnapshots,'channelId');
  const result = activeTeams.map(team => {
    const selected = accounts.filter(channel => channel.teamId === team.id), ids = new Set(selected.map(channel => channel.id));
    const src = metric === 'followers' ? {entities:selected,index:accountIndex,isPost:false} : {entities:posts.filter(post => ids.has(post.channelId)),index:postIndex,isPost:true};
    const updates=new Map(),latest=new Map();
    for(const entity of src.entities)for(const row of src.index.get(entity.id)?.values()||[]){
      if(!known(row[metric]))continue;
      const date=src.isPost&&row.date<entity.publishedDate?entity.publishedDate:row.date;
      if(!updates.has(date))updates.set(date,[]);updates.get(date).push({id:entity.id,date:row.date,value:row[metric]});
    }
    const apply=date=>{for(const update of updates.get(date)||[]){const previous=latest.get(update.id);if(!previous||update.date>=previous.date)latest.set(update.id,update);}};
    for(const date of [...updates.keys()].filter(date=>date<start).sort())apply(date);
    const series=dates.map(date=>{
      apply(date);let total=0,lastTotal=0,count=0,latestCount=0,eligible=0,oldest=null,newest=null;
      for(const entity of src.entities){
        if(src.isPost&&entity.publishedDate>date)continue;eligible++;
        const exact=src.index.get(entity.id)?.get(date)?.[metric],recent=latest.get(entity.id);
        if(known(exact)){total+=exact;count++;}
        if(recent){lastTotal+=recent.value;latestCount++;if(oldest===null||recent.date<oldest)oldest=recent.date;if(newest===null||recent.date>newest)newest=recent.date;}
      }
      return {date,total:count?total:null,latest:latestCount?lastTotal:null,count,latestCount,stale:latestCount-count,eligible,oldest,newest,
        complete:eligible>0&&count===eligible,change:compareMetric(src,metric,shiftDate(date,-1),date)};
    });
    const {date:_,...last}=series.at(-1);
    return {id:team.id,name:team.name,isOwn:team.id === ownTeamId,channelCount:selected.length,
      summary:{...last,period:compareMetric(src,metric,shiftDate(start,-1),end)},series};
  });
  return {start,end,metric,label:definition.label,ownTeamId:teamIds.has(ownTeamId) ? ownTeamId : null,teams:result,
    aggregateOnly:true,limitedHistory:query.get('range') === 'all' && !!first && first < earliest,
    definitions:{scope:'운영 중인 팀에 넣은 채널을 팀마다 더한 값이에요. 채널별 자세한 자료는 볼 권한이 있는 사람만 봐요.',
      total:'누적은 그날까지 마지막으로 확인한 수치의 합이에요. 이전 기록과 일부만 확인한 값은 따로 표시해요.',
      change:'하루 증감은 전날과 그날 모두 기록이 있는 같은 대상의 차이예요. 기록이 없는 값은 0으로 채우지 않아요.',
      units:'도달·팔로워는 게시물·계정마다 플랫폼이 알려 준 값을 더한 것이라, 같은 사람을 여러 번 셀 수 있어요.'}};
}
