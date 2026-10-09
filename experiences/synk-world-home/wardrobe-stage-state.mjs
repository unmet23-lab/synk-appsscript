export const STAGE_ZOOM_MIN=0;
export const STAGE_ZOOM_MAX=1;
export const STAGE_DEFAULT_VIEW=Object.freeze({angle:-.17,zoom:0,detail:false});
export const STAGE_POSES=Object.freeze(['neutral','wave','tilt']);
export const STAGE_BACKGROUNDS=Object.freeze(['room','warm','garden']);
export function normalizeStageView(value={},fallback=STAGE_DEFAULT_VIEW){
  return {angle:Number.isFinite(value?.angle)?value.angle:fallback.angle,zoom:Number.isFinite(value?.zoom)?Math.max(STAGE_ZOOM_MIN,Math.min(STAGE_ZOOM_MAX,value.zoom)):fallback.zoom,detail:typeof value?.detail==='boolean'?value.detail:Boolean(fallback.detail)};
}
export function stagePointerDistance(points){const [a,b]=[...points.values()];return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;}
