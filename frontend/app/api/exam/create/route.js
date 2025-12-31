import { exams } from '../../store'

export async function POST() {
  const code = Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase()

  exams[code] = {
    status: 'LIVE',
    questions: [
      { id: 1, q: 'What is cloud computing?' },
      { id: 2, q: 'What is load balancing?' }
    ],
    submissions: []
  }

  return Response.json({ code })
}
