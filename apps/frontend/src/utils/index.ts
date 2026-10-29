import config from '../config/prod.json'
import dev_config from '../config/local.json'
import {
  CourseInfo,
  CourseOption,
  SlotInfo,
  MultipleOptions,
  Option,
  PickedCourses,
  ProfessorInfo,
  ClassInfo,
} from '../@types'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import Plausible from 'plausible-tracker'
import { ENV } from 'varlock/env'
const minHour = 8
const maxHour = 23
const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get's the complete for a page.
 * @param simplePath Path withot a prefix.
 * @returns The complete path with the prefix.
 */
const getPath = (simplePath: string) => {
  return config.pathPrefix + simplePath
}

const getDisplayDate = () => {
  const date = new Date()
  return `${dayNames[date.getDay()]}, ${date.getDate() + 1} ${monthNames[date.getMonth()]}`
}

const getSemester = () => {
  //jan-jul --> 2º Semestre
  const date = new Date()
  const month = date.getMonth()

  return month >= 0 && month <= 6 ? 2 : 1
}

const getSchoolYear = () => {
  const date = new Date()
  const month = date.getMonth()
  const year = date.getFullYear()

  return month >= 0 && month <= 6
    ? `${year - 1}/${year.toString().slice(2, 4)}`
    : `${year}/${(year + 1).toString().slice(2, 4)}`
}

const getAcademicYear = () => {
  const date = new Date()
  return date.getMonth() + 1 < 8 ? date.getFullYear() - 1 : date.getFullYear()
}

const convertWeekday = (dayNumber: number) => {
  if (dayNumber < 0 || dayNumber > 7) return null

  const weekdays = ['2ªf', '3ªf', '4ªf', '5ªf', '6ªf', 'Sáb', 'Dom']
  return weekdays[dayNumber]
}

const convertWeekdayLong = (dayNumber: number) => {
  if (dayNumber < 0 || dayNumber > 7) return null

  const weekdays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
  return weekdays[dayNumber]
}

const convertHour = (hourNumber: string) => {
  if (parseFloat(hourNumber) < 0 || parseFloat(hourNumber) > 24) return null

  const split = hourNumber.split('.')
  const hour = split[0].padStart(2, '0')
  const minutes = split[1] === '0' || !split[1] ? '00' : '30'

  return `${hour}:${minutes}`
}

const isMandatory = (slot: SlotInfo, tClassConflict: boolean): boolean => {
  return (tClassConflict || slot.lesson_type !== 'T') && slot.lesson_type !== 'O'
}

const conflictsSeverity = (first: SlotInfo, second: SlotInfo, tClassConflict: boolean): number => {
  return isMandatory(first, tClassConflict) && isMandatory(second, tClassConflict) ? 2 : 1
}

const classesConflictSeverity = (first: ClassInfo, second: ClassInfo, tClassConflict: boolean): number => {
  let maxSeverity = 0

  for (const slot of first.slots) {
    for (const otherSlot of second.slots) {
      if (schedulesConflict(slot, otherSlot)) {
        maxSeverity = Math.max(maxSeverity, conflictsSeverity(slot, otherSlot, tClassConflict))
      }
    }
  }

  return maxSeverity
}

const schedulesConflict = (first: SlotInfo, second: SlotInfo) => {
  if (first.day !== second.day) return false

  const firstStart = first.start_time
  const secondStart = second.start_time
  const firstDuration = first.duration
  const secondDuration = second.duration
  const firstEnd = firstStart + firstDuration
  const secondEnd = secondStart + secondDuration

  return firstEnd > secondStart && firstStart < secondEnd
}

const getClassDisplayText = (course: CourseInfo, picked_class_id: number) => {
  const classInfo = course.classes && course.classes?.find((classInfo) => classInfo.id === picked_class_id)
  if (!classInfo) return 'Selecionar Opção...'

  const classTitle = classInfo.name
  //const professor_acronyms = classInfo.slots.flatMap((slot) => slot.professors.map((prof) => prof.acronym))
  //const classTypes = classInfo.slots.map((slot) => slot.lesson_type)
  //const weekdays = classInfo.slots.map((slot) => convertWeekday(slot.day))

  return [classTitle].join(', ')
}

const getLessonBoxTime = (slot: SlotInfo) => {
  return [
    convertHour(slot.start_time.toString()),
    convertHour(addHour(slot.start_time.toString(), slot.duration.toString())),
  ].join('-')
}

