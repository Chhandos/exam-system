const express = require("express");
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Online Exam Backend Running" });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

app.get("/start-exam", (req, res) => {
  res.json({ exam: "started" });
});

app.post("/submit-exam", (req, res) => {
  res.json({ result: "submitted" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
