using System.ComponentModel.DataAnnotations;

namespace KRUVED.Shared.Models
{
    public class ChatRequest
    {
        [Required(ErrorMessage = "Message cannot be empty.")]
        public string Message { get; set; }
    }
}
