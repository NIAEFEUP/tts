import { Context } from 'react'
import { createContext } from 'react'
import { Major } from '../@types'

interface MajorContextContent {
  majors: Major[]
  majorsError: Error | null
  majorsLoading: boolean
  majorsValidating: boolean
  retryMajors: () => void
}

const MajorContext: Context<MajorContextContent> = createContext({
  majors: [],
  majorsError: null,
  majorsLoading: false,
  majorsValidating: false,
  retryMajors: () => {},
})

export default MajorContext
