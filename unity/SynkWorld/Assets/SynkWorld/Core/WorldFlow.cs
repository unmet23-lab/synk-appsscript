using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Synk.World.Core
{
    /// <summary>Engine-independent app state. Account changes invalidate every outstanding response.</summary>
    public sealed class WorldFlow : IDisposable
    {
        readonly IWorldService service;
        readonly IWorldPendingStore pendingStore;
        CancellationTokenSource session = new CancellationTokenSource();
        int epoch;
        bool inFlight;
        string completionRequestId;
        PracticeAnswer[] pendingAnswers;
        public event Action Changed;
        public WorldScreen Screen { get; private set; } = WorldScreen.Welcome;
        public WorldSnapshot Snapshot { get; private set; }
        public PracticeRun Run { get; private set; }
        public RewardResult Reward { get; private set; }
        public string Error { get; private set; }
        public bool Busy => inFlight;
        public bool IsGuest { get; private set; }
        public bool SignedIn => Snapshot != null && !IsGuest;
        public bool HasPendingCompletion => pendingAnswers != null;
        public WorldFlow(IWorldService service, IWorldPendingStore pendingStore = null) { this.service = service; this.pendingStore = pendingStore; }
        public PracticeAnswer[] PendingAnswers => pendingAnswers?.Select(x => new PracticeAnswer { questionId = x.questionId, choiceId = x.choiceId }).ToArray() ?? Array.Empty<PracticeAnswer>();
        void Notify() => Changed?.Invoke();
        public void Navigate(WorldScreen screen)
        {
            if (inFlight) return;
            Screen = screen; Error = null; Notify();
        }
        public void EnterGuest()
        {
            Reset(); IsGuest = true;
            Snapshot = new WorldSnapshot { displayName = "처음 온 친구", townMessage = "싱크 타운은 학습 해금과 이용권 확인 뒤 연결됩니다." };
            Screen = WorldScreen.Home; Notify();
        }
        public async Task SignInAsync(string accountKey)
        {
            Reset();
            await Perform(async ct =>
            {
                var value = await service.SignInRehearsalAsync(accountKey, ct); ct.ThrowIfCancellationRequested();
                Snapshot = value; Screen = WorldScreen.Home;
                var saved = pendingStore?.Load(value.accountId);
                if (saved != null)
                {
                    saved.Validate(value.accountId); Run = saved.run; completionRequestId = saved.requestId;
                    pendingAnswers = saved.answers; Screen = WorldScreen.Play;
                }
            });
        }
        public Task RefreshAsync() => Perform(async ct => { if (SignedIn) { var value = await service.BootstrapAsync(ct); ct.ThrowIfCancellationRequested(); Snapshot = value; } });
        public Task StartAsync() => Perform(async ct =>
        {
            if (!SignedIn) { Screen = WorldScreen.SignIn; return; }
            if (pendingAnswers != null) { Screen = WorldScreen.Play; return; }
            var run = await service.StartPracticeAsync(ct); ct.ThrowIfCancellationRequested(); Run = run;
            completionRequestId = Guid.NewGuid().ToString("D");
            Reward = null; Screen = WorldScreen.Play;
        });
        public Task CompleteAsync(PracticeAnswer[] answers) => Perform(async ct =>
        {
            if (!SignedIn || Run == null) throw new InvalidOperationException("먼저 놀이를 시작해 주세요.");
            // Freeze the exact request after the first submission. Retry cannot rewrite answers.
            if (pendingAnswers == null) pendingAnswers = answers.Select(x => new PracticeAnswer { questionId = x.questionId, choiceId = x.choiceId }).ToArray();
            var pending = new PendingCompletion { accountId = Snapshot.accountId, requestId = completionRequestId, run = Run, answers = pendingAnswers };
            pending.Validate(Snapshot.accountId);
            // A disk-full error must stop submission, otherwise a crash could lose its idempotency key.
            pendingStore?.Save(pending);
            var result = await service.CompletePracticeAsync(Run.runId, pendingAnswers, completionRequestId, ct);
            ct.ThrowIfCancellationRequested();
            pendingStore?.Clear(Snapshot.accountId);
            Reward = result; Snapshot = result.snapshot;
            pendingAnswers = null; Run = null; Screen = WorldScreen.Reward;
        });
        public Task EquipAsync(string itemId) => Perform(async ct =>
        {
            if (!SignedIn) { Screen = WorldScreen.SignIn; return; }
            var desired = Array.Empty<EquippedItem>();
            if (!string.IsNullOrEmpty(itemId))
            {
                var item = Snapshot.items.FirstOrDefault(x => x.itemId == itemId && x.owned);
                if (item == null) throw new InvalidOperationException("먼저 이 아이템을 받아야 입을 수 있어요.");
                desired = Snapshot.equipped.Where(x => x.slot != item.slot).Concat(new[] { new EquippedItem { slot = item.slot, itemId = item.itemId } }).ToArray();
            }
            try { var value = await service.EquipAsync(desired, Snapshot.revision, Guid.NewGuid().ToString("D"), ct); ct.ThrowIfCancellationRequested(); Snapshot = value; }
            catch (WorldApiException e) when (e.Status == 409)
            {
                var value = await service.BootstrapAsync(ct); ct.ThrowIfCancellationRequested(); Snapshot = value;
                throw new InvalidOperationException("다른 기기에서 차림이 바뀌었어요. 최신 차림을 불러왔으니 다시 골라 주세요.");
            }
            Screen = WorldScreen.Wardrobe;
        });
        async Task Perform(Func<CancellationToken, Task> action)
        {
            if (inFlight) return;
            int currentEpoch = epoch;
            inFlight = true; Error = null; Notify();
            // Service callbacks cannot mutate state after sign-out: cancellation plus per-operation gate.
            try { await action(session.Token); }
            catch (OperationCanceledException) { }
            catch (Exception ex) { if (currentEpoch == epoch) Error = ex.Message; }
            finally { if (currentEpoch == epoch) { inFlight = false; Notify(); } }
        }
        void Reset()
        {
            epoch++; session.Cancel(); session.Dispose(); session = new CancellationTokenSource();
            service.ClearSession(); inFlight = false; IsGuest = false; Snapshot = null; Run = null; Reward = null;
            pendingAnswers = null; completionRequestId = null; Error = null;
        }
        public void SignOut() { Reset(); Screen = WorldScreen.Welcome; Notify(); }
        public void Dispose() { Reset(); session.Dispose(); service.Dispose(); }
    }
}
