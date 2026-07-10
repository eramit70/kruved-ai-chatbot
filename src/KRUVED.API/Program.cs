using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Diagnostics;
using System.Linq;
using System.Text.Json;
using System;
using KRUVED.Application.Services;
using KRUVED.Shared.Models;
using KRUVED.Shared.Settings;
using KRUVED.API.Middleware;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
    });

// Custom validation responses to match Rule 5
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var errors = context.ModelState
            .Where(e => e.Value.Errors.Count > 0)
            .SelectMany(e => e.Value.Errors.Select(err => new ApiError
            {
                Field = e.Key,
                Message = err.ErrorMessage
            }))
            .ToList();

        var traceId = Activity.Current?.Id ?? context.HttpContext.TraceIdentifier;

        var response = new ApiResponse<object>
        {
            Success = false,
            StatusCode = 400,
            Message = "Validation failed.",
            Errors = errors,
            TraceId = traceId,
            Timestamp = DateTime.UtcNow
        };

        return new BadRequestObjectResult(response);
    };
});

// Configure standard services
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
// Memory cache for conversation history and HTTP clients
builder.Services.AddMemoryCache();
builder.Services.Configure<GroqSettings>(builder.Configuration.GetSection("Groq"));
builder.Services.AddHttpClient();

// Register dependencies
builder.Services.AddSingleton<IChatService, ChatService>();

var app = builder.Build();

// Configure the HTTP request pipeline.
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Serve static and default files from wwwroot
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthorization();

app.MapControllers();

app.Run();
