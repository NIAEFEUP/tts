'use client'

import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '../ui/table'
import { DateTimePicker } from '../ui/datetime-picker'
import { Button } from '../ui/new/button'
import { Edit2Icon, Trash2Icon, CheckIcon, XIcon } from 'lucide-react'
import { format } from 'date-fns'
import * as React from 'react'
import type { ExchangePeriod } from '../../api/services/periodService'

interface ExchangePeriodTableProps {
  periods: ExchangePeriod[]
  editingPeriodId: string | null
  editingStartDate: Date | undefined
  editingEndDate: Date | undefined
  isLoading: boolean
  isLoadingPeriods: boolean
  loadError: string | null
  onRetry: () => void
  onEditChange: (periodId: string, newStartDate: Date, newEndDate: Date) => void
  onEditSubmit: (e: React.FormEvent) => void
  onCancelEdit: () => void
  onDelete: (periodId: string) => void
  formatDate?: (dateString: string) => string
}

export const ExchangePeriodTable: React.FC<ExchangePeriodTableProps> = ({
  periods,
  editingPeriodId,
  editingStartDate,
  editingEndDate,
  isLoading,
  isLoadingPeriods,
  loadError,
  onRetry,
  onEditChange,
  onEditSubmit,
  onCancelEdit,
  onDelete,
  formatDate = (dateString: string) => format(new Date(dateString), 'yyyy-MM-dd HH:mm'),
}) => {
  return (
    <Table className="w-full table-auto">
      <TableHeader>
        <TableRow>
          <TableHead className="text-center w-12">#</TableHead>
          <TableHead className="text-center font-mono">Início</TableHead>
          <TableHead className="text-center font-mono">Fim</TableHead>
          <TableHead className="text-center font-mono">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoadingPeriods ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
              A carregar…
            </TableCell>
          </TableRow>
        ) : loadError ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-red-600 py-4">
              {loadError}{' '}
              <Button onClick={onRetry} size="sm" variant="ghost">
                Tentar novamente
              </Button>
            </TableCell>
          </TableRow>
        ) : periods.length > 0 ? (
          periods.map((period, index) => (
            <TableRow key={period.id}>
              <TableCell className="text-center">{index + 1}</TableCell>
              <TableCell className="text-center font-mono">
                {editingPeriodId === period.id ? (
                  <DateTimePicker
                    value={editingStartDate}
                    onChange={(date) => onEditChange(period.id, date!, editingEndDate!)}
                  />
                ) : (
                  formatDate(period.startsAt)
                )}
              </TableCell>
              <TableCell className="text-center font-mono">
                {editingPeriodId === period.id ? (
                  <DateTimePicker
                    value={editingEndDate}
                    onChange={(date) => onEditChange(period.id, editingStartDate!, date!)}
                  />
                ) : (
                  formatDate(period.endsAt)
                )}
              </TableCell>
              <TableCell className="flex justify-center gap-2">
                {editingPeriodId === period.id ? (
                  <>
                    <Button onClick={onEditSubmit} size="sm" disabled={isLoading}>
                      <CheckIcon size="16" />
                    </Button>
                    <Button onClick={onCancelEdit} variant="destructive" size="sm">
                      <XIcon size="16" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={() => onEditChange(period.id, new Date(period.startsAt), new Date(period.endsAt))}
                      size="sm"
                      variant="ghost"
                    >
                      <Edit2Icon className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => onDelete(period.id)}
                      variant="destructive"
                      size="sm"
                      disabled={isLoading}
                      className="hover:bg-red-700"
                    >
                      <Trash2Icon size="16" />
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
              Nenhum período encontrado.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
