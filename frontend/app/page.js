'use client'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <h1>Cloud-Based Online Examination System</h1>

      <div style={{ marginTop: '40px' }}>
        <button
          style={{ padding: '12px 24px', marginRight: '20px' }}
          onClick={() => router.push('/student')}
        >
          Student
        </button>

        <button
          style={{ padding: '12px 24px' }}
          onClick={() => router.push('/teacher')}
        >
          Teacher
        </button>
      </div>
    </div>
  )
}
