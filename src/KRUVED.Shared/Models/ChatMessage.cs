namespace KRUVED.Shared.Models
{
    public class ChatMessage
    {
        public string Role { get; set; } // "user" or "model"
        public string Content { get; set; }
    }
}
