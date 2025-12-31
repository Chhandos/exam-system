console.log("🔥🔥 MCQ EXAM SYSTEM LOADED 🔥🔥");

const express = require('express')
const cors = require('cors')

// Try to load DynamoDB
let db, PutCommand, GetCommand, DeleteCommand;
try {
  db = require("./dynamo");
  const awsSdk = require("@aws-sdk/lib-dynamodb");
  PutCommand = awsSdk.PutCommand;
  GetCommand = awsSdk.GetCommand;
  DeleteCommand = awsSdk.DeleteCommand;
  console.log("✅ DynamoDB modules loaded successfully");
} catch (err) {
  console.error("⚠️ Could not load DynamoDB:", err.message);
  console.log("⚠️ Running in mock mode");
}

const app = express()

// Log requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

app.use(cors())
app.use(express.json())

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: "MCQ Exam System Backend" });
});

// Create exam - NOW WITH CUSTOM QUESTIONS
app.post('/api/exam/create', async (req, res) => {
  try {
    const { questions } = req.body;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    console.log("Creating exam with code:", code);
    console.log("Questions received:", questions);

    const item = {
      examCode: code,
      status: "LIVE",
      questions: questions || [
        {
          id: 1,
          text: 'What is cloud computing?',
          options: [
            { id: 'A', text: 'Storing data on local hard drive' },
            { id: 'B', text: 'Delivering computing services over the internet' },
            { id: 'C', text: 'Programming language' },
            { id: 'D', text: 'Type of hardware' }
          ],
          correctAnswer: 'B'
        },
        {
          id: 2,
          text: 'What is load balancing?',
          options: [
            { id: 'A', text: 'Increasing server weight' },
            { id: 'B', text: 'Distributing network traffic across servers' },
            { id: 'C', text: 'Balancing keyboard keys' },
            { id: 'D', text: 'Type of exercise' }
          ],
          correctAnswer: 'B'
        }
      ],
      submissions: [],
      createdAt: Date.now()
    };

    if (!db) {
      console.log("⚠️ Mock mode - exam not saved to DB");
      return res.json({ 
        code,
        warning: "Mock mode"
      });
    }

    await db.send(new PutCommand({
      TableName: "LiveExams",
      Item: item
    }));

    console.log("✅ Exam created:", code);
    res.json({ code, questions: item.questions });
  } catch (err) {
    console.error("Error creating exam:", err);
    res.status(500).json({ error: "Failed to create exam", details: err.message });
  }
});

// Join exam
app.post('/api/exam/join', async (req, res) => {
  const { code } = req.body
  
  if (!db) {
    console.log("⚠️ Mock mode for code:", code);
    return res.json({ 
      questions: [
        {
          id: 1,
          text: 'Mock: What is cloud computing?',
          options: [
            { id: 'A', text: 'Option A' },
            { id: 'B', text: 'Option B' },
            { id: 'C', text: 'Option C' },
            { id: 'D', text: 'Option D' }
          ],
          correctAnswer: 'B'
        }
      ]
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

    // Don't send correct answers to student
    const questionsForStudent = result.Item.questions.map(q => ({
      id: q.id,
      text: q.text,
      options: q.options
      // Don't include correctAnswer!
    }));

    res.json({ questions: questionsForStudent })
  } catch (err) {
    console.error("Error joining exam:", err);
    res.status(500).json({ error: "Failed to join exam" });
  }
})

// Submit exam - WITH SCORE CALCULATION
app.post('/api/exam/submit', async (req, res) => {
  try {
    const { code, studentName, answers } = req.body;

    if (!db) {
      console.log("⚠️ Mock mode submit");
      return res.json({ 
        message: 'Submitted (mock mode)',
        score: 0,
        total: 2
      });
    }

    const result = await db.send(new GetCommand({
      TableName: "LiveExams",
      Key: { examCode: code }
    }));

    if (!result.Item || result.Item.status !== 'LIVE') {
      return res.status(403).json({ error: 'Exam not active' });
    }

    // Calculate score
    let score = 0;
    const questionResults = result.Item.questions.map(question => {
      const studentAnswer = answers[question.id];
      const isCorrect = studentAnswer === question.correctAnswer;
      if (isCorrect) score++;
      
      return {
        questionId: question.id,
        questionText: question.text,
        studentAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        options: question.options
      };
    });

    const submission = {
      studentName: studentName || 'Anonymous',
      answers,
      score,
      total: result.Item.questions.length,
      percentage: Math.round((score / result.Item.questions.length) * 100),
      results: questionResults,
      submittedAt: Date.now()
    };

    const submissions = result.Item.submissions || [];
    submissions.push(submission);

    await db.send(new PutCommand({
      TableName: "LiveExams",
      Item: {
        ...result.Item,
        submissions
      }
    }));

    res.json({ 
      message: 'Submitted successfully',
      score,
      total: result.Item.questions.length,
      percentage: Math.round((score / result.Item.questions.length) * 100),
      results: questionResults
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit exam" });
  }
});

// End exam
app.post('/api/exam/end', async (req, res) => {
  const { code } = req.body
  
  if (!db) {
    console.log("⚠️ Mock mode end exam");
    return res.json({ message: 'Exam ended (mock mode)' });
  }

  try {
    await db.send(new DeleteCommand({
      TableName: "LiveExams",
      Key: { examCode: code }
    }))

    res.json({ message: 'Exam ended' })
  } catch (err) {
    console.error("Error ending exam:", err);
    res.status(500).json({ error: "Failed to end exam" });
  }
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ MCQ Exam System running on port ${PORT}`);
  console.log(`DynamoDB: ${db ? 'Connected' : 'Mock mode'}`);
});
