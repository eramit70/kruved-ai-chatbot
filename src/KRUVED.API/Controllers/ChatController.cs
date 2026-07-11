using Microsoft.AspNetCore.Mvc;
using System;
using System.Text.Json;
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

        private bool TryGetSessionId(out string sessionId)
        {
            sessionId = Request.Headers["X-Session-ID"].ToString();
            return Guid.TryParse(sessionId, out _);
        }

        [HttpPost]
        public async Task<IActionResult> SendMessage([FromBody] ChatRequest request)
        {
            if (!TryGetSessionId(out var sessionId))
            {
                return ErrorResponse("A valid X-Session-ID header is required.");
            }

            // Query chatbot service
            var reply = await _chatService.GetChatReplyAsync(sessionId, request.Message);

            var response = new ChatResponse
            {
                Reply = reply
            };

            return SuccessResponse(response, "Reply generated successfully.");
        }

        [HttpPost("stream")]
        public async Task StreamMessage([FromBody] ChatRequest request)
        {
            if (!TryGetSessionId(out var sessionId))
            {
                Response.StatusCode = 400;
                await Response.WriteAsJsonAsync(new { success = false, message = "A valid X-Session-ID header is required." });
                return;
            }

            Response.ContentType = "text/event-stream";
            Response.Headers.CacheControl = "no-cache";
            Response.Headers["X-Accel-Buffering"] = "no";

            try
            {
                await foreach (var token in _chatService.StreamChatReplyAsync(sessionId, request.Message))
                {
                    await Response.WriteAsync($"data: {JsonSerializer.Serialize(new { token })}\n\n");
                    await Response.Body.FlushAsync();
                }

                await Response.WriteAsync("data: {\"done\":true}\n\n");
                await Response.Body.FlushAsync();
            }
            catch (Exception ex)
            {
                await Response.WriteAsync($"data: {JsonSerializer.Serialize(new { error = ex.Message })}\n\n");
                await Response.Body.FlushAsync();
            }
        }

        [HttpGet("sessions")]
        public async Task<IActionResult> GetSessions()
        {
            if (!TryGetSessionId(out var sessionId)) return ErrorResponse("A valid X-Session-ID header is required.");
            var sessions = await _chatService.GetSessionsAsync(sessionId);
            return SuccessResponse(sessions, "Sessions retrieved successfully.");
        }

        [HttpGet("sessions/{id}")]
        public async Task<IActionResult> GetSession(string id)
        {
            if (!TryGetSessionId(out var sessionId)) return ErrorResponse("A valid X-Session-ID header is required.");
            var session = await _chatService.GetSessionAsync(id, sessionId);
            if (session == null)
            {
                return NotFoundResponse($"Session with ID {id} not found.");
            }
            return SuccessResponse(session, "Session retrieved successfully.");
        }

        [HttpPost("sessions")]
        public async Task<IActionResult> CreateSession()
        {
            if (!TryGetSessionId(out var sessionId)) return ErrorResponse("A valid X-Session-ID header is required.");
            var session = await _chatService.CreateSessionAsync(sessionId);
            return CreatedResponse(session, "Session created successfully.");
        }

        [HttpDelete("sessions/{id}")]
        public async Task<IActionResult> DeleteSession(string id)
        {
            if (!TryGetSessionId(out var sessionId)) return ErrorResponse("A valid X-Session-ID header is required.");
            var deleted = await _chatService.DeleteSessionAsync(id, sessionId);
            if (!deleted)
            {
                return NotFoundResponse($"Session with ID {id} not found.");
            }
            return SuccessResponse(true, "Session deleted successfully.");
        }

        [HttpGet("search")]
        public async Task<IActionResult> SearchSessions([FromQuery] string query)
        {
            if (!TryGetSessionId(out var sessionId)) return ErrorResponse("A valid X-Session-ID header is required.");
            var results = await _chatService.SearchSessionsAsync(query, sessionId);
            return SuccessResponse(results, "Search completed successfully.");
        }
    }
}
