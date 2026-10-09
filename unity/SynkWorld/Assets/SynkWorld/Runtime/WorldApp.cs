using System;
using System.Collections.Generic;
using System.Linq;
using System.IO;
using System.Threading.Tasks;
using Synk.World.Core;
using UnityEngine;
using UnityEngine.UIElements;

namespace Synk.World
{
    public sealed class WorldApp : MonoBehaviour
    {
        public string apiBaseUrl = "http://127.0.0.1:4296/api/world";
        WorldFlow flow;
        WorldHomeScene home;
        UIDocument document;
        VisualElement root, content;
        string accountKey = "player-a";
        readonly Dictionary<string, string> answers = new Dictionary<string, string>();
        bool mobile, paused, pauseAcknowledged;
        string displayedRun;
        Vector2Int lastSize;
        Rect lastSafeArea;
        Font font;
        WorldAvatarContract avatarContract;
        const string AliasKey = "synk.world.rehearsal.alias"; // Non-secret synthetic selector; never an auth credential.
        void Awake()
        {
            Application.targetFrameRate = Application.isMobilePlatform ? 30 : 60;
            var avatarText = Resources.Load<TextAsset>("avatar-contract");
            if (avatarText == null) throw new InvalidOperationException("공통 몽글 계약이 없어요. Tools/sync-avatar-contract.ps1을 먼저 실행해 주세요.");
            avatarContract = JsonUtility.FromJson<WorldAvatarContract>(avatarText.text) ?? throw new InvalidOperationException("공통 몽글 계약을 읽지 못했어요.");
            avatarContract.Validate();
            font = Resources.Load<Font>("Brand/SUIT-Regular");
            document = gameObject.AddComponent<UIDocument>();
            var panel = ScriptableObject.CreateInstance<PanelSettings>();
            panel.scaleMode = PanelScaleMode.ConstantPixelSize; panel.scale = 1;
            document.panelSettings = panel;
            var sceneObject = new GameObject("WORLD home art study"); home = sceneObject.AddComponent<WorldHomeScene>(); home.Initialise();
            home.ReducedMotion = PlayerPrefs.GetInt("synk.world.reducedMotion", 0) == 1;
            var pending = new WorldPendingFileStore(Path.Combine(Application.persistentDataPath, "rehearsal-pending"),
                value => JsonUtility.ToJson(value), json => JsonUtility.FromJson<PendingCompletion>(json));
            flow = new WorldFlow(new WorldApiClient(apiBaseUrl), pending); flow.Changed += Render;
        }
        async void Start()
        {
            Render();
            string alias = PlayerPrefs.GetString(AliasKey, "");
            if (alias == "player-a" || alias == "player-b") { accountKey = alias; await flow.SignInAsync(alias); }
        }
        void Update()
        {
            var size = new Vector2Int(Screen.width, Screen.height);
            if (size != lastSize || Screen.safeArea != lastSafeArea)
            { lastSize = size; lastSafeArea = Screen.safeArea; Render(); }
        }
        void Render()
        {
            if (document == null) return;
            home.SetVisible(false);
            root = document.rootVisualElement; root.Clear(); root.styleSheets.Clear();
            var sheet = Resources.Load<StyleSheet>("World"); if (sheet != null) root.styleSheets.Add(sheet);
            root.style.unityFont = font;
            // Physical-pixel density does not change the intended ~390 logical-point mobile layout.
            float scale = Application.isMobilePlatform ? Screen.width / 390f : Mathf.Max(1, Screen.width / 1600f);
            document.panelSettings.scale = scale;
            mobile = Screen.width / scale < 800;
            root.AddToClassList("app"); root.EnableInClassList("mobile", mobile);
            var safe = Screen.safeArea;
            root.style.paddingTop = (Screen.height - safe.yMax) / scale;
            root.style.paddingBottom = safe.y / scale;
            var shell = new VisualElement(); shell.AddToClassList("shell"); root.Add(shell);
            bool main = flow.Screen != WorldScreen.Welcome && flow.Screen != WorldScreen.SignIn;
            if (!mobile && main) shell.Add(Navigation());
            var column = new VisualElement(); column.AddToClassList("main"); shell.Add(column);
            column.Add(Header());
            var scroll = new ScrollView(ScrollViewMode.Vertical); scroll.AddToClassList("scroll"); column.Add(scroll);
            content = new VisualElement(); content.AddToClassList("content"); scroll.Add(content);
            Label("로컬 개발 리허설 · 실제 SYNK 계정과 분리", "rehearsal");
            switch (flow.Screen)
            {
                case WorldScreen.Welcome: Welcome(); break;
                case WorldScreen.SignIn: SignIn(); break;
                case WorldScreen.Play: Practice(); break;
                case WorldScreen.Reward: Reward(); break;
                case WorldScreen.Wardrobe: Wardrobe(); break;
                case WorldScreen.Town: Town(); break;
                case WorldScreen.Songs: Songs(); break;
                case WorldScreen.Settings: Settings(); break;
                default: Home(); break;
            }
            if (!string.IsNullOrEmpty(flow.Error))
            {
                var error = Box("error"); error.Add(new Label(flow.Error));
                if (flow.HasPendingCompletion) error.Add(Button("같은 결과 다시 저장", () => Run(() => flow.CompleteAsync(Array.Empty<PracticeAnswer>()))));
            }
            if (flow.Busy) { var status = Box("status"); status.Add(new Label("안전하게 연결하고 있어요…")); }
            if (mobile && main) column.Add(Navigation());
            if (flow.Snapshot != null)
                home.SetOutfit(flow.Snapshot.equipped.Any(x => x.slot == "neck" && x.itemId == "mongle-scarf-first-steps" && avatarContract.Allows(x.slot, x.itemId)),
                    flow.Snapshot.equipped.Any(x => x.slot == "body" && x.itemId == "mongle-apron-starter" && avatarContract.Allows(x.slot, x.itemId)));
            else home.SetOutfit(false, false);
        }
        VisualElement Header()
        {
            var bar = new VisualElement(); bar.AddToClassList("header");
            var logo = new Image { image = Resources.Load<Texture2D>("Brand/logo"), scaleMode = ScaleMode.ScaleToFit }; logo.AddToClassList("logo"); bar.Add(logo);
            var word = new Label("WORLD"); word.AddToClassList("wordmark"); bar.Add(word);
            var spacer = new VisualElement(); spacer.style.flexGrow = 1; bar.Add(spacer);
            bar.Add(Button("설정", () => flow.Navigate(WorldScreen.Settings), "small-button")); return bar;
        }
        VisualElement Navigation()
        {
            var nav = new VisualElement(); nav.AddToClassList("nav");
            foreach (var entry in new[] { ("홈", WorldScreen.Home), ("놀이", WorldScreen.Play), ("옷장", WorldScreen.Wardrobe), ("타운", WorldScreen.Town), ("노래", WorldScreen.Songs) })
            {
                var value = entry;
                var button = Button(value.Item1, () => { if (value.Item2 == WorldScreen.Play) Run(flow.StartAsync); else flow.Navigate(value.Item2); }, "nav-button");
                button.EnableInClassList("selected", value.Item2 == flow.Screen); nav.Add(button);
            }
            return nav;
        }
        void Welcome()
        {
            Label("나의 작은 세상에\n잘 왔어.", "title");
            Label("몽글과 한 번 놀고, 나만의 차림을 만나 봐.", "subtitle");
            Hero();
            content.Add(Button("먼저 둘러보기", flow.EnterGuest, "primary"));
            content.Add(Button("리허설 계정으로 시작", () => flow.Navigate(WorldScreen.SignIn)));
            Label("이번 개발판은 두 가상 계정으로 저장과 기기 연결을 확인해요. 실제 가입·구매는 하지 않아요.", "muted");
        }
        void SignIn()
        {
            Label("이어서 만날 몽글", "title");
            Label("휴대폰과 PC에서 같은 리허설 계정을 고르면 서버에 저장된 차림을 이어 볼 수 있어요.", "subtitle");
            var card = Box("card");
            var choice = new DropdownField("리허설 계정", new List<string> { "player-a", "player-b" }, accountKey == "player-b" ? 1 : 0);
            choice.RegisterValueChangedCallback(e => accountKey = e.newValue); card.Add(choice);
            card.Add(Button("연결하고 홈으로", () => Run(async () =>
            {
                await flow.SignInAsync(accountKey);
                if (flow.SignedIn) { PlayerPrefs.SetString(AliasKey, accountKey); PlayerPrefs.Save(); }
            }), "primary"));
            card.Add(Button("먼저 둘러보기", flow.EnterGuest));
            Label("운영 SYNK ID 로그인은 아직 연결되지 않았어요. 비밀번호나 개인 정보를 입력하지 마세요.", "muted");
        }
        void Home()
        {
            Label("오늘도, 나답게 놀아봐.", "title");
            Label("작은 놀이가 나의 세상이 되는 곳.", "subtitle");
            Hero();
            content.Add(Button(flow.SignedIn ? "몽글의 첫 산책" : "리허설 계정으로 놀이 시작", () => Run(flow.StartAsync), "primary"));
            var card = Box("card"); card.Add(new Label("짧은 문장 세 개, 첫 목도리 한 개."));
            card.Add(new Label("초급 한국어 문장을 읽고 알맞은 말을 골라 봐. 끝까지 참여하면 옷장에 선물이 도착해."));
            card.Add(Button("내 옷장 보기", () => flow.Navigate(WorldScreen.Wardrobe)));
            if (flow.SignedIn) Label("서버에 저장됨 · " + accountKey + " · 차림 " + flow.Snapshot.revision, "muted");
        }
        void Hero()
        {
            var hero = Box("hero"); var image = new Image { scaleMode = ScaleMode.ScaleToFit }; image.AddToClassList("scene"); hero.Add(image); home.Bind(image);
            var tools = new VisualElement(); tools.AddToClassList("hero-tools"); hero.Add(tools);
            tools.Add(Button("인사해", home.Greet, "small-button"));
            tools.Add(Button(home.Sunset ? "아침 빛" : "노을 빛", () => { home.SetSunset(!home.Sunset); Render(); }, "small-button"));
        }
        void Practice()
        {
            if (flow.Run == null) { Home(); return; }
            if (displayedRun != flow.Run.runId)
            {
                displayedRun = flow.Run.runId; answers.Clear();
                foreach (var answer in flow.PendingAnswers) answers[answer.questionId] = answer.choiceId;
            }
            Label("몽글의 첫 산책", "title"); Label("짧은 문장을 읽고 어울리는 말을 골라 줘.", "subtitle");
            if (flow.HasPendingCompletion) Label("아직 확인하지 못한 결과가 있어요. 전에 고른 답 그대로 다시 저장할 수 있어요.", "subtitle");
            if (paused && !pauseAcknowledged)
            {
                Label("잠깐 쉬고 돌아왔구나. 고른 답은 그대로 있어.", "subtitle");
                content.Add(Button("이어서 하기", () => { pauseAcknowledged = true; Render(); }, "primary")); return;
            }
            int number = 0;
            foreach (var question in flow.Run.questions)
            {
                var card = Box("card"); card.Add(new Label((++number) + " / " + flow.Run.questions.Length));
                var prompt = new Label(question.prompt); prompt.AddToClassList("question"); card.Add(prompt);
                foreach (var choice in question.choices)
                {
                    var q = question; var c = choice;
                    var option = Button(choice.text, () => { answers[q.questionId] = c.id; Render(); });
                    option.EnableInClassList("selected", answers.TryGetValue(q.questionId, out var chosen) && chosen == c.id);
                    option.SetEnabled(!flow.HasPendingCompletion && !flow.Busy); card.Add(option);
                }
            }
            var submit = Button(flow.HasPendingCompletion ? "같은 결과 다시 저장" : "산책 마치고 선물 받기", () => Run(() => flow.CompleteAsync(flow.Run.questions.Select(q => new PracticeAnswer { questionId = q.questionId, choiceId = answers[q.questionId] }).ToArray())), "primary");
            submit.SetEnabled(!flow.Busy && answers.Count == flow.Run.questions.Length); content.Add(submit);
            Label("정답 수와 관계없이 첫 참여 선물을 한 번 받아요. 학습 효과나 TOPIK 성적을 보장하는 검사는 아니에요.", "muted");
        }
        void Reward()
        {
            Label("첫 산책을 마쳤어!", "title");
            if (flow.Reward != null)
            {
                Label(flow.Reward.message, "subtitle");
                Label(flow.Reward.correct + " / " + flow.Reward.total + " 문장을 알맞게 골랐어요.", "subtitle");
            }
            Hero(); content.Add(Button("선물 목도리 입어보기", () => Run(() => flow.EquipAsync(flow.Reward.itemId)), "primary"));
            content.Add(Button("홈으로", () => flow.Navigate(WorldScreen.Home)));
        }
        void Wardrobe()
        {
            Label("오늘의 나를 골라봐", "title"); Label("몸 의상과 목도리를 함께 입을 수 있어.", "subtitle"); Hero();
            if (!flow.SignedIn) { content.Add(Button("리허설 계정 연결", () => flow.Navigate(WorldScreen.SignIn), "primary")); return; }
            foreach (var item in flow.Snapshot.items)
            {
                var value = item; var card = Box("card"); card.Add(new Label(item.name));
                bool worn = flow.Snapshot.equipped.Any(x => x.itemId == item.itemId);
                card.Add(new Label(worn ? "지금 입고 있어요" : item.owned ? "내 옷장에 있어요" : "첫 산책을 마치면 받을 수 있어요"));
                var button = Button(worn ? "착용 중" : "입어보기", () => Run(() => flow.EquipAsync(value.itemId))); button.SetEnabled(item.owned && !worn && !flow.Busy); card.Add(button);
            }
            content.Add(Button("기본 차림으로", () => Run(() => flow.EquipAsync(""))));
            content.Add(Button("다른 기기의 저장 불러오기", () => Run(flow.RefreshAsync)));
        }
        void Town()
        {
            Label("우리 동네, 싱크 타운", "title"); Hero();
            Label(flow.Snapshot?.townMessage ?? "학습 해금과 이용권 확인 뒤 연결됩니다.", "subtitle");
            Label("이번 앱 기본판에는 아직 마을 이동과 다인 접속이 포함되지 않았어요. 지금 입은 차림을 같은 데이터로 연결할 예정이에요.", "muted");
            content.Add(Button("홈으로", () => flow.Navigate(WorldScreen.Home), "primary"));
        }
        void Songs()
        {
            Label("한글이 노래가 되는 시간", "title"); Label("모음 댄스 · 그아가 · 받침", "subtitle");
            Label("기존 노래 콘텐츠는 유지하고 있어요. 이 설치형 앱의 영상 재생·다운로드·이어서 보기는 다음 연결 범위예요.", "muted");
            content.Add(Button("홈으로", () => flow.Navigate(WorldScreen.Home), "primary"));
        }
        void Settings()
        {
            Label("나에게 맞게", "title");
            var card = Box("card"); var motion = new Toggle("움직임 줄이기") { value = home.ReducedMotion };
            motion.RegisterValueChangedCallback(e => { home.ReducedMotion = e.newValue; PlayerPrefs.SetInt("synk.world.reducedMotion", e.newValue ? 1 : 0); PlayerPrefs.Save(); }); card.Add(motion);
            card.Add(new Label("연결: 로컬 개발 서버\n저장: 서버의 리허설 계정\n토큰: 앱 메모리에만 유지"));
            if (flow.SignedIn) card.Add(Button("최신 저장 불러오기", () => Run(flow.RefreshAsync)));
            card.Add(Button("리허설 계정 바꾸기", () => { PlayerPrefs.DeleteKey(AliasKey); PlayerPrefs.Save(); flow.SignOut(); flow.Navigate(WorldScreen.SignIn); }));
            card.Add(Button("처음 화면으로", () => { PlayerPrefs.DeleteKey(AliasKey); PlayerPrefs.Save(); flow.SignOut(); }));
            content.Add(Button("홈으로", () => { if (flow.Snapshot == null) flow.EnterGuest(); else flow.Navigate(WorldScreen.Home); }, "primary"));
        }
        Label Label(string text, string className)
        { var label = new Label(text); label.AddToClassList(className); content.Add(label); return label; }
        VisualElement Box(string className) { var box = new VisualElement(); box.AddToClassList(className); content.Add(box); return box; }
        Button Button(string text, Action action, string className = "button")
        {
            var button = new Button(action) { text = text }; button.AddToClassList("button"); button.AddToClassList(className);
            button.SetEnabled(flow == null || !flow.Busy); return button;
        }
        async void Run(Func<Task> operation) { await operation(); }
        void OnApplicationPause(bool value)
        {
            if (value) { paused = true; pauseAcknowledged = false; }
            else if (flow != null) { if (flow.Screen == WorldScreen.Play) Render(); else if (flow.SignedIn) Run(flow.RefreshAsync); }
        }
        void OnDestroy() { if (flow != null) { flow.Changed -= Render; flow.Dispose(); } }
    }
}
