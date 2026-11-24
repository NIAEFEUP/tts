import { useState, useEffect } from 'react'
import CoursePicker from './CoursePicker'
import CoursePickerContext from '../../../../contexts/coursePicker/CoursePickerContext'
import { Major, CourseInfo } from '../../../../@types'
import occurrenceService from '../../../../api/services/occurrenceService'
import { Dispatch, SetStateAction } from 'react'
import useLocalStorage from '../../../../hooks/useLocalStorage'
import { toast } from '../../../ui/new/toaster'

type Props = {
  enrollCourses: CourseInfo[]
  setEnrollCourses: Dispatch<SetStateAction<CourseInfo[]>>
  allowedAcronyms?: string[]
}

export const ExchangeCoursePicker = ({ enrollCourses, setEnrollCourses, allowedAcronyms }: Props) => {
  const [checkboxedCourses, setCheckboxedCourses] = useState([])
  const [coursesInfo, setCoursesInfo] = useState<CourseInfo[]>([])
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [selectedMajor, setSelectedMajor] = useLocalStorage<Major>('enrollMajor', null)

  useEffect(() => {
    let cancelled = false

    Promise.all(
      checkboxedCourses.map(async (course) => {
        const { classes } = await occurrenceService.getClasses(course.id, course.occurrenceYear)
        return { ...course, classes }
      }),
    )
      .then((coursesWithClasses) => {
        if (!cancelled) setEnrollCourses(coursesWithClasses)
      })
      .catch((error) => {
        console.error(error)
        if (!cancelled) {
          toast({
            title: 'Erro ao carregar as turmas',
            description: 'Não foi possível carregar as turmas das unidades curriculares selecionadas.',
            duration: 3000,
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [checkboxedCourses, setEnrollCourses])

  return (
    <CoursePickerContext.Provider
      value={{
        coursesStorage: enrollCourses,
        setCoursesStorage: setEnrollCourses,
        checkboxedCourses: checkboxedCourses,
        setCheckboxedCourses: setCheckboxedCourses,
        choosingNewCourse: false,
        setChoosingNewCourse: () => {},
        ucsModalOpen: modalOpen,
        setUcsModalOpen: setModalOpen,
        coursesInfo: coursesInfo,
        setCoursesInfo: setCoursesInfo,
        selectedMajor: selectedMajor,
        setSelectedMajor: setSelectedMajor,
      }}
    >
      <CoursePicker allowedAcronyms={allowedAcronyms} />
    </CoursePickerContext.Provider>
  )
}
