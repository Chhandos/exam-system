import { exams } from '../../store'

export async function POST(req) {
  const { code } = await req.json()

  if (!exams[code]) {
    return Response.json({ error: 'Invalid exam code' }, { status: 404 })
  }

  exams[code].status = 'ENDED'
  return Response.json({ message: 'Exam ended' })
}
