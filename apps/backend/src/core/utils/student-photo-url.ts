// Sigarra serves every student photo from FEUP's `fotografias_service`.
export function studentPhotoUrl(nmec: string): string {
  return `https://sigarra.up.pt/feup/pt/fotografias_service.foto?pct_cod=${encodeURIComponent(nmec)}`
}
