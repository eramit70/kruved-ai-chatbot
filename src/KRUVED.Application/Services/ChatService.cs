using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using KRUVED.Shared.Models;
using KRUVED.Shared.Settings;

namespace KRUVED.Application.Services
{
    public class ChatService : IChatService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly GroqSettings _groqSettings;
        private readonly Dictionary<string, ChatSession> _sessions;
        private readonly object _lock = new();
        private const string SystemPrompt = "You are a helpful, concise assistant.";

        public ChatService(IHttpClientFactory httpClientFactory, IOptions<GroqSettings> groqOptions)
        {
            _httpClientFactory = httpClientFactory;
            _groqSettings = groqOptions.Value;
            _sessions = new Dictionary<string, ChatSession>();
        }

        public Task<IEnumerable<ChatSession>> GetSessionsAsync(string sessionId)
        {
            lock (_lock)
            {
                var sessionsList = _sessions.Values
                    .Where(s => s.Id == sessionId)
                    .OrderByDescending(s => s.CreatedAt)
                    .Select(s => new ChatSession
                    {
                        Id = s.Id,
                        Title = s.Title,
                        CreatedAt = s.CreatedAt,
                        Messages = s.Messages
                    })
                    .ToList();
                return Task.FromResult<IEnumerable<ChatSession>>(sessionsList);
            }
        }

        public Task<ChatSession> GetSessionAsync(string id, string sessionId)
        {
            lock (_lock)
            {
                if (id == sessionId && _sessions.TryGetValue(id, out var session))
                {
                    return Task.FromResult(session);
                }
                return Task.FromResult<ChatSession>(null);
            }
        }

        public Task<ChatSession> CreateSessionAsync(string sessionId)
        {
            lock (_lock)
            {
                if (_sessions.TryGetValue(sessionId, out var existingSession))
                {
                    return Task.FromResult(existingSession);
                }

                var session = new ChatSession
                {
                    Id = sessionId,
                    Title = "New Conversation",
                    CreatedAt = DateTime.UtcNow
                };
                _sessions[session.Id] = session;
                return Task.FromResult(session);
            }
        }

        public Task<bool> DeleteSessionAsync(string id, string sessionId)
        {
            lock (_lock)
            {
                var removed = id == sessionId && _sessions.Remove(id);
                return Task.FromResult(removed);
            }
        }

        public Task<IEnumerable<ChatSession>> SearchSessionsAsync(string query, string sessionId)
        {
            if (string.IsNullOrWhiteSpace(query))
            {
                return GetSessionsAsync(sessionId);
            }

            lock (_lock)
            {
                var lowerQuery = query.ToLowerInvariant();
                var matches = _sessions.Values
                    .Where(s => s.Id == sessionId)
                    .Where(s => (s.Title != null && s.Title.ToLowerInvariant().Contains(lowerQuery)) ||
                                s.Messages.Any(m => m.Content != null && m.Content.ToLowerInvariant().Contains(lowerQuery)))
                    .OrderByDescending(s => s.CreatedAt)
                    .ToList();

                return Task.FromResult<IEnumerable<ChatSession>>(matches);
            }
        }

        public async Task<string> GetChatReplyAsync(string sessionId, string message)
        {
            // 1. Validate API Key configuration
            var apiKey = _groqSettings.ApiKey;
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                throw new InvalidOperationException("Groq API key is not configured. Please add 'Groq:ApiKey' to your appsettings.json or user secrets.");
            }

            // 2. Validate user message
            if (string.IsNullOrWhiteSpace(message))
            {
                throw new ArgumentException("Message cannot be empty.", nameof(message));
            }

            // 3. Find or create the session
            ChatSession session;
            lock (_lock)
            {
                if (!_sessions.TryGetValue(sessionId, out session))
                {
                    session = new ChatSession
                    {
                        Id = sessionId,
                        Title = message.Length > 30 ? message.Substring(0, 30) + "..." : message,
                        CreatedAt = DateTime.UtcNow
                    };
                    _sessions[sessionId] = session;
                }
                else if (session.Title == "New Conversation" && session.Messages.Count == 0)
                {
                    // Generate a better title on the first user message
                    session.Title = message.Length > 30 ? message.Substring(0, 30) + "..." : message;
                }

                // Append user message to history
                session.Messages.Add(new ChatMessage { Role = "user", Content = message });
            }

            // 4. Structure payload for Groq's OpenAI-compatible chat/completions endpoint
            List<ChatMessage> messagesCopy;
            lock (_lock)
            {
                messagesCopy = new List<ChatMessage>(session.Messages);
            }

            var messages = new List<object>
            {
                new { role = "system", content = SystemPrompt }
            };

            messages.AddRange(messagesCopy.Select(m => new
            {
                role = m.Role == "model" ? "assistant" : "user",
                content = m.Content
            }));

            var payload = new
            {
                model = string.IsNullOrWhiteSpace(_groqSettings.Model) ? "llama-3.3-70b-versatile" : _groqSettings.Model,
                messages = messages
            };

            // 5. Execute API POST request
            var client = _httpClientFactory.CreateClient();
            var request = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            request.Content = JsonContent.Create(payload);

            HttpResponseMessage response;
            try
            {
                response = await client.SendAsync(request);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException("Failed to establish connection to the Groq API.", ex);
            }

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException($"Groq API error (Status: {response.StatusCode}): {errorContent}");
            }

            // 6. Parse output payload (standard OpenAI-compatible response shape)
            var responseData = await response.Content.ReadFromJsonAsync<JsonElement>();
            string reply = null;

            try
            {
                if (responseData.TryGetProperty("choices", out var choices) &&
                    choices.ValueKind == JsonValueKind.Array &&
                    choices.GetArrayLength() > 0)
                {
                    var firstChoice = choices[0];
                    if (firstChoice.TryGetProperty("message", out var messageObj) &&
                        messageObj.TryGetProperty("content", out var contentProp))
                    {
                        reply = contentProp.GetString();
                    }
                }
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException("Failed to decode response format from the Groq API.", ex);
            }

            if (string.IsNullOrEmpty(reply))
            {
                throw new InvalidOperationException("Groq API completed request but returned an empty or invalid content candidate.");
            }

            // 7. Append model reply to history
            lock (_lock)
            {
                session.Messages.Add(new ChatMessage { Role = "model", Content = reply });
            }

            return reply;
        }
    }
}
