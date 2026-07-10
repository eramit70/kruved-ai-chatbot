using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using KRUVED.Shared.Models;

namespace KRUVED.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public abstract class BaseApiController : ControllerBase
    {
        protected string GetTraceId() => Activity.Current?.Id ?? HttpContext.TraceIdentifier;

        protected IActionResult SuccessResponse<T>(T data, string message = "Success", object metadata = null)
        {
            var response = new ApiResponse<T>
            {
                Success = true,
                StatusCode = 200,
                Message = message,
                Data = data,
                TraceId = GetTraceId(),
                Metadata = metadata
            };
            return Ok(response);
        }

        protected IActionResult CreatedResponse<T>(T data, string message = "Resource created successfully", object metadata = null)
        {
            var response = new ApiResponse<T>
            {
                Success = true,
                StatusCode = 201,
                Message = message,
                Data = data,
                TraceId = GetTraceId(),
                Metadata = metadata
            };
            return StatusCode(201, response);
        }

        protected IActionResult ErrorResponse(string message, List<ApiError> errors = null, int statusCode = 400)
        {
            var response = new ApiResponse<object>
            {
                Success = false,
                StatusCode = statusCode,
                Message = message,
                Errors = errors ?? new List<ApiError>(),
                TraceId = GetTraceId()
            };
            return StatusCode(statusCode, response);
        }

        protected IActionResult NotFoundResponse(string message = "Resource not found")
        {
            var response = new ApiResponse<object>
            {
                Success = false,
                StatusCode = 404,
                Message = message,
                TraceId = GetTraceId()
            };
            return NotFound(response);
        }
    }
}
