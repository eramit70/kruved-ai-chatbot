using System;
using System.Collections.Generic;

namespace KRUVED.Shared.Models
{
    public class ApiResponse<T>
    {
        public bool Success { get; set; }
        public int StatusCode { get; set; }
        public string Message { get; set; }
        public T Data { get; set; }
        public List<ApiError> Errors { get; set; } = new List<ApiError>();
        public string TraceId { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public object Metadata { get; set; }
    }
}
