import { useRef, useState, useContext, useEffect } from 'react'
import { Lock, LockOpen, ChevronsUpDown } from 'lucide-react'
import { CourseInfo } from '../../../../@types'
import { getClassDisplayText } from '../../../../utils'
import { Button } from '../../../ui/new/button'
import { Popover } from '../../../ui/new/popover'
import ClassSelectorDropdownController from './ClassSelectorDropdownController'
import ClassSelectorContext from '../../../../contexts/classSelector/ClassSelectorContext'
import useCourseUnitClasses from '../../../../hooks/useCourseUnitClasses'
import CourseContext from '../../../../contexts/CourseContext'

type Props = {
  course: CourseInfo
  lockFunctionality?: boolean
}

const ClassSelector = ({ course, lockFunctionality = true }: Props) => {
  const classSelectorTriggerRef = useRef(null)
  const classSelectorContentRef = useRef(null)

  const { setPickedCourses } = useContext(CourseContext)

  const { classes, loading: classesLoading } = useCourseUnitClasses(course.id)

  useEffect(() => {
    if (classes) {
      setPickedCourses((prevCourses) => prevCourses.map((c) => (c.id === course.id ? { ...c, classes: classes } : c)))
    }
  }, [classes, setPickedCourses])

  const { selectedClassId, setSelectedClassId, display, setPreview, removePreview, toggleLocker, courseOption } =
    useContext(ClassSelectorContext)

  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  return (
    <div className="text-sm" key={`course-option-${course.acronym}`}>
      {/* Header */}
      <p className="mb-0.5 flex text-xs">
        <strong>{course.acronym}</strong>
        <span>&nbsp;&middot;&nbsp;</span>
        <span className="truncate tracking-tighter">{course.name}&nbsp;</span>
      </p>
      <div className="flex items-center gap-2">
        <Popover
          open={isDropdownOpen}
          onOpenChange={(open: boolean) => {
            setIsDropdownOpen(open)
            if (!open) {
              window.setTimeout(() => {
                removePreview()
              }, 0)
            }
          }}
        >
          <div className="w-full">
            <Popover.Trigger asChild>
              <Button
                ref={classSelectorTriggerRef}
                disabled={courseOption?.locked}
                variant="outline"
                className="w-full justify-between"
              >
                <span className={`min-w-0 truncate ${selectedClassId === null ? 'opacity-50' : ''}`}>
                  {getClassDisplayText(course, selectedClassId)}
                </span>
                {!courseOption?.locked && (
                  <ChevronsUpDown size="14" className="shrink-0 text-blackish dark:text-lightish" />
                )}
              </Button>
            </Popover.Trigger>
            <Popover.Content
              className="z-60 p-0 overflow-hidden"
              style={{ width: 'var(--width)' }}
              ref={classSelectorContentRef}
            >
              <ClassSelectorDropdownController
                course={course}
                selectedClassIdHook={[selectedClassId, setSelectedClassId]}
                isDropdownOpen={isDropdownOpen}
                setPreview={setPreview}
                removePreview={removePreview}
                contentRef={classSelectorContentRef}
                triggerRef={classSelectorTriggerRef}
                classesLoading={classesLoading}
                closeDropdown={() => setIsDropdownOpen(false)}
              />
            </Popover.Content>
          </div>
        </Popover>

        {/* Lock Button */}
        {lockFunctionality && (
          <Button
            square
            variant="ghost"
            title={courseOption?.locked ? 'Desbloquear Horário' : 'Bloquear Horário'}
            onClick={toggleLocker}
            disabled={display === null}
          >
            {courseOption?.locked ? (
              <LockOpen size={16} className="text-darkish dark:text-lightish" />
            ) : (
              <Lock size={16} className="text-darkish dark:text-lightish" />
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

export default ClassSelector
