let currentUser = null;
let socket = null;
let currentChatUser = null;
let timerInterval = null;

// Initialize dashboard
function initDashboard() {
    loadThemeFromStorage();
    loadSiteSettings();
    loadUserInfo();
    loadGames();
}

window.addEventListener('load', initDashboard);

async function loadUserInfo() {
    try {
        const response = await fetch('/api/check-auth');
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 401 && errorData.message === 'User not found or inactive') {
                alert('Your account has been disabled by an administrator.');
            }
            window.location.href = '/';
            return;
        }
        
        const data = await response.json();
        currentUser = data.user;
        
        document.getElementById('username').textContent = currentUser.username;
        
        const accountBadge = document.getElementById('account-type');
        accountBadge.textContent = currentUser.accountType;
        accountBadge.className = `account-badge ${currentUser.accountType}`;
        
        // Show appropriate UI elements based on account type
        if (currentUser.accountType === 'temporary') {
            document.getElementById('temp-timer').classList.remove('hidden');
        } else {
            document.getElementById('perm-icons').classList.remove('hidden');
            if (currentUser.accountType === 'admin') {
                document.getElementById('admin-btn').style.display = 'flex';
            }
        }
    } catch (error) {
        window.location.href = '/';
    }
}

function startTimerIfNeeded() {
    if (currentUser.accountType === 'temporary' && currentUser.expiresAt) {
        const expiresAt = new Date(currentUser.expiresAt);
        
        timerInterval = setInterval(() => {
            const now = new Date();
            const timeLeft = expiresAt - now;
            
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                alert('Your temporary account has expired. You will be logged out.');
                logout();
                return;
            }
            
            const minutes = Math.floor(timeLeft / 60000);
            const seconds = Math.floor((timeLeft % 60000) / 1000);
            document.getElementById('timer-text').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }
}

function setupSocketConnection() {
    if (currentUser.accountType === 'permanent' || currentUser.accountType === 'admin') {
        socket = io();
        socket.emit('join-room', currentUser._id);
        
        socket.on('new-message', (message) => {
            if (currentChatUser && message.sender._id === currentChatUser._id) {
                displayMessage(message, false);
            }
            updateMessageNotifications();
        });
    }
}

function toggleMessages() {
    const panel = document.getElementById('messages-panel');
    const overlay = document.querySelector('.overlay') || createOverlay();
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        setTimeout(() => panel.classList.add('active'), 10);
        overlay.classList.add('active');
        loadFriendsForMessages();
    } else {
        panel.classList.remove('active');
        overlay.classList.remove('active');
        setTimeout(() => panel.classList.add('hidden'), 300);
    }
}

function toggleFriends() {
    const panel = document.getElementById('friends-panel');
    const overlay = document.querySelector('.overlay') || createOverlay();
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        setTimeout(() => panel.classList.add('active'), 10);
        overlay.classList.add('active');
        loadFriends();
        loadFriendRequests();
    } else {
        panel.classList.remove('active');
        overlay.classList.remove('active');
        setTimeout(() => panel.classList.add('hidden'), 300);
    }
}

function toggleAdmin() {
    const panel = document.getElementById('admin-panel');
    const overlay = document.querySelector('.overlay') || createOverlay();
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        setTimeout(() => panel.classList.add('active'), 10);
        overlay.classList.add('active');
        loadAllUsers();
    } else {
        panel.classList.remove('active');
        overlay.classList.remove('active');
        setTimeout(() => panel.classList.add('hidden'), 300);
    }
}

function createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.onclick = () => {
        closePanels();
    };
    document.body.appendChild(overlay);
    return overlay;
}

function closePanels() {
    document.querySelectorAll('.side-panel').forEach(panel => {
        panel.classList.remove('active');
        setTimeout(() => panel.classList.add('hidden'), 300);
    });
    const overlay = document.querySelector('.overlay');
    if (overlay) overlay.classList.remove('active');
}

