using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;

namespace Synk.World.Core
{
    [Serializable]
    public sealed class PendingCompletion
    {
        public int version = 1;
        public string accountId;
        public string requestId;
        public PracticeRun run;
        public PracticeAnswer[] answers;

        public void Validate(string expectedAccount)
        {
            if (version != 1 || accountId != expectedAccount || string.IsNullOrEmpty(accountId) ||
                !Guid.TryParse(requestId, out _) || run == null || string.IsNullOrEmpty(run.runId) ||
                run.questions == null || run.questions.Length == 0 || run.questions.Length > 20 ||
                answers == null || answers.Length != run.questions.Length ||
                run.questions.Any(q => q == null || string.IsNullOrEmpty(q.questionId) || q.choices == null ||
                    q.choices.Length == 0 || q.choices.Any(c => c == null || string.IsNullOrEmpty(c.id))) ||
                run.questions.Select(q => q.questionId).Distinct().Count() != run.questions.Length ||
                answers.Any(a => a == null) || answers.Select(a => a.questionId).Distinct().Count() != answers.Length ||
                run.questions.Any(q => !answers.Any(a => a.questionId == q.questionId && q.choices.Any(c => c.id == a.choiceId))))
                throw new InvalidDataException("저장해 둔 놀이 결과를 확인할 수 없어요. 원본 파일은 보존했어요.");
        }
    }

    public interface IWorldPendingStore
    {
        PendingCompletion Load(string accountId);
        void Save(PendingCompletion value);
        void Clear(string accountId);
    }

    /// <summary>Only non-secret rehearsal answer payloads. Authentication is never written here.</summary>
    public sealed class WorldPendingFileStore : IWorldPendingStore
    {
        const int MaxBytes = 256 * 1024;
        readonly string directory;
        readonly Func<PendingCompletion, string> serialize;
        readonly Func<string, PendingCompletion> deserialize;
        public WorldPendingFileStore(string directory, Func<PendingCompletion, string> serialize, Func<string, PendingCompletion> deserialize)
        {
            this.directory = Path.GetFullPath(directory);
            this.serialize = serialize ?? throw new ArgumentNullException(nameof(serialize));
            this.deserialize = deserialize ?? throw new ArgumentNullException(nameof(deserialize));
        }
        string PathFor(string accountId)
        {
            if (string.IsNullOrEmpty(accountId)) throw new ArgumentException("계정을 확인해 주세요.");
            using (var hash = SHA256.Create())
            {
                string file = BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(accountId))).Replace("-", "").ToLowerInvariant();
                return Path.Combine(directory, file + ".json");
            }
        }
        public PendingCompletion Load(string accountId)
        {
            string path = PathFor(accountId);
            if (!File.Exists(path)) return null;
            if (new FileInfo(path).Length > MaxBytes) throw new InvalidDataException("저장해 둔 결과 파일의 크기를 확인해 주세요.");
            PendingCompletion result;
            try { result = deserialize(File.ReadAllText(path)); }
            catch (Exception e) { throw new InvalidDataException("저장해 둔 놀이 결과를 읽지 못했어요. 원본 파일은 보존했어요.", e); }
            if (result == null) throw new InvalidDataException("저장해 둔 놀이 결과가 비어 있어요.");
            result.Validate(accountId); return result;
        }
        public void Save(PendingCompletion value)
        {
            value.Validate(value.accountId);
            byte[] bytes = Encoding.UTF8.GetBytes(serialize(value));
            if (bytes.Length > MaxBytes) throw new InvalidDataException("놀이 결과의 크기를 확인해 주세요.");
            Directory.CreateDirectory(directory);
            string path = PathFor(value.accountId), temporary = path + ".tmp";
            // Commit before contacting the server. Interrupted temp writes never replace the last full record.
            using (var stream = new FileStream(temporary, FileMode.Create, FileAccess.Write, FileShare.None))
            { stream.Write(bytes, 0, bytes.Length); stream.Flush(true); }
            if (File.Exists(path)) File.Replace(temporary, path, null);
            else File.Move(temporary, path);
        }
        public void Clear(string accountId)
        {
            string path = PathFor(accountId);
            if (File.Exists(path)) File.Delete(path);
        }
    }
}
