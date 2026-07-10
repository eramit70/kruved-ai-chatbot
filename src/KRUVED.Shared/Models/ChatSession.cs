using System;
using System.Collections.Generic;

namespace KRUVED.Shared.Models
{
    public class ChatSession
    {
        public string Id { get; set; }
        public string Title { get; set; }
        public List<ChatMessage> Messages { get; set; } = new();
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
