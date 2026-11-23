import { useContext, useEffect, useState } from 'react'
import CourseContext from '../../../../contexts/CourseContext'
import CoursePicker from './CoursePicker'
import CoursePickerContext from '../../../../contexts/coursePicker/CoursePickerContext'
import StorageAPI from '../../../../api/storage'
import { Major } from '../../../../@types'

export const PlannerCoursePicker = () => {
  const {
    pickedCourses,
    setPickedCourses,
    checkboxedCourses,
    setCheckboxedCourses,
    choosingNewCourse,
    setChoosingNewCourse,
    ucsModalOpen,
    coursesInfo,
    setCoursesInfo,
    setUcsModalOpen,
  } = useContext(CourseContext)

  const [selectedMajor, setSelectedMajor] = useState<Major>(StorageAPI.getSelectedMajorStorage())

  useEffect(() => {
    setPickedCourses((prev) => {
      const merged = checkboxedCourses.map((course) => ({
        ...course,
        classes: prev.find((c) => c.id === course.id)?.classes ?? course.classes,
      }))
      StorageAPI.setPickedCoursesStorage(merged)
      return merged
    })
  }, [checkboxedCourses])

  useEffect(() => {
    if (!selectedMajor) return
    StorageAPI.setSelectedMajorStorage(selectedMajor)
  }, [selectedMajor, setCoursesInfo])

  return (
    <CoursePickerContext.Provider
      value={{
        coursesStorage: pickedCourses,
        setCoursesStorage: setPickedCourses,
        checkboxedCourses,
        setCheckboxedCourses,
        choosingNewCourse,
        setChoosingNewCourse,
        ucsModalOpen,
        setUcsModalOpen,
        coursesInfo,
        setCoursesInfo,
        selectedMajor,
        setSelectedMajor,
      }}
    >
      <CoursePicker />
    </CoursePickerContext.Provider>
  )
}
