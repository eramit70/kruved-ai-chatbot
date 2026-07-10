using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;
using KRUVED.Application.Services;
using KRUVED.Shared.Models;

namespace KRUVED.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ChatController : BaseApiController
    {
        private readonly IChatService _chatService;

        public ChatController(IChatService chatService)
        {
            _chatService = chatService;
        }

        [HttpPost]
        public async Task<IActionResult> SendMessage([FromBody] ChatRequest request)
        {
            // Retrieve session identifier from header, generate new if missing
            if (!Request.Headers.TryGetValue("X-Session-ID", out var sessionId) || string.IsNullOrWhiteSpace(sessionId))
            {
                sessionId = Guid.NewGuid().ToString();
            }

            Response.Headers["X-Session-ID"] = sessionId;

            // Query chatbot service
            var reply = await _chatService.GetChatReplyAsync(sessionId, request.Message);

            var response = new ChatResponse
            {
                Reply = reply
            };

            return SuccessResponse(response, "Reply generated successfully.");
        }

        [HttpGet("sessions")]
        public async Task<IActionResult> GetSessions()
        {
            var sessions = await _chatService.GetSessionsAsync();
            return SuccessResponse(sessions, "Sessions retrieved successfully.");
        }

        [HttpGet("sessions/{id}")]
        public async Task<IActionResult> GetSession(string id)
        {
            var session = await _chatService.GetSessionAsync(id);
            if (session == null)
            {
                return NotFoundResponse($"Session with ID {id} not found.");
            }
            return SuccessResponse(session, "Session retrieved successfully.");
        }

        [HttpPost("sessions")]
        public async Task<IActionResult> CreateSession()
        {
            var session = await _chatService.CreateSessionAsync();
            return CreatedResponse(session, "Session created successfully.");
        }

        [HttpDelete("sessions/{id}")]
        public async Task<IActionResult> DeleteSession(string id)
        {
            var deleted = await _chatService.DeleteSessionAsync(id);
            if (!deleted)
            {
                return NotFoundResponse($"Session with ID {id} not found.");
            }
            return SuccessResponse(true, "Session deleted successfully.");
        }

        [HttpGet("search")]
        public async Task<IActionResult> SearchSessions([FromQuery] string query)
        {
            var results = await _chatService.SearchSessionsAsync(query);
            return SuccessResponse(results, "Search completed successfully.");
        }
    }
}
