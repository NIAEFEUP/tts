import { Dispatch, SetStateAction, useContext, useEffect, useState } from 'react'
import { ClassDescriptor, DirectExchangeRequest, MarketplaceRequest } from '../../../../../@types'
import ExchangeRequestCommonContext from '../../../../../contexts/ExchangeRequestCommonContext'
import ScheduleContext from '../../../../../contexts/ScheduleContext'
import useSchedule from '../../../../../hooks/useSchedule'
import { toast } from '../../../../ui/new/toaster'
import { StudentRequestCardStatus } from '../../../../../utils/requests'

type Props = {
  children: React.ReactNode
  request: MarketplaceRequest | DirectExchangeRequest
  hiddenRequests: Set<number>
  setHiddenRequests: Dispatch<SetStateAction<Set<number>>>
  chosenRequest: MarketplaceRequest | DirectExchangeRequest | null
  setChosenRequest: Dispatch<SetStateAction<MarketplaceRequest | DirectExchangeRequest | null>>
  type: string
}

export const CommonRequestCard = ({
  children,
  request,
  hiddenRequests,
  setHiddenRequests,
  chosenRequest,
  setChosenRequest,
  type,
}: Props) => {
  const { exchangeSchedule, setExchangeSchedule } = useContext(ScheduleContext)
  const [open, setOpen] = useState<boolean>(false)
  const [selectedOptions, setSelectedOptions] = useState<Map<string, boolean>>(new Map())
  const [selectAll, setSelectAll] = useState<boolean>(true)
  const [requestStatus, setRequestStatus] = useState<StudentRequestCardStatus | undefined>(undefined)
  const [currRequest, setCurrRequest] = useState<MarketplaceRequest | DirectExchangeRequest | null>(request)
  const originalSchedule = useSchedule()

  const hide = () => {
    const newHidden = new Set(hiddenRequests)
    newHidden.add(request.id)
    setHiddenRequests(newHidden)
    toast({
      title: 'Pedido escondido',
      description: 'O pedido foi escondido da lista de pedidos.',
    })
  }

  useEffect(() => {
    if (open) {
      setChosenRequest(request)
      togglePreview(selectedOptions)
    } else {
      setExchangeSchedule(originalSchedule.schedule)
    }
  }, [open])

  useEffect(() => {
    if (!request) return

    const ucs = new Set(request.options?.map((option) => option.course_info.acronym))

    const newSelectedOptions = new Map()
    ucs.forEach((acronym) => {
      newSelectedOptions.set(acronym, true)
    })

    setSelectedOptions(newSelectedOptions)
  }, [request])

  const handleSelectAll = () => {
    const allSelected = !selectAll
    setSelectAll(allSelected)

    for (const key of selectedOptions.keys()) {
      selectedOptions.set(key, allSelected)
    }

    const newSelectedOptions = new Map(selectedOptions)
    setSelectedOptions(newSelectedOptions)
    togglePreview(newSelectedOptions)
  }

  const togglePreview = (updatedOptions: Map<string, boolean>) => {
    const anySelected = Array.from(updatedOptions.values()).some((value) => value)

    // Schedule with courses that are not selected
    const newExchangeSchedule = originalSchedule?.schedule?.filter((classDescriptor: ClassDescriptor) => {
      return !updatedOptions.get(classDescriptor.courseInfo.acronym)
    })

    if (!exchangeSchedule) return

    if (anySelected) {
      request.options.forEach((option) => {
        if (updatedOptions.get(option.course_info.acronym) === true) {
          const matchingClass =
            type === 'directexchange' ? option.class_participant_goes_to : option.class_issuer_goes_from
          if (!matchingClass) return
          matchingClass.slots.forEach((slot) => {
            newExchangeSchedule.push({
              courseInfo: option.course_info,
              classInfo: {
                id: matchingClass.id,
                name: matchingClass.name,
                filteredTeachers: [],
                slots: [slot],
              },
            })
          })
        }
      })

      if (open) setExchangeSchedule(newExchangeSchedule)
    } else {
      if (open) setExchangeSchedule(originalSchedule.schedule)
    }
  }

  return (
    <ExchangeRequestCommonContext.Provider
      value={{
        request: currRequest,
        setRequest: setCurrRequest,
        hiddenRequests: hiddenRequests,
        setHiddenRequests: setHiddenRequests,
        chosenRequest: chosenRequest,
        setChosenRequest: setChosenRequest,
        exchangeSchedule: exchangeSchedule,
        selectAll: selectAll,
        setSelectAll: setSelectAll,
        selectedOptions: selectedOptions,
        setSelectedOptions: setSelectedOptions,
        open: open,
        setOpen: setOpen,
        togglePreview: togglePreview,
        hide: hide,
        handleSelectAll: handleSelectAll,
        requestStatus: requestStatus,
        setRequestStatus: setRequestStatus,
      }}
    >
      {children}
    </ExchangeRequestCommonContext.Provider>
  )
}
