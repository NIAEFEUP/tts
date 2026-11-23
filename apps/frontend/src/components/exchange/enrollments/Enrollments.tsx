import { useState, useContext, Dispatch, SetStateAction, FormEvent } from 'react'
// import { Desert } from "../../svgs/";
import { ExchangeCoursePicker } from '../../planner/sidebar/sessionController/ExchangeCoursePicker'
import { CourseInfo } from '../../../@types'
import CourseContext from '../../../contexts/CourseContext'
import { Button } from '../../ui/new/button'
import enrollmentService from '../../../api/services/enrollmentService'
import { ExchangeSidebarStatus } from '../../../pages/Exchange'
import { toast } from '../../ui/new/toaster'
import useStudentCourseUnits from '../../../hooks/useStudentCourseUnits'
import { AlreadyEnrolledCourseUnitCard } from './AlreadyEnrolledCourseUnitCard'
import { EnrollingCourseUnitCard } from './EnrollingCourseUnitCard'
import { toEnrollmentRequestOptions } from './enrollmentOptions'
import { CourseUnitsError } from '../CourseUnitsError'
import { LockClosedIcon } from '@heroicons/react/24/outline'
import { Skeleton } from '../../ui/skeleton'

type Props = {
  setExchangeSidebarStatus: Dispatch<SetStateAction<ExchangeSidebarStatus>>
}

export const Enrollments = ({ setExchangeSidebarStatus }: Props) => {
  const parentCourseContext = useContext(CourseContext)

  const [enrollCourses, setEnrollCourses] = useState<CourseInfo[]>([])
  const [dropChoices, setDropChoices] = useState<Set<number>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [coursesInfo, setCoursesInfo] = useState<CourseInfo[]>([])

  const {
    enrolledCourseUnits: alreadyEnrolledCourseUnits,
    loading: loadingEnrolled,
    error: courseUnitsError,
  } = useStudentCourseUnits()

  const toggleDropChoice = (courseUnitId: number) => {
    setDropChoices((current) => {
      const next = new Set(current)
      if (next.has(courseUnitId)) next.delete(courseUnitId)
      else next.add(courseUnitId)

      return next
    })
  }

  const selectedDrops = (alreadyEnrolledCourseUnits ?? []).filter(({ id }) => dropChoices.has(id))
  const hasSelection = enrollCourses.length > 0 || selectedDrops.length > 0

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    // Guards against submitting an enrollment request with no course units selected,
    // which would create a ghost request with an empty options list.
    if (!hasSelection) {
      toast({
        variant: 'negative',
        title: 'Nenhuma unidade curricular selecionada',
        description: 'Seleciona pelo menos uma unidade curricular antes de submeter o pedido.',
      })
      return
    }

    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      await enrollmentService.createRequest(toEnrollmentRequestOptions({ enrollCourses, dropCourses: selectedDrops }))

      setExchangeSidebarStatus(ExchangeSidebarStatus.SHOWING_REQUESTS)
      toast({
        title: 'Pedido submetido',
        description: 'Pedido de inscrição submetida com sucesso',
      })
      setEnrollCourses([])
      setDropChoices(new Set())
    } catch (error) {
      toast({
        variant: 'negative',
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao submeter o pedido',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <CourseContext.Provider
      value={{
        ...parentCourseContext,
        pickedCourses: enrollCourses,
        setPickedCourses: setEnrollCourses,
        coursesInfo: coursesInfo,
        setCoursesInfo: setCoursesInfo,
      }}
    >
      <div className="relative flex flex-col gap-y-4 w-full">
        <div className="flex flex-row justify-between items-center w-full">
          <h1 className="font-bold text-xl text-left">Inscrições</h1>
          <div className="w-1/2">
            <ExchangeCoursePicker
              enrollCourses={enrollCourses}
              setEnrollCourses={setEnrollCourses}
              allowedAcronyms={['L.EIC', 'M.EIC']}
            />
          </div>
        </div>

        <div className="w-full flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-2">
            {enrollCourses?.length > 0 && <h3 className="font-bold text-md text-left">Cadeiras a inscrever</h3>}

            {enrollCourses.map((course: CourseInfo) => (
              <EnrollingCourseUnitCard
                key={'enrolling-' + course.id}
                courseUnit={course}
                enrollCourses={enrollCourses}
                setEnrollCourses={setEnrollCourses}
              />
            ))}
          </div>

          <div className="flex flex-col gap-y-2">
            {courseUnitsError ? (
              <CourseUnitsError />
            ) : loadingEnrolled ? (
              <div className="flex flex-col gap-y-2">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ) : alreadyEnrolledCourseUnits && alreadyEnrolledCourseUnits.length === 0 ? (
              <h3 className="flex flex-col items-center justify-center text-center font-bold text-md mt-8">
                <LockClosedIcon className="w-12 h-12 mb-2 text-muted-foreground" />
                Não tens inscrição em nenhuma cadeira com período de inscrição aberto
              </h3>
            ) : (
              alreadyEnrolledCourseUnits?.map((courseUnit: CourseInfo) => (
                <AlreadyEnrolledCourseUnitCard
                  key={'already-enrolled-' + courseUnit.id}
                  courseUnit={courseUnit}
                  selected={dropChoices.has(courseUnit.id)}
                  onToggle={() => toggleDropChoice(courseUnit.id)}
                />
              ))
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <Button
              type="submit"
              size="md"
              disabled={!hasSelection}
              isLoading={isSubmitting}
              className="w-full bg-primary hover:bg-primary/90 text-white"
            >
              Submeter
            </Button>
          </form>
        </div>
      </div>
    </CourseContext.Provider>
  )
}
