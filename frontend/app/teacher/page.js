'use client'
import { useState } from 'react'

export default function TeacherPage() {
  const [examCode, setExamCode] = useState('')
  const [status, setStatus] = useState('IDLE')

  async function createExam() {
    console.log("Clicked Create Exam button");  // Step 1: button works
    try {
      const res = await fetch('http://15.207.109.205:3001/api/exam/create', { method: 'POST' });
      console.log("Fetch response object:", res); // Step 2: fetch sent
      const data = await res.json();
      console.log("Exam code from backend:", data); // Step 3: backend responded
      setExamCode(data.code);
      setStatus('LIVE');
    } catch (err) {
      console.error("Fetch failed:", err);  // Step 4: fetch failed
    }
  }


  async function endExam() {
    await fetch('http://15.207.109.205:3001/api/exam/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: examCode })
    })

    setStatus('ENDED')
  }

  function resetExam() {
    setExamCode('')
    setStatus('IDLE')
  }

  return (
    <div style={{ padding: '40px' }}>
      <h2>Teacher Dashboard</h2>

      <button
        onClick={async () => {
          try {
            const res = await fetch('http://15.207.109.205:3001/api/test');
            const data = await res.json();
            alert(JSON.stringify(data));
          } catch (err) {
            console.error(err);
            alert("Failed to reach backend");
          }
        }}
      >
        Test Backend Connection
      </button>



      {status === 'IDLE' && (
        <button onClick={createExam}>Create Exam</button>
      )}

      {status !== 'IDLE' && (
        <>
          <p>
            Exam Code: <b>{examCode}</b>
          </p>
          <p>Status: <b>{status}</b></p>
        </>
      )}

      {status === 'LIVE' && (
        <button onClick={endExam}>End Exam</button>
      )}

      {status === 'ENDED' && (
        <button onClick={resetExam}>Create New Exam</button>
      )}
    </div>
  )
}
