import { useState, useEffect } from 'react'
import CoursePicker from './CoursePicker'
import CoursePickerContext from '../../../../contexts/coursePicker/CoursePickerContext'
import { Major, CourseInfo } from '../../../../@types'
import BackendAPI from '../../../../api/backend'
import { Dispatch, SetStateAction } from 'react'
import useLocalStorage from '../../../../hooks/useLocalStorage'

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
    BackendAPI.getCoursesClasses(checkboxedCourses).then((courseWithClasses) => {
      setEnrollCourses(courseWithClasses)
    })
  }, [checkboxedCourses])

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
