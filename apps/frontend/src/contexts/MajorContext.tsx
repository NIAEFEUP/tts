import { Context } from 'react'
import { createContext } from 'react'
import { Major } from '../@types'

interface MajorContextContent {
  majors: Major[]
  majorsError: unknown
  majorsLoading: boolean
  retryMajors: () => void
}

const MajorContext: Context<MajorContextContent> = createContext({
  majors: [],
  majorsError: null,
  majorsLoading: false,
  retryMajors: () => {},
})

export default MajorContext
