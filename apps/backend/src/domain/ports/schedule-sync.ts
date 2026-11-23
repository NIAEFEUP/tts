export type ScheduleEnrollment = {
  occurrenceId: number
  occurrenceYear: number
  className: string
}

/** Fetches the authoritative class assignments for a student from Sigarra or a dev provider. */
export type ScheduleSync = {
  fetchEnrollments(nmec: string): Promise<ScheduleEnrollment[]>
}
