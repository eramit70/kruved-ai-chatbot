using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using System;
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
            var sessionId = Guid.NewGuid().ToString();
            var session = await _chatService.CreateSessionAsync(sessionId);

            // Assert
            Assert.NotNull(session);
            Assert.False(string.IsNullOrWhiteSpace(session.Id));
            Assert.Equal("New Conversation", session.Title);
            Assert.Empty(session.Messages);
        }

        [Fact]
        public async Task GetSessionsAsync_ShouldReturnOnlyTheRequestedSession()
        {
            var sessionId = Guid.NewGuid().ToString();
            await _chatService.CreateSessionAsync(sessionId);
            var sessions = await _chatService.GetSessionsAsync(sessionId);

            // Assert
            Assert.NotEmpty(sessions);
            Assert.Single(sessions);
            Assert.Equal(sessionId, sessions.Single().Id);
        }

        [Fact]
        public async Task DeleteSessionAsync_ShouldRemoveExistingSession()
        {
            // Arrange
            var sessionId = Guid.NewGuid().ToString();
            var newSession = await _chatService.CreateSessionAsync(sessionId);

            // Act
            var deleted = await _chatService.DeleteSessionAsync(newSession.Id, sessionId);
            var sessions = await _chatService.GetSessionsAsync(sessionId);

            // Assert
            Assert.True(deleted);
            Assert.DoesNotContain(sessions, s => s.Id == newSession.Id);
        }

        [Fact]
        public async Task SearchSessionsAsync_ShouldFilterByTitleOrContent()
        {
            // Arrange
            var sessionId = Guid.NewGuid().ToString();
            var targetSession = await _chatService.CreateSessionAsync(sessionId);
            targetSession.Title = "Learning C#";

            // Act
            var searchResults = (await _chatService.SearchSessionsAsync("Learning", sessionId)).ToList();

            // Assert
            Assert.Single(searchResults);
            Assert.Equal(targetSession.Id, searchResults[0].Id);
        }

        [Fact]
        public async Task SessionOperations_ShouldNotExposeAnotherTabHistory()
        {
            var sessionA = Guid.NewGuid().ToString();
            var sessionB = Guid.NewGuid().ToString();
            await _chatService.CreateSessionAsync(sessionA);
            await _chatService.CreateSessionAsync(sessionB);

            var visibleToA = await _chatService.GetSessionsAsync(sessionA);
            var sessionBVisibleToA = await _chatService.GetSessionAsync(sessionB, sessionA);
            var deleteBAsA = await _chatService.DeleteSessionAsync(sessionB, sessionA);

            Assert.Single(visibleToA);
            Assert.Equal(sessionA, visibleToA.Single().Id);
            Assert.Null(sessionBVisibleToA);
            Assert.False(deleteBAsA);
        }
    }
}
