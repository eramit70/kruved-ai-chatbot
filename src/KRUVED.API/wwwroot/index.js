document.addEventListener('DOMContentLoaded', () => {
    const messagesContainer = document.getElementById('messages-container');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const newChatBtn = document.getElementById('new-chat-btn');
    const sendBtn = document.getElementById('send-btn');
    const sessionsList = document.getElementById('sessions-list');
    const searchInput = document.getElementById('search-input');
    const sidebar = document.querySelector('.sidebar');
    const menuBtn = document.getElementById('menu-btn');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');
    const themeToggle = document.getElementById('theme-toggle');
    const themeStorageKey = 'kruved_theme';
    let typingScrollTimer;

    let currentSessionId = sessionStorage.getItem('chat_session_id') || crypto.randomUUID();
    sessionStorage.setItem('chat_session_id', currentSessionId);

    function sessionHeaders(headers = {}) {
        return { ...headers, 'X-Session-ID': currentSessionId };
    }

    function scrollToLatestMessage() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function applyTheme(theme) {
        const isLight = theme === 'light';
        document.documentElement.dataset.theme = isLight ? 'light' : 'dark';
        themeToggle.innerHTML = isLight
            ? '<i class="fa-solid fa-moon"></i><span>Dark</span>'
            : '<i class="fa-solid fa-sun"></i><span>Light</span>';
        themeToggle.setAttribute('aria-label', `Switch to ${isLight ? 'dark' : 'light'} theme`);
        localStorage.setItem(themeStorageKey, isLight ? 'light' : 'dark');
    }

    function setSidebarOpen(isOpen) {
        sidebar.classList.toggle('is-open', isOpen);
        sidebarBackdrop.classList.toggle('is-visible', isOpen);
        menuBtn.setAttribute('aria-expanded', String(isOpen));
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
        if (isUser) {
            avatarDiv.textContent = '🙂';
        } else if (isSystem) {
            const icon = document.createElement('i');
            icon.className = 'fa-solid fa-circle-exclamation';
            avatarDiv.appendChild(icon);
        } else {
            avatarDiv.textContent = '🤖';
        }

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
            addCodeCopyButtons(bubbleDiv);
        } else {
            bubbleDiv.textContent = text;
        }

        wrapperDiv.appendChild(senderDiv);
        wrapperDiv.appendChild(bubbleDiv);

        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(wrapperDiv);

        messagesContainer.appendChild(messageDiv);
        scrollToLatestMessage();

        if (!isUser && !isSystem) {
            const cursor = document.createElement('span');
            cursor.className = 'response-cursor';
            cursor.setAttribute('aria-hidden', 'true');
            bubbleDiv.appendChild(cursor);
            window.setTimeout(() => cursor.remove(), 1200);
        }

        return bubbleDiv;
    }

    async function renderStreamingReply(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let reply = '';
        let replyBubble;
        let cursor;

        const delay = milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds));

        const renderReply = () => {
            replyBubble.innerHTML = DOMPurify.sanitize(marked.parse(reply));
            replyBubble.appendChild(cursor);
            addCodeCopyButtons(replyBubble);
            scrollToLatestMessage();
        };

        while (true) {
            const { value, done } = await reader.read();
            buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

            const events = buffer.split('\n\n');
            buffer = events.pop();

            for (const event of events) {
                const dataLine = event.split('\n').find(line => line.startsWith('data: '));
                if (!dataLine) continue;

                const payload = JSON.parse(dataLine.slice(6));
                if (payload.error) throw new Error(payload.error);
                if (!payload.token) continue;

                if (!replyBubble) {
                    removeTypingIndicator();
                    replyBubble = appendMessage('Kruved AI Assistant', '');
                    replyBubble.innerHTML = '';
                    cursor = document.createElement('span');
                    cursor.className = 'response-cursor';
                    cursor.setAttribute('aria-hidden', 'true');
                }

                // A provider can send many words in one chunk. Reveal each word separately so
                // the result still feels like a ChatGPT-style typed response.
                const words = payload.token.match(/\S+\s*|\s+/g) || [payload.token];
                for (const word of words) {
                    reply += word;
                    renderReply();
                    await delay(22);
                }
            }

            if (done) break;
        }

        if (!replyBubble) throw new Error('The assistant returned an empty response.');
        cursor.remove();
        await loadSessions(searchInput.value.trim());
    }

    function addCodeCopyButtons(messageBubble) {
        messageBubble.querySelectorAll('pre').forEach(pre => {
            const code = pre.querySelector('code');
            if (!code || pre.querySelector('.copy-code-btn')) return;

            const copyButton = document.createElement('button');
            copyButton.type = 'button';
            copyButton.className = 'copy-code-btn';
            copyButton.innerHTML = '<i class="fa-regular fa-copy"></i><span>Copy</span>';
            copyButton.setAttribute('aria-label', 'Copy code');

            copyButton.addEventListener('click', async () => {
                try {
                    await copyCodeToClipboard(code.textContent || '');
                    copyButton.innerHTML = '<i class="fa-solid fa-check"></i><span>Copied</span>';
                    window.setTimeout(() => {
                        copyButton.innerHTML = '<i class="fa-regular fa-copy"></i><span>Copy</span>';
                    }, 1800);
                } catch {
                    copyButton.querySelector('span').textContent = 'Unable to copy';
                }
            });

            pre.appendChild(copyButton);
        });
    }

    async function copyCodeToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = text;
        tempTextArea.setAttribute('readonly', 'true');
        tempTextArea.style.position = 'fixed';
        tempTextArea.style.top = '-9999px';
        tempTextArea.style.left = '-9999px';
        document.body.appendChild(tempTextArea);
        tempTextArea.focus();
        tempTextArea.select();

        const copied = document.execCommand('copy');
        document.body.removeChild(tempTextArea);

        if (!copied) {
            throw new Error('Unable to copy code to the clipboard.');
        }
    }

    function showTypingIndicator() {
        const loaderDiv = document.createElement('div');
        loaderDiv.classList.add('message', 'assistant');
        loaderDiv.id = 'typing-indicator-msg';

        const avatarDiv = document.createElement('div');
        avatarDiv.classList.add('avatar-sm');
        avatarDiv.textContent = '🤖';

        const wrapperDiv = document.createElement('div');
        wrapperDiv.classList.add('message-wrapper');

        const senderDiv = document.createElement('div');
        senderDiv.classList.add('message-sender');
        senderDiv.textContent = 'Kruved AI Assistant';

        const bubbleDiv = document.createElement('div');
        bubbleDiv.classList.add('message-bubble');

        const typingIndicator = document.createElement('div');
        typingIndicator.classList.add('typing-indicator');
        typingIndicator.setAttribute('role', 'status');
        typingIndicator.innerHTML = '<span class="typing-label">AI is thinking</span><span></span><span></span><span></span>';

        bubbleDiv.appendChild(typingIndicator);
        wrapperDiv.appendChild(senderDiv);
        wrapperDiv.appendChild(bubbleDiv);

        loaderDiv.appendChild(avatarDiv);
        loaderDiv.appendChild(wrapperDiv);

        messagesContainer.appendChild(loaderDiv);
        scrollToLatestMessage();
        typingScrollTimer = window.setInterval(scrollToLatestMessage, 250);
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('typing-indicator-msg');
        if (indicator) {
            indicator.remove();
        }
        window.clearInterval(typingScrollTimer);
    }

    // Load dynamic sessions list
    async function loadSessions(query = '') {
        try {
            const url = query ? `/api/chat/search?query=${encodeURIComponent(query)}` : '/api/chat/sessions';
            const response = await fetch(url, { headers: sessionHeaders() });
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
                setSidebarOpen(false);
            });

            sessionsList.appendChild(itemDiv);
        });
    }

    // Select/Load specific chat session
    async function selectSession(sessionId) {
        currentSessionId = sessionId;
        sessionStorage.setItem('chat_session_id', sessionId);
        
        // Highlight active session item in sidebar
        const items = sessionsList.querySelectorAll('.session-item');
        items.forEach(item => item.classList.remove('active'));
        
        // Reload list to update active highlight if matches query
        loadSessions(searchInput.value.trim());

        // Clear screen and load messages
        messagesContainer.innerHTML = '';
        
        try {
            const response = await fetch(`/api/chat/sessions/${sessionId}`, { headers: sessionHeaders() });
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
            currentSessionId = crypto.randomUUID();
            sessionStorage.setItem('chat_session_id', currentSessionId);
            const response = await fetch('/api/chat/sessions', {
                method: 'POST',
                headers: sessionHeaders()
            });
            const result = await response.json();
            if (response.ok && result.success) {
                const newSession = result.data;
                currentSessionId = newSession.id;
                sessionStorage.setItem('chat_session_id', currentSessionId);
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
                method: 'DELETE',
                headers: sessionHeaders()
            });
            const result = await response.json();
            if (response.ok && result.success) {
                await loadSessions();
                
                // If we deleted the active session, switch to the first available or create a new one
                if (currentSessionId === sessionId) {
                    const nextResponse = await fetch('/api/chat/sessions', { headers: sessionHeaders() });
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
            currentSessionId = crypto.randomUUID();
            sessionStorage.setItem('chat_session_id', currentSessionId);
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
            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: sessionHeaders({
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({ message: messageText })
            });

            if (response.ok && response.body) {
                await renderStreamingReply(response);
            } else {
                const result = await response.json();
                removeTypingIndicator();
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
        setSidebarOpen(false);
    });

    menuBtn.addEventListener('click', () => {
        setSidebarOpen(!sidebar.classList.contains('is-open'));
    });

    sidebarBackdrop.addEventListener('click', () => setSidebarOpen(false));

    themeToggle.addEventListener('click', () => {
        applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
    });

    // Initial startup sequence
    async function init() {
        applyTheme(localStorage.getItem(themeStorageKey) || 'dark');
        await loadSessions();
        
        // A tab keeps its own ID in sessionStorage. Reloading the same tab restores its history;
        // opening another tab receives a different ID and therefore a different history.
        if (currentSessionId) {
            const response = await fetch(`/api/chat/sessions/${currentSessionId}`, { headers: sessionHeaders() });
            if (response.ok) {
                await selectSession(currentSessionId);
                return;
            } else {
                currentSessionId = null;
            }
        }
        
        if (!currentSessionId) {
            await createNewSession();
        }
    }

    init();
});
