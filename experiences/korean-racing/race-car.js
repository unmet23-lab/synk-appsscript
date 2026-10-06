// 내 차(코스트 GT, 실제 GLB) 재질과 차 밑 그림자 판(app.js에서 옮김). 다른 차는 vehicles.js가 만든다.
import { canvasTexture } from './world-build.js';
import { refineOriginalCar } from './vehicles.js';

/** 차 밑에 까는 부드러운 그림자 판. */
export function shadowPlane(THREE, renderer) {
  const t = canvasTexture(THREE, renderer, 128, (ctx, n) => {
    const g = ctx.createRadialGradient(n / 2, n / 2, 12, n / 2, n / 2, n / 2);
    g.addColorStop(0, 'rgba(0,10,15,.85)'); g.addColorStop(.45, 'rgba(0,10,15,.48)'); g.addColorStop(1, 'rgba(0,10,15,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, n, n);
  });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 5.1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  s.rotation.x = -Math.PI / 2; s.position.y = .035;
  return s;
}

/** GLB 원본을 복제해 차체·유리·바퀴·실내·등의 재질을 입힌다. 뒤 램프와 부스터 불꽃을 단다. */
export function prepareCar(THREE, renderer, scene, model, color) {
  const root = new THREE.Group(), object = model.clone(true);
  object.rotation.y = Math.PI;
  const body = new THREE.MeshPhysicalMaterial({ color, metalness: .34, roughness: .29, clearcoat: 1, clearcoatRoughness: .15, envMapIntensity: 1.15 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x253037, metalness: .22, roughness: .46 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xc0c8c7, metalness: .92, roughness: .24, envMapIntensity: 1.1 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xbad9da, metalness: 0, roughness: .075, transparent: true, opacity: .34, depthWrite: false, clearcoat: 1, clearcoatRoughness: .06, envMapIntensity: 1.1 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x171b20, roughness: .88, metalness: 0 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x40352f, roughness: .82, metalness: 0 });
  const interior = new THREE.MeshStandardMaterial({ color: 0x20272d, roughness: .69, metalness: .04 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xb7bfc4, roughness: .22, metalness: .94 });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x252b30, roughness: .54, metalness: .18 });
  const brake = new THREE.MeshStandardMaterial({ color: 0xbea880, roughness: .43, metalness: .55 });
  const frontLight = new THREE.MeshPhysicalMaterial({ color: 0xf4f5f0, emissive: 0xe9f4ff, emissiveIntensity: .38, metalness: .05, roughness: .18, clearcoat: 1 });
  const rearLight = new THREE.MeshPhysicalMaterial({ color: 0x9a302b, emissive: 0xe53e28, emissiveIntensity: .7, roughness: .2, clearcoat: 1 });
  object.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const name = o.userData.name || o.name;
    if (name === 'body') o.material = body;
    else if (name === 'glass') { o.material = glass; o.castShadow = false; }
    else if (name.startsWith('rim_') || ['metal', 'chrome', 'steering_metal', 'nuts'].includes(name)) o.material = name.startsWith('rim_') ? rim : chrome;
    else if (name === 'tire') o.material = rubber;
    else if (['leather', 'steering_leather', 'carpet'].includes(name)) o.material = leather;
    else if (['trim', 'plastic_gray', 'grills', 'wipers'].includes(name)) o.material = trim;
    else if (['carbon_fibre_trim', 'carbon fibre', 'steering_carbon'].includes(name)) o.material = carbon;
    else if (['interior_dark', 'interior_light', 'steering_trim'].includes(name)) o.material = interior;
    else if (['brakes', 'brake', 'wheel'].includes(name)) o.material = brake;
    else if (['lights', 'leds'].includes(name)) o.material = frontLight;
    else if (['lights_red', 'steering_red_lights'].includes(name)) o.material = rearLight;
  });
  root.add(object, shadowPlane(THREE, renderer));
  root.userData.model = object;
  root.userData.wheels = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].map((n) => object.getObjectByName(n)).filter(Boolean);
  // 은은한 뒤 램프와 배기 불꽃이 가속을 또렷이 알려 준다.
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x962719, emissive: 0xf13b23, emissiveIntensity: .7, roughness: .2 });
  for (const x of [-.68, .68]) { const lamp = new THREE.Mesh(new THREE.TorusGeometry(.105, .025, 6, 14), lampMat); lamp.position.set(x, .65, -1.99); root.add(lamp); }
  const jets = [];
  for (const x of [-.26, .26]) {
    const jet = new THREE.Mesh(new THREE.ConeGeometry(.065, .62, 8), new THREE.MeshBasicMaterial({ color: 0xb3f5ff, transparent: true, opacity: .6, depthWrite: false }));
    jet.rotation.x = -Math.PI / 2; jet.position.set(x, .28, -2.2); jet.visible = false; root.add(jet); jets.push(jet);
  }
  root.userData.jets = jets;
  refineOriginalCar(root); scene.add(root);
  return root;
}
