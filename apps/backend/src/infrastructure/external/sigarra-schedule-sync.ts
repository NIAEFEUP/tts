import type { ScheduleEnrollment, ScheduleSync } from '@/domain/ports/schedule-sync'

function semesterWeeks(now = new Date()) {
  const month = now.getMonth() + 1
  const firstSemester = month >= 10 || month <= 2
  const year = now.getFullYear()
  if (firstSemester) {
    const startYear = month <= 2 ? year - 1 : year
    return { start: `${startYear}1001`, end: `${startYear + 1}0131`, year: startYear }
  }
  return { start: `${year}0210`, end: `${year}0601`, year: year - 1 }
}

export function createSigarraScheduleSync(): ScheduleSync {
  return {
    async fetchEnrollments(nmec) {
      const normalized = nmec.replace(/^up/i, '')
      const weeks = semesterWeeks()
      const url = new URL('https://sigarra.up.pt/feup/pt/mob_hor_geral.estudante')
      url.searchParams.set('pv_codigo', normalized)
      url.searchParams.set('pv_semana_ini', weeks.start)
      url.searchParams.set('pv_semana_fim', weeks.end)

      const response = await fetch(url)
      if (!response.ok) throw new Error(`Sigarra schedule returned ${response.status}`)

      const body = (await response.json()) as {
        horario?: Array<{ ocorrencia_id: number; turma_sigla: string; tipo: string }>
      }

      const latest = new Map<string, ScheduleEnrollment>()
      for (const item of body.horario ?? []) {
        if (item.tipo === 'T' || item.tipo === 'O') continue
        const occurrenceId = Number(item.ocorrencia_id)
        const className = item.turma_sigla?.split('+')[0]?.trim()
        if (!Number.isFinite(occurrenceId) || !className) continue

        latest.set(`${occurrenceId}:${className}`, { occurrenceId, occurrenceYear: weeks.year, className })
      }

      return [...latest.values()]
    },
  }
}

export function createDevScheduleSync(enrollments: ScheduleEnrollment[] = []): ScheduleSync {
  return { fetchEnrollments: async () => [...enrollments] }
}
