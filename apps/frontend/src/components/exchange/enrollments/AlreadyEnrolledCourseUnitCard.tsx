import { CourseInfo } from '../../../@types'
import { Button } from '../../ui/new/button'
import { Card, CardHeader, CardTitle } from '../../ui/card'

type Props = {
  courseUnit: CourseInfo
  selected: boolean
  onToggle: () => void
}

export const AlreadyEnrolledCourseUnitCard = ({ courseUnit, selected, onToggle }: Props) => {
  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center py-2 px-4">
        <CardTitle className="text-sm">{courseUnit.acronym}</CardTitle>
        <Button variant="outline" size="sm" onClick={onToggle}>
          {selected ? 'Cancelar pedido' : 'Anular inscrição'}
        </Button>
      </CardHeader>
    </Card>
  )
}
