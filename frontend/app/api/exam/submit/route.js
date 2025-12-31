import { exams } from '../../store'

export async function POST(req) {
  const { code } = await req.json()

  if (!exams[code] || exams[code].status !== 'LIVE') {
    return Response.json({ error: 'Exam not active' }, { status: 403 })
  }

  exams[code].submissions.push('submitted')
  return Response.json({ message: 'Submitted' })
}
