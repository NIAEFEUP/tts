import type { StudentPhotoProvider } from '@/domain/ports/student-photo.provider'

const PHOTO_ENDPOINT = 'https://sigarra.up.pt/feup/pt/fotografias_service.foto'

/**
 * Points at the photo Sigarra serves for a student. TTS never fetches or
 * stores the image, so building the URL needs no network call.
 */
export function createSigarraStudentPhoto(): StudentPhotoProvider {
  return {
    urlFor(nmec) {
      return `${PHOTO_ENDPOINT}?pct_cod=${encodeURIComponent(nmec)}`
    },
  }
}