async function loadFriends() {
    try {
        const response = await fetch('/api/friends');
        const data = await response.json();
        
        const friendsList = document.getElementById('friends-list');
        friendsList.innerHTML = '';
        
        data.friends.forEach(friend => {
            const friendDiv = document.createElement('div');
            friendDiv.className = 'friend-item';
            friendDiv.innerHTML = `
                <span>${friend.username}</span>
                <button onclick="startChat('${friend._id}', '${friend.username}')">Message</button>
            `;
            friendsList.appendChild(friendDiv);
        });
    } catch (error) {
        console.error('Failed to load friends:', error);
    }
}

async function loadFriendsForMessages() {
    try {
        const response = await fetch('/api/friends');
        const data = await response.json();
        
        const friendsList = document.getElementById('friends-for-messages');
        friendsList.innerHTML = '';
        
        data.friends.forEach(friend => {
            const friendDiv = document.createElement('div');
            friendDiv.className = 'friend-item';
            friendDiv.onclick = () => startChat(friend._id, friend.username);
            friendDiv.innerHTML = `<span>${friend.username}</span>`;
            friendsList.appendChild(friendDiv);
        });
    } catch (error) {
        console.error('Failed to load friends:', error);
    }
}

async function loadFriendRequests() {
    try {
        const response = await fetch('/api/friend-requests');
        const data = await response.json();
        
        const requestsList = document.getElementById('friend-requests-list');
        requestsList.innerHTML = '';
        
        // Update notification badge
        const badge = document.getElementById('friend-requests-count');
        if (data.requests.length > 0) {
            badge.textContent = data.requests.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
        
        data.requests.forEach(request => {
            const requestDiv = document.createElement('div');
            requestDiv.className = 'friend-request';
            requestDiv.innerHTML = `
                <span>${request.from.username}</span>
                <div class="friend-request-actions">
                    <button class="accept-btn" onclick="respondToFriendRequest('${request._id}', 'accepted')">Accept</button>
                    <button class="reject-btn" onclick="respondToFriendRequest('${request._id}', 'rejected')">Reject</button>
                </div>
            `;
            requestsList.appendChild(requestDiv);
        });
    } catch (error) {
        console.error('Failed to load friend requests:', error);
    }
}

async function searchUsers() {
    const query = document.getElementById('user-search').value;
    if (query.length < 2) {
        document.getElementById('search-results').innerHTML = '';
        return;
    }
    
    try {
        const response = await fetch(`/api/search-users?query=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        const resultsDiv = document.getElementById('search-results');
        resultsDiv.innerHTML = '';
        
        data.users.forEach(user => {
            const userDiv = document.createElement('div');
            userDiv.className = 'search-result';
            userDiv.innerHTML = `
                <span>${user.username}</span>
                <button onclick="sendFriendRequest('${user.username}')">Add Friend</button>
            `;
            resultsDiv.appendChild(userDiv);
        });
    } catch (error) {
        console.error('Search failed:', error);
    }
}

async function sendFriendRequest(username) {
    try {
        const response = await fetch('/api/send-friend-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        
        const data = await response.json();
        alert(data.message);
        
        if (response.ok) {
            document.getElementById('user-search').value = '';
            document.getElementById('search-results').innerHTML = '';
        }
    } catch (error) {
        alert('Failed to send friend request');
    }
}

async function respondToFriendRequest(requestId, action) {
    try {
        const response = await fetch('/api/respond-friend-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId, action })
        });
        
        if (response.ok) {
            loadFriendRequests();
            loadFriends();
        }
    } catch (error) {
        alert('Failed to respond to friend request');
    }
}

async function startChat(userId, username) {
    currentChatUser = { _id: userId, username };
    
    document.getElementById('chat-with').textContent = username;
    document.querySelector('.friends-list').style.display = 'none';
    document.getElementById('chat-area').classList.remove('hidden');
    
    await loadMessages(userId);
}

function backToFriendsList() {
    document.querySelector('.friends-list').style.display = 'block';
    document.getElementById('chat-area').classList.add('hidden');
    currentChatUser = null;
}

async function loadMessages(userId) {
    try {
        const response = await fetch(`/api/messages/${userId}`);
        const data = await response.json();
        
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        
        data.messages.forEach(message => {
            displayMessage(message, message.sender._id === currentUser._id);
        });
        
        container.scrollTop = container.scrollHeight;
    } catch (error) {
        console.error('Failed to load messages:', error);
    }
}

function displayMessage(message, isSent) {
    const container = document.getElementById('messages-container');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    
    const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
        <div class="message-bubble">${message.content}</div>
        <div class="message-time">${time}</div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('message-text');
    const content = input.value.trim();
    
    if (!content || !currentChatUser) return;
    
    try {
        const response = await fetch('/api/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId: currentChatUser._id,
                content
            })
        });
        
        if (response.ok) {
            displayMessage({
                content,
                timestamp: new Date(),
                sender: { _id: currentUser._id }
            }, true);
            input.value = '';
        }
    } catch (error) {
        alert('Failed to send message');
    }
}

// Enter key to send message
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && document.getElementById('message-text') === document.activeElement) {
        sendMessage();
    }
});

async function loadAllUsers() {
    try {
        const response = await fetch('/api/admin/users');
        const data = await response.json();
        
        const usersList = document.getElementById('all-users-list');
        usersList.innerHTML = '';
        
        data.users.forEach(user => {
            const userDiv = document.createElement('div');
            userDiv.className = 'user-item';
            
            const expiresText = user.expiresAt ? 
                `Expires: ${new Date(user.expiresAt).toLocaleString()}` : 
                'Permanent';
            
            userDiv.innerHTML = `
                <div class="user-info-item">
                    <span class="username">${user.username}</span>
                    <span class="account-type">${user.accountType} - ${user.isActive ? 'Active' : 'Disabled'}</span>
                    <span class="expires">${expiresText}</span>
                </div>
                <div class="user-actions">
                    ${user.isActive ? 
                        `<button onclick="disableUser('${user._id}')">Disable</button>` : 
                        `<button onclick="enableUser('${user._id}')" class="enable">Enable</button>`
                    }
                </div>
            `;
            usersList.appendChild(userDiv);
        });
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

async function searchAllUsers() {
    const query = document.getElementById('admin-search').value;
    
    try {
        const response = await fetch(`/api/admin/users?search=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        const usersList = document.getElementById('all-users-list');
        usersList.innerHTML = '';
        
        data.users.forEach(user => {
            const userDiv = document.createElement('div');
            userDiv.className = 'user-item';
            
            const expiresText = user.expiresAt ? 
                `Expires: ${new Date(user.expiresAt).toLocaleString()}` : 
                'Permanent';
            
            userDiv.innerHTML = `
                <div class="user-info-item">
                    <span class="username">${user.username}</span>
                    <span class="account-type">${user.accountType} - ${user.isActive ? 'Active' : 'Disabled'}</span>
                    <span class="expires">${expiresText}</span>
                </div>
                <div class="user-actions">
                    ${user.isActive ? 
                        `<button onclick="disableUser('${user._id}')">Disable</button>` : 
                        `<button onclick="enableUser('${user._id}')" class="enable">Enable</button>`
                    }
                </div>
            `;
            usersList.appendChild(userDiv);
        });
    } catch (error) {
        console.error('Failed to search users:', error);
    }
}

async function disableUser(userId) {
    if (!confirm('Are you sure you want to disable this user?')) return;
    
    try {
        const response = await fetch('/api/admin/disable-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        
        if (response.ok) {
            loadAllUsers();
            alert('User disabled successfully');
        } else {
            alert('Failed to disable user');
        }
    } catch (error) {
        alert('Failed to disable user');
    }
}

async function updateMessageNotifications() {
    // This would typically check for unread messages and update the badge
    // For now, we'll keep it simple
}

async function loadGames() {
    try {
        const response = await fetch('/api/games');
        const games = await response.json();
        
        const gamesGrid = document.querySelector('.games-grid');
        gamesGrid.innerHTML = '';
        
        games.forEach(game => {
            const gameCard = document.createElement('div');
            gameCard.className = 'game-card';
            gameCard.onclick = () => window.open(game.link, '_blank');
            
            gameCard.innerHTML = `
                <img src="${game.imgSrc}" alt="${game.title}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+R2FtZTwvdGV4dD48L3N2Zz4='" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;">
                <h3>${game.title}</h3>
            `;
            
            gamesGrid.appendChild(gameCard);
        });
    } catch (error) {
        console.error('Failed to load games:', error);
        const gamesGrid = document.querySelector('.games-grid');
        gamesGrid.innerHTML = '<p style="text-align: center; color: #666;">Failed to load games</p>';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update theme icon
    const themeIcon = document.getElementById('theme-icon');
    themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
}

function loadThemeFromStorage() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Update theme icon
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
        themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    }
}

function openReport() {
    window.location.href = '/report.html';
}

async function toggleShutdown() {
    const toggle = document.getElementById('shutdown-toggle');
    try {
        const response = await fetch('/api/admin/toggle-shutdown', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: toggle.checked })
        });
        
        if (!response.ok) {
            toggle.checked = !toggle.checked;
            alert('Failed to toggle shutdown mode');
        }
    } catch (error) {
        toggle.checked = !toggle.checked;
        alert('Error toggling shutdown mode');
    }
}

