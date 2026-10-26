// Port for where a student's photo lives. Photos are not stored by TTS; the
// provider only knows how to point at the upstream copy.

export type StudentPhotoProvider = {
  /** URL of the student's photo for a normalised NMEC. Does not check it exists. */
  urlFor(nmec: string): string
}
