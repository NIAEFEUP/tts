import Plausible from 'plausible-tracker'
import { ENV } from 'varlock/env'
import { Major } from '../@types'

const plausible = Plausible({
  domain: import.meta.env.VITE_APP_PLAUSIBLE_DOMAIN,
  apiHost: import.meta.env.VITE_APP_PLAUSIBLE_HOST,
  trackLocalhost: !ENV.VITE_APP_PROD,
})

const { trackEvent } = plausible

export enum Feature {
  COPY = 'Copy Schedule',
  PASTE = 'Paste Schedule',
  RANDOM_FILL = 'Random Fill',

  OPTION_REORDER = 'Options Order Changed',
  OPTION_RENAME = 'Option Renamed',
  OPTION_EMOJI = 'Schedule Emoji Changed',

  SCREENSHOT = 'Screenshot',
  GRID = 'Grid View Toggle',

  EXPORT_TO_CSV = 'Export to CSV',
  EXPORT_TO_ICS = 'Export to ICS',

  LOCK_TOGGLE = 'Class Lock Toggled',
}

export class AnalyticsTracker {
  static majorSelected = (major: Major) => {
    if (major) {
      trackEvent('Major Selected', { props: { major: major.name } })
      trackEvent('Faculty', {
        props: { faculty: (major.faculties?.[0] ?? major.faculty_id ?? '').toUpperCase() },
      })
    }
  }

  static trackFeature = (feature: Feature) => {
    trackEvent('Feature', { props: { feature_counter: feature } })
  }

  static trackFaq = (faq: string) => {
    if (faq) trackEvent('FAQ', { props: { faq } })
  }

  static emoji = (emoji: string) => {
    if (emoji) trackEvent('Emoji', { props: { emoji } })
  }
}
