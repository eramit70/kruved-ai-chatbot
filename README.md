# KRUVED AI Chatbot Web Application

A simple AI chatbot web application built using **ASP.NET Core Web API (.NET 8)** as the backend, querying the Gemini API, and providing a premium **glassmorphic HTML/CSS/JS frontend** served statically.

## Architecture

This project follows **Clean Architecture** patterns:
- **`KRUVED.Shared`**: Holds Request/Response DTOs (`ChatRequest`, `ChatResponse`, `ChatMessage`) and standardized API response structures (`ApiResponse<T>`, `ApiError`).
- **`KRUVED.Application`**: Handles Gemini API connection, HttpClient creation, and session history management through sliding memory cache (`IMemoryCache`).
- **`KRUVED.API`**: Exposes `/api/chat` POST endpoint, runs exception middleware, validates payload schemas, and serves static files.

## Prerequisites

- [.NET SDK 8.0](https://dotnet.microsoft.com/download/dotnet/8.0) or higher.

## Getting Started

### 1. Configure the Gemini API Key

You can obtain a Gemini API key from [Google AI Studio](https://aistudio.google.com/).

Once obtained, you can configure it in one of three ways:

#### Option A: User Secrets (Recommended for Local Dev)
Navigate to the API project directory and run:
```bash
cd src/KRUVED.API
dotnet user-secrets set "Gemini:ApiKey" "YOUR_API_KEY"
```

#### Option B: Environment Variables
Set the environment variable:
- **Windows (PowerShell)**:
  ```powershell
  $env:Gemini__ApiKey="YOUR_API_KEY"
  ```
- **Linux/macOS**:
  ```bash
  export Gemini__ApiKey="YOUR_API_KEY"
  ```

#### Option C: appsettings.json
Open `src/KRUVED.API/appsettings.json` and insert your key:
```json
  "Gemini": {
    "ApiKey": "YOUR_API_KEY"
  }
```

---

### 2. Run the Application

From the root workspace directory, run:
```bash
dotnet run --project src/KRUVED.API
```
Or open the solution in Visual Studio / VS Code and click run.

### 3. Open in Browser

The server will start and host the application (typically at `http://localhost:5000` / `https://localhost:5001` or dynamic dev port). Simply open the URL printed in the terminal.

---

## Standardized Responses

All API endpoints return responses using the unified wrapper `ApiResponse<T>`:

### Success Response (HTTP 200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Reply generated successfully.",
  "data": {
    "reply": "Hello! I am here to help you."
  },
  "errors": [],
  "traceId": "00-bfb91d293883a452ef2049e7b28f9d0c-03d36b856ad8834f-00",
  "timestamp": "2026-07-10T15:22:00Z",
  "metadata": null
}
```

### Validation Error (HTTP 400)
Returned when sending an empty or invalid message:
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed.",
  "data": null,
  "errors": [
    {
      "field": "Message",
      "message": "Message cannot be empty."
    }
  ],
  "traceId": "00-...",
  "timestamp": "..."
}
```

### System / Configuration Error (HTTP 500)
Returned when the Gemini API key is missing or calls fail:
```json
{
  "success": false,
  "statusCode": 500,
  "message": "Gemini API key is not configured. Please add 'Gemini:ApiKey' to your appsettings.json or user secrets.",
  "errors": [
    {
      "field": "Server",
      "message": "Gemini API key is not configured. Please add 'Gemini:ApiKey' to your appsettings.json or user secrets."
    }
  ],
  "traceId": "00-...",
  "timestamp": "..."
}
```
