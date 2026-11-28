import {
  MajorSearchCombobox,
  CourseYearTabs,
  PickedCoursesList,
  Ects,
} from '@/components/planner/sidebar/sessionController/course-picker'
import { AlertCircle, PenSquare } from 'lucide-react'
import { useContext, useEffect } from 'react'
import { X } from 'lucide-react'
import { Desert } from '@/components/svgs'
import { Button } from '@/components/ui/new/button'
import { Dialog } from '@/components/ui/new/dialog'
import useCourseUnits from '@/hooks/useCourseUnits'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ClearAllCoursesButton } from '@/components/planner/sidebar/sessionController/course-picker/ClearAllCoursesButton'
import CoursePickerContext from '@/contexts/coursePicker/CoursePickerContext'
import { Divider } from '@/components/ui/new/divider'

type Props = {
  allowedAcronyms?: string[]
}

const CoursePicker = ({ allowedAcronyms }: Props) => {
  const {
    coursesStorage,
    setCoursesInfo,
    setUcsModalOpen,
    setChoosingNewCourse,
    ucsModalOpen,
    selectedMajor,
    setSelectedMajor,
  } = useContext(CoursePickerContext)

  const {
    courseUnits,
    loading: loadingCourseUnits,
    error: courseUnitsError,
    mutate: retryCourseUnits,
  } = useCourseUnits(selectedMajor ? selectedMajor.id : null)
  const showContent = selectedMajor || coursesStorage.length > 0

  useEffect(() => {
    setCoursesInfo(courseUnits ?? [])
  }, [courseUnits, setCoursesInfo])

  const handleOpenChange = (open: boolean) => {
    setChoosingNewCourse((prev) => !prev)
    setUcsModalOpen(open)
  }

  return (
    <Dialog open={ucsModalOpen} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <Button
          variant="primary"
          className="grow gap-2 bg-primary hover:bg-primary/90 transition-all"
          title="Editar Unidades Curriculares"
        >
          <span className="hidden md:block lg:hidden xl:block">Unidades Curriculares</span>
          <PenSquare size="16" />
        </Button>
      </Dialog.Trigger>

      <Dialog.Content className="flex flex-col h-fit w-screen max-h-screen lg:min-w-fit overflow-auto py-6">
        <Dialog.Title className="mx-4">Seleciona as tuas unidades curriculares</Dialog.Title>
        <Dialog.Close asChild>
          <Button variant="ghost" className="absolute top-3 right-3 ">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </Dialog.Close>
        <Dialog.Description className="mx-4 mt-2">
          Pesquisa pelas tuas unidades curriculares. As disciplinas selecionadas aparecem no lado direito.
        </Dialog.Description>

        <div className="mx-4 mt-6 mb-2">
          <MajorSearchCombobox
            selectedMajor={selectedMajor}
            setSelectedMajor={setSelectedMajor}
            allowedAcronyms={allowedAcronyms}
          />
        </div>

        <div className="my-4">
          <Divider />
        </div>

        {showContent ? (
          <>
            <div className="flex flex-col lg:flex-row grow w-full lg:w-240 px-4 mb-6">
              <div className="w-full lg:w-1/2">
                {courseUnitsError ? (
                  <div className="flex flex-col items-start gap-4">
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Não foi possível carregar as unidades curriculares deste curso.
                      </AlertDescription>
                    </Alert>
                    <Button variant="outline" onClick={() => void retryCourseUnits()}>
                      Tentar novamente
                    </Button>
                  </div>
                ) : !loadingCourseUnits ? (
                  <CourseYearTabs />
                ) : (
                  <div className="flex flex-col space-y-3">
                    <Skeleton className="h-8 rounded-xl" />
                    <div className="space-y-4">
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-5 w-full" />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-row w-full lg:w-1/2 mt-8 lg:mt-0">
                <Divider orientation="vertical" className="mx-5 hidden lg:block" />
                <div className="w-full">
                  <PickedCoursesList />
                </div>
              </div>
            </div>

            <Dialog.Actions className="flex flex-row justify-center mt-auto px-4">
              <div className="flex flex-row items-center justify-between w-full dark:text-white pb-4">
                <Ects />
                <div className="flex gap-2 mt-4">
                  <ClearAllCoursesButton />
                </div>
              </div>
            </Dialog.Actions>
          </>
        ) : (
          <div className="flex flex-col items-center grow w-full lg:w-240 py-10">
            <Desert className="h-64 w-full" />
            <p className="mt-4 text-muted-foreground">Seleciona um curso primeiro.</p>
          </div>
        )}
      </Dialog.Content>
    </Dialog>
  )
}

export default CoursePicker
