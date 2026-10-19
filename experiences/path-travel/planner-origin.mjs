// The selector uses the same finite map coverage as the bundled walking graph.
export const ORIGIN_BOUNDS = Object.freeze([37.564, 126.962, 37.59, 127.001]);
export function originPoint(x, y) {
  if (![x, y].every(Number.isFinite) || x < 0 || x > 1 || y < 0 || y > 1) throw new TypeError('지도 안에서 출발점을 골라 주세요.');
  const [south, west, north, east] = ORIGIN_BOUNDS;
  return { lat: Number((north - y * (north - south)).toFixed(6)), lon: Number((west + x * (east - west)).toFixed(6)) };
}
export function originPosition({lat, lon}) {
  const [south, west, north, east] = ORIGIN_BOUNDS;
  if (![lat, lon].every(Number.isFinite) || lat < south || lat > north || lon < west || lon > east) throw new TypeError('지금은 종로 지도 안의 출발점을 지원해요.');
  return { x: (lon - west) / (east - west), y: (north - lat) / (north - south) };
}
export function createMapOrigin(point, name = '') {
  originPosition(point);
  const lat = Number(point.lat.toFixed(6)), lon = Number(point.lon.toFixed(6));
  const label = String(name).trim() || '지도에서 고른 출발점';
  if (label.length > 160) throw new TypeError('출발점 이름은 160자까지 쓸 수 있어요.');
  // Different coordinates must not resolve to an earlier saved origin option.
  return { id: `map:${lat}:${lon}`, name: label, lat, lon };
}
