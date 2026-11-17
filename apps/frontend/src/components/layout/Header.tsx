import { Link } from 'react-router-dom'
import { Popover, Transition } from '@headlessui/react'
// DARK MODE DISABLED: toggle hidden. To re-enable, uncomment this import line.
// import { DarkModeSwitch } from './DarkModeSwitch'
import { Menu, X, AtSign, Layers, CircleQuestionMark, ArrowLeftRight, Wrench } from 'lucide-react'
import { LogoNIAEFEUPImage } from '../../images'
import { getPath, config } from '../../utils'
import { FeedbackReport } from '../FeedbackReport'
import SessionContext from '../../contexts/SessionContext'
import { useContext } from 'react'
import { LoginButton } from '../auth/LoginButton'
import { HeaderProfileDropdown } from '../auth/HeaderProfileDropdown'
import { ENV } from 'varlock/env'

const navigation = [
  {
    title: 'Horários',
    location: getPath(config.paths.planner),
    icon: <Layers className="h-5 w-5" />,
    wip: false,
  },
  {
    title: 'Turmas',
    location: getPath(config.paths.exchange),
    icon: <ArrowLeftRight className="h-5 w-5" />,
    wip: false,
  },
  {
    title: 'Sobre',
    location: getPath(config.paths.about),
    icon: <AtSign className="h-5 w-5" />,
    wip: false,
  },
  {
    title: 'FAQs',
    location: getPath(config.paths.faqs),
    icon: <CircleQuestionMark className="h-5 w-5" />,
    wip: false,
  },
  {
    title: 'Admin',
    location: getPath(config.paths.admin),
    icon: <Wrench className="h-5 w-5" />,
    wip: false,
  },
]

type Props = {
  siteTitle: string
  location: string
}

/** Site header with navigation, session controls, and the mobile menu. */
const Header = ({ siteTitle, location }: Props) => {
  const { signedIn, user, isSessionLoading } = useContext(SessionContext)

  return (
    <Popover
      as="nav"
      className="max-sm:flex max-sm:flex-col sticky top-0 z-40 space-x-4 bg-light px-3 py-2 text-gray-800 dark:bg-darkest dark:text-white md:py-0 md:px-3"
    >
      {({ open }) => {
        return (
          <>
            <div className={'p-2 relative flex items-center justify-between md:py-0'}>
              <Hamburger open={open} signedIn={signedIn} isSessionLoading={isSessionLoading} />
              <div className="flex md:flex-1 items-center justify-between md:items-stretch md:justify-between">
                <div className="relative hidden h-auto space-x-12 self-center duration-200 hover:opacity-75 md:inline-flex">
                  <Link to={config.pathPrefix} className="flex items-center space-x-2">
                    <img
                      src={LogoNIAEFEUPImage}
                      alt="Time Table Selector"
                      className="z-20 inline-flex h-6 w-auto rounded-full transition"
                    />
                    <h3 className="text-xs font-bold tracking-tighter duration-150 lg:text-base">{siteTitle}</h3>
                  </Link>
                </div>

                <div className="hidden space-x-8 self-center md:inline-flex">
                  {navigation
                    .filter((link) => !link.wip || !ENV.VITE_APP_PROD || ENV.VITE_APP_STAGING)
                    .filter((link) => link.title !== 'Admin' || (signedIn && user?.is_admin))
                    .map((link, index) => (
                      <Link to={link.location} key={`nav-${index}`} className="relative py-1">
                        <button
                          type="button"
                          className={`flex h-12 items-center justify-center font-medium capitalize tracking-wide transition ${
                            location === link.title
                              ? 'text-primary dark:text-white'
                              : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'
                          }`}
                        >
                          <span className="flex items-center justify-center space-x-1.5">
                            <span>{link.icon}</span>
                            <span>{link.title}</span>
                          </span>
                        </button>
                        {location === link.title ? (
                          <span className="absolute bottom-0 h-1 w-full rounded-t bg-primary dark:bg-primary" />
                        ) : null}
                      </Link>
                    ))}
                </div>

                <div className="hidden self-center md:inline-flex items-center gap-x-4">
                  {/* DARK MODE DISABLED: uncomment to re-enable the toggle */}
                  {/* <DarkModeSwitch /> */}
                  {signedIn ? <HeaderProfileDropdown /> : isSessionLoading ? null : <LoginButton expanded={false} />}
                </div>
              </div>
            </div>
            <Mobile location={location} />
          </>
        )
      }}
    </Popover>
  )
}

