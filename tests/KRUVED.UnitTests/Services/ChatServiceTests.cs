using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using Moq;
using KRUVED.Application.Services;
using KRUVED.Shared.Settings;
using Xunit;

namespace KRUVED.UnitTests.Services
{
    public class ChatServiceTests
    {
        private readonly Mock<IHttpClientFactory> _httpClientFactoryMock;
        private readonly Mock<IOptions<GroqSettings>> _groqOptionsMock;
        private readonly ChatService _chatService;

        public ChatServiceTests()
        {
            _httpClientFactoryMock = new Mock<IHttpClientFactory>();
            _groqOptionsMock = new Mock<IOptions<GroqSettings>>();

            var settings = new GroqSettings
            {
                ApiKey = "mock-key",
                Model = "mock-model"
            };
            _groqOptionsMock.Setup(o => o.Value).Returns(settings);

            _chatService = new ChatService(_httpClientFactoryMock.Object, _groqOptionsMock.Object);
        }

        [Fact]
        public async Task CreateSessionAsync_ShouldInitializeWithDefaultTitleAndUniqueId()
        {
            // Act
            var session = await _chatService.CreateSessionAsync();

            // Assert
            Assert.NotNull(session);
            Assert.False(string.IsNullOrWhiteSpace(session.Id));
            Assert.Equal("New Conversation", session.Title);
            Assert.Empty(session.Messages);
        }

        [Fact]
        public async Task GetSessionsAsync_ShouldReturnSeededSession()
        {
            // Act
            var sessions = await _chatService.GetSessionsAsync();

            // Assert
            Assert.NotEmpty(sessions);
            Assert.Contains(sessions, s => s.Title == "New Conversation");
        }

        [Fact]
        public async Task DeleteSessionAsync_ShouldRemoveExistingSession()
        {
            // Arrange
            var newSession = await _chatService.CreateSessionAsync();

            // Act
            var deleted = await _chatService.DeleteSessionAsync(newSession.Id);
            var sessions = await _chatService.GetSessionsAsync();

            // Assert
            Assert.True(deleted);
            Assert.DoesNotContain(sessions, s => s.Id == newSession.Id);
        }

        [Fact]
        public async Task SearchSessionsAsync_ShouldFilterByTitleOrContent()
        {
            // Arrange
            var targetSession = await _chatService.CreateSessionAsync();
            targetSession.Title = "Learning C#";

            // Act
            var searchResults = (await _chatService.SearchSessionsAsync("Learning")).ToList();

            // Assert
            Assert.Single(searchResults);
            Assert.Equal(targetSession.Id, searchResults[0].Id);
        }
    }
}
