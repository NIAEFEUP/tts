'use client'

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/new/button'
import useAdminScopedCourses from '../../hooks/admin/useAdminScopedCourses'
import useCoursePeriods from '../../hooks/admin/useCoursePeriods'
import exchangeRequestService from '../../api/services/exchangeRequestService'
import { PlusIcon } from 'lucide-react'
import { AdminExchangePeriodDeleteConfirmation } from './AdminExchangePeriodDeleteConfirmation'
import { ExchangePeriodForm } from './AdminExchangePeriodForm'
import { ExchangePeriodTable } from './AdminExchangePeriodTable'
import { useEffect, useState } from 'react'

export const AdminExchangeCourseSettings = () => {
  const { data: courses = [] } = useAdminScopedCourses()
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null)
  const { data: periods = [], mutate } = useCoursePeriods(selectedCourse)
  const [addingPeriod, setAddingPeriod] = useState<boolean>(false)
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null)
  const [editingStartDate, setEditingStartDate] = useState<Date | undefined>(undefined)
  const [editingEndDate, setEditingEndDate] = useState<Date | undefined>(undefined)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false)
  const [periodToDelete, setPeriodToDelete] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (courses.length > 0 && !selectedCourse) {
      setSelectedCourse(courses[0].id)
    }
  }, [courses])

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

  const handleDeletePeriod = async (periodId: string) => {
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

  const onEditChange = (periodId: string, newStartDate: Date, newEndDate: Date) => {
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

  const onDelete = (periodId: string) => {
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
              periods={periods}
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
            {courses.map((course) => (
              <Button
                key={course.id}
                variant={selectedCourse === course.id ? 'primary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setSelectedCourse(course.id)}
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
