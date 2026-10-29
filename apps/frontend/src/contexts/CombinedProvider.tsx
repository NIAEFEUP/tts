import { useState } from 'react'
import { CourseInfo, MultipleOptions } from '../@types'
import StorageAPI from '../api/storage'
import MultipleOptionsContext from './MultipleOptionsContext'
import { ThemeContext } from './ThemeContext'
import { useDarkMode } from '../hooks'
import useSession from '../hooks/useSession'
import useCourses from '../hooks/useCourses'
import SessionContext from './SessionContext'
import MajorContext from './MajorContext'
import CourseContext from './CourseContext'
import ConflictsContext from './ConflictsContext'

type Props = {
  children: React.JSX.Element
}

const CombinedProvider = ({ children }: Props) => {
  StorageAPI.storeCurrentVisit()
  const [coursesInfo, setCoursesInfo] = useState([])
  const [pickedCourses, setPickedCourses] = useState<CourseInfo[]>(StorageAPI.getPickedCoursesStorage())
  const [checkboxedCourses, setCheckboxedCourses] = useState<CourseInfo[]>(StorageAPI.getPickedCoursesStorage())
  const [ucsModalOpen, setUcsModalOpen] = useState<boolean>(false)

  //TODO: Looks suspicious
  const [choosingNewCourse, setChoosingNewCourse] = useState<boolean>(false)

  const [enabled, setEnabled] = useDarkMode() // TODO (Process-ing): Stop using a hook (who smoked here?)
  const [multipleOptions, setMultipleOptionsState] = useState<MultipleOptions>(StorageAPI.getMultipleOptionsStorage())

  const [selectedOption, setSelectedOptionState] = useState<number>(StorageAPI.getSelectedOptionStorage())

  const { signedIn: userSignedIn, user, isLoading: isSessionLoading, forceScheduleRevalidation } = useSession()

  // Load the course catalog once, only after the session resolves and the user is
  // signed in. The hook keys off `enabled` so signed-out visitors fire no request.
  // Failures are surfaced inline in the picker (see MajorSearchCombobox), not as a
  // toast — SWR retries mean a toast here would fire once per retry.
  const {
    majors,
    error: majorsError,
    loading: majorsLoading,
    retry: retryMajors,
  } = useCourses({
    enabled: userSignedIn && !isSessionLoading,
  })

  const [conflictSeverity, setConflictSeverity] = useState<boolean>(false)
  const [tClassConflicts, setTClassConflicts] = useState<boolean>(false)
  const [hasSomeConflict, setHasSomeConflict] = useState<boolean>(false)

  const setMultipleOptions = (
    newMultipleOptions: MultipleOptions | ((prevMultipleOptions: MultipleOptions) => MultipleOptions),
  ) => {
    if (newMultipleOptions instanceof Function) newMultipleOptions = newMultipleOptions(multipleOptions)

    setMultipleOptionsState(newMultipleOptions)
    StorageAPI.setMultipleOptionsStorage(newMultipleOptions)
  }

  const setSelectedOption = (newOption: number | ((prevOption: number) => number)) => {
    if (newOption instanceof Function) newOption = newOption(selectedOption)

    setSelectedOptionState(newOption)
    StorageAPI.setSelectedOptionStorage(newOption)
  }

  return (
    <SessionContext.Provider
      value={{
        signedIn: userSignedIn,
        user,
        isSessionLoading,
        forceScheduleRevalidation,
      }}
    >
      <ThemeContext.Provider value={{ enabled, setEnabled }}>
        <MajorContext.Provider value={{ majors, majorsError, majorsLoading, retryMajors }}>
          <CourseContext.Provider
            value={{
              pickedCourses,
              setPickedCourses,
              coursesInfo,
              setCoursesInfo,
              checkboxedCourses,
              setCheckboxedCourses,
              choosingNewCourse,
              setChoosingNewCourse,
              ucsModalOpen,
              setUcsModalOpen,
            }}
          >
            <MultipleOptionsContext.Provider
              value={{
                multipleOptions,
                setMultipleOptions,
                selectedOption,
                setSelectedOption,
              }}
            >
              <ConflictsContext.Provider
                value={{
                  conflictSeverity,
                  setConflictSeverity,
                  tClassConflicts,
                  setTClassConflicts,
                  hasSomeConflict,
                  setHasSomeConflict,
                }}
              >
                {children}
              </ConflictsContext.Provider>
            </MultipleOptionsContext.Provider>
          </CourseContext.Provider>
        </MajorContext.Provider>
      </ThemeContext.Provider>
    </SessionContext.Provider>
  )
}

export default CombinedProvider
