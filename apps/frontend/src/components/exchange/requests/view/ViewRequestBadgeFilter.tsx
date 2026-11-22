import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { Dispatch, SetStateAction } from 'react'
import { ClassInfo, CourseInfo } from '../../../../@types'
import useCourseUnitClasses from '../../../../hooks/useCourseUnitClasses'
import { Badge } from '../../../ui/new/badge'
import { Button } from '../../../ui/new/button'
import { Checkbox } from '../../../ui/new/checkbox'
import { Menu } from '../../../ui/new/menu'

type Props = {
  courseUnit: CourseInfo
  filterCourseUnitsHook: [Set<number>, Dispatch<SetStateAction<Set<number>>>]
  classesFilterHook: [Map<string, Set<string>>, Dispatch<SetStateAction<Map<string, Set<string>>>>]
}

export const ViewRequestBadgeFilter = ({ courseUnit, filterCourseUnitsHook, classesFilterHook }: Props) => {
  const [classesFilter, setClassesFilter] = classesFilterHook
  const [filterCourseUnits, setFilterCourseUnits] = filterCourseUnitsHook
  const { classes } = useCourseUnitClasses(courseUnit.id, courseUnit.occurrenceYear)

  const handleClassFilterChange = (className: string, checked: boolean) => {
    const classFilterItem = classesFilter.get(courseUnit.acronym)

    if (checked) {
      if (classFilterItem) classFilterItem.add(className)
      else classesFilter.set(courseUnit.acronym, new Set([className]))
    } else {
      classFilterItem?.delete(className)
      if (classFilterItem?.size === 0) classesFilter?.delete(courseUnit.acronym)
    }

    setClassesFilter(new Map(classesFilter))
  }

  return (
    <div className="flex flex-row items-center gap-x-2">
      <Badge
        className="ml-2"
        onClick={() => {
          const newFilterCourseUnits = new Set(filterCourseUnits)

          if (newFilterCourseUnits.has(courseUnit.id)) newFilterCourseUnits.delete(courseUnit.id)
          else newFilterCourseUnits.add(courseUnit.id)

          setFilterCourseUnits(newFilterCourseUnits)
        }}
      >
        {courseUnit.acronym}
      </Badge>
      <Menu>
        <Menu.Trigger asChild>
          <Button variant="ghost" size="xs" square className="h-5 w-5">
            <ChevronDownIcon className="h-5 w-5" />
          </Button>
        </Menu.Trigger>
        <Menu.Items className="flex flex-col gap-y-1 p-2 max-h-72 overflow-y-auto no-scrollbar">
          <p className="px-2 py-1 text-sm font-medium">Turma de destino</p>
          {classes?.map((currentClass: ClassInfo) => (
            <Menu.Item
              asChild
              key={`from-${currentClass.id}`}
              onSelect={(e) => e.preventDefault()} // Keep dropdown open when clicking
            >
              <label htmlFor={`from-${currentClass.id}`} className="flex items-center gap-x-2 cursor-pointer w-full">
                <Checkbox
                  id={`from-${currentClass.id}`}
                  checked={classesFilter.get(courseUnit.acronym)?.has(currentClass.name) || false}
                  onChange={(e) => {
                    handleClassFilterChange(currentClass.name, e.target.checked)
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-sm">{currentClass.name}</span>
              </label>
            </Menu.Item>
          ))}
        </Menu.Items>
      </Menu>
    </div>
  )
}
