using Synk.World.Core;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

var checks = new List<string>();
void Check(bool result, string name) { if (!result) throw new Exception("FAIL " + name); checks.Add(name); }
using (var service = new FakeService())
using (var flow = new WorldFlow(service))
{
    flow.EnterGuest(); Check(flow.IsGuest && flow.Screen == WorldScreen.Home, "guest enters home without authenticated rewards");
    await flow.StartAsync(); Check(flow.Screen == WorldScreen.SignIn && service.StartCalls == 0, "guest cannot request server reward run");
    await flow.SignInAsync("player-a"); Check(flow.SignedIn && flow.Snapshot.accountId == "player-a", "rehearsal sign-in restores snapshot");
    await flow.StartAsync(); Check(flow.Run.questions.Length == 1 && flow.Screen == WorldScreen.Play, "server question enters play");
    var answer = new[] { new PracticeAnswer { questionId = "q1", choiceId = "hello" } };
    service.FailCompletion = true; await flow.CompleteAsync(answer); Check(flow.HasPendingCompletion && flow.Error != null, "network failure retains frozen completion");
    string request = service.LastRequest; answer[0].choiceId = "rewritten";
    service.FailCompletion = false; await flow.CompleteAsync(answer);
    Check(service.LastRequest == request && service.LastAnswers[0].choiceId == "hello", "completion retry retains idempotency key and original answers");
    Check(flow.Screen == WorldScreen.Reward && !flow.HasPendingCompletion, "confirmed reward consumes pending completion");
    await flow.EquipAsync("scarf"); Check(flow.Snapshot.equipped.Any(x => x.slot == "neck") && flow.Snapshot.equipped.Any(x => x.slot == "body"), "neck equip preserves body layer");
    service.Conflict = true; await flow.EquipAsync("scarf"); Check(flow.Error?.Contains("다른 기기") == true && service.BootstrapCalls > 0, "revision conflict refreshes and asks explicit retry");
    await flow.EquipAsync("unowned"); Check(flow.Error?.Contains("먼저") == true, "unowned item blocked before service");
    flow.SignOut(); Check(!flow.SignedIn && flow.Snapshot == null && flow.Run == null && flow.Reward == null, "sign-out clears all account state");
}
using (var service = new FakeService())
using (var flow = new WorldFlow(service))
{
    service.DelaySignIn = new TaskCompletionSource<WorldSnapshot>();
    var pending = flow.SignInAsync("player-a"); flow.SignOut();
    service.DelaySignIn.SetResult(FakeService.State("player-a")); await pending;
    Check(flow.Snapshot == null && flow.Screen == WorldScreen.Welcome, "late response cannot rehydrate signed-out account even if service ignores cancellation");
}
var serialization = new System.Text.Json.JsonSerializerOptions { IncludeFields = true };
string folder = Path.Combine(Path.GetTempPath(), "synk-world-pending-tests", Guid.NewGuid().ToString("N"));
var store = new WorldPendingFileStore(folder,
    x => System.Text.Json.JsonSerializer.Serialize(x, serialization),
    x => System.Text.Json.JsonSerializer.Deserialize<PendingCompletion>(x, serialization));
