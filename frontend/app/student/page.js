'use client'
import { useState } from 'react'

export default function StudentPage() {
  const [code, setCode] = useState('')
  const [questions, setQuestions] = useState([])
  const [error, setError] = useState(null)
  const [joined, setJoined] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function joinExam() {
    setError(null)

    const res = await fetch('http://localhost:3001/api/exam/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
      return
    }

    setQuestions(data.questions)
    setJoined(true)
  }

  async function submitExam() {
    const res = await fetch('http://localhost:3001/api/exam/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        answers: 'submitted'
      })
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error)
      return
    }

    setSubmitted(true)
  }

  return (
    <div style={{ padding: '40px' }}>
      <h2>Student Portal</h2>

      {!joined && (
        <>
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="Enter Exam Code"
          />
          <br /><br />
          <button onClick={joinExam}>Join Exam</button>
        </>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {joined && !submitted && (
        <>
          <h3>Questions</h3>
          {questions.map(q => (
            <div key={q.id}>
              <p>{q.q}</p>
            </div>
          ))}

          <br />
          <button onClick={submitExam}>Submit Exam</button>
        </>
      )}

      {submitted && (
        <h3 style={{ color: 'green' }}>
          Exam submitted successfully
        </h3>
      )}
    </div>
  )
}
