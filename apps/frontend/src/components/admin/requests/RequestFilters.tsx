import { useContext, useState } from 'react'
import { Button } from '../../ui/new/button'
import RequestFiltersContext, {
  activeStatesPossibleValues,
  adminRequestStateToText,
  adminRequestStateToBadgeVariant,
} from '../../../contexts/admin/RequestFiltersContext'
import useAdminCourses from '../../../hooks/admin/useAdminCourses'
import { Popover } from '../../ui/new/popover'
import { Command, CommandGroup, CommandItem } from '../../ui/command'
import { Check, ChevronDown } from 'lucide-react'
import { Badge } from '../../ui/new/badge'
import { PageSizeSelector } from './cards/PageSizeSelector'
import AdminPaginationContext from '../../../contexts/admin/AdminPaginationContext'

export const RequestFilters = () => {
  const {
    activeCourse,
    setActiveCourse,
    activeCurricularYear,
    setActiveCurricularYear,
    activeStates,
    setActiveStates,
  } = useContext(RequestFiltersContext)

  // From main branch: Pagination context
  const { itemsPerPage, setItemsPerPage, setCurrPage } = useContext(AdminPaginationContext)

  const { courses } = useAdminCourses()

  const [courseOpen, setCourseOpen] = useState(false)
  const [yearOpen, setYearOpen] = useState(false)

  return (
    <div className="flex flex-row flex-wrap gap-2">
      <Popover open={courseOpen} onOpenChange={setCourseOpen} placement="bottom-start">
        <Popover.Trigger asChild>
          <Button variant="outline" className="justify-between w-32">
            {activeCourse ? courses?.find((c) => c.id === activeCourse)?.acronym : 'Curso'}
            <ChevronDown size="18" />{' '}
          </Button>
        </Popover.Trigger>
        <Popover.Content className="w-40 p-0">
          <Command>
            <CommandGroup>
              {(!courses || courses.length === 0) && <CommandItem disabled>Nenhum</CommandItem>}
              {courses?.map((course) => (
                <CommandItem
                  key={`course-${course.id}`}
                  onSelect={() => {
                    setActiveCourse(course.id === activeCourse ? undefined : course.id)
                    setCourseOpen(false)
                  }}
                >
                  <div className="flex flex-row items-center gap-x-2">
                    <div className="w-4 h-4">{activeCourse === course.id && <Check className="w-4 h-4" />}</div>
                    <p>{course.acronym}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </Popover.Content>
      </Popover>

      <Popover open={yearOpen} onOpenChange={setYearOpen} placement="bottom-start">
        <Popover.Trigger asChild>
          <Button variant="outline" className="justify-between w-32">
            {activeCurricularYear ? `${activeCurricularYear}º Ano` : 'Ano'}
            <ChevronDown size="18" />
          </Button>
        </Popover.Trigger>
        <Popover.Content className="w-32 p-0">
          <Command>
            <CommandGroup>
              {[1, 2, 3, 4, 5].map((year) => (
                <CommandItem
                  key={`year-${year}`}
                  onSelect={() => {
                    setActiveCurricularYear(year === activeCurricularYear ? undefined : year)
                    setYearOpen(false)
                  }}
                >
                  <div className="flex flex-row items-center gap-x-2">
                    <div className="w-4 h-4">{activeCurricularYear === year && <Check className="w-4 h-4" />}</div>
                    <p>{year}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </Popover.Content>
      </Popover>

      <Popover placement="bottom-start">
        <Popover.Trigger asChild>
          <Button variant="outline" className="justify-between w-32">
            <span className="flex items-center">
              Estado
              {activeStates.length > 0 && (
                <Badge className="ml-2" variant="neutral">
                  {activeStates.length}
                </Badge>
              )}
            </span>
            <ChevronDown size="18" />
          </Button>
        </Popover.Trigger>
        <Popover.Content className="w-56 p-0">
          <Command>
            <CommandGroup>
              {activeStatesPossibleValues.map((state) => (
                <CommandItem
                  key={`state-${state}`}
                  onSelect={() => {
                    const newActiveStates = [...activeStates]
                    if (newActiveStates.includes(state)) {
                      setActiveStates(newActiveStates.filter((currentState) => currentState !== state))
                    } else {
                      setActiveStates([...newActiveStates, state])
                    }
                  }}
                >
                  <div className="flex flex-row items-center gap-x-3">
                    <div className="w-4 h-4">{activeStates.includes(state) && <Check className="w-4 h-4" />}</div>
                    <Badge variant={adminRequestStateToBadgeVariant[state] as any} size="sm">
                      {adminRequestStateToText[state]}
                    </Badge>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </Popover.Content>
      </Popover>

      <Button
        variant="ghost"
        onClick={() => {
          setActiveCourse(undefined)
          setActiveCurricularYear(undefined)
          setActiveStates([])
        }}
      >
        Limpar
      </Button>

      {/* From main branch: Page Size Selector */}
      <PageSizeSelector
        value={itemsPerPage}
        onChange={(value) => {
          setCurrPage(1)
          setItemsPerPage(value)
        }}
      />
    </div>
  )
}
