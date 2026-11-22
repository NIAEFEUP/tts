import { useContext, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/solid'
import occurrenceService from '../../../../api/services/occurrenceService'
import StorageAPI from '../../../../api/storage'
import { Button } from '../../../ui/new/button'
import CourseContext from '../../../../contexts/CourseContext'
import useVerifyCourseUnitHashes from '../../../../hooks/useVerifyCourseUnitHashes'
import MultipleOptionsContext from '../../../../contexts/MultipleOptionsContext'
import { Tooltip } from '../../../ui/new/tooltip'
import { toast } from '../../../ui/new/toaster'

const Refresh = () => {
  const { pickedCourses, setPickedCourses } = useContext(CourseContext)
  const { mismatchedMap } = useVerifyCourseUnitHashes(pickedCourses)
  const { multipleOptions, setMultipleOptions } = useContext(MultipleOptionsContext)
  const [isLoading, setIsLoading] = useState(false)

  const updateCourses = async () => {
    setIsLoading(true)

    try {
      if (mismatchedMap.size > 0) {
        const coursesToUpdate = pickedCourses.filter((course) => mismatchedMap.has(course.id))
        const updatedCoursesWithClasses = await Promise.all(
          coursesToUpdate.map(async (course) => {
            const { classes } = await occurrenceService.getClasses(course.id, course.occurrenceYear)
            return {
              ...course,
              hash: mismatchedMap.get(course.id),
              classes,
            }
          }),
        )

        const finalCourses = pickedCourses.map((course) =>
          mismatchedMap.has(course.id)
            ? updatedCoursesWithClasses.find((updated) => updated.id === course.id) || course
            : course,
        )

        const classIdMap: Record<number, number> = {} //Maps old class ids to new class ids and is used to update the picked classes in multiple options

        pickedCourses.forEach((course) => {
          const oldClasses = course.classes || []
          const newClasses = finalCourses.find((finalCourse) => finalCourse.id === course.id)?.classes || []
          oldClasses.forEach((oldClass) => {
            const newClass = newClasses.find((cls) => cls.name === oldClass.name)
            if (newClass) {
              classIdMap[oldClass.id] = newClass.id
            } else {
              classIdMap[oldClass.id] = null
            }
          })
        })

        const updatedMultipleOptions = [...multipleOptions]
        for (let i = 0; i < updatedMultipleOptions.length; i++) {
          for (let j = 0; j < updatedMultipleOptions[i].course_options.length; j++) {
            const courseOption = updatedMultipleOptions[i].course_options[j]
            const oldClassId = courseOption.picked_class_id
            if (classIdMap[oldClassId] !== undefined) {
              updatedMultipleOptions[i].course_options[j].picked_class_id = classIdMap[oldClassId]
            }
          }
        }
        setMultipleOptions(updatedMultipleOptions)
        StorageAPI.setMultipleOptionsStorage(updatedMultipleOptions)
        StorageAPI.setPickedCoursesStorage(finalCourses)
        setPickedCourses(finalCourses)
        mismatchedMap.clear()
        toast({
          title: 'Informação atualizada',
          description: 'A informação das UCs foi atualizada com sucesso!',
        })
      }
    } catch (error) {
      console.error(error)
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar as turmas das UCs.',
        duration: 3000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (mismatchedMap.size === 0) {
    return null
  }

  return (
    <Tooltip>
      <Tooltip.Trigger asChild>
        <div className="relative group pointer-events-auto">
          <Button
            variant="ghost"
            square
            size="sm"
            className="bg-emerald-800 text-white hover:bg-emerald-700 relative"
            onClick={updateCourses}
            disabled={isLoading}
          >
            <span className="absolute -top-1 -right-1 block h-3 w-3 rounded-full bg-red-600 border border-white"></span>
            <ArrowPathIcon className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </Tooltip.Trigger>
      <Tooltip.Content>Existem informações desatualizadas, clica aqui para atualizares.</Tooltip.Content>
    </Tooltip>
  )
}

export default Refresh
