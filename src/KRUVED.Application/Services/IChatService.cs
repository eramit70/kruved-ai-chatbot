using System.Collections.Generic;
using System.Threading.Tasks;
using KRUVED.Shared.Models;

namespace KRUVED.Application.Services
{
    public interface IChatService
    {
        Task<IEnumerable<ChatSession>> GetSessionsAsync(string sessionId);
        Task<ChatSession> GetSessionAsync(string id, string sessionId);
        Task<ChatSession> CreateSessionAsync(string sessionId);
        Task<string> GetChatReplyAsync(string sessionId, string message);
        Task<bool> DeleteSessionAsync(string id, string sessionId);
        Task<IEnumerable<ChatSession>> SearchSessionsAsync(string query, string sessionId);
    }
}