try
{
    string savedRequest;
    using (var service = new FakeService { FailCompletion = true })
    using (var flow = new WorldFlow(service, store))
    {
        await flow.SignInAsync("player-a"); await flow.StartAsync();
        await flow.CompleteAsync(new[] { new PracticeAnswer { questionId = "q1", choiceId = "hello" } });
        savedRequest = service.LastRequest;
        Check(store.Load("player-a")?.requestId == savedRequest, "completion saved durably before first server request");
        flow.SignOut(); Check(store.Load("player-a") != null, "sign-out preserves unconfirmed result in isolated account file");
    }
    using (var service = new FakeService())
    using (var flow = new WorldFlow(service, store))
    {
        await flow.SignInAsync("player-b");
        Check(!flow.HasPendingCompletion && flow.Run == null, "different account cannot restore another account pending result");
        await flow.SignInAsync("player-a");
        Check(flow.Screen == WorldScreen.Play && flow.HasPendingCompletion && flow.Run?.runId == "run", "process restart restores frozen pending run for same account");
        var clone = flow.PendingAnswers; clone[0].choiceId = "mutated";
        await flow.CompleteAsync(Array.Empty<PracticeAnswer>());
        Check(service.LastRequest == savedRequest && service.LastAnswers[0].choiceId == "hello", "restart retry sends exact persisted idempotency key and answers");
        Check(flow.Screen == WorldScreen.Reward && store.Load("player-a") == null, "confirmed retry deletes durable record and shows server reward");
    }
    var record = new PendingCompletion { accountId = "player-a", requestId = Guid.NewGuid().ToString("D"),
        run = new PracticeRun { runId = "run", questions = new[] { new PracticeQuestion { questionId = "q1", choices = new[] { new PracticeChoice { id = "hello" } } } } },
        answers = new[] { new PracticeAnswer { questionId = "q1", choiceId = "hello" } } };
    store.Save(record); record.requestId = Guid.NewGuid().ToString("D"); store.Save(record);
    Check(store.Load("player-a").requestId == record.requestId, "atomic replacement updates existing record");
    var file = Directory.GetFiles(folder, "*.json").Single();
    File.WriteAllText(file + ".tmp", "interrupted temp write");
    Check(store.Load("player-a").requestId == record.requestId, "interrupted temporary file cannot overwrite last durable completion");
    File.WriteAllText(file, "{broken"); bool rejected = false;
    try { store.Load("player-a"); } catch (InvalidDataException) { rejected = true; }
    Check(rejected && File.ReadAllText(file) == "{broken", "corrupt durable payload is rejected and preserved for diagnosis");
    store.Clear("player-a"); record.accountId = "player-b"; store.Save(record);
    var otherFile = Directory.GetFiles(folder, "*.json").Single();
    record.accountId = "player-a";
    File.WriteAllText(otherFile, System.Text.Json.JsonSerializer.Serialize(record, serialization));
    rejected = false; try { store.Load("player-b"); } catch (InvalidDataException) { rejected = true; }
    Check(rejected, "embedded account mismatch cannot replay under file account");
}
finally
{
    if (Directory.Exists(folder)) { foreach (var file in Directory.GetFiles(folder)) File.Delete(file); Directory.Delete(folder); }
}
using (var service = new FakeService())
using (var flow = new WorldFlow(service, new FailingPendingStore()))
{
    await flow.SignInAsync("player-a"); await flow.StartAsync();
    await flow.CompleteAsync(new[] { new PracticeAnswer { questionId = "q1", choiceId = "hello" } });
    Check(service.CompletionCalls == 0 && flow.HasPendingCompletion && flow.Error != null, "disk save failure prevents server submission without losing in-memory retry");
}
var project = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../"));
var contractText = File.ReadAllText(Path.Combine(project, "Assets/SynkWorld/Resources/avatar-contract.json"));
var contract = System.Text.Json.JsonSerializer.Deserialize<WorldAvatarContract>(contractText, serialization);
contract.Validate();
Check(contract.Allows("body", "mongle-apron-starter") && contract.Allows("neck", "mongle-scarf-first-steps"), "shared avatar contract binds exact apron and scarf item IDs");
Check(!contract.Allows("neck", "mongle-apron-starter") && !contract.Allows("body", "unknown"), "shared avatar rejects wrong-slot and unknown item identity");
contract.forward = "-Z"; bool invalidContract = false;
try { contract.Validate(); } catch (InvalidOperationException) { invalidContract = true; }
Check(invalidContract, "shared avatar orientation mismatch requires an explicit native adapter");
foreach (var file in Directory.GetFiles(Path.Combine(project, "Assets"), "*.cs", SearchOption.AllDirectories))
{
    var errors = CSharpSyntaxTree.ParseText(File.ReadAllText(file)).GetDiagnostics().Where(x => x.Severity == DiagnosticSeverity.Error).ToArray();
    Check(errors.Length == 0, "C# syntax: " + Path.GetFileName(file));
}
Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { passed = checks.Count, checks, nativeUnityCompilation = "not run: Unity Editor unavailable" }, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));

sealed class FakeService : IWorldService
{
    public bool FailCompletion, Conflict;
    public int StartCalls, BootstrapCalls, CompletionCalls;
    public string LastRequest;
    public PracticeAnswer[] LastAnswers;
    public TaskCompletionSource<WorldSnapshot> DelaySignIn;
    WorldSnapshot state = State("player-a");
    public static WorldSnapshot State(string id) => new WorldSnapshot { accountId = id, displayName = "test", revision = 2,
        items = new[] { new WorldItem { itemId = "scarf", name = "scarf", slot = "neck", owned = true }, new WorldItem { itemId = "apron", slot = "body", owned = true } },
        equipped = new[] { new EquippedItem { slot = "body", itemId = "apron" } } };
    public Task<WorldSnapshot> SignInRehearsalAsync(string accountKey, CancellationToken token) => DelaySignIn?.Task ?? Task.FromResult(state = State(accountKey));
    public Task<WorldSnapshot> BootstrapAsync(CancellationToken token) { BootstrapCalls++; return Task.FromResult(state); }
    public Task<PracticeRun> StartPracticeAsync(CancellationToken token) { StartCalls++; return Task.FromResult(new PracticeRun { runId = "run", questions = new[] { new PracticeQuestion { questionId = "q1", prompt = "hi", choices = new[] { new PracticeChoice { id = "hello", text = "안녕하세요." } } } } }); }
    public Task<RewardResult> CompletePracticeAsync(string runId, PracticeAnswer[] answers, string requestId, CancellationToken token)
    { CompletionCalls++; LastRequest = requestId; LastAnswers = answers; if (FailCompletion) throw new WorldApiException(0, "NETWORK", "offline"); return Task.FromResult(new RewardResult { itemId = "scarf", granted = true, snapshot = state }); }
    public Task<WorldSnapshot> EquipAsync(EquippedItem[] equipped, int revision, string requestId, CancellationToken token)
    { if (Conflict) throw new WorldApiException(409, "REVISION_CONFLICT", "conflict"); state.equipped = equipped; state.revision++; return Task.FromResult(state); }
    public void ClearSession() { }
    public void Dispose() { }
}

sealed class FailingPendingStore : IWorldPendingStore
{
    public PendingCompletion Load(string accountId) => null;
    public void Save(PendingCompletion value) => throw new IOException("Disk full");
    public void Clear(string accountId) { }
}
