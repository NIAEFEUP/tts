import { useEffect, useContext, useState } from 'react'
import { Sidebar } from '../components/planner'
import { useSidebarContext } from '../components/layout/SidebarPosition'
import { SidebarProvider } from '../components/layout/SidebarPosition'
import PlannerSchedule from '../components/planner/schedule/PlannerSchedule'
import { Tabs } from '../components/ui/new/tabs'
import Alert, { AlertType } from '../components/planner/Alert'
import { AlertDescription } from '../components/ui/alert'
import SessionContext from '../contexts/SessionContext'
import StorageAPI from '../api/storage'
import { X } from 'lucide-react'
import { LoginButton } from '../components/auth/LoginButton'
import { ShieldExclamationIcon } from '@heroicons/react/24/outline'
import { useMediaQuery } from '../hooks/useMediaQuery'
const TimeTableSelectorPage = () => {
  // The catalog is loaded once in CombinedProvider; here we only make sure the
  // layout is scrolled into view on mount.
  useEffect(() => {
    document.getElementById('layout').scrollIntoView()
  }, [])

  return (
    <SidebarProvider>
      <Content />
    </SidebarProvider>
  )
}

const Content = () => {
  const { sidebarPosition } = useSidebarContext()
  const { signedIn, user } = useContext(SessionContext)
  const [showExchangeAlert, setShowExchangeAlert] = useState<boolean>(true)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  useEffect(() => {
    setShowExchangeAlert(StorageAPI.getShowExchangeAlertStorage())
  }, [])

  const handleCloseAlert = () => {
    setShowExchangeAlert(false)
    StorageAPI.setShowExchangeAlertStorage()
  }

  if (!signedIn)
    return (
      <div className="grid w-cfull grid-cols-12 gap-x-4 gap-y-4 px-4 py-4">
        <div className="lg:min-h-adjusted order-1 col-span-12 min-h-min rounded-sm bg-lightest px-3 py-3 dark:bg-dark lg:col-span-9 2xl:px-5 2xl:py-5">
          <div className="h-full w-full">
            <PlannerSchedule />
          </div>
        </div>

        <div className="lg:min-h-adjusted order-2 col-span-12 flex min-h-min flex-col justify-between rounded-sm bg-lightest px-3 py-3 dark:bg-dark lg:col-span-3 2xl:px-4 2xl:py-4">
          <div className="flex flex-col items-center justify-center gap-4 h-full">
            <ShieldExclamationIcon className="w-12 h-12" />
            <p className="text-center">Tens de iniciar sessão para poderes usar o Horário</p>
            <LoginButton expanded={true} />
          </div>
        </div>
      </div>
    )

  if (!isDesktop) {
    return (
      <div className="h-full w-full">
        <div className="flex w-full px-4 py-4 justify-items-start">
          <Tabs className="w-full">
            <Tabs.Items className="w-full">
              <Tabs.Item className="flex-1">Horário</Tabs.Item>
              <Tabs.Item className="flex-1">Turmas</Tabs.Item>
            </Tabs.Items>
            <Tabs.Panels>
              <Tabs.Panel>
                <div className="rounded-sm bg-lightest px-3 py-3 dark:bg-dark">
                  <div className="h-full w-full">
                    <PlannerSchedule />
                  </div>
                </div>
              </Tabs.Panel>
              <Tabs.Panel>
                <Sidebar />
              </Tabs.Panel>
            </Tabs.Panels>
          </Tabs>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <div className="grid w-full grid-cols-12 gap-x-4 gap-y-4 px-4 py-4">
        {user?.eligible_exchange && showExchangeAlert && (
          <div className="col-span-12 mb-2">
            <Alert type={AlertType.info} className="relative p-4">
              <AlertDescription className="pr-8">
                Esta secção funciona apenas como Planner de horários. As inscrições e trocas reais são realizadas na
                página de Inscrições e Trocas de Turmas.
              </AlertDescription>
              <button
                onClick={handleCloseAlert}
                className="absolute top-1.5 right-3 text-current opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 p-1 rounded-full transition-all"
              >
                <X size={18} />
              </button>
            </Alert>
          </div>
        )}
        {sidebarPosition === 'left' ? (
          <>
            <div className="col-span-12 min-h-min lg:col-span-3 lg:min-h-adjusted">
              <Sidebar />
            </div>
            <div className="col-span-12 min-h-min rounded-md bg-lightest px-3 py-3 dark:bg-dark lg:col-span-9 lg:min-h-adjusted 2xl:px-5 2xl:py-5">
              <PlannerSchedule />
            </div>
          </>
        ) : (
          <>
            <div className="col-span-12 min-h-min rounded-md bg-lightest px-3 py-3 dark:bg-dark lg:col-span-9 lg:min-h-adjusted 2xl:px-5 2xl:py-5">
              <PlannerSchedule />
            </div>
            <div className="col-span-12 min-h-min lg:col-span-3 lg:min-h-adjusted">
              <Sidebar />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default TimeTableSelectorPage
