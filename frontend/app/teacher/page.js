'use client'
import { useState } from 'react'

export default function TeacherPage() {
  const [examCode, setExamCode] = useState('')
  const [status, setStatus] = useState('IDLE')

  async function createExam() {
    const res = await fetch('http://localhost:3001/api/exam/create', { method: 'POST' })
    const data = await res.json()

    setExamCode(data.code)
    setStatus('LIVE')
  }

  async function endExam() {
    await fetch('http://localhost:3001/api/exam/end', {
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
