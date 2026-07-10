using System.Collections.Generic;
using System.Threading.Tasks;
using KRUVED.Shared.Models;

namespace KRUVED.Application.Services
{
    public interface IChatService
    {
        Task<IEnumerable<ChatSession>> GetSessionsAsync();
        Task<ChatSession> GetSessionAsync(string id);
        Task<ChatSession> CreateSessionAsync();
        Task<string> GetChatReplyAsync(string sessionId, string message);
        Task<bool> DeleteSessionAsync(string id);
        Task<IEnumerable<ChatSession>> SearchSessionsAsync(string query);
    }
}
