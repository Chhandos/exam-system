import { exams } from '../../store'

export async function POST(req) {
  const { code } = await req.json()

  if (!exams[code]) {
    return Response.json({ error: 'Invalid exam code' }, { status: 404 })
  }

  if (exams[code].status !== 'LIVE') {
    return Response.json({ error: 'Exam ended' }, { status: 403 })
  }

  return Response.json({ questions: exams[code].questions })
}
