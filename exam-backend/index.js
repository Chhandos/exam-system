const express = require('express')
const cors = require('cors')

const db = require("./dynamo");
const {
  PutCommand,
  GetCommand,
  DeleteCommand
} = require("@aws-sdk/lib-dynamodb");


const app = express()
app.use(cors())
app.use(express.json())


// Create exam
app.post('/api/exam/create', async (req, res) => {
  const code = Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase()

  const questions = [
    { id: 1, q: 'What is cloud computing?' },
    { id: 2, q: 'What is load balancing?' }
  ]

  await db.send(new PutCommand({
    TableName: "LiveExams",
    Item: {
      examCode: code,
      status: "LIVE",
      questions,
      createdAt: Date.now()
    }
  }))

  res.json({ code })
})


// Join exam
app.post('/api/exam/join', async (req, res) => {
  const { code } = req.body

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
})


// End exam
app.post('/api/exam/end', async (req, res) => {
  const { code } = req.body

  await db.send(new DeleteCommand({
    TableName: "LiveExams",
    Key: { examCode: code }
  }))

  res.json({ message: 'Exam ended' })
})


// Submit exam
app.post('/api/exam/submit', (req, res) => {
  const { code } = req.body

  if (!exams[code] || exams[code].status !== 'LIVE') {
    return res.status(403).json({ error: 'Exam not active' })
  }

  exams[code].submissions.push('submitted')
  res.json({ message: 'Submitted' })
})

app.listen(3001, () => {
  console.log('Express backend running on port 3001')
})
