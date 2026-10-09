using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Synk.World.Editor
{
    public static class WorldProjectSetup
    {
        const string ScenePath = "Assets/SynkWorld/Scenes/World.unity";
        [MenuItem("SYNK WORLD/Prepare rehearsal project")]
        public static void Prepare()
        {
            Directory.CreateDirectory("Assets/SynkWorld/Scenes");
            Directory.CreateDirectory("Assets/SynkWorld/Settings");
            Directory.CreateDirectory("Assets/SynkWorld/Resources/Shaders");
            const string pipelinePath = "Assets/SynkWorld/Settings/WorldURP.asset";
            var pipeline = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(pipelinePath);
            if (pipeline == null)
            {
                var renderer = ScriptableObject.CreateInstance<UniversalRendererData>();
                AssetDatabase.CreateAsset(renderer, "Assets/SynkWorld/Settings/WorldRenderer.asset");
                pipeline = UniversalRenderPipelineAsset.Create(renderer);
                pipeline.msaaSampleCount = 2; pipeline.shadowDistance = 25; pipeline.renderScale = 1;
                pipeline.supportsHDR = true; pipeline.useSRPBatcher = true;
                AssetDatabase.CreateAsset(pipeline, pipelinePath);
            }
            GraphicsSettings.defaultRenderPipeline = pipeline; QualitySettings.renderPipeline = pipeline;
            const string materialPath = "Assets/SynkWorld/Resources/Shaders/WorldLit.mat";
            if (AssetDatabase.LoadAssetAtPath<Material>(materialPath) == null)
                AssetDatabase.CreateAsset(new Material(Shader.Find("Universal Render Pipeline/Lit")), materialPath);
            foreach (var path in AssetDatabase.FindAssets("t:Texture2D", new[] { "Assets/SynkWorld/Resources/Brand" }))
            {
                var importer = (TextureImporter)AssetImporter.GetAtPath(AssetDatabase.GUIDToAssetPath(path));
                importer.textureType = TextureImporterType.Default; importer.alphaIsTransparency = true;
                importer.maxTextureSize = 2048; importer.mipmapEnabled = false; importer.SaveAndReimport();
            }
            PlayerSettings.companyName = "SYNK"; PlayerSettings.productName = "SYNK WORLD Rehearsal";
            PlayerSettings.SetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.Android, "im.synk.world.rehearsal");
            PlayerSettings.SetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.iOS, "im.synk.world.rehearsal");
            PlayerSettings.defaultScreenWidth = 1440; PlayerSettings.defaultScreenHeight = 1000;
            PlayerSettings.defaultIsNativeResolution = false; PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.resizableWindow = true; PlayerSettings.defaultInterfaceOrientation = UIOrientation.Portrait;
            PlayerSettings.colorSpace = ColorSpace.Linear;
            // Dev-only loopback HTTP; release shipping requires HTTPS production auth, not this client.
            PlayerSettings.insecureHttpOption = InsecureHttpOption.DevelopmentOnly;
            PlayerSettings.runInBackground = false;
            if (!File.Exists(ScenePath))
            {
                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                new GameObject("SYNK WORLD").AddComponent<WorldApp>();
                EditorSceneManager.SaveScene(scene, ScenePath);
            }
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            AssetDatabase.SaveAssets(); AssetDatabase.Refresh();
            Debug.Log("SYNK WORLD rehearsal assets and scene prepared. Native render/build still needs validation.");
        }
        [MenuItem("SYNK WORLD/Open home scene")]
        public static void OpenHome() { Prepare(); EditorSceneManager.OpenScene(ScenePath); }
        public static void BuildWindows() => Build(BuildTarget.StandaloneWindows64, "Builds/Windows/SynkWorld.exe");
        public static void BuildAndroid() => Build(BuildTarget.Android, "Builds/Android/SynkWorld-rehearsal.apk");
        public static void ExportIOS() => Build(BuildTarget.iOS, "Builds/iOS");
        public static void BuildMac() => Build(BuildTarget.StandaloneOSX, "Builds/macOS/SynkWorld.app");
        static void Build(BuildTarget target, string path)
        {
            Prepare(); Directory.CreateDirectory(Path.GetDirectoryName(path));
            if (!BuildPipeline.IsBuildTargetSupported(BuildPipeline.GetBuildTargetGroup(target), target))
                throw new InvalidOperationException("해당 Unity 플랫폼 빌드 모듈이 설치되지 않았습니다: " + target);
            if (target == BuildTarget.Android)
            {
                PlayerSettings.SetScriptingBackend(UnityEditor.Build.NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
                PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            }
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions { scenes = new[] { ScenePath }, locationPathName = path, target = target, options = BuildOptions.Development });
            if (report.summary.result != BuildResult.Succeeded) throw new InvalidOperationException("리허설 빌드 실패: " + report.summary.result);
            Debug.Log("Development build created: " + path);
        }
    }
}
