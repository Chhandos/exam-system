
console.log("🔥🔥 FIXED INDEX.JS LOADED 🔥🔥");

const express = require('express')
const cors = require('cors')

// Try to load DynamoDB, but don't crash if it fails
let db, PutCommand, GetCommand, DeleteCommand;
try {
  db = require("./dynamo");
  const awsSdk = require("@aws-sdk/lib-dynamodb");
  PutCommand = awsSdk.PutCommand;
  GetCommand = awsSdk.GetCommand;
  DeleteCommand = awsSdk.DeleteCommand;
  console.log("✅ DynamoDB modules loaded successfully");
} catch (err) {
  console.error("⚠️ Warning: Could not load DynamoDB modules:", err.message);
  console.log("⚠️ Running in mock mode (DynamoDB disabled)");
}

const app = express()

// Add request logging middleware FIRST
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

app.use(cors())
app.use(express.json())

// Test endpoint - NOW AT THE TOP
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
      submitExam: "POST /api/exam/submit"
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

// Create exam - with mock fallback
app.post('/api/exam/create', async (req, res) => {
  try {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const questions = [
      { id: 1, q: 'What is cloud computing?' },
      { id: 2, q: 'What is load balancing?' }
    ];

    const item = {
      examCode: code,
      status: "LIVE",
      questions,
      submissions: [],
      createdAt: Date.now()
    };

    console.log("Creating exam with code:", code);

    // Use mock if DynamoDB not available
    if (!db) {
      console.log("⚠️ Running in mock mode - exam not saved to DB");
      return res.json({ 
        code,
        warning: "Running in mock mode (DynamoDB not configured)"
      });
    }

    const result = await db.send(new PutCommand({
      TableName: "LiveExams",
      Item: item
    }));

    console.log("✅ Exam created in DynamoDB:", code);
    res.json({ code });
  } catch (err) {
    console.error("Error creating exam:", err);
    res.status(500).json({ error: "Failed to create exam", details: err.message });
  }
});

// Join exam - with mock fallback
app.post('/api/exam/join', async (req, res) => {
  const { code } = req.body
  
  if (!db) {
    console.log("⚠️ Mock mode: Returning mock questions for code:", code);
    return res.json({ 
      questions: [
        { id: 1, q: 'Mock: What is cloud computing?' },
        { id: 2, q: 'Mock: What is load balancing?' }
      ],
      warning: "Running in mock mode"
    });
  }

  try {
    const result = await db.send(new GetCommand({
      TableName: "LiveExams",
      Key: { examCode: code }
    }))

    if (!result.Item) {
      return res.status(404).json({ error: 'Invalid exam code' })
    }

    if (result.Item.status !== 'LIVE') {
      return res.status(403).json({ error: 'Exam ended' })
    }

    res.json({ questions: result.Item.questions })
  } catch (err) {
    console.error("Error joining exam:", err);
    res.status(500).json({ error: "Failed to join exam", details: err.message });
  }
})

// End exam - with mock fallback
app.post('/api/exam/end', async (req, res) => {
  const { code } = req.body
  
  if (!db) {
    console.log("⚠️ Mock mode: Would delete exam:", code);
    return res.json({ 
      message: 'Exam ended (mock mode)',
      warning: "Running in mock mode"
    });
  }

  try {
    await db.send(new DeleteCommand({
      TableName: "LiveExams",
      Key: { examCode: code }
    }))

    res.json({ message: 'Exam ended' })
  } catch (err) {
    console.error("Error ending exam:", err);
    res.status(500).json({ error: "Failed to end exam", details: err.message });
  }
})

// Submit exam - with mock fallback
app.post('/api/exam/submit', async (req, res) => {
  try {
    const { code, submission } = req.body;

    if (!db) {
      console.log("⚠️ Mock mode: Would submit for exam:", code);
      return res.json({ 
        message: 'Submitted (mock mode)',
        warning: "Running in mock mode"
      });
    }

    const result = await db.send(new GetCommand({
      TableName: "LiveExams",
      Key: { examCode: code }
    }));

    if (!result.Item || result.Item.status !== 'LIVE') {
      return res.status(403).json({ error: 'Exam not active' });
    }

    const submissions = result.Item.submissions || [];
    submissions.push(submission || "submitted");

    await db.send(new PutCommand({
      TableName: "LiveExams",
      Item: {
        ...result.Item,
        submissions
      }
    }));

    res.json({ message: 'Submitted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit exam", details: err.message });
  }
});

// 404 handler for undefined routes
app.use((req, res) => {
  console.log(`❌ Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Route not found',
    method: req.method,
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

const PORT = 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅✅✅ Express backend running on port ${PORT}`);
  console.log(`PID: ${process.pid}`);
  console.log(`Start time: ${new Date().toISOString()}`);
  console.log(`DynamoDB: ${db ? 'Connected' : 'Mock mode'}`);
  console.log(`Test endpoint: http://localhost:${PORT}/api/test`);
});