export default Header

type HamburgerProps = {
  open: boolean
  signedIn: boolean
  isSessionLoading: boolean
}

/** Mobile header bar with the session control and menu toggle. */
const Hamburger = ({ open, signedIn, isSessionLoading }: HamburgerProps) => {
  return (
    <div className={'z-50 md:hidden flex w-full items-center justify-between'}>
      <Link to={config.pathPrefix}>
        <img
          className="h-6 w-auto rounded-full transition hover:opacity-80 md:hidden"
          src={LogoNIAEFEUPImage}
          alt="Time Table Selector"
        />
      </Link>

      <div className="flex items-center space-x-1">
        {/* DARK MODE DISABLED: uncomment to re-enable the toggle */}
        {/* <DarkModeSwitch /> */}
        <FeedbackReport />
        {signedIn ? <HeaderProfileDropdown /> : isSessionLoading ? null : <LoginButton expanded={false} />}

        <Popover.Button className="group text-gray-800 transition duration-200 ease-in dark:text-white md:hidden">
          <span className="sr-only">Open nav menu</span>
          {open ? (
            <X
              className="ease block h-6 w-6 transition duration-200 group-hover:text-primary/75 dark:group-hover:text-primary/75"
              aria-hidden="true"
            />
          ) : (
            <Menu
              className="ease block h-6 w-6 transition duration-200 group-hover:text-primary/75 dark:group-hover:text-primary/75"
              aria-hidden="true"
            />
          )}
        </Popover.Button>
      </div>
    </div>
  )
}

type MobileProps = {
  location: string
}

const Mobile = ({ location }: MobileProps) => {
  const { signedIn, user } = useContext(SessionContext)

  return (
    <Transition
      enter="transition duration-200 ease-out"
      enterFrom="transform -translate-y-2 opacity-0"
      enterTo="transform translate-y-0 opacity-100"
      leave="transition duration-150 ease-out"
      leaveFrom="transform translate-y-0 opacity-100"
      leaveTo="transform -translate-y-2 opacity-0"
    >
      <div className="absolute top-full left-0 w-full z-40 bg-light dark:bg-darkest shadow-xl rounded-b-lg md:hidden origin-top ml-0!">
        <Popover.Panel className="flex flex-col space-y-3 px-3 pl-8 py-4">
          {navigation
            .filter((link) => !link.wip)
            .filter((link) => link.title !== 'Admin' || (signedIn && user?.is_admin))
            .map((link, index) => (
              <Popover.Button as={Link} to={link.location} className="relative h-auto" key={`mobile-nav-${index}`}>
                <span
                  className={`flex h-auto items-center justify-start font-medium capitalize tracking-wide transition ${
                    location === link.title
                      ? 'text-primary dark:text-white'
                      : 'text-gray-800/70 hover:text-gray-800 dark:text-white/60 dark:hover:text-white'
                  }`}
                >
                  <span className="flex items-center justify-start space-x-2">
                    <span>{link.icon}</span>
                    <span>{link.title}</span>
                  </span>
                  {location === link.title && (
                    <span className="absolute -left-4 h-full w-1 rounded-sm bg-primary dark:bg-primary" />
                  )}
                </span>
              </Popover.Button>
            ))}
        </Popover.Panel>
      </div>
    </Transition>
  )
}
