console.log("🔥🔥 NEW INDEX.JS LOADED 🔥🔥");

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

    console.log("Creating item in DynamoDB:", item);

    const result = await db.send(new PutCommand({
      TableName: "LiveExams",
      Item: item
    }));

    console.log("DynamoDB result:", result);

    res.json({ code });
  } catch (err) {
    console.error("Error creating exam:", err); // ← This will print the real error
    res.status(500).json({ error: "Failed to create exam" });
  }
});


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



app.get('/api/test', (req, res) => {
  console.log("Frontend hit the /api/test endpoint!");
  res.json({ message: "Backend is reachable!" });
});



// Submit exam
app.post('/api/exam/submit', async (req, res) => {
  try {
    const { code, submission } = req.body;

    const result = await db.send(new GetCommand({
      TableName: "LiveExams",
      Key: { examCode: code }
    }));

    if (!result.Item || result.Item.status !== 'LIVE') {
      return res.status(403).json({ error: 'Exam not active' });
    }

    // Push submission into DynamoDB
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
    res.status(500).json({ error: "Failed to submit exam" });
  }
});


app.listen(3001, "0.0.0.0", () => {
  console.log("Express backend running on port 3001");
});
