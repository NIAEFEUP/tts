'use client'

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/new/button'
import useAdminExchangeCoursePeriods from '../../hooks/admin/useAdminExchangeCoursePeriods'
import useAdminCourses from '../../hooks/admin/useAdminCourses'
import exchangeRequestService from '../../api/services/exchangeRequestService'
import { PlusIcon } from 'lucide-react'
import { AdminExchangePeriodDeleteConfirmation } from './AdminExchangePeriodDeleteConfirmation'
import { ExchangePeriodForm } from './AdminExchangePeriodForm'
import { ExchangePeriodTable, ExchangePeriod } from './AdminExchangePeriodTable'
import { useEffect, useState } from 'react'
import { Spinner } from '../ui/new/spinner'
import { cn } from '../../lib/utils'

export const AdminExchangeCourseSettings = () => {
  const { exchangeCoursePeriods, mutate } = useAdminExchangeCoursePeriods()
  const [selectedGroup, setSelectedGroup] = useState<number>(0)
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null)
  const [addingPeriod, setAddingPeriod] = useState<boolean>(false)
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const [editingPeriodId, setEditingPeriodId] = useState<number | null>(null)
  const [editingStartDate, setEditingStartDate] = useState<Date | undefined>(undefined)
  const [editingEndDate, setEditingEndDate] = useState<Date | undefined>(undefined)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false)
  const [periodToDelete, setPeriodToDelete] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // The picker comes from the admin scope, so a course the admin manages is
  // offered even before it has any exchange period configured.
  const { courses, loading: coursesLoading, error: coursesError } = useAdminCourses()

  useEffect(() => {
    // An in-flight or failed request is not an empty scope: keep the current
    // selection until a successful response tells us what is actually in scope.
    if (coursesLoading || coursesError) return

    if (courses.length === 0) {
      setSelectedGroup(0)
      setSelectedCourse(null)
      setAddingPeriod(false)
      setStartDate(undefined)
      setEndDate(undefined)
      setEditingPeriodId(null)
      setEditingStartDate(undefined)
      setEditingEndDate(undefined)
      setPeriodToDelete(null)
      setDeleteDialogOpen(false)
      return
    }

    if (selectedCourse === null || !courses.some((course) => course.id === selectedCourse)) {
      setSelectedGroup(0)
      setSelectedCourse(courses[0].id)
    }
  }, [courses, coursesError, coursesLoading, selectedCourse])

  useEffect(() => {
    if (!addingPeriod && editingPeriodId === null) {
      setErrorMessage(null)
    }
  }, [addingPeriod, editingPeriodId])

  const handleAddPeriod = async (e) => {
    e.preventDefault()
    if (!startDate || !endDate || !selectedCourse) return
    try {
      setIsLoading(true)
      setErrorMessage(null)
      const response = await exchangeRequestService.addCourseExchangePeriod(startDate, endDate, selectedCourse)
      if (!response.ok) {
        const data = await response.json()
        setErrorMessage(data.error || 'Erro ao adicionar período.')
        return
      }
      setAddingPeriod(false)
      setStartDate(undefined)
      setEndDate(undefined)
      mutate()
    } catch (error) {
      console.error('Failed to add exchange period:', error)
      setErrorMessage('Erro de rede ao adicionar o período.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditPeriod = async (e) => {
    e.preventDefault()
    if (!editingStartDate || !editingEndDate || !selectedCourse || editingPeriodId === null) return
    try {
      setIsLoading(true)
      setErrorMessage(null)
      const response = await exchangeRequestService.editCourseExchangePeriod(
        editingStartDate,
        editingEndDate,
        selectedCourse,
        editingPeriodId,
      )
      if (!response.ok) {
        const data = await response.json()
        setErrorMessage(data.error || 'Erro ao atualizar período.')
        return
      }
      setEditingPeriodId(null)
      setEditingStartDate(undefined)
      setEditingEndDate(undefined)
      mutate()
    } catch (error) {
      console.error('Failed to update exchange period:', error)
      setErrorMessage('Erro de rede ao atualizar o período.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeletePeriod = async (periodId: number) => {
    if (!selectedCourse) return
    try {
      setIsLoading(true)
      await exchangeRequestService.deleteCourseExchangePeriod(selectedCourse, periodId)
      mutate()
    } catch (error) {
      console.error('Failed to delete exchange period:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const confirmDelete = async () => {
    if (periodToDelete !== null) {
      await handleDeletePeriod(periodToDelete)
      setPeriodToDelete(null)
    }
    setDeleteDialogOpen(false)
  }

  const getCurrentCoursePeriods = (): ExchangePeriod[] => {
    // Only surface periods for a course that is still in the current scope.
    if (!selectedCourse || !courses.some((course) => course.id === selectedCourse)) return []
    if (!exchangeCoursePeriods?.courses) return []

    const course = exchangeCoursePeriods.courses.find((c) => c.courseId === selectedCourse)
    return course?.exchangePeriods || []
  }

  const onEditChange = (periodId: number, newStartDate: Date, newEndDate: Date) => {
    if (editingPeriodId === null) {
      setEditingPeriodId(periodId)
    }
    setEditingStartDate(newStartDate)
    setEditingEndDate(newEndDate)
  }

  const onCancelEdit = () => {
    setEditingPeriodId(null)
    setEditingStartDate(undefined)
    setEditingEndDate(undefined)
    setErrorMessage(null)
  }

  const onDelete = (periodId: number) => {
    setPeriodToDelete(periodId)
    setDeleteDialogOpen(true)
  }

  return (
    <div className="flex flex-col gap-y-8 p-4">
      <div className="text-base text-muted-foreground">
        <p>Configure os períodos de troca dos cursos responsáveis.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="col-span-2 rounded-2xl shadow-md">
          <CardHeader>
            <div className="flex flex-row justify-between items-center">
              <CardTitle className="text-xl">Períodos de troca ativos</CardTitle>
              <Button
                onClick={() => {
                  setAddingPeriod((prev) => {
                    if (prev) setErrorMessage(null)
                    return !prev
                  })
                  setEditingPeriodId(null)
                }}
                disabled={selectedCourse === null}
                size="md"
                square
                className="hover:bg-accent/90"
              >
                <PlusIcon size="18" />
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {errorMessage && (
              <div className="text-sm text-red-600 px-2 py-1 rounded-md bg-red-100 border border-red-300 mb-4">
                {errorMessage}
              </div>
            )}
            {addingPeriod && (
              <ExchangePeriodForm
                startDate={startDate}
                endDate={endDate}
                setStartDate={setStartDate}
                setEndDate={setEndDate}
                isLoading={isLoading}
                onSubmit={handleAddPeriod}
              />
            )}
            <ExchangePeriodTable
              periods={getCurrentCoursePeriods()}
              editingPeriodId={editingPeriodId}
              editingStartDate={editingStartDate}
              editingEndDate={editingEndDate}
              isLoading={isLoading}
              onEditChange={onEditChange}
              onEditSubmit={handleEditPeriod}
              onCancelEdit={onCancelEdit}
              onDelete={onDelete}
            />
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Cursos responsáveis</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {coursesLoading && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner size="sm" /> A carregar cursos…
              </p>
            )}
            {coursesError && <p className="text-sm text-red-600">Erro ao carregar os cursos.</p>}
            {!coursesLoading && !coursesError && courses.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum curso disponível.</p>
            )}
            {courses.map((course, idx) => (
              <Button
                key={course.id}
                variant={selectedGroup === idx ? 'primary' : 'ghost'}
                className={cn('w-full justify-start', selectedGroup === idx)}
                onClick={() => {
                  setSelectedGroup(idx)
                  setSelectedCourse(course.id)
                }}
              >
                {course.name}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      <AdminExchangePeriodDeleteConfirmation
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
