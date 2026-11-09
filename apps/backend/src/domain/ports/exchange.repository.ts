export type ExchangeRole = 'sent' | 'received' | 'all'
export type ExchangeStatus = 'PENDING' | 'ACCEPTED' | 'CANCELLED'
export type ExchangeType = 'DIRECT' | 'MARKETPLACE' | 'URGENT'

export type ExchangeRequestFilters = {
  role: ExchangeRole
  status?: ExchangeStatus
  type?: ExchangeType
  page: number
  limit: number
}

export type ExchangeRequestItem = {
  userId: string
  occurrenceId: number
  occurrenceYear: number
  fromClassId: number
  toClassId: number
  accepted: boolean
}

export type ExchangeRequest = {
  id: string
  creatorId: string
  targetUserId: string | null
  type: ExchangeType
  status: ExchangeStatus
  message: string | null
  adminState: 'UNTREATED' | 'TREATED' | 'REJECTED' | 'AWAITING_INFORMATION'
  createdAt: Date
  updatedAt: Date
  items: ExchangeRequestItem[]
}

export type ExchangeRequestPage = {
  current: number
  hasNext: boolean
  hasPrevious: boolean
  data: ExchangeRequest[]
}

export interface ExchangeRepository {
  findForUser(userId: string, filters: ExchangeRequestFilters): Promise<ExchangeRequestPage>
}
