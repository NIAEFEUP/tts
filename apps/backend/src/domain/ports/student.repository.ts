// Read-side port for looking up another student. Deliberately narrower than
// `AuthUser`: a profile is what any signed-in user may see about someone else,
// so email and role never cross this boundary.

/** The public face of a student. */
export type StudentProfile = {
  /** NMEC ("up" number), without the `up` prefix. */
  nmec: string
  name: string
}

/** The Sigarra `fest_id` cached for a student in one course. */
export type StudentCourseMetadata = {
  nmec: string
  courseId: number
  festId: number
}

export type StudentRepository = {
  /** Profile for a normalised NMEC, or `null` if no such student exists. */
  findProfile(nmec: string): Promise<StudentProfile | null>

  /** Cached metadata for a student in a course, or `null` if none was stored. */
  findCourseMetadata(nmec: string, courseId: number): Promise<StudentCourseMetadata | null>
}