const addHour = (hour1: string, hour2: string): string => {
  return (parseFloat(hour1) + parseFloat(hour2)).toString()
}

const getLessonBoxStyles = (slotInfo: SlotInfo, maxHour: number, minHour: number) => {
  const step = (maxHour - minHour) * 2
  const top = (slotInfo.start_time - minHour) * 2
  const length = slotInfo.duration * 2

  return {
    top: `${(top * 100) / step}%`,
    left: `${(slotInfo.day * 100) / 6}%`,
    height: `${length * (100 / step)}%`,
  }
}

const getLessonTypeLongName = (type: string) => {
  switch (type) {
    case 'T':
      return 'Aula Teórica'

    case 'P':
      return 'Aula Prática'

    case 'TP':
      return 'Aula Teórico-Prática'

    case 'S':
      return 'Seminário'

    case 'TC':
      return 'Teórica de Campo'

    case 'PL':
      return 'Aula Prática Laboratorial'

    case 'OT':
      return 'Aula de Orientação'

    default:
      return 'Aula Desconhecida'
  }
}

const getClassTypeClassName = (type: string) => {
  switch (type) {
    case 'T':
      return 'schedule-class-t'

    case 'P':
      return 'schedule-class-p'

    case 'TP':
      return 'schedule-class-tp'

    case 'S':
      return 'schedule-class-s'

    case 'PL':
      return 'schedule-class-pl'

    case 'OT':
      return 'schedule-class-ot'

    case 'TC':
      return 'schedule-class-tc'

    default:
      return 'schedule-class-o'
  }
}

const getClassType = (type: string) => {
  switch (type) {
    case 'T':
      return 'Teórica'
    case 'TP':
      return 'Teórico-Prática'
    case 'PL':
      return 'Prática Laboratorial'
    case 'OT':
      return 'Orientação Tutorial'
    case 'S':
      return 'Seminário'
    case 'P':
      return 'Prática'
    case 'TC':
      return 'Teórica de Campo'
    case 'O':
      return 'Outros'
    case 'Teórica':
      return 'T'
    case 'Teórico-Prática':
      return 'TP'
    case 'Prática Laboratorial':
      return 'PL'
    case 'Orientação Tutorial':
      return 'OT'
    case 'Seminário':
      return 'S'
    case 'Prática':
      return 'P'
    case 'Teórica de Campo':
      return 'TC'
    case 'Outros':
      return 'O'
  }
}

const getCourseTeachers = (courseInfo: CourseInfo) => {
  return courseInfo.classes?.reduce((acc, classInfo) => [...acc, ...classInfo.slots.map((slot) => slot.professors)], [])
}

const convertCourseInfoToCourseOption = (course: CourseInfo): CourseOption => {
  return {
    course_id: course.id,
    picked_class_id: null,
    locked: false,
    filteredTeachers: null,
    hide: [],
  }
}

/**
 * Considering that the yearCourses is sorted by the course_unit_year field in ascending order, the function groups the major courses by year.
 * @param yearCourses All the courses in a major.
 * @returns The courses grouped by year.
 * @example input: [{ course: 1, year: 1 }, { course: 3, year: 1 }, { course: 2, year: 2 }]
 * @example output: [[{ course: 1, year: 1 }, { course: 3, year: 1 }], [{ course: 2, year: 2 }]]
 */
const groupCoursesByYear = (yearCourses: CourseInfo[]): CourseInfo[][] => {
  const majorCourses: CourseInfo[][] = []
  let currYear = 0
  for (let i = 0; i < yearCourses?.length; i++) {
    if (yearCourses[i].course_unit_year !== currYear) {
      currYear += 1
      majorCourses.push([yearCourses[i]])
    } else {
      majorCourses[currYear - 1].push(yearCourses[i])
    }
  }
  return majorCourses
}

const isSubset = (set1, set2, same) => {
  for (const elem1 of set1) {
    let found = false
    for (const elem2 of set2) {
      if (same(elem1, elem2)) {
        found = true
        break
      }
    }
    if (!found) return false
  }
  return true
}

const createDefaultCourseOption = (course: CourseInfo): CourseOption => {
  return {
    course_id: course.id,
    picked_class_id: null,
    locked: false,
    filteredTeachers: null,
    hide: [],
  }
}

const addCourseOption = (course: CourseInfo, multipleOptions: MultipleOptions): MultipleOptions => {
  return multipleOptions.map((option) => {
    const currentOption = createDefaultCourseOption(course)
    currentOption.filteredTeachers = teacherIdsFromCourseInfo(course)
    option.course_options.push(currentOption)
    return option
  })
}

