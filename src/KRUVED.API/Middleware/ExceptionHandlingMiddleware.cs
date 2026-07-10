using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Text.Json;
using System.Threading.Tasks;
using KRUVED.Shared.Models;

namespace KRUVED.API.Middleware
{
    public class ExceptionHandlingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ExceptionHandlingMiddleware> _logger;

        public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An unhandled exception occurred: {Message}", ex.Message);
                await HandleExceptionAsync(context, ex);
            }
        }

        private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
        {
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;

            var traceId = Activity.Current?.Id ?? context.TraceIdentifier;

            // Differentiate system/api key errors from other server issues if necessary
            var errorMessage = exception is InvalidOperationException && exception.Message.Contains("API key") 
                ? exception.Message 
                : "An unexpected error occurred. Please contact administrator.";

            var response = new ApiResponse<object>
            {
                Success = false,
                StatusCode = StatusCodes.Status500InternalServerError,
                Message = errorMessage,
                Errors = new List<ApiError>
                {
                    new ApiError { Field = "Server", Message = exception.Message }
                },
                TraceId = traceId,
                Timestamp = DateTime.UtcNow
            };

            var options = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };

            var json = JsonSerializer.Serialize(response, options);
            await context.Response.WriteAsync(json);
        }
    }
}
