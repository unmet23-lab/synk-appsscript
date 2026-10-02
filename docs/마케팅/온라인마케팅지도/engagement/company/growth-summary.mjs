import { METRICS, dateRange, shiftDate, metricIndex, metricPoint, compareMetric } from '../analytics.mjs';

export function growthMonthWindow(asOf){
  dateRange(asOf,asOf);
  const currentStart=asOf.slice(0,8)+'01',previousLast=shiftDate(currentStart,-1),previousStart=previousLast.slice(0,8)+'01';
  const currentDays=Number(asOf.slice(8)),previousDays=Math.min(currentDays,Number(previousLast.slice(8)));
  return {current:{start:currentStart,end:asOf,days:currentDays},
    previous:{start:previousStart,end:shiftDate(previousStart,previousDays-1),days:previousDays},
    sameDayCount:currentDays===previousDays,comparisonDays:previousDays};
}

export function growthWeekWindow(asOf){
  dateRange(asOf,asOf);
  // asOf is the caller's KST calendar date, so UTC is used only for calendar arithmetic.
  const elapsed=(new Date(asOf+'T00:00:00Z').getUTCDay()+6)%7,start=shiftDate(asOf,-elapsed),days=elapsed+1;
  return {current:{start,end:asOf,days},previous:{start:shiftDate(start,-7),end:shiftDate(asOf,-7),days},sameDayCount:true,comparisonDays:days};
}

// Records and catalog must already have the caller's channel and ownership scope applied.
export function buildGrowthSummary(records,catalog,{asOf}){
  const month=growthMonthWindow(asOf),week=growthWeekWindow(asOf),yesterday=shiftDate(asOf,-1);
  const channels=catalog.channels.filter(channel=>channel.ready),channelIds=new Set(channels.map(channel=>channel.id));
  const posts=records.posts.filter(post=>channelIds.has(post.channelId)&&post.publishedDate<=asOf);
  const postIndex=metricIndex(records.snapshots,'postId'),accountIndex=metricIndex(records.channelSnapshots,'channelId');
  const currentBase=shiftDate(month.current.start,-1),previousBase=shiftDate(month.previous.start,-1);
  const dates=dateRange(month.current.start,asOf);
  const weekCurrentBase=shiftDate(week.current.start,-1),weekPreviousBase=shiftDate(week.previous.start,-1),weekDates=dateRange(week.current.start,asOf);
  const metrics=Object.fromEntries(METRICS.map(({key})=>{
    const src=key==='followers'?{entities:channels,index:accountIndex,isPost:false}:{entities:posts,index:postIndex,isPost:true};
    const current=compareMetric(src,key,currentBase,asOf),previous=compareMetric(src,key,previousBase,month.previous.end);
    const comparable=month.sameDayCount&&current.complete&&previous.complete;
    const difference=comparable?current.delta-previous.delta:null;
    const rate=comparable&&previous.delta>0?difference/previous.delta*100:null;
    const trend=dates.map((date,index)=>{
      const currentPoint=compareMetric(src,key,currentBase,date);
      const previousDate=index<month.previous.days?shiftDate(month.previous.start,index):null;
      const previousPoint=previousDate?compareMetric(src,key,previousBase,previousDate):null;
      return {date,day:index+1,value:currentPoint.delta,previousDate,previousValue:previousPoint?.delta??null,current:currentPoint,previous:previousPoint};
    });
    const weekCurrent=compareMetric(src,key,weekCurrentBase,asOf),weekPrevious=compareMetric(src,key,weekPreviousBase,week.previous.end);
    const weekComparable=weekCurrent.complete&&weekPrevious.complete,weekDifference=weekComparable?weekCurrent.delta-weekPrevious.delta:null;
    const weekRate=weekComparable&&weekPrevious.delta>0?weekDifference/weekPrevious.delta*100:null;
    const weekTrend=weekDates.map((date,index)=>{
      const previousDate=shiftDate(date,-7),currentPoint=compareMetric(src,key,weekCurrentBase,date),previousPoint=compareMetric(src,key,weekPreviousBase,previousDate);
      return {date,day:index+1,value:currentPoint.delta,previousDate,previousValue:previousPoint.delta,current:currentPoint,previous:previousPoint};
    });
    return [key,{today:metricPoint(src,key,asOf),yesterday:metricPoint(src,key,yesterday),day:compareMetric(src,key,yesterday,asOf),
      month:{current,previous,difference,rate,comparable},trend,
      week:{current:weekCurrent,previous:weekPrevious,difference:weekDifference,rate:weekRate,comparable:weekComparable,trend:weekTrend}}];
  }));
  return {asOf,yesterday,month,week,metrics};
}
