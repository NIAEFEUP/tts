// Read-side port for the per-(student, course) metadata scraped from Sigarra.
// Routes depend on this interface; the Prisma implementation lives in
// `infrastructure/database/repositories/`.

export type StudentCourseMetadata = {
  courseId: number
  /** Sigarra `fest_id` of the student's enrollment in the course. */
  festId: number
}

export type StudentCourseMetadataRepository = {
  /** The metadata of one student in one course, or `null` when none was scraped. */
  find(nmec: string, courseId: number): Promise<StudentCourseMetadata | null>
}
