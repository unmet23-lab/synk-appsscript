using System;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.UIElements;

namespace Synk.World
{
    // Procedural screen study preserving the armless bell silhouette. Not the approved production mesh.
    public sealed class WorldHomeScene : MonoBehaviour
    {
        Camera sceneCamera;
        RenderTexture renderTexture;
        Transform mascot;
        GameObject scarf, apron;
        Light key;
        Image target;
        float greetUntil;
        bool visible, applicationPaused;
        public bool ReducedMotion { get; set; }
        public bool Sunset { get; private set; }
        const int Layer = 28;
        public void Initialise()
        {
            var cameraObject = new GameObject("Home camera"); cameraObject.transform.SetParent(transform);
            sceneCamera = cameraObject.AddComponent<Camera>();
            sceneCamera.clearFlags = CameraClearFlags.SolidColor; sceneCamera.backgroundColor = new Color(.92f, .95f, .93f);
            sceneCamera.cullingMask = 1 << Layer; sceneCamera.orthographic = true; sceneCamera.orthographicSize = 2.3f;
            sceneCamera.transform.position = new Vector3(0, 3.4f, -7.2f); sceneCamera.transform.LookAt(new Vector3(0, 1.0f, 0));
            sceneCamera.allowHDR = true; sceneCamera.allowMSAA = true;
            RenderSettings.ambientMode = AmbientMode.Flat; RenderSettings.ambientLight = new Color(.71f, .76f, .74f);
            var lamp = new GameObject("Soft morning light"); lamp.layer = Layer; lamp.transform.SetParent(transform);
            key = lamp.AddComponent<Light>(); key.type = LightType.Directional; key.intensity = 1.7f; key.shadows = LightShadows.Soft;
            key.transform.rotation = Quaternion.Euler(45, -32, 0);
            var wood = Mat("wood", new Color(.61f, .43f, .28f));
            var cream = Mat("linen", new Color(.94f, .91f, .82f));
            var stone = Mat("stone", new Color(.73f, .77f, .70f));
            var sage = Mat("sage cotton", new Color(.34f, .51f, .40f));
            var coral = Mat("Mongle felt", new Color(.95f, .59f, .43f), "Brand/felt-coral");
            var black = Mat("eye", new Color(.08f, .06f, .055f));
            var blue = Mat("scarf knit", new Color(.38f, .54f, .78f), "Brand/felt-blue");
            var deck = Node("Terrace", transform);
            for (int i = 0; i < 24; i++) Shape(deck, PrimitiveType.Cube, "wood plank", new Vector3(-4.1f + i * .355f, -.08f, .5f), new Vector3(.347f, .16f, 5.4f), wood);
            Shape(transform, PrimitiveType.Cube, "ground", new Vector3(0, -.2f, 0), new Vector3(40, .12f, 40), stone);
            for (int i = 0; i < 5; i++)
                Shape(transform, PrimitiveType.Sphere, "distant ridge", new Vector3(-11 + i * 5.1f, .1f + i % 2 * .5f, 14 + i % 2 * 3), new Vector3(9, 5 + i % 3, 5), Mat("ridge " + i, new Color(.74f + i * .017f, .83f + i * .01f, .80f)));
            var bench = Node("Wooden bench", transform); bench.localPosition = new Vector3(-2.1f, .1f, 1.3f);
            for (int i = 0; i < 4; i++) Shape(bench, PrimitiveType.Cube, "seat slat", new Vector3(0, .5f, -.24f + i * .16f), new Vector3(1.75f, .07f, .145f), wood);
            for (int i = 0; i < 3; i++) Shape(bench, PrimitiveType.Cube, "back slat", new Vector3(0, .75f + i * .15f, .3f), new Vector3(1.75f, .13f, .075f), wood);
            for (int s = -1; s <= 1; s += 2) Shape(bench, PrimitiveType.Cube, "leg", new Vector3(s * .68f, .25f, 0), new Vector3(.09f, .5f, .5f), wood);
            Shape(bench, PrimitiveType.Sphere, "linen cushion", new Vector3(.27f, .58f, 0), new Vector3(.78f, .17f, .54f), cream);
            Plant(new Vector3(2.3f, .02f, 1.0f), sage, cream);
            Plant(new Vector3(-3.25f, .02f, 1.5f), sage, stone);
            Shape(transform, PrimitiveType.Cylinder, "ceramic side table", new Vector3(1.8f, .38f, -.1f), new Vector3(.88f, .38f, .88f), stone);
            Shape(transform, PrimitiveType.Cylinder, "cup", new Vector3(1.77f, .85f, -.12f), new Vector3(.19f, .1f, .19f), cream);
            mascot = Node("Mongle — procedural art study", transform); mascot.localPosition = new Vector3(0, .1f, -.3f);
            var body = new GameObject("Armless scalloped body"); body.layer = Layer; body.transform.SetParent(mascot, false);
            body.AddComponent<MeshFilter>().sharedMesh = BellMesh(); body.AddComponent<MeshRenderer>().sharedMaterial = coral;
            for (int s = -1; s <= 1; s += 2)
            {
                Shape(mascot, PrimitiveType.Sphere, "eye", new Vector3(s * .28f, 1.37f, -.545f), new Vector3(.19f, .22f, .10f), black);
                Shape(mascot, PrimitiveType.Sphere, "eye catchlight", new Vector3(s * .28f - .022f, 1.4f, -.592f), Vector3.one * .027f, cream);
            }
            scarf = Node("First voice scarf", mascot).gameObject;
            for (int i = 0; i < 56; i++)
            {
                float a = i * Mathf.PI * 2 / 56;
                Shape(scarf.transform, PrimitiveType.Sphere, "knit fold", new Vector3(Mathf.Sin(a) * .77f, .94f, Mathf.Cos(a) * .64f), new Vector3(.12f, .16f, .12f), blue);
            }
            Shape(scarf.transform, PrimitiveType.Capsule, "scarf end", new Vector3(.37f, .72f, -.67f), new Vector3(.16f, .22f, .055f), blue).transform.localRotation = Quaternion.Euler(0, 0, -12);
            apron = Node("Meadow apron", mascot).gameObject;
            Shape(apron.transform, PrimitiveType.Sphere, "cotton apron", new Vector3(0, .55f, -.655f), new Vector3(.89f, .77f, .16f), sage);
            Shape(apron.transform, PrimitiveType.Sphere, "apron pocket", new Vector3(0, .53f, -.745f), new Vector3(.30f, .23f, .05f), sage);
            scarf.SetActive(false); apron.SetActive(false);
        }
        public void Bind(Image image)
        {
            SetVisible(true);
            target = image; ResizeTexture();
            image.RegisterCallback<GeometryChangedEvent>(_ => ResizeTexture());
        }
        void ResizeTexture()
        {
            if (target == null || float.IsNaN(target.resolvedStyle.width) || target.resolvedStyle.width < 1) return;
            float cap = Application.isMobilePlatform ? 1.5f : 2;
            int width = Mathf.Clamp(Mathf.RoundToInt(target.resolvedStyle.width * cap), 320, 1600);
            int height = Mathf.Clamp(Mathf.RoundToInt(target.resolvedStyle.height * cap), 240, 1100);
            if (renderTexture != null && renderTexture.width == width && renderTexture.height == height) { target.image = renderTexture; return; }
            if (renderTexture != null) { sceneCamera.targetTexture = null; renderTexture.Release(); Destroy(renderTexture); }
            renderTexture = new RenderTexture(width, height, 24) { antiAliasing = 2, name = "Home viewport" };
            renderTexture.Create(); sceneCamera.targetTexture = renderTexture; target.image = renderTexture;
            sceneCamera.orthographicSize = width < height * 1.1f ? 2.35f : 2.15f;
        }
        public void SetOutfit(bool neck, bool body) { scarf.SetActive(neck); apron.SetActive(body); }
        public void SetVisible(bool value) { visible = value; if (sceneCamera != null) sceneCamera.enabled = visible && !applicationPaused; }
        public void SetSunset(bool value)
        {
            Sunset = value; key.color = value ? new Color(1, .81f, .65f) : Color.white;
            sceneCamera.backgroundColor = value ? new Color(.96f, .88f, .82f) : new Color(.92f, .95f, .93f);
        }
        public void Greet() { if (!ReducedMotion) greetUntil = Time.unscaledTime + 1.2f; }
        void Update()
        {
            if (mascot == null) return;
            float wave = !ReducedMotion && Time.unscaledTime < greetUntil ? Mathf.Sin((greetUntil - Time.unscaledTime) * 8) * 7 : 0;
            mascot.localRotation = Quaternion.Euler(0, -7, wave);
        }
        void OnApplicationPause(bool paused) { applicationPaused = paused; SetVisible(visible); }
        void OnDestroy() { if (renderTexture != null) { renderTexture.Release(); Destroy(renderTexture); } }
        static Transform Node(string name, Transform parent)
        { var o = new GameObject(name); o.layer = Layer; o.transform.SetParent(parent, false); return o.transform; }
        static Material Mat(string name, Color color, string texture = null)
        {
            var template = Resources.Load<Material>("Shaders/WorldLit");
            var m = template != null ? new Material(template) : new Material(Shader.Find("Universal Render Pipeline/Lit")); m.name = name;
            m.SetColor("_BaseColor", color); m.SetFloat("_Smoothness", .18f);
            if (texture != null) { m.SetTexture("_BaseMap", Resources.Load<Texture2D>(texture)); m.SetTextureScale("_BaseMap", new Vector2(3, 3)); m.SetColor("_BaseColor", Color.white); }
            return m;
        }
        static GameObject Shape(Transform parent, PrimitiveType type, string name, Vector3 position, Vector3 scale, Material mat)
        {
            var o = GameObject.CreatePrimitive(type); o.name = name; o.layer = Layer; o.transform.SetParent(parent, false);
            o.transform.localPosition = position; o.transform.localScale = scale;
            o.GetComponent<Renderer>().sharedMaterial = mat;
            var collider = o.GetComponent<Collider>(); if (collider != null) Destroy(collider);
            return o;
        }
        void Plant(Vector3 position, Material leaf, Material pot)
        {
            var p = Node("Potted plant", transform); p.position = position;
            Shape(p, PrimitiveType.Cylinder, "pot", new Vector3(0, .24f, 0), new Vector3(.6f, .24f, .6f), pot);
            for (int i = 0; i < 7; i++)
            {
                float a = i * 2.4f;
                var l = Shape(p, PrimitiveType.Sphere, "curved leaf", new Vector3(Mathf.Sin(a) * .23f, .67f + i * .07f, Mathf.Cos(a) * .23f), new Vector3(.17f, .62f, .055f), leaf);
                l.transform.localRotation = Quaternion.Euler(15, a * Mathf.Rad2Deg, 30 * Mathf.Sin(a));
            }
        }
        static Mesh BellMesh()
        {
            Vector2[] profile = { new Vector2(0,.09f), new Vector2(.83f,.1f), new Vector2(.82f,.23f), new Vector2(.765f,.46f), new Vector2(.755f,.8f), new Vector2(.735f,1.15f), new Vector2(.665f,1.45f), new Vector2(.51f,1.67f), new Vector2(.28f,1.81f), new Vector2(0,1.855f) };
            const int rings = 64, segments = 80;
            var vertices = new Vector3[(rings + 1) * (segments + 1)]; var uv = new Vector2[vertices.Length]; var indices = new int[rings * segments * 6];
            for (int r = 0; r <= rings; r++)
            {
                float t = r / (float)rings * (profile.Length - 1); int n = Mathf.Min((int)t, profile.Length - 2); float f = t - n;
                var p0 = profile[Mathf.Max(0,n-1)]; var p1 = profile[n]; var p2 = profile[n+1]; var p3 = profile[Mathf.Min(profile.Length-1,n+2)];
                Vector2 p = .5f * ((2*p1) + (-p0+p2)*f + (2*p0-5*p1+4*p2-p3)*f*f + (-p0+3*p1-3*p2+p3)*f*f*f);
                for (int s = 0; s <= segments; s++)
                {
                    float a = s / (float)segments * Mathf.PI * 2, influence = Mathf.Exp(-p.y*7), wave = Mathf.Cos(a*8 + Mathf.PI), rad = Mathf.Max(0,p.x + influence*wave*.07f);
                    int i = r * (segments+1)+s; vertices[i] = new Vector3(Mathf.Sin(a)*rad, p.y + influence*wave*.14f, Mathf.Cos(a)*rad*.82f); uv[i] = new Vector2(s/(float)segments,r/(float)rings);
                    if (r < rings && s < segments) { int j = (r*segments+s)*6; indices[j]=i; indices[j+1]=i+1; indices[j+2]=i+segments+1; indices[j+3]=i+1; indices[j+4]=i+segments+2; indices[j+5]=i+segments+1; }
                }
            }
            var mesh = new Mesh { name = "Mongle bell study" }; mesh.vertices = vertices; mesh.uv = uv; mesh.triangles = indices; mesh.RecalculateNormals(); mesh.RecalculateBounds(); return mesh;
        }
    }
}
