# Kruved AI Chatbot (KRUVED.ChatCore) — Architectural & Design Document

Welcome to the **Kruved AI Chatbot** Proof of Concept (POC) codebase. This solution is designed and developed as a technical evaluation submission for **Kruved Infotech**, showing enterprise-grade architecture, thread safety, design patterns, and testing strategies in a modern .NET environment.

---

## 1. Directory Structure & Layers

The solution strictly adheres to **Clean Architecture** guidelines, segregating concerns into cohesive, decoupled layers:

```
KRUVED/
├── src/
│   ├── KRUVED.API/           # Presentation Layer
│   │   ├── Controllers/     # API Endpoints (inheriting from BaseApiController)
│   │   ├── Middleware/      # Global Exception Handler Middleware
│   │   └── wwwroot/         # Glassmorphic Static Web Frontend (Vanilla HTML, CSS, JS)
│   │
│   ├── KRUVED.Application/   # Application Core Layer
│   │   └── Services/        # Business Logic, Chat & Groq Orchestration
│   │
│   └── KRUVED.Shared/        # Shared Model Layer (Domain DTOs)
│       ├── Models/          # Standardized API response wrappers & Message entities
│       └── Settings/        # Strongly-typed Options Models
│
└── tests/
    └── KRUVED.UnitTests/     # Test Automation Infrastructure (xUnit, Moq)
```

### Decoupling of Concerns
- **Domain & DTOs (`KRUVED.Shared`)**: Holds cross-cutting model structures (`ApiResponse<T>`, `ChatMessage`, `ChatSession`, and settings parameters).
- **Core Orchestration (`KRUVED.Application`)**: Coordinates logic and integrations. It has zero dependencies on presentation frameworks or UI-specific protocols.
- **Delivery (`KRUVED.API`)**: Directs HTTP request mapping, error serialization, static file serving, and middleware orchestration.

---

## 2. Key Engineering & Design Patterns

### 1. Clean Architecture & Dependency Direction
All dependencies flow inward. The Presentation layer depends on the Application layer, and both leverage models in the Shared project. This structure prevents leaking transport details into core services, making it easy to swap the delivery layer (e.g., from Web API to a console utility, worker service, or gRPC) without touching chat orchestrations.

### 2. Standardized API Response Wrappers (`ApiResponse<T>`)
Every REST endpoint returns a unified JSON format regardless of success or failure. This ensures stability across client platforms (Web, Angular, Flutter, iOS):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Reply generated successfully.",
  "data": {
    "reply": "..."
  },
  "errors": [],
  "traceId": "00-84c...",
  "timestamp": "2026-07-10T17:00:00Z"
}
```

### 3. Strongly Typed Options Pattern
To avoid accessing loose string keys (`builder.Configuration["Groq:ApiKey"]`) directly from business services, configurations are bound using the **Options Pattern** (`IOptions<GroqSettings>`). This enables strongly typed configuration and validation at startup:
- Configuration: `src/KRUVED.Shared/Settings/GroqSettings.cs`
- Injection: `ChatService(..., IOptions<GroqSettings> options)`

### 4. Thread-Safe In-Memory Multi-Session Store
To support ChatGPT-style multi-thread sessions without the overhead of external databases for a POC, states are stored inside an in-memory dictionary.
- All operations (Add, Retrieve, Search, Delete) utilize a central **thread synchronization monitor lock** (`lock (_lock)`) to guarantee thread safety against concurrent requests.

### 5. Automatic Title Generation & Text Search
- **Auto-Title**: On the very first message of a thread, the thread's title dynamically updates to match the user's initial input (truncated gracefully).
- **Text Search**: A text query scanner queries across both thread titles and internal conversation history content using case-insensitive invariant matching:
```csharp
s.Title.ToLowerInvariant().Contains(lowerQuery) || 
s.Messages.Any(m => m.Content.ToLowerInvariant().Contains(lowerQuery))
```

---

## 3. How to Run the Solution

### Run the Web API Backend
To restore dependencies, build projects, and boot the web host on `http://localhost:5189`:
```bash
dotnet run --project src/KRUVED.API
```

### View Swagger UI Docs
Once running, navigate to:
- `http://localhost:5189/swagger`

### Launch the Frontend Chat Interface
Open a browser and navigate to:
- `http://localhost:5189/`

---

## 4. Automation Testing (xUnit + Moq)

Our test suite uses **xUnit** and **Moq** to validate core service behaviors without making real network calls.

### Run Unit Tests
To run all tests and display the output results:
```bash
dotnet test
```
Tests verify that:
1. `CreateSession` instantiates new threads with correct defaults.
2. `GetSessions` returns seeded values.
3. `DeleteSession` cleanly purges conversations from memory.
4. `SearchSessions` accurately filters lists by search keywords.
