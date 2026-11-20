import { useContext, useEffect, useState, Dispatch, SetStateAction } from 'react'
import { ClassDescriptor } from '../@types'
import { LoginButton } from '../components/auth/LoginButton'
import ExchangeSchedule from '../components/exchange/schedule/ExchangeSchedule'
import ScheduleContext from '../contexts/ScheduleContext'
import SessionContext from '../contexts/SessionContext'
import useSchedule from '../hooks/useSchedule'
import useStudentCourseUnits from '../hooks/useStudentCourseUnits'
import '../styles/exchange.css'
import { CreateRequest } from '../components/exchange/requests/issue/CreateRequest'
import { ViewRequests } from '../components/exchange/requests/view/ViewRequests'
import { FaceFrownIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline'
import { Schedule } from '../components/planner'
import { Enrollments } from '../components/exchange/enrollments/Enrollments'
import { Tabs } from '../components/ui/new/tabs'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '../components/ui/alert'
import useStudentRefreshSchedule from '../hooks/useStudentRefreshSchedule'
import RefreshScheduleButton from '../components/exchange/schedule/RefreshScheduleButton'

export enum ExchangeSidebarStatus {
  SHOWING_REQUESTS,
  CREATING_REQUEST,
}

const ExchangeSidebarStatusView = ({
  sidebarStatus,
  setExchangeSidebarStatus,
}: {
  sidebarStatus: ExchangeSidebarStatus
  setExchangeSidebarStatus: Dispatch<SetStateAction<ExchangeSidebarStatus>>
}) => {
  switch (sidebarStatus) {
    case ExchangeSidebarStatus.SHOWING_REQUESTS:
      return <ViewRequests setExchangeSidebarStatus={setExchangeSidebarStatus} />
    case ExchangeSidebarStatus.CREATING_REQUEST:
      return <CreateRequest setExchangeSidebarStatus={setExchangeSidebarStatus} />
  }
}

const ExchangePage = () => {
  const [loads, setLoads] = useState<number>(-1)
  const [creatingRequest] = useState<boolean>(false)
  const [sidebarStatus, setSidebarStatus] = useState<ExchangeSidebarStatus>(ExchangeSidebarStatus.SHOWING_REQUESTS)
  const { schedule, loading: loadingSchedule } = useSchedule()
  const [originalExchangeSchedule, setOriginalExchangeSchedule] = useState<Array<ClassDescriptor>>([])
  const [exchangeSchedule, setExchangeSchedule] = useState<Array<ClassDescriptor>>([])

  const { signedIn, user, forceScheduleRevalidation, isSessionLoading } = useContext(SessionContext)

  const { enrolledCourseUnits, forceCourseUnitsRevalidation } = useStudentCourseUnits()

  const { refreshedSchedule, forceRefreshStudentSchedule, isRefreshingStudentSchedule } = useStudentRefreshSchedule()

  useEffect(() => {
    forceScheduleRevalidation()

    setExchangeSchedule(schedule ? schedule : [])

    if (loads <= 0) {
      setOriginalExchangeSchedule(schedule ? schedule : [])
    }
  }, [schedule])

  useEffect(() => {
    if (user?.eligible_exchange) forceCourseUnitsRevalidation()
  }, [user])

  useEffect(() => {
    if (creatingRequest) setSidebarStatus(ExchangeSidebarStatus.CREATING_REQUEST)
    else setSidebarStatus(ExchangeSidebarStatus.SHOWING_REQUESTS)
  }, [creatingRequest])

  useEffect(() => {
    if (refreshedSchedule) setExchangeSchedule(refreshedSchedule.schedule)
  }, [refreshedSchedule])

  useEffect(() => {
    setLoads((prev) => prev + 1)
  }, [setLoads])

  if (!signedIn)
    return (
      <ScheduleContext.Provider
        value={{
          originalExchangeSchedule,
          exchangeSchedule,
          loadingSchedule,
          setExchangeSchedule,
          enrolledCourseUnits,
        }}
      >
        <div className="grid w-cfull grid-cols-12 gap-x-4 gap-y-4 px-4 py-4">
          <div className="lg:min-h-adjusted order-1 col-span-12 min-h-min rounded-sm bg-lightest px-3 py-3 dark:bg-dark lg:col-span-9 2xl:px-5 2xl:py-5">
            <div className="h-full w-full">
              <Schedule classes={[]} slots={[]} />
            </div>
          </div>

          <div className="lg:min-h-adjusted order-2 col-span-12 flex min-h-min flex-col justify-between rounded-sm bg-lightest px-3 py-3 dark:bg-dark lg:col-span-3 2xl:px-4 2xl:py-4">
            <div className="flex flex-col items-center justify-center gap-4 h-full">
              <ShieldExclamationIcon className="w-12 h-12" />
              <p className="text-center">Tens de iniciar sessão para começares a trocar de turmas</p>
              <LoginButton expanded={true} />
            </div>
          </div>
        </div>
      </ScheduleContext.Provider>
    )

  return (
    <ScheduleContext.Provider
      value={{
        originalExchangeSchedule,
        exchangeSchedule,
        loadingSchedule,
        setExchangeSchedule,
        enrolledCourseUnits,
      }}
    >
      <div className="block lg:hidden mx-4">
        <RefreshScheduleButton
          forceRefreshStudentSchedule={forceRefreshStudentSchedule}
          loadingSchedule={loadingSchedule}
          isRefreshingStudentSchedule={isRefreshingStudentSchedule}
        />
      </div>

      <div className="grid w-cfull grid-cols-12 gap-x-4 gap-y-4 px-4 py-4">
        {/* Schedule Preview */}
        <div className="lg:min-h-adjusted order-1 col-span-12 min-h-min rounded-sm bg-lightest px-3 py-3 dark:bg-dark lg:col-span-9 2xl:px-5 2xl:py-5  ">
          <div className="h-full w-full">
            {refreshedSchedule?.noChanges === false && !loadingSchedule && (
              <>
                <Alert variant="destructive" className="my-2 mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>O horário reflete trocas que ainda não estão no sigarra</AlertDescription>
                </Alert>
              </>
            )}

            <ExchangeSchedule
              refresh={
                !loadingSchedule && (
                  <div className="hidden md:block">
                    <RefreshScheduleButton
                      forceRefreshStudentSchedule={forceRefreshStudentSchedule}
                      loadingSchedule={loadingSchedule}
                      isRefreshingStudentSchedule={isRefreshingStudentSchedule}
                    />
                  </div>
                )
              }
            />
          </div>
        </div>

        <div className="lg:min-h-adjusted order-2 col-span-12 flex flex-col rounded-sm bg-lightest px-3 py-3 dark:bg-dark lg:col-span-3 2xl:px-4 2xl:py-4 h-[85vh] overflow-y-auto no-scrollbar">
          <Tabs defaultIndex={0} className="flex flex-col h-full">
            <Tabs.Items className="w-full mb-2 shrink-0">
              <Tabs.Item className="flex-1">Pedidos</Tabs.Item>
              <Tabs.Item className="flex-1">Inscrições</Tabs.Item>
            </Tabs.Items>
            <Tabs.Panels className="grow">
              <Tabs.Panel>
                {!isSessionLoading && user?.eligible_exchange ? (
                  <ExchangeSidebarStatusView
                    sidebarStatus={sidebarStatus}
                    setExchangeSidebarStatus={setSidebarStatus}
                  />
                ) : (
                  <>
                    {!loadingSchedule && (
                      <div className="flex flex-col items-center justify-center gap-4 mt-16">
                        <FaceFrownIcon className="w-12 h-12" />
                        <p className="text-center">
                          Nenhuma das tuas unidades curriculares dá para trocar a turma no TTS
                        </p>
                      </div>
                    )}
                  </>
                )}
              </Tabs.Panel>
              <Tabs.Panel>
                <Enrollments setExchangeSidebarStatus={setSidebarStatus} />
              </Tabs.Panel>
            </Tabs.Panels>
          </Tabs>
        </div>
      </div>
    </ScheduleContext.Provider>
  )
}

export default ExchangePage
