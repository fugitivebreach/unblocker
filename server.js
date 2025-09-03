const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const User = require('./models/User');
const Message = require('./models/Message');
const SiteSettings = require('./models/SiteSettings');
const Report = require('./models/Report');
const { requireAuth, requirePermanentAccount, requireAdmin, redirectIfAuthenticated } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect('mongodb+srv://arrowsbritisharmy:cXgXOnuDac4RnAbP@unblockedsitedb.suidun3.mongodb.net/?retryWrites=true&w=majority&appName=unblockedsitedb', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB Atlas');
  createAdminAccount();
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Create admin account if it doesn't exist
async function createAdminAccount() {
  try {
    const adminExists = await User.findOne({ username: 'archiveAnt' });
    if (!adminExists) {
      const admin = new User({
        username: 'archiveAnt',
        password: 'Arrow147527',
        accountType: 'admin'
      });
      await admin.save();
      console.log('Admin account created');
    }
  } catch (error) {
    console.error('Error creating admin account:', error);
  }
}

// Site settings middleware - check for shutdown/maintenance modes
async function checkSiteStatus(req, res, next) {
  try {
    const settings = await SiteSettings.findOne();
    
    // Skip checks for admin and API routes
    if (req.path.startsWith('/api/') || req.session.user?.accountType === 'admin') {
      return next();
    }
    
    if (settings?.shutdownMode) {
      return res.redirect('https://www.stjude.org/');
    }
    
    if (settings?.maintenanceMode && req.path !== '/maintenance.html') {
      return res.redirect('/maintenance.html');
    }
    
    next();
  } catch (error) {
    console.error('Error checking site status:', error);
    next();
  }
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.use(checkSiteStatus);
app.use(express.static(__dirname));

// Add MIME type for Unity WebAssembly files
express.static.mime.define({
  'application/wasm': ['wasm'],
  'application/octet-stream': ['unityweb']
});

// Auth routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, accountType } = req.body;
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    
    const user = new User({
      username,
      password,
      accountType: accountType || 'temporary'
    });
    
    await user.save();
    req.session.userId = user._id;
    
    res.json({ message: 'Account created successfully', user: { username: user.username, accountType: user.accountType } });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await User.findOne({ username, isActive: true });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    req.session.userId = user._id;
    res.json({ message: 'Login successful', user: { username: user.username, accountType: user.accountType } });
  } catch (error) {
    res.status(500).json({ message: 'Login failed' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/check-auth', requireAuth, (req, res) => {
  res.json({ 
    user: { 
      username: req.user.username, 
      accountType: req.user.accountType,
      expiresAt: req.user.expiresAt 
    } 
  });
});

// Friend system routes
app.post('/api/send-friend-request', requireAuth, requirePermanentAccount, async (req, res) => {
  try {
    const { username } = req.body;
    const targetUser = await User.findOne({ username, isActive: true });
    
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (targetUser._id.equals(req.user._id)) {
      return res.status(400).json({ message: 'Cannot send friend request to yourself' });
    }
    
    // Check if already friends or request exists
    const existingRequest = targetUser.friendRequests.find(req => 
      req.from.equals(req.user._id) && req.status === 'pending'
    );
    
    if (existingRequest) {
      return res.status(400).json({ message: 'Friend request already sent' });
    }
    
    if (req.user.friends.includes(targetUser._id)) {
      return res.status(400).json({ message: 'Already friends' });
    }
    
    targetUser.friendRequests.push({ from: req.user._id });
    await targetUser.save();
    
    res.json({ message: 'Friend request sent' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to send friend request' });
  }
});

app.post('/api/respond-friend-request', requireAuth, requirePermanentAccount, async (req, res) => {
  try {
    const { requestId, action } = req.body;
    
    const user = await User.findById(req.user._id);
    const request = user.friendRequests.id(requestId);
    
    if (!request) {
      return res.status(404).json({ message: 'Friend request not found' });
    }
    
    request.status = action;
    
    if (action === 'accepted') {
      const friend = await User.findById(request.from);
      user.friends.push(friend._id);
      friend.friends.push(user._id);
      await friend.save();
    }
    
    await user.save();
    res.json({ message: `Friend request ${action}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to respond to friend request' });
  }
});

app.get('/api/friends', requireAuth, requirePermanentAccount, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('friends', 'username');
    res.json({ friends: user.friends });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get friends' });
  }
});

app.get('/api/friend-requests', requireAuth, requirePermanentAccount, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('friendRequests.from', 'username');
    const pendingRequests = user.friendRequests.filter(req => req.status === 'pending');
    res.json({ requests: pendingRequests });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get friend requests' });
  }
});

app.get('/api/search-users', requireAuth, requirePermanentAccount, async (req, res) => {
  try {
    const { query } = req.query;
    const users = await User.find({
      username: { $regex: query, $options: 'i' },
      isActive: true,
      _id: { $ne: req.user._id }
    }).select('username').limit(10);
    
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: 'Search failed' });
  }
});

// Message routes
app.post('/api/send-message', requireAuth, requirePermanentAccount, async (req, res) => {
  try {
    const { recipientId, content } = req.body;
    
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    
    const message = new Message({
      sender: req.user._id,
      recipient: recipientId,
      content
    });
    
    await message.save();
    
    // Emit to recipient if online
    io.to(recipientId).emit('new-message', {
      _id: message._id,
      sender: { username: req.user.username },
      content: message.content,
      timestamp: message.timestamp
    });
    
    res.json({ message: 'Message sent' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to send message' });
  }
});

app.get('/api/messages/:userId', requireAuth, requirePermanentAccount, async (req, res) => {
  try {
    const { userId } = req.params;
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, recipient: userId },
        { sender: userId, recipient: req.user._id }
      ]
    }).populate('sender', 'username').sort({ timestamp: 1 });
    
    // Mark messages as read
    await Message.updateMany({
      sender: userId,
      recipient: req.user._id,
      isRead: false
    }, { isRead: true });
    
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get messages' });
  }
});

// Admin routes
app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    
    if (search) {
      query.username = { $regex: search, $options: 'i' };
    }
    
    const users = await User.find(query, '-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

app.post('/api/admin/disable-user', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    await User.findByIdAndUpdate(userId, { isActive: false });
    res.json({ message: 'User disabled successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to disable user' });
  }
});

app.post('/api/admin/enable-user', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    await User.findByIdAndUpdate(userId, { isActive: true });
    res.json({ message: 'User enabled successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to enable user' });
  }
});

// Site settings routes
app.get('/api/admin/site-settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    let settings = await SiteSettings.findOne();
    if (!settings) {
      settings = new SiteSettings();
      await settings.save();
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch site settings' });
  }
});

app.post('/api/admin/toggle-shutdown', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { enabled } = req.body;
    let settings = await SiteSettings.findOne();
    if (!settings) {
      settings = new SiteSettings();
    }
    settings.shutdownMode = enabled;
    settings.lastUpdated = new Date();
    settings.updatedBy = req.user._id;
    await settings.save();
    res.json({ message: 'Shutdown mode updated' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update shutdown mode' });
  }
});

app.post('/api/admin/toggle-maintenance', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { enabled } = req.body;
    let settings = await SiteSettings.findOne();
    if (!settings) {
      settings = new SiteSettings();
    }
    settings.maintenanceMode = enabled;
    settings.lastUpdated = new Date();
    settings.updatedBy = req.user._id;
    await settings.save();
    res.json({ message: 'Maintenance mode updated' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update maintenance mode' });
  }
});

// Report routes
app.post('/api/submit-report', requireAuth, async (req, res) => {
  try {
    const { reportType, urgencyLevel, description, location, timeOfIncident, witnessPresent, actionTaken, additionalInfo } = req.body;
    
    // Generate unique report ID
    const reportId = 'RPT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
    
    const report = new Report({
      reportId,
      reportedBy: req.session.user._id,
      reportType,
      urgencyLevel,
      description,
      location,
      timeOfIncident: new Date(timeOfIncident),
      witnessPresent,
      actionTaken,
      additionalInfo
    });
    
    await report.save();
    res.json({ message: 'Report submitted successfully', reportId });
  } catch (error) {
    console.error('Report submission error:', error);
    res.status(500).json({ message: 'Failed to submit report' });
  }
});

app.get('/api/admin/reports', requireAuth, requireAdmin, async (req, res) => {
  try {
    const reports = await Report.find()
      .populate('reportedBy', 'username accountType')
      .sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch reports' });
  }
});

app.post('/api/admin/update-report', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { reportId, status } = req.body;
    await Report.findByIdAndUpdate(reportId, { status });
    res.json({ message: 'Report status updated' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update report status' });
  }
});

// Serve login page for root
app.get('/', redirectIfAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// ... (rest of the code remains the same)
app.get('/api/games', (req, res) => {
  const games = require('./config/games.json');
  res.json(games);
});

// Protect dashboard
app.get('/dashboard.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Serve static files with proper MIME types
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.unityweb')) {
      res.setHeader('Content-Type', 'application/octet-stream');
    } else if (filePath.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Socket.io for real-time messaging
io.on('connection', (socket) => {
  socket.on('join-room', (userId) => {
    socket.join(userId);
  });
  
  socket.on('disconnect', () => {
    // Handle disconnect
  });
});

server.listen(PORT, () => {
  console.log(`3kh0-lite is running on port ${PORT}`);
});
