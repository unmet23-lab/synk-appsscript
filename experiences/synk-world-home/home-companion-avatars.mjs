import {createHomeMaterials} from './home-scene-materials.mjs';
import {createKkamongHomeAvatar} from './home-kkamong-avatar.mjs';
import {createMarinHomeAvatar} from './home-marin-avatar.mjs';

/** Canon-referenced, individually authored 3D companions and the room kit.
 * The approved 4K masters remain the visual source of truth; this runtime
 * reconstruction is not a replacement master. Each model owns its resources.
 */
export function createHomeCompanions({low=false,grounded=false,onInvalidate=()=>{}}={}){
  const kit=createHomeMaterials();
  const kkamong=createKkamongHomeAvatar({kit,low,grounded,onInvalidate});
  const marin=createMarinHomeAvatar({kit,low});
  let disposed=false;
  return {kkamong,marin,materials:kit,
    setQuality(level){kkamong.setQuality(level);marin.setQuality(level);},
    dispose(){if(disposed)return;disposed=true;kkamong.dispose();marin.dispose();kit.dispose();}
  };
}
