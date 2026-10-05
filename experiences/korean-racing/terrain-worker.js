// No renderer, WebGL context, textures or random scene state live in this worker.
import {ROAD_END, pathX, pathY, terrainColorAt} from './course.js';
import {createLandscapeHeight} from './landscape.js';
import {buildCourseTerrainData} from './terrain-data.js';

self.onmessage = ({data}) => {
  if (data?.type !== 'build') return;
  const startedAt = performance.now();
  try {
    const terrain = buildCourseTerrainData({pathX, groundHeight: createLandscapeHeight(pathX, pathY), ROAD_END, colorAt: terrainColorAt});
    const buffers = terrain.geometries.flatMap(geometry => [geometry.index.buffer, ...Object.values(geometry.attributes).map(attribute => attribute.array.buffer)]);
    self.postMessage({ok: true, terrain, computeMs: performance.now() - startedAt}, buffers);
  } catch {
    self.postMessage({ok: false});
  } finally {
    self.close();
  }
};
