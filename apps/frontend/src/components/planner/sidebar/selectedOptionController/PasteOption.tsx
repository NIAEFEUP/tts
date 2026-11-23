import { Clipboard } from 'lucide-react'
import { useContext, useEffect, useState } from 'react'
import { Buffer } from 'buffer'
import fillOptions from './fillOptions'
import { Tooltip } from '../../../ui/new/tooltip'
import { ImportedCourses, CourseOption, CourseInfo } from '../../../../@types'
import occurrenceService from '../../../../api/services/occurrenceService'
import CourseContext from '../../../../contexts/CourseContext'
import MultipleOptionsContext from '../../../../contexts/MultipleOptionsContext'
import { convertCourseInfoToCourseOption } from '../../../../utils'
import { Button } from '../../../ui/new/button'
import { toast } from '../../../ui/new/toaster'
import { AnalyticsTracker, Feature } from '../../../../utils/AnalyticsTracker'
import { Menu } from '../../../ui/new/menu'

const PasteOption = () => {
  const { multipleOptions, setMultipleOptions, selectedOption } = useContext(MultipleOptionsContext)
  const { pickedCourses, setPickedCourses, setCheckboxedCourses } = useContext(CourseContext)

  const [isClipboardSupported, setIsClipboardSupported] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // Check if the browser Supports Clipboard API readText
  // Eventually this will become dead code when Firefox starts supporting Clipboard API readText method
  // See more: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/readText
  useEffect(() => {
    if (navigator.clipboard && navigator.clipboard.readText) {
      setIsClipboardSupported(true)
    }
  }, [])

  const importSchedule = async (value) => {
    const url = value
    const decoded_url = Buffer.from(url, 'base64').toString()
    const isImporteFromClipboard: boolean = value

    if (!isValidURL(decoded_url)) {
      const description = isImporteFromClipboard
        ? 'O texto do clipboard não é uma opção válida'
        : 'O texto inserido não é uma opção válida'

      toast({
        title: 'Erro ao colar opção',
        description,
        duration: 3000,
      })
      return
    }

    setIsDropdownOpen(false)

    //ex: course_id#picked_class_id;course_id#picked_class_id
    const tokens: string[] = decoded_url.split(';')

    //TODO (thePeras): A more function programming oportunity here
    const importedCourses: ImportedCourses = {}
    tokens.forEach((token) => {
      const course = token.split('#')
      importedCourses[course[0]] = course[1]
    })

    // Unchecked imported courses units
    const checkedCoursesIds = multipleOptions[selectedOption].course_options.map((courseOption: CourseOption) => {
      return courseOption.course_id
    })

    const uncheckedCoursesIds = Object.keys(importedCourses).filter((course_unit_id) => {
      return (
        !checkedCoursesIds.includes(Number(course_unit_id)) ||
        !pickedCourses.some((course) => course.id === Number(course_unit_id))
      )
    })

    if (uncheckedCoursesIds.length > 0) {
      let courses: CourseInfo[]
      try {
        courses = (
          await Promise.all(
            uncheckedCoursesIds.map(async (course_unit_id) => {
              return await occurrenceService.getClasses(Number(course_unit_id))
            }),
          )
        ).flat()
      } catch (error) {
        console.error(error)
        toast({
          title: 'Erro ao colar a opção',
          description: 'Não foi possível carregar as turmas das unidades curriculares importadas.',
          duration: 3000,
        })
        return
      }

      setPickedCourses((current) =>
        current.concat(courses.filter((course) => !current.some((c) => c.id === course.id))),
      )
      setCheckboxedCourses((current) =>
        current.concat(courses.filter((course) => !current.some((c) => c.id === course.id))),
      )

      const newMultipleOptions = [...multipleOptions]
      newMultipleOptions.forEach((option) => {
        option.course_options = option.course_options.concat(
          courses
            .filter((course) => !checkedCoursesIds.includes(course.id))
            .map((course) => convertCourseInfoToCourseOption(course)),
        )
      })

      setMultipleOptions(newMultipleOptions)
    }

    fillOptions(importedCourses, multipleOptions, setMultipleOptions, selectedOption)

    toast({
      title: 'Horário colado!',
      description: 'A opção foi colada com sucesso',
      duration: 1500,
    })

    AnalyticsTracker.trackFeature(Feature.PASTE)
  }

  /**
   *
   * @param options Decoded URL with courses units options
   * @returns true if the url is valid
   */
  const isValidURL = (url: string) => {
    if (url.length === 0) return false
    const tokens = url.split(';')
    if (tokens.length < 1) return false //At leat one course

    // Validate courses: course_unit_id#selected_option_id
    tokens.forEach((token) => {
      const course = token.split('#')
      if (course.length !== 2) return false
      if (isNaN(Number(course[0])) || isNaN(Number(course[1]))) return false
    })

    return true
  }

  return (
    <>
      {isClipboardSupported ? (
        <Tooltip>
          <Tooltip.Trigger asChild>
            <Button
              square
              size="sm"
              onClick={async () => {
                const value = await navigator.clipboard.readText()
                importSchedule(value)
              }}
              className="bg-primary hover:bg-primary/90"
            >
              <Clipboard size="18" />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>Colar horário</Tooltip.Content>
        </Tooltip>
      ) : (
        <Menu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
          <Tooltip>
            <Tooltip.Trigger asChild>
              <Menu.Trigger asChild>
                <Button onClick={() => setIsDropdownOpen(true)} square className="bg-primary">
                  <Clipboard size="18" />
                </Button>
              </Menu.Trigger>
            </Tooltip.Trigger>
            <Tooltip.Content>Colar horário</Tooltip.Content>
          </Tooltip>

          <Menu.Items className="p-2 w-64 md:w-80">
            <input
              autoFocus
              type="text"
              placeholder="Colar aqui opção"
              className="w-full rounded-sm border border-slate-200 p-2 text-slate-950 focus:outline-hidden focus:ring-2 focus:ring-primary dark:border-slate-800 dark:text-slate-50"
              onPaste={(e) => {
                e.preventDefault()
                importSchedule(e.clipboardData.getData('text/plain'))
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  importSchedule(e.currentTarget.value)
                }
              }}
            />
          </Menu.Items>
        </Menu>
      )}
    </>
  )
}

export default PasteOption
