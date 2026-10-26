import type { StudentPhotoProvider } from '@/domain/ports/student-photo.provider'
import type { StudentRepository } from '@/domain/ports/student.repository'

export type GetStudentPhotoResult = { ok: true; url: string } | { ok: false; reason: 'student-not-found' }

/** Any signed-in user may get the photo URL of a student that exists in TTS. */
export function createGetStudentPhoto(deps: { students: StudentRepository; photos: StudentPhotoProvider }) {
  return async function getStudentPhoto(nmec: string): Promise<GetStudentPhotoResult> {
    const profile = await deps.students.findProfile(nmec)
    if (!profile) return { ok: false, reason: 'student-not-found' }

    return { ok: true, url: deps.photos.urlFor(profile.nmec) }
  }
}
