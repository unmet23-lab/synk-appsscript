import {createHash} from 'node:crypto';
export const stableTeaReview = value => Array.isArray(value) ? '['+value.map(stableTeaReview).join(',')+']'
  : value && typeof value === 'object' ? '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stableTeaReview(value[key])).join(',')+'}' : JSON.stringify(value);
export const TEA_JUDGE = Object.freeze({id:'town-tea-judge-r1',axes:{tea:'cup.tea',temp:'cup.vessel',sweet:'cup.honey'},
  rule:'Only explicitly requested axes must match; any value on an unrequested axis is accepted. No time penalty. A wrong cup returns for retry. Meaning is explanation; repeat/slower/reopen are cue. Unreviewed and regular-memory requests remain unassessed.',
  responseFormat:'cup-compose',modality:'reading',difficulty:{L1:1,L2:2},allowedLevels:['L1','L2']});
export const teaReviewUnit = (frame, axes) => ({frame:frame.id,when:frame.when,levels:{L1:frame.levels.L1,L2:frame.levels.L2},axes,judge:TEA_JUDGE});
export const teaReviewUnitHash = (frame, axes) => createHash('sha256').update(stableTeaReview(teaReviewUnit(frame,axes))).digest('hex');
export const TEA_REVIEW_AUTHORIZATION = '2026-10-28 사용자가 이번 Atlas·WORLD·학습 보완 작업에 GPT 구현 및 작성자와 다른 GPT의 독립 검수 예외를 명시 승인했다. 일반 Claude·Argon 문항 검수 정책은 유지한다.';
export const TEA_REVIEW_PACKET = '76a6ee9df5d6714d9e75c4212146417af620273784467f9602dd7e9bf31550fc';
export const TEA_REVIEW_EVIDENCE = Object.freeze({
  'full.json': TEA_REVIEW_PACKET,
  'blind-all.json': 'bc66b122f6d132d545ddf7ffdee0a363724ca7ad4b394a217e203d0944654edd',
  'root-blind-solved.json': '54bbd5f6acbacaf9478cdb4f65fce68584094a1c559a7ffb03c504627a4429dc',
  'root-result.json': 'fde6fe1b66ed2a049ce399b8256c43703c6b615b0c288c3ccf3701b4bd16eabe',
});
/** Reviewed content is emitted only when the current authoring unit still equals the reviewed unit.
 * The digest is also the browser's display acknowledgement, so old data cannot claim a new review. */
export function teaAssessmentMetadata(frames, axes, review = null) {
  const results = review?.task === 'atlas-world-learning-20261028' && review.author?.id === '/root/world_integration_review' && review.reviewer?.id === '/root'
    && review.authorization === TEA_REVIEW_AUTHORIZATION && review.packetSha256 === TEA_REVIEW_PACKET
    && stableTeaReview(review.judge) === stableTeaReview(TEA_JUDGE) ? review.results || [] : [];
  return Object.fromEntries(frames.filter(frame=>frame.when?.part==='request').map(frame=>{
    const hash=teaReviewUnitHash(frame,axes),row=results.find(row=>row.id===frame.id&&row.hash===hash&&row.verdict==='pass');
    return [frame.id,{hash,levels:row?.levels?.filter(level=>TEA_JUDGE.allowedLevels.includes(level))||[]}];
  }));
}
