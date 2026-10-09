using System;
using System.Linq;

namespace Synk.World.Core
{
    /// <summary>Shared identity and equipment contract. This does not contain or certify a native 3D model.</summary>
    [Serializable]
    public sealed class WorldAvatarContract
    {
        public int schemaVersion;
        public string id;
        public int renderVersion;
        public string units;
        public string forward;
        public string origin;
        public float height;
        public string assetStatus;
        public AvatarSlots slots;

        public void Validate()
        {
            if (schemaVersion != 1 || id != "mongle" || renderVersion < 3 || units != "meters" ||
                forward != "+Z" || origin != "feet" || Math.Abs(height - 1.85f) > .001f ||
                slots?.body == null || slots.neck == null ||
                !slots.body.Contains("mongle-apron-starter") || !slots.neck.Contains("mongle-scarf-first-steps"))
                throw new InvalidOperationException("공통 몽글·코스튬 계약을 확인해 주세요. 기기의 절차형 모델을 정식 공유 모델로 대신 표시하지 않습니다.");
        }
        public bool Allows(string slot, string itemId) => slot == "body" ? slots.body.Contains(itemId) : slot == "neck" && slots.neck.Contains(itemId);
    }
    [Serializable] public sealed class AvatarSlots { public string[] body; public string[] neck; }
}
