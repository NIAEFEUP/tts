import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '../ui/alert'

/** Visible failure state for the eligible-course-units fetch. */
export const CourseUnitsError = () => (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>Não foi possível carregar as tuas unidades curriculares.</AlertDescription>
  </Alert>
)
