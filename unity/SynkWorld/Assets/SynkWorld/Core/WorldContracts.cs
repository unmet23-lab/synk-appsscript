using System;
using System.Threading;
using System.Threading.Tasks;

namespace Synk.World.Core
{
    public enum WorldScreen { Welcome, SignIn, Home, Play, Reward, Wardrobe, Town, Songs, Settings }

    [Serializable] public class WorldItem
    {
        public string itemId;
        public string name;
        public string slot;
        public string assetId;
        public bool owned;
    }
    [Serializable] public class EquippedItem { public string slot; public string itemId; }
    [Serializable] public class WorldSnapshot
    {
        public string accountId;
        public string displayName;
        public int revision;
        public WorldItem[] items = Array.Empty<WorldItem>();
        public EquippedItem[] equipped = Array.Empty<EquippedItem>();
        public int completedRuns;
        public bool rehearsal;
        public string townMessage;
    }
    [Serializable] public class PracticeChoice { public string id; public string text; }
    [Serializable] public class PracticeQuestion
    {
        public string questionId;
        public string prompt;
        public PracticeChoice[] choices;
    }
    [Serializable] public class PracticeRun
    {
        public string runId;
        public string contentId;
        public PracticeQuestion[] questions;
    }
    [Serializable] public class PracticeAnswer { public string questionId; public string choiceId; }
    [Serializable] public class RewardResult
    {
        public string transactionId;
        public bool granted;
        public string itemId;
        public string message;
        public int correct;
        public int total;
        public WorldSnapshot snapshot;
    }
    public sealed class WorldApiException : Exception
    {
        public int Status { get; }
        public string Code { get; }
        public WorldApiException(int status, string code, string message) : base(message) { Status = status; Code = code; }
    }
    public interface IWorldService : IDisposable
    {
        Task<WorldSnapshot> SignInRehearsalAsync(string accountKey, CancellationToken token);
        Task<WorldSnapshot> BootstrapAsync(CancellationToken token);
        Task<PracticeRun> StartPracticeAsync(CancellationToken token);
        Task<RewardResult> CompletePracticeAsync(string runId, PracticeAnswer[] answers, string requestId, CancellationToken token);
        Task<WorldSnapshot> EquipAsync(EquippedItem[] equipped, int revision, string requestId, CancellationToken token);
        void ClearSession();
    }
}
