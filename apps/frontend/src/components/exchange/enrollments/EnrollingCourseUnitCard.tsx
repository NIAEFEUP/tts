import { Dispatch, SetStateAction, useState } from 'react'
import { CourseInfo } from '../../../@types'
import { Button } from '../../ui/new/button'
import { Card, CardHeader, CardTitle } from '../../ui/card'

type Props = {
  courseUnit: CourseInfo
  enrollCourses: CourseInfo[]
  setEnrollCourses: Dispatch<SetStateAction<CourseInfo[]>>
}

export const EnrollingCourseUnitCard = ({ courseUnit, enrollCourses, setEnrollCourses }: Props) => {
  const [remove, setRemove] = useState<boolean>(true)

  return (
    <>
      {remove && (
        <Card>
          <CardHeader className="flex flex-row justify-between items-center py-2 px-4 text-left">
            <CardTitle className="text-sm">{courseUnit.acronym}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600"
              onClick={() => {
                setRemove(false)
                setEnrollCourses(enrollCourses.filter((course) => course.id !== courseUnit.id))
              }}
            >
              Remover
            </Button>
          </CardHeader>
        </Card>
      )}
    </>
  )
}
