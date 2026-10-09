using System;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Synk.World.Core;
using UnityEngine;
using UnityEngine.Networking;

namespace Synk.World
{
    /// <summary>Only the isolated localhost rehearsal API is enabled. Production auth is deliberately absent.</summary>
    public sealed class WorldApiClient : IWorldService
    {
        readonly string baseUrl;
        string accessToken; // Memory only. Never PlayerPrefs, files, URLs, or logs.
        public WorldApiClient(string baseUrl)
        {
            if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri) || uri.Scheme != "http" ||
                !(uri.Host == "127.0.0.1" || uri.Host == "localhost" || uri.Host == "10.0.2.2"))
                throw new ArgumentException("리허설 서버는 localhost 또는 Android 에뮬레이터의 로컬 호스트만 허용합니다.");
            this.baseUrl = baseUrl.TrimEnd('/');
        }
        public async Task<WorldSnapshot> SignInRehearsalAsync(string accountKey, CancellationToken token)
        {
            var session = await Send<Session>("POST", "/rehearsal/session", new SessionRequest { accountKey = accountKey }, token, false);
            token.ThrowIfCancellationRequested();
            if (!session.rehearsal || string.IsNullOrEmpty(session.accessToken)) throw new InvalidOperationException("리허설 세션을 확인할 수 없어요.");
            accessToken = session.accessToken;
            return await BootstrapAsync(token);
        }
        public async Task<WorldSnapshot> BootstrapAsync(CancellationToken token) => Snapshot(await Send<Reply>("GET", "/bootstrap", null, token));
        public async Task<PracticeRun> StartPracticeAsync(CancellationToken token)
        {
            var reply = await Send<Reply>("POST", "/play/start", new StartRequest { requestId = Guid.NewGuid().ToString("D") }, token);
            return Run(reply.run ?? reply.activeRun);
        }
        public async Task<RewardResult> CompletePracticeAsync(string runId, PracticeAnswer[] answers, string requestId, CancellationToken token)
        {
            var reply = await Send<Reply>("POST", "/play/complete", new CompleteRequest { runId = runId, requestId = requestId,
                answers = answers.Select(x => new Answer { questionId = x.questionId, optionId = x.choiceId }).ToArray() }, token);
            var result = reply.completion ?? throw new InvalidOperationException("서버 완료 결과를 확인할 수 없어요.");
            return new RewardResult { transactionId = result.runId, granted = result.rewardGranted, itemId = result.rewardItemId,
                correct = result.correctCount, total = result.totalCount, snapshot = Snapshot(reply),
                message = result.rewardGranted ? "첫 산책 선물이 도착했어요." : "이미 받은 선물은 옷장에 보관되어 있어요." };
        }
        public async Task<WorldSnapshot> EquipAsync(EquippedItem[] equipped, int revision, string requestId, CancellationToken token)
        {
            var slots = new Slots { body = "", neck = "" };
            foreach (var item in equipped) { if (item.slot == "body") slots.body = item.itemId; if (item.slot == "neck") slots.neck = item.itemId; }
            return Snapshot(await Send<Reply>("PUT", "/avatar/outfit", new EquipRequest { slots = slots, expectedRevision = revision, requestId = requestId }, token));
        }
        async Task<T> Send<T>(string method, string path, object body, CancellationToken token, bool authenticated = true) where T : class
        {
            token.ThrowIfCancellationRequested();
            if (authenticated && string.IsNullOrEmpty(accessToken)) throw new WorldApiException(401, "NO_SESSION", "리허설 계정을 먼저 연결해 주세요.");
            using (var request = new UnityWebRequest(baseUrl + path, method))
            {
                request.downloadHandler = new DownloadHandlerBuffer(); request.timeout = 15;
                request.SetRequestHeader("Accept", "application/json"); request.SetRequestHeader("x-synk-product", "world"); request.SetRequestHeader("x-synk-contract", "1");
                if (authenticated) request.SetRequestHeader("Authorization", "Bearer " + accessToken);
                if (body != null) { request.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(JsonUtility.ToJson(body))); request.SetRequestHeader("Content-Type", "application/json"); }
                var operation = request.SendWebRequest();
                while (!operation.isDone) { if (token.IsCancellationRequested) { request.Abort(); token.ThrowIfCancellationRequested(); } await Task.Yield(); }
                token.ThrowIfCancellationRequested();
                if (request.result != UnityWebRequest.Result.Success)
                {
                    var error = JsonUtility.FromJson<ErrorReply>(request.downloadHandler.text ?? "{}");
                    throw new WorldApiException((int)request.responseCode, error?.error?.code ?? "NETWORK",
                        request.responseCode == 0 ? "로컬 서버에 연결하지 못했어요. 서버가 켜져 있는지 확인한 뒤 다시 시도해 주세요." : error?.error?.message ?? "요청을 저장하지 못했어요. 다시 시도해 주세요.");
                }
                var result = JsonUtility.FromJson<T>(request.downloadHandler.text);
                if (result == null) throw new InvalidOperationException("서버 응답을 읽지 못했어요.");
                return result;
            }
        }
        static WorldSnapshot Snapshot(Reply reply)
        {
            if (reply == null || !reply.ok) throw new InvalidOperationException("서버 상태를 확인하지 못했어요.");
            var owned = reply.inventory ?? Array.Empty<Item>();
            var catalog = reply.content?.catalog ?? owned;
            var equipped = new System.Collections.Generic.List<EquippedItem>();
            if (!string.IsNullOrEmpty(reply.avatar?.slots?.body)) equipped.Add(new EquippedItem { slot = "body", itemId = reply.avatar.slots.body });
            if (!string.IsNullOrEmpty(reply.avatar?.slots?.neck)) equipped.Add(new EquippedItem { slot = "neck", itemId = reply.avatar.slots.neck });
            return new WorldSnapshot { accountId = reply.accountId, displayName = "나의 몽글", revision = reply.revision, rehearsal = true,
                items = catalog.Select(x => new WorldItem { itemId = x.itemId, name = x.title, slot = x.slot, assetId = x.itemId, owned = owned.Any(i => i.itemId == x.itemId) }).ToArray(),
                equipped = equipped.ToArray(), townMessage = "싱크 타운은 학습 해금과 이용권 서버 연결 뒤 열립니다." };
        }
        static PracticeRun Run(RunDto dto)
        {
            if (dto == null || dto.questions == null || dto.questions.Length == 0) throw new InvalidOperationException("놀이 문항을 받지 못했어요.");
            return new PracticeRun { runId = dto.runId, contentId = dto.gameId, questions = dto.questions.Select(x => new PracticeQuestion { questionId = x.questionId, prompt = x.prompt,
                choices = x.options.Select(o => new PracticeChoice { id = o.optionId, text = o.text }).ToArray() }).ToArray() };
        }
        public void ClearSession() => accessToken = null;
        public void Dispose() => ClearSession();
        [Serializable] class SessionRequest { public string accountKey; }
        [Serializable] class Session { public bool ok; public string accessToken; public string accountId; public bool rehearsal; }
        [Serializable] class StartRequest { public string requestId; }
        [Serializable] class Answer { public string questionId; public string optionId; }
        [Serializable] class CompleteRequest { public string runId; public string requestId; public Answer[] answers; }
        [Serializable] class Slots { public string body; public string neck; }
        [Serializable] class EquipRequest { public Slots slots; public int expectedRevision; public string requestId; }
        [Serializable] class Avatar { public string characterId; public Slots slots; }
        [Serializable] class Item { public string itemId; public string title; public string slot; public string source; }
        [Serializable] class Content { public string gameId; public string title; public string learningArea; public string rewardItemId; public Item[] catalog; }
        [Serializable] class Option { public string optionId; public string text; }
        [Serializable] class Question { public string questionId; public string prompt; public Option[] options; }
        [Serializable] class RunDto { public string runId; public string gameId; public string status; public Question[] questions; }
        [Serializable] class Completion { public string runId; public int correctCount; public int totalCount; public string rewardItemId; public bool rewardGranted; }
        [Serializable] class Reply { public bool ok; public string accountId; public int revision; public Avatar avatar; public Item[] inventory; public RunDto activeRun; public RunDto run; public Content content; public Completion completion; }
        [Serializable] class ApiError { public string code; public string message; }
        [Serializable] class ErrorReply { public ApiError error; }
    }
}
