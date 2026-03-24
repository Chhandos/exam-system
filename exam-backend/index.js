console.log("🔥🔥 FIXED INDEX.JS LOADED 🔥🔥");

const express = require('express');
const cors = require('cors');
const os = require('os');
const http = require('http');

// DynamoDB setup
let db, PutCommand, GetCommand, DeleteCommand, ScanCommand;
try {
  db = require("./dynamo");
  const awsSdk = require("@aws-sdk/lib-dynamodb");
  PutCommand = awsSdk.PutCommand;
  GetCommand = awsSdk.GetCommand;
  DeleteCommand = awsSdk.DeleteCommand;
  ScanCommand = awsSdk.ScanCommand;
  console.log("✅ DynamoDB modules loaded successfully");
} catch (err) {
  console.error("⚠️ Warning: Could not load DynamoDB modules:", err.message);
  console.log("⚠️ Running in mock mode (DynamoDB disabled)");
}

const app = express();

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

app.use(cors());
app.use(express.json());

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log("✅✅✅ /api/test endpoint hit!");
  res.json({ 
    message: "Backend is reachable!",
    timestamp: new Date().toISOString(),
    pid: process.pid,
    dynamoStatus: db ? "connected" : "mock mode"
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: "Exam System Backend API",
    endpoints: {
      test: "GET /api/test",
      createExam: "POST /api/exam/create",
      joinExam: "POST /api/exam/join",
      endExam: "POST /api/exam/end",
      submitExam: "POST /api/exam/submit",
      teacherExams: "GET /api/teacher/exams",
      teacherLogin: "POST /api/teacher/login",
      teacherSignup: "POST /api/teacher/signup"
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// --------------------
// TEACHER ROUTES
// --------------------

// Signup - writes to DynamoDB
app.post('/api/teacher/signup', async (req, res) => {
  const { email, name } = req.body;
  if (!email || !name) return res.status(400).json({ error: "Email and name are required" });
  if (!db) return res.status(403).json({ error: "DynamoDB not configured" });

  try {
    const existing = await db.send(new GetCommand({ TableName: "Teachers", Key: { email } }));
    if (existing.Item) return res.status(409).json({ error: "Teacher already exists" });

    const teacherId = "t" + Date.now();
    await db.send(new PutCommand({
      TableName: "Teachers",
      Item: { teacherId, email, name }
    }));

    res.json({ token: "real-token-123", teacherId, name, email });

  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Failed to signup", details: err.message });
  }
});

// Login - reads from DynamoDB
app.post('/api/teacher/login', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });
  if (!db) return res.status(403).json({ error: "DynamoDB not configured" });

  try {
    const result = await db.send(new GetCommand({ TableName: "Teachers", Key: { email } }));
    if (!result.Item) return res.status(404).json({ error: "Teacher not found. Please sign up first." });

    res.json({
      token: "real-token-123",
      teacherId: result.Item.teacherId,
      name: result.Item.name,
      email: result.Item.email
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// Fetch all exams
app.get('/api/teacher/exams', async (req, res) => {
  if (!db) return res.status(403).json({ error: "DynamoDB not configured" });

  try {
    const result = await db.send(new ScanCommand({ TableName: "LiveExams" }));
    res.json({ exams: result.Items || [] });
  } catch (err) {
    console.error("Error fetching exams:", err);
    res.status(500).json({ error: err.message });
  }
});

// --------------------
// EXAM ROUTES
// --------------------

// Create exam
app.post('/api/exam/create', async (req, res) => {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const questions = [
    { id: 1, q: 'What is cloud computing?' },
    { id: 2, q: 'What is load balancing?' }
  ];
  const item = { examCode: code, status: "LIVE", questions, submissions: [], createdAt: Date.now() };

  try {
    if (!db) return res.json({ code, warning: "Running in mock mode (DynamoDB not configured)" });
    await db.send(new PutCommand({ TableName: "LiveExams", Item: item }));
    res.json({ code });
  } catch (err) {
    console.error("Error creating exam:", err);
    res.status(500).json({ error: "Failed to create exam", details: err.message });
  }
});

// Join exam
app.post('/api/exam/join', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Exam code is required" });
  if (!db) return res.json({ questions: [], warning: "Running in mock mode" });

  try {
    const result = await db.send(new GetCommand({ TableName: "LiveExams", Key: { examCode: code } }));
    if (!result.Item) return res.status(404).json({ error: 'Invalid exam code' });
    if (result.Item.status !== 'LIVE') return res.status(403).json({ error: 'Exam ended' });

    res.json({ questions: result.Item.questions });
  } catch (err) {
    console.error("Error joining exam:", err);
    res.status(500).json({ error: "Failed to join exam", details: err.message });
  }
});

// End exam
app.post('/api/exam/end', async (req, res) => {
  const { code } = req.body;
  if (!db) return res.json({ message: 'Exam ended (mock mode)', warning: "Running in mock mode" });

  try {
    await db.send(new DeleteCommand({ TableName: "LiveExams", Key: { examCode: code } }));
    res.json({ message: 'Exam ended' });
  } catch (err) {
    console.error("Error ending exam:", err);
    res.status(500).json({ error: "Failed to end exam", details: err.message });
  }
});

// Submit exam
app.post('/api/exam/submit', async (req, res) => {
  const { code, submission } = req.body;
  if (!db) return res.json({ message: 'Submitted (mock mode)', warning: "Running in mock mode" });

  try {
    const result = await db.send(new GetCommand({ TableName: "LiveExams", Key: { examCode: code } }));
    if (!result.Item || result.Item.status !== 'LIVE') return res.status(403).json({ error: 'Exam not active' });

    const submissions = result.Item.submissions || [];
    submissions.push(submission || "submitted");

    await db.send(new PutCommand({ TableName: "LiveExams", Item: { ...result.Item, submissions } }));
    res.json({ message: 'Submitted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit exam", details: err.message });
  }
});

// --------------------
// Instance ID (for debugging EC2)
// --------------------
app.get('/api/instance-id', async (req, res) => {
  try {
    const options = { host: '169.254.169.254', path: '/latest/meta-data/instance-id', timeout: 1000 };
    const request = http.get(options, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        res.json({ instanceId: data || "unknown", hostname: os.hostname(), pid: process.pid });
      });
    });
    request.on('error', () => {
      res.json({ instanceId: "metadata-unavailable", hostname: os.hostname(), pid: process.pid });
    });
    request.end();
  } catch (err) {
    res.json({ instanceId: "error", hostname: os.hostname(), pid: process.pid });
  }
});

// --------------------
// 404 & Error handlers
// --------------------
app.use((req, res) => {
  console.log(`❌ Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Route not found', method: req.method, path: req.originalUrl, timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// --------------------
// Start server
// --------------------
const PORT = 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅✅✅ Express backend running on port ${PORT}`);
  console.log(`PID: ${process.pid}`);
  console.log(`Start time: ${new Date().toISOString()}`);
  console.log(`DynamoDB: ${db ? 'Connected' : 'Mock mode'}`);
  console.log(`Test endpoint: http://localhost:${PORT}/api/test`);
});
