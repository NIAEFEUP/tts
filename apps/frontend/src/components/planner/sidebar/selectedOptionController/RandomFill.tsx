import { ChevronDown, Dices } from 'lucide-react'
import { ClassInfo } from '../../../../@types'
import { useContext, useEffect, useState } from 'react'
import { Button } from '../../../ui/new/button'
import { Tooltip } from '../../../ui/new/tooltip'
import { Popover } from '../../../ui/new/popover'
import { Checkbox } from '../../../ui/new/checkbox'
import { Separator } from '../../../ui/separator'
import CourseContext from '../../../../contexts/CourseContext'
import MultipleOptionsContext from '../../../../contexts/MultipleOptionsContext'
import { AnalyticsTracker, Feature } from '../../../../utils/AnalyticsTracker'
import { toast } from '../../../ui/new/toaster'
import { Desert } from '../../../svgs'

type Props = {
  className?: string
}

type SlotMetadata = {
  day: number
  start_time: number
  duration: number
}

const RandomFill = (props: Props) => {
  void props
  const { pickedCourses } = useContext(CourseContext)
  const { multipleOptions, setMultipleOptions, selectedOption } = useContext(MultipleOptionsContext)
  const courseOptions = multipleOptions[selectedOption].course_options
  const [permutations, setPermutations] = useState([])
  const [lockedCourses, setLockedCourses] = useState(
    courseOptions.filter((course) => course.locked).map((course) => course.course_id),
  )

  // Get all course_unit-class combinations
  const getClassesCombinations = () => {
    return pickedCourses
      .map((course) => {
        if (!course.classes) return []
        // Optional chaining added here for safety
        return course.classes?.map((cls) => {
          return {
            course_info: course,
            class_info: cls,
          }
        })
      })
      .flat()
  }

  const [classesCombinations, setClassesCombinations] = useState([])
  useEffect(() => {
    const combinations = getClassesCombinations()
    setClassesCombinations(combinations)
  }, [pickedCourses, selectedOption])

  const getUniqueClasses = () => {
    return Array.from(new Set(classesCombinations.map((class_info) => class_info.class_info.name)))
  }

  // not a good name
  const [uniqueClasses, setUniqueClasses] = useState(getUniqueClasses())
  useEffect(() => {
    setUniqueClasses(getUniqueClasses())
  }, [classesCombinations])

  /*
  Usage:

  ~~~~~~~~~~~~~~~~~~~~~~~~~
    const generator = cartesianGenerator(...schedules);
    const combination = generator.next().value;
  */
  function* cartesianGenerator(...arrays) {
    if (arrays.length === 0) {
      yield []
      return
    }

    const [head, ...tail] = arrays

    if (head.length === 0) {
      for (const t of cartesianGenerator(...tail)) {
        yield [null, ...t]
      }
      return
    }

    for (const h of head) {
      for (const t of cartesianGenerator(...tail)) {
        if (isValidSchedule([h, ...t])) {
          yield [h, ...t]
        }
      }
    }
  }

  const getSchedulesGenerator = () => {
    const allSchedules = courseOptions.map((course) => {
      if (course.locked && course.picked_class_id) {
        return [
          pickedCourses
            .find((picked) => picked.id === course.course_id)
            ?.classes?.find((cls) => cls.id === course.picked_class_id), // Safety chaining added
        ]
      }

      const availableClasses = classesCombinations.filter((class_info) => {
        return uniqueClasses.includes(class_info.class_info.name)
      })

      return availableClasses
        .filter((class_info) => class_info.course_info.id === course.course_id)
        .map((class_info) => class_info.class_info)
    })

    return cartesianGenerator(...allSchedules)
  }

  const [generator, setGenerator] = useState(getSchedulesGenerator())

  /*
    Function to check if a schedule is valid (no overlapping classesCombinations)
  */
  const isValidSchedule = (courses: ClassInfo[]) => {
    const schedules = courses
      .filter((classInfo) => classInfo !== null)
      .map((classInfo) => {
        return classInfo.slots.map((slot) => {
          return {
            day: slot.day,
            start_time: slot.start_time,
            duration: slot.duration,
          }
        })
      })
      .flat()
      .sort((a: SlotMetadata, b: SlotMetadata) => {
        if (a.day == b.day) return a.start_time - b.start_time
        return a.day - b.day
      })

    for (let i = 0; i < schedules.length; i++) {
      const schedule = schedules[i]
      const nextSchedule = schedules[i + 1]
      if (!nextSchedule) return true

      if (schedule.day == nextSchedule.day) {
        if (schedule.start_time == nextSchedule.start_time) {
          return false
        } else if (schedule.start_time < nextSchedule.start_time) {
          if (schedule.start_time + schedule.duration > nextSchedule.start_time) {
            return false
          }
        } else {
          if (nextSchedule.start_time + nextSchedule.duration > schedule.start_time) {
            return false
          }
        }
      }
    }
    return true
  }

  const applyRandomSchedule = () => {
    const newPermutations = [...permutations]
    const STEP = 1000 //TODO(thePeras): Not a good number for a big number of pickedCourses
    for (let i = 0; i < STEP; i++) {
      const permutation = generator.next().value
      if (!permutation) break
      newPermutations.push(permutation)
    }
    setPermutations(newPermutations)

    // Choose a random permutation
    const randomNumber = Math.floor(Math.random() * (newPermutations.length - 1))
    applySchedule(newPermutations[randomNumber])

    AnalyticsTracker.trackFeature(Feature.RANDOM_FILL)
  }

  const applySchedule = (classesCombinations: ClassInfo[]) => {
    if (!classesCombinations || classesCombinations.length <= 0) {
      toast({
        title: 'Não foi possível gerar turmas!',
        description: 'Não encontramos uma combinação com as turmas das disciplinas selecionadas sem conflitos',
      })
    }

    setMultipleOptions((prevMultipleOptions) => {
      const newMultipleOptions = [...prevMultipleOptions]
      const selectedOptionCopy = { ...newMultipleOptions[selectedOption] }

      if (!selectedOptionCopy.course_options) {
        console.error('course_options is undefined in selectedOptionCopy.')
        return prevMultipleOptions
      }

      const newCourseOptions = selectedOptionCopy.course_options.map((course) => {
        if (course.locked) return course

        for (const classInfo of classesCombinations) {
          if (!classInfo) continue

          const courseUnit = pickedCourses.find((other_course) => other_course.id === course.course_id)
          // Double safety chaining added here (courseUnit could potentially be undefined too)
          const matchedClassInfo = courseUnit?.classes?.find((courseUnitClass) => courseUnitClass.id === classInfo.id)

          if (matchedClassInfo) {
            return {
              ...course,
              picked_class_id: matchedClassInfo.id,
            }
          }
        }

        return course
      })

      selectedOptionCopy.course_options = newCourseOptions
      newMultipleOptions[selectedOption] = selectedOptionCopy

      return newMultipleOptions
    })
  }

  const toggleRandomClass = (className: string) => {
    setUniqueClasses((prevRandomClasses) => {
      if (prevRandomClasses.includes(className)) {
        return prevRandomClasses.filter((name) => name !== className)
      } else {
        return [...prevRandomClasses, className]
      }
    })
  }

  /**
   * Reseting generator and permutations when:
   * -
   */
  useEffect(() => {
    const newMultipleOptions = [...multipleOptions]

    const selected = newMultipleOptions[selectedOption]?.course_options
    // Updating locked courses
    const newLockedCourses = selected?.filter((course) => course.locked).map((course) => course.course_id)
    // Only update if locked courses changed
    if (newLockedCourses?.join() !== lockedCourses?.join()) {
      setLockedCourses(newLockedCourses)
      setPermutations([])
      setGenerator(getSchedulesGenerator())
    }
  }, [multipleOptions, selectedOption, lockedCourses])

  /**
   * Reseting generator and permutations when:
   * - Selected option changes
   * - Selected classesCombinations for random generations change
   * - Picked courses change
   */
  useEffect(() => {
    setPermutations([])
    setGenerator(getSchedulesGenerator())
  }, [pickedCourses, uniqueClasses])

  return (
    <div className="flex">
      <Tooltip placement="bottom">
        <Tooltip.Trigger asChild onClick={applyRandomSchedule}>
          <Button square size="sm" className="bg-secondary hover:bg-secondary/90 rounded-r-none">
            <Dices size="18" />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content>Preenchimento aleatório</Tooltip.Content>
      </Tooltip>

      <Popover placement="bottom-end">
        <Popover.Trigger asChild>
          <Button
            square
            size="sm"
            className="bg-secondary hover:bg-secondary/90 rounded-l-none border-l border-foreground/10"
          >
            <ChevronDown size="14" />
          </Button>
        </Popover.Trigger>
        <Popover.Content className="w-52 p-1">
          <p className="px-1 py-1 text-sm font-medium">Preenchimento aleatório</p>
          <Separator />
          {Array.from(new Set(classesCombinations.map((class_info) => class_info.class_info.name))).map((key) => (
            <div
              key={key}
              onClick={() => toggleRandomClass(key)}
              className="mt-1 flex w-full items-center space-x-2 rounded-sm p-1.5 hover:cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 select-none"
            >
              <Checkbox
                id={key}
                checked={uniqueClasses.includes(key)}
                className="pointer-events-none [--color-accent:var(--color-primary)] [--color-accent-foreground:#fff]"
              />
              <span className="text-sm font-medium leading-none flex-1">{key}</span>
            </div>
          ))}

          {classesCombinations.length === 0 && (
            <div className="flex flex-col mx-auto m-4 w-full">
              <Desert className="w-full h-24" />
              <p className="mt-2 text-sm text-center">Não foi encontrada nenhuma turma</p>
            </div>
          )}
        </Popover.Content>
      </Popover>
    </div>
  )
}

export default RandomFill
