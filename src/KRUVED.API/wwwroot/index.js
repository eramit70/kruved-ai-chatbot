document.addEventListener('DOMContentLoaded', () => {
    const messagesContainer = document.getElementById('messages-container');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const newChatBtn = document.getElementById('new-chat-btn');
    const sendBtn = document.getElementById('send-btn');
    const sessionsList = document.getElementById('sessions-list');
    const searchInput = document.getElementById('search-input');

    let currentSessionId = localStorage.getItem('chat_session_id') || null;

    // Helper to generate UUID if needed
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function appendMessage(sender, text, isUser = false, isSystem = false) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        if (isUser) {
            messageDiv.classList.add('user');
        } else if (isSystem) {
            messageDiv.classList.add('system');
        } else {
            messageDiv.classList.add('assistant');
        }

        const avatarDiv = document.createElement('div');
        avatarDiv.classList.add('avatar-sm');
        const icon = document.createElement('i');
        if (isUser) {
            icon.className = 'fa-solid fa-user';
        } else if (isSystem) {
            icon.className = 'fa-solid fa-circle-exclamation';
        } else {
            icon.className = 'fa-solid fa-robot';
        }
        avatarDiv.appendChild(icon);

        const wrapperDiv = document.createElement('div');
        wrapperDiv.classList.add('message-wrapper');

        const senderDiv = document.createElement('div');
        senderDiv.classList.add('message-sender');
        senderDiv.textContent = sender;

        const bubbleDiv = document.createElement('div');
        bubbleDiv.classList.add('message-bubble');
        
        // Parse markdown for AI responses only, keep user messages as plain text
        if (!isUser && !isSystem) {
            const parsedMarkdown = marked.parse(text);
            const sanitizedHtml = DOMPurify.sanitize(parsedMarkdown);
            bubbleDiv.innerHTML = sanitizedHtml;
        } else {
            bubbleDiv.textContent = text;
        }

        wrapperDiv.appendChild(senderDiv);
        wrapperDiv.appendChild(bubbleDiv);

        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(wrapperDiv);

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function showTypingIndicator() {
        const loaderDiv = document.createElement('div');
        loaderDiv.classList.add('message', 'assistant');
        loaderDiv.id = 'typing-indicator-msg';

        const avatarDiv = document.createElement('div');
        avatarDiv.classList.add('avatar-sm');
        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-robot';
        avatarDiv.appendChild(icon);

        const wrapperDiv = document.createElement('div');
        wrapperDiv.classList.add('message-wrapper');

        const senderDiv = document.createElement('div');
        senderDiv.classList.add('message-sender');
        senderDiv.textContent = 'Kruved AI Assistant';

        const bubbleDiv = document.createElement('div');
        bubbleDiv.classList.add('message-bubble');

        const typingIndicator = document.createElement('div');
        typingIndicator.classList.add('typing-indicator');
        typingIndicator.innerHTML = '<span></span><span></span><span></span>';

        bubbleDiv.appendChild(typingIndicator);
        wrapperDiv.appendChild(senderDiv);
        wrapperDiv.appendChild(bubbleDiv);

        loaderDiv.appendChild(avatarDiv);
        loaderDiv.appendChild(wrapperDiv);

        messagesContainer.appendChild(loaderDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('typing-indicator-msg');
        if (indicator) {
            indicator.remove();
        }
    }

    // Load dynamic sessions list
    async function loadSessions(query = '') {
        try {
            const url = query ? `/api/chat/search?query=${encodeURIComponent(query)}` : '/api/chat/sessions';
            const response = await fetch(url);
            const result = await response.json();
            
            if (response.ok && result.success) {
                renderSessions(result.data);
            }
        } catch (error) {
            console.error('Error loading sessions:', error);
        }
    }

    // Render session items in the sidebar
    function renderSessions(sessions) {
        sessionsList.innerHTML = '';
        
        if (sessions.length === 0) {
            const noSessionDiv = document.createElement('div');
            noSessionDiv.style.padding = '12px 24px';
            noSessionDiv.style.fontSize = '12px';
            noSessionDiv.style.color = 'var(--text-secondary)';
            noSessionDiv.style.textAlign = 'center';
            noSessionDiv.textContent = 'No conversations found';
            sessionsList.appendChild(noSessionDiv);
            return;
        }

        sessions.forEach(session => {
            const itemDiv = document.createElement('div');
            itemDiv.className = `session-item ${session.id === currentSessionId ? 'active' : ''}`;
            
            // Content container (icon + title)
            const contentDiv = document.createElement('div');
            contentDiv.className = 'session-item-content';
            
            const icon = document.createElement('i');
            icon.className = 'fa-solid fa-message session-item-icon';
            
            const titleSpan = document.createElement('span');
            titleSpan.className = 'session-item-title';
            titleSpan.textContent = session.title || 'New Conversation';
            
            contentDiv.appendChild(icon);
            contentDiv.appendChild(titleSpan);
            
            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'session-item-delete';
            deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
            deleteBtn.title = 'Delete Conversation';
            
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`Delete conversation "${session.title}"?`)) {
                    await deleteChatSession(session.id);
                }
            });

            itemDiv.appendChild(contentDiv);
            itemDiv.appendChild(deleteBtn);
            
            // Click to load
            itemDiv.addEventListener('click', () => {
                selectSession(session.id);
            });

            sessionsList.appendChild(itemDiv);
        });
    }

    // Select/Load specific chat session
    async function selectSession(sessionId) {
        currentSessionId = sessionId;
        localStorage.setItem('chat_session_id', sessionId);
        
        // Highlight active session item in sidebar
        const items = sessionsList.querySelectorAll('.session-item');
        items.forEach(item => item.classList.remove('active'));
        
        // Reload list to update active highlight if matches query
        loadSessions(searchInput.value.trim());

        // Clear screen and load messages
        messagesContainer.innerHTML = '';
        
        try {
            const response = await fetch(`/api/chat/sessions/${sessionId}`);
            const result = await response.json();
            
            if (response.ok && result.success) {
                const session = result.data;
                if (session.messages && session.messages.length > 0) {
                    session.messages.forEach(msg => {
                        const sender = msg.role === 'model' ? 'Kruved AI Assistant' : 'You';
                        appendMessage(sender, msg.content, msg.role !== 'model');
                    });
                } else {
                    appendMessage('Kruved AI Assistant', 'Hello! I am your Kruved AI assistant. How can I help you today?');
                }
            } else {
                appendMessage('Kruved AI Assistant', 'Hello! I am your Kruved AI assistant. How can I help you today?');
            }
        } catch (error) {
            console.error('Error loading session messages:', error);
            appendMessage('Kruved AI Assistant', 'Hello! I am your Kruved AI assistant. How can I help you today?');
        }
    }

    // Create a new session
    async function createNewSession() {
        try {
            const response = await fetch('/api/chat/sessions', {
                method: 'POST'
            });
            const result = await response.json();
            if (response.ok && result.success) {
                const newSession = result.data;
                currentSessionId = newSession.id;
                localStorage.setItem('chat_session_id', currentSessionId);
                await loadSessions();
                await selectSession(currentSessionId);
                searchInput.value = '';
            }
        } catch (error) {
            console.error('Error creating new session:', error);
        }
    }

    // Delete a chat session
    async function deleteChatSession(sessionId) {
        try {
            const response = await fetch(`/api/chat/sessions/${sessionId}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            if (response.ok && result.success) {
                await loadSessions();
                
                // If we deleted the active session, switch to the first available or create a new one
                if (currentSessionId === sessionId) {
                    const nextResponse = await fetch('/api/chat/sessions');
                    const nextResult = await nextResponse.json();
                    if (nextResponse.ok && nextResult.success && nextResult.data.length > 0) {
                        await selectSession(nextResult.data[0].id);
                    } else {
                        await createNewSession();
                    }
                }
            }
        } catch (error) {
            console.error('Error deleting session:', error);
        }
    }

    // Chat submit
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const messageText = messageInput.value.trim();
        if (!messageText) return;

        // If no active session, create one first
        if (!currentSessionId) {
            currentSessionId = generateUUID();
            localStorage.setItem('chat_session_id', currentSessionId);
        }

        // Render user bubble
        appendMessage('You', messageText, true);
        messageInput.value = '';
        messageInput.focus();

        // Render loader
        showTypingIndicator();
        messageInput.disabled = true;
        sendBtn.disabled = true;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': currentSessionId
                },
                body: JSON.stringify({ message: messageText })
            });

            const result = await response.json();
            removeTypingIndicator();

            if (response.ok && result.success) {
                appendMessage('Kruved AI Assistant', result.data.reply);
                // Reload sessions to update title if it was the first message
                await loadSessions(searchInput.value.trim());
            } else {
                let errorMsg = result.message || 'Unknown error occurred.';
                if (result.errors && result.errors.length > 0) {
                    errorMsg += '\nDetails:\n' + result.errors.map(err => `- ${err.field}: ${err.message}`).join('\n');
                }
                appendMessage('System Error', errorMsg, false, true);
            }
        } catch (error) {
            removeTypingIndicator();
            appendMessage('System Error', 'Failed to connect to the server. Please verify the ASP.NET Core API is running.', false, true);
            console.error('Error sending message:', error);
        } finally {
            messageInput.disabled = false;
            sendBtn.disabled = false;
            messageInput.focus();
        }
    });

    // Search input event
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            loadSessions(searchInput.value.trim());
        }, 300);
    });

    // New chat button action
    newChatBtn.addEventListener('click', () => {
        createNewSession();
    });

    // Initial startup sequence
    async function init() {
        await loadSessions();
        
        // If there's a stored session ID, use it. Otherwise find the first session or create one.
        if (currentSessionId) {
            const response = await fetch(`/api/chat/sessions/${currentSessionId}`);
            if (response.ok) {
                await selectSession(currentSessionId);
            } else {
                currentSessionId = null;
            }
        }
        
        if (!currentSessionId) {
            // Check if backend already has sessions we can select
            const response = await fetch('/api/chat/sessions');
            const result = await response.json();
            if (response.ok && result.success && result.data.length > 0) {
                await selectSession(result.data[0].id);
            } else {
                await createNewSession();
            }
        }
    }

    init();
});