async function toggleMaintenance() {
    const toggle = document.getElementById('maintenance-toggle');
    try {
        const response = await fetch('/api/admin/toggle-maintenance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: toggle.checked })
        });
        
        if (!response.ok) {
            toggle.checked = !toggle.checked;
            alert('Failed to toggle maintenance mode');
        }
    } catch (error) {
        toggle.checked = !toggle.checked;
        alert('Error toggling maintenance mode');
    }
}

async function viewReports() {
    const container = document.getElementById('reports-list');
    const isHidden = container.classList.contains('hidden');
    
    if (isHidden) {
        try {
            const response = await fetch('/api/admin/reports');
            const reports = await response.json();
            
            container.innerHTML = '';
            
            if (reports.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No reports found</p>';
            } else {
                reports.forEach(report => {
                    const reportDiv = document.createElement('div');
                    reportDiv.className = 'report-item';
                    reportDiv.innerHTML = `
                        <div class="report-header">
                            <span class="report-id">#${report.reportId}</span>
                            <span class="report-status ${report.status}">${report.status.toUpperCase()}</span>
                        </div>
                        <div class="report-meta">
                            ${report.reportType.replace('_', ' ').toUpperCase()} | 
                            ${report.urgencyLevel.toUpperCase()} | 
                            ${new Date(report.createdAt).toLocaleString()}
                        </div>
                        <div class="report-description">${report.description}</div>
                        <div style="margin-top: 10px;">
                            <button onclick="updateReportStatus('${report._id}', 'reviewed')" class="admin-btn" style="font-size: 12px; padding: 5px 10px;">Mark Reviewed</button>
                            <button onclick="updateReportStatus('${report._id}', 'resolved')" class="admin-btn" style="font-size: 12px; padding: 5px 10px;">Mark Resolved</button>
                        </div>
                    `;
                    container.appendChild(reportDiv);
                });
            }
            
            container.classList.remove('hidden');
        } catch (error) {
            alert('Error loading reports');
        }
    } else {
        container.classList.add('hidden');
    }
}

async function updateReportStatus(reportId, status) {
    try {
        const response = await fetch('/api/admin/update-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportId, status })
        });
        
        if (response.ok) {
            viewReports(); // Refresh the reports list
        } else {
            alert('Failed to update report status');
        }
    } catch (error) {
        alert('Error updating report status');
    }
}

async function loadSiteSettings() {
    if (currentUser && currentUser.accountType === 'admin') {
        try {
            const response = await fetch('/api/admin/site-settings');
            const settings = await response.json();
            
            document.getElementById('shutdown-toggle').checked = settings.shutdownMode;
            document.getElementById('maintenance-toggle').checked = settings.maintenanceMode;
        } catch (error) {
            console.error('Error loading site settings:', error);
        }
    }
}

async function enableUser(userId) {
    if (!confirm('Are you sure you want to enable this user?')) return;
    
    try {
        const response = await fetch('/api/admin/enable-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        
        if (response.ok) {
            loadAllUsers();
            alert('User enabled successfully');
        } else {
            alert('Failed to enable user');
        }
    } catch (error) {
        alert('Failed to enable user');
    }
}

async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        if (timerInterval) clearInterval(timerInterval);
        if (socket) socket.disconnect();
        window.location.href = '/';
    }
}
