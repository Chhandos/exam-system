console.log("🔥🔥 SIMPLE TEACHER AUTH SYSTEM LOADED 🔥🔥");

const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const os = require('os');

// ========== CREATE UNIQUE INSTANCE ID ==========
const fs = require('fs');
const path = require('path');

let INSTANCE_ID;

try {
  const instanceIdFile = path.join(__dirname, '.instance-id');
  
  // Check if instance ID file exists
  if (fs.existsSync(instanceIdFile)) {
    INSTANCE_ID = fs.readFileSync(instanceIdFile, 'utf8').trim();
  } else {
    // Create new unique instance ID
    INSTANCE_ID = `ec2-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    fs.writeFileSync(instanceIdFile, INSTANCE_ID);
    console.log(`✅ Created new instance ID: ${INSTANCE_ID}`);
  }
  
  console.log(`🆔 Using instance ID: ${INSTANCE_ID}`);
} catch (err) {
  // Fallback if file operations fail
  INSTANCE_ID = `ec2-fallback-${process.pid}`;
  console.log(`⚠️ Using fallback instance ID: ${INSTANCE_ID}`);
}


// Try to load DynamoDB
let db, PutCommand, GetCommand, DeleteCommand, ScanCommand, UpdateCommand;
try {
  db = require("./dynamo");
  const awsSdk = require("@aws-sdk/lib-dynamodb");
  PutCommand = awsSdk.PutCommand;
  GetCommand = awsSdk.GetCommand;
  DeleteCommand = awsSdk.DeleteCommand;
  ScanCommand = awsSdk.ScanCommand;
  UpdateCommand = awsSdk.UpdateCommand;
  console.log("✅ DynamoDB modules loaded successfully");
} catch (err) {
  console.error("⚠️ Could not load DynamoDB:", err.message);
  console.log("⚠️ Running in mock mode");
}

const app = express()
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key'

// Log requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});





// Apply CORS middleware
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
}));

// ✅ Handle OPTIONS preflight for all routes

app.use(express.json())

// Auth middleware
const authenticateTeacher = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.teacherId = decoded.teacherId
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// ========== SIMPLE TEACHER AUTH ==========



app.get('/api/test-hostname', (req, res) => {
  const hostname = os.hostname();
  
  res.json({
    hostname: hostname,
    hostnameType: typeof hostname,
    hostnameLength: hostname ? hostname.length : 0,
    isEmptyString: hostname === '',
    isNull: hostname === null,
    isUndefined: hostname === undefined,
    rawOutput: `"${hostname}"`
  });
});



app.get('/api/test', (req, res) => {
  res.status(200).send('OK')
})



app.get('/api/instance', (req, res) => {
  console.log(`📡 Request handled by instance: ${INSTANCE_ID}`);
  
  res.json({
    instance: INSTANCE_ID,
    time: new Date().toISOString(),
    pid: process.pid,
    region: process.env.AWS_REGION || 'ap-south-1',
    note: 'Each EC2 instance has unique ID stored in .instance-id file'
  });
});




app.get('/api/load-test', (req, res) => {
  // Count requests per instance
  if (!global.requestCount) global.requestCount = 0;
  global.requestCount++;
  
  res.json({
    instance: INSTANCE_ID,
    requestNumber: global.requestCount,
    time: new Date().toISOString(),
    message: `This instance (${INSTANCE_ID}) has handled ${global.requestCount} requests`
  });
});



// Teacher Signup (Just name and email)
app.post('/api/teacher/signup', async (req, res) => {
  try {
    const { email, name } = req.body
    
    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' })
    }
    
    // Check if teacher already exists
    const existing = await db.send(new ScanCommand({
      TableName: "LiveExams",
      FilterExpression: "teacherEmail = :email AND itemType = :type",
      ExpressionAttributeValues: {
        ":email": email,
        ":type": "TEACHER_PROFILE"
      }
    }))
    
    if (existing.Items && existing.Items.length > 0) {
      // Teacher exists, just login
      const teacher = existing.Items[0]
      const token = jwt.sign({ 
        teacherId: teacher.teacherId, 
        email: teacher.teacherEmail, 
        name: teacher.teacherName 
      }, JWT_SECRET, { expiresIn: '30d' })
      
      return res.json({ 
        success: true, 
        message: 'Welcome back!',
        teacherId: teacher.teacherId,
        name: teacher.teacherName,
        email: teacher.teacherEmail,
        token
      })
    }
    
    // Create new teacher
    const teacherId = `teacher_${Date.now()}`
    
    const teacherItem = {
      examCode: `TEACHER_${teacherId}`,
      teacherId: teacherId,
      teacherEmail: email,
      teacherName: name,
      createdAt: Date.now(),
      itemType: "TEACHER_PROFILE"
    }
    
    await db.send(new PutCommand({
      TableName: "LiveExams",
      Item: teacherItem
    }))
    
    // Generate JWT token
    const token = jwt.sign({ teacherId, email, name }, JWT_SECRET, { expiresIn: '30d' })
    
    res.json({ 
      success: true, 
      message: 'Teacher registered successfully',
      teacherId,
      name,
      email,
      token
    })
    
  } catch (err) {
    console.error("Signup error:", err)
    res.status(500).json({ error: 'Registration failed', details: err.message })
  }
})

// Teacher Login (Just email - same as signup basically)
app.post('/api/teacher/login', async (req, res) => {
  try {
    const { email } = req.body
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }
    
    // Find teacher by email
    const result = await db.send(new ScanCommand({
      TableName: "LiveExams",
      FilterExpression: "teacherEmail = :email AND itemType = :type",
      ExpressionAttributeValues: {
        ":email": email,
        ":type": "TEACHER_PROFILE"
      }
    }))
    
    if (!result.Items || result.Items.length === 0) {
      return res.status(404).json({ error: 'Teacher not found. Please sign up first.' })
    }
    
    const teacher = result.Items[0]
    
    // Generate JWT token
    const token = jwt.sign({ 
      teacherId: teacher.teacherId, 
      email: teacher.teacherEmail, 
      name: teacher.teacherName 
    }, JWT_SECRET, { expiresIn: '30d' })
    
    res.json({ 
      success: true, 
      message: 'Login successful',
      teacherId: teacher.teacherId,
      name: teacher.teacherName,
      email: teacher.teacherEmail,
      token
    })
    
  } catch (err) {
    console.error("Login error:", err)
    res.status(500).json({ error: 'Login failed', details: err.message })
  }
})

// ========== EXAM ENDPOINTS (same as before but with teacherId) ==========

// Create exam
app.post('/api/exam/create', authenticateTeacher, async (req, res) => {
  try {
    const { questions, examTitle } = req.body
    const teacherId = req.teacherId
    
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()

    console.log(`Creating exam for teacher ${teacherId}, code: ${code}`)

    const item = {
      examCode: code,
      teacherId: teacherId,
      examTitle: examTitle || `Exam ${code}`,
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
        }
      ],
      submissions: [],
      createdAt: Date.now(),
      itemType: "EXAM"
    }

    if (!db) {
      console.log("⚠️ Mock mode - exam not saved to DB")
      return res.json({ 
        code,
        warning: "Mock mode"
      })
    }

    await db.send(new PutCommand({
      TableName: "LiveExams",
      Item: item
    }))

    console.log("✅ Exam created:", code)
    res.json({ 
      code, 
      examTitle: item.examTitle,
      questions: item.questions,
      createdAt: item.createdAt 
    })
    
  } catch (err) {
    console.error("Error creating exam:", err)
    res.status(500).json({ error: "Failed to create exam", details: err.message })
  }
})

// Join exam (no changes needed)
app.post('/api/exam/join', async (req, res) => {
  const { code } = req.body
  
  if (!db) {
    console.log("⚠️ Mock mode for code:", code)
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
    })
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

    const questionsForStudent = result.Item.questions.map(q => ({
      id: q.id,
      text: q.text,
      options: q.options
    }))

    res.json({ 
      questions: questionsForStudent,
      examTitle: result.Item.examTitle 
    })
    
  } catch (err) {
    console.error("Error joining exam:", err)
    res.status(500).json({ error: "Failed to join exam" })
  }
})

// Submit exam (no changes needed)
app.post('/api/exam/submit', async (req, res) => {
  try {
    const { code, studentName, answers } = req.body

    if (!db) {
      console.log("⚠️ Mock mode submit")
      return res.json({ 
        message: 'Submitted (mock mode)',
        score: 0,
        total: 2
      })
    }

    const result = await db.send(new GetCommand({
      TableName: "LiveExams",
      Key: { examCode: code }
    }))

    if (!result.Item || result.Item.status !== 'LIVE') {
      return res.status(403).json({ error: 'Exam not active' })
    }

    let score = 0
    const questionResults = result.Item.questions.map(question => {
      const studentAnswer = answers[question.id]
      const isCorrect = studentAnswer === question.correctAnswer
      if (isCorrect) score++
      
      return {
        questionId: question.id,
        questionText: question.text,
        studentAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        options: question.options
      }
    })

    const submission = {
      studentName: studentName || 'Anonymous',
      answers,
      score,
      total: result.Item.questions.length,
      percentage: Math.round((score / result.Item.questions.length) * 100),
      results: questionResults,
      submittedAt: Date.now()
    }

    const submissions = result.Item.submissions || []
    submissions.push(submission)

    await db.send(new PutCommand({
      TableName: "LiveExams",
      Item: {
        ...result.Item,
        submissions
      }
    }))

    res.json({ 
      message: 'Submitted successfully',
      score,
      total: result.Item.questions.length,
      percentage: Math.round((score / result.Item.questions.length) * 100),
      results: questionResults
    })
    
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to submit exam" })
  }
})

// End exam (mark as ENDED instead of deleting)
app.post('/api/exam/end', authenticateTeacher, async (req, res) => {
  const { code } = req.body
  const teacherId = req.teacherId
  
  if (!db) {
    console.log("⚠️ Mock mode end exam")
    return res.json({ message: 'Exam ended (mock mode)' })
  }

  try {
    const result = await db.send(new GetCommand({
      TableName: "LiveExams",
      Key: { examCode: code }
    }))

    if (!result.Item) {
      return res.status(404).json({ error: 'Exam not found' })
    }

    if (result.Item.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized to end this exam' })
    }

    await db.send(new UpdateCommand({
      TableName: "LiveExams",
      Key: { examCode: code },
      UpdateExpression: "SET #status = :status, endedAt = :endedAt",
      ExpressionAttributeNames: {
        "#status": "status"
      },
      ExpressionAttributeValues: {
        ":status": "ENDED",
        ":endedAt": Date.now()
      }
    }))

    res.json({ 
      message: 'Exam ended successfully',
      examCode: code,
      submissionsCount: result.Item.submissions?.length || 0
    })
    
  } catch (err) {
    console.error("Error ending exam:", err)
    res.status(500).json({ error: "Failed to end exam", details: err.message })
  }
})

// ========== TEACHER DASHBOARD ==========

// Get all exams for a teacher
app.get('/api/teacher/exams', authenticateTeacher, async (req, res) => {
  try {
    const teacherId = req.teacherId
    
    const result = await db.send(new ScanCommand({
      TableName: "LiveExams",
      FilterExpression: "teacherId = :teacherId AND itemType = :type",
      ExpressionAttributeValues: {
        ":teacherId": teacherId,
        ":type": "EXAM"
      }
    }))

    const exams = result.Items || []
    
    const formattedExams = exams.map(exam => ({
      examCode: exam.examCode,
      examTitle: exam.examTitle || `Exam ${exam.examCode}`,
      status: exam.status,
      createdAt: exam.createdAt,
      endedAt: exam.endedAt,
      questionsCount: exam.questions?.length || 0,
      submissionsCount: exam.submissions?.length || 0,
      averageScore: exam.submissions?.length > 0 
        ? Math.round(exam.submissions.reduce((sum, sub) => sum + sub.percentage, 0) / exam.submissions.length)
        : 0
    }))

    res.json({ 
      success: true, 
      exams: formattedExams,
      totalExams: formattedExams.length
    })
    
  } catch (err) {
    console.error("Error fetching exams:", err)
    res.status(500).json({ error: "Failed to fetch exams", details: err.message })
  }
})

// Get exam details with submissions
app.get('/api/teacher/exam/:code', authenticateTeacher, async (req, res) => {
  try {
    const { code } = req.params
    const teacherId = req.teacherId
    
    const result = await db.send(new GetCommand({
      TableName: "LiveExams",
      Key: { examCode: code }
    }))

    if (!result.Item) {
      return res.status(404).json({ error: 'Exam not found' })
    }

    if (result.Item.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized to view this exam' })
    }

    const questionsWithoutAnswers = result.Item.questions?.map(q => ({
      id: q.id,
      text: q.text,
      options: q.options
    })) || []

    res.json({ 
      success: true,
      exam: {
        examCode: result.Item.examCode,
        examTitle: result.Item.examTitle,
        status: result.Item.status,
        createdAt: result.Item.createdAt,
        endedAt: result.Item.endedAt,
        questions: questionsWithoutAnswers,
        questionsCount: result.Item.questions?.length || 0,
        submissions: result.Item.submissions || [],
        submissionsCount: result.Item.submissions?.length || 0
      }
    })
    
  } catch (err) {
    console.error("Error fetching exam details:", err)
    res.status(500).json({ error: "Failed to fetch exam details", details: err.message })
  }
})

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: "Simple Teacher Auth Exam System",
    auth: "Email-based (no passwords)",
    features: ["Teacher auth", "Exam history", "Student tracking"]
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

const PORT = 3001
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Simple Teacher Auth System on port ${PORT}`)
  console.log(`📧 Auth: Email-only (no passwords)`)
})