const removeCourseOption = (course: CourseInfo, multipleOptions: MultipleOptions): MultipleOptions =>
  multipleOptions.map((option) => {
    option.course_options = option.course_options.filter((courseOption) => courseOption.course_id !== course.id)
    return option
  })

const removeAllCourseOptions = (multipleOptions: MultipleOptions): MultipleOptions =>
  multipleOptions.map((option) => {
    option.course_options = []
    return option
  })

const courseHasClassPicked = (course: CourseInfo, option: Option): CourseOption | null => {
  const candidateOption = option.course_options.filter(
    (courseOption) => courseOption.picked_class_id && courseOption.course_id === course.course_unit_id,
  )

  if (!candidateOption) return null

  return candidateOption[0]
}

const replaceCourseOptions = (courses: CourseInfo[], multipleOptions: MultipleOptions): MultipleOptions => {
  //  const courseOptions = courses.map((course) => createDefaultCourseOption(course))

  return multipleOptions.map((option) => {
    const newCourseOptions = []
    for (const course of courses) {
      const existingOption = courseHasClassPicked(course, option)
      if (existingOption) {
        newCourseOptions.push({ ...existingOption })
      } else {
        newCourseOptions.push(createDefaultCourseOption(course))
      }
    }
    // We have to use JSON.parse as well as JSON.stringify in order to create a copy for each option. Otherwise, they would
    // all have the same reference to the same object
    option.course_options = [...JSON.parse(JSON.stringify(newCourseOptions))]
    return option
  })
}

const getAllPickedSlots = (selected_courses: PickedCourses, option: Option) => {
  return option.course_options.flatMap((course) => {
    if (!course.picked_class_id) return []
    const courseInfo = selected_courses.find((selected_course) => selected_course.id === course.course_id)
    const classInfo = courseInfo.classes?.find((classInfo) => classInfo.id === course.picked_class_id)

    if (!classInfo) return []

    return classInfo.slots
  })
}

const teachersFromCourseInfo = (courseInfo: CourseInfo): ProfessorInfo[] => {
  const classes = courseInfo.classes
  if (!classes) return []

  return courseInfo.classes?.flatMap((c) => c.slots.flatMap((s) => s.professors))
}

const uniqueTeachersFromCourseInfo = (courseInfo: CourseInfo): ProfessorInfo[] => {
  const uniqueIds = new Set()
  return teachersFromCourseInfo(courseInfo).filter((item) => {
    if (!uniqueIds.has(item.id)) {
      uniqueIds.add(item.id)
      return true
    }
    return false
  })
}

const teacherIdsFromCourseInfo = (courseInfo: CourseInfo): number[] => {
  const teacherIds = []
  const uniqueTeachers = uniqueTeachersFromCourseInfo(courseInfo)

  uniqueTeachers.forEach((teacher: ProfessorInfo) => {
    teacherIds.push(teacher.id)
  })

  return teacherIds
}

const scrollToTop = () => {
  if (!window.location.href.split('#')[1]) document.getElementById('layout').scrollIntoView()
}

const plausible = Plausible({
  domain: import.meta.env.VITE_APP_PLAUSIBLE_DOMAIN,
  apiHost: import.meta.env.VITE_APP_PLAUSIBLE_HOST,
  trackLocalhost: !ENV.VITE_APP_PROD,
})

export {
  config,
  dev_config,
  getPath,
  minHour,
  maxHour,
  dayNames,
  monthNames,
  getDisplayDate,
  getSemester,
  getSchoolYear,
  getAcademicYear,
  convertWeekday,
  convertWeekdayLong,
  convertHour,
  schedulesConflict,
  getClassDisplayText,
  getLessonBoxTime,
  getLessonBoxStyles,
  getClassTypeClassName,
  getLessonTypeLongName,
  getCourseTeachers,
  cn,
  groupCoursesByYear,
  isSubset,
  addCourseOption,
  removeCourseOption,
  replaceCourseOptions,
  getAllPickedSlots,
  getClassType,
  removeAllCourseOptions,
  convertCourseInfoToCourseOption,
  conflictsSeverity,
  teachersFromCourseInfo,
  uniqueTeachersFromCourseInfo,
  teacherIdsFromCourseInfo,
  scrollToTop,
  classesConflictSeverity,
  plausible,
}
