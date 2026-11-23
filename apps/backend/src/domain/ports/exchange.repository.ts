export type ExchangeRole = 'sent' | 'received' | 'all'
export type ExchangeType = 'DIRECT' | 'MARKETPLACE' | 'URGENT'
export type ExchangeOfferStatus = 'OPEN' | 'MATCHED' | 'CANCELLED' | 'EXPIRED'
export type ExchangeCycleStatus = 'PENDING' | 'ACCEPTED' | 'CANCELLED'
export type ExchangeCycleOrigin = 'DIRECT' | 'MARKETPLACE' | 'URGENT' | 'AUTO_MATCH'
export type ExchangeItemStatus = 'PENDING' | 'ACCEPTED' | 'CANCELLED' | 'INVALID'
export type AdminValidationState = 'UNTREATED' | 'TREATED' | 'REJECTED' | 'AWAITING_INFORMATION'

export type ExchangeRequestFilters = {
  role: ExchangeRole
  status?: ExchangeOfferStatus
  type?: ExchangeType
  page: number
  limit: number
}

/**
 * One participant's move inside the approved swap. Only an offer that has been
 * claimed or assigned has a cycle, so these rows exist only for `MATCHED`
 * offers (and for cancelled or expired cycles that used to be matched).
 */
export type ExchangeItem = {
  userId: string
  occurrenceId: number
  occurrenceYear: number
  fromClassId: number
  toClassId: number
  status: ExchangeItemStatus
  acceptedAt: Date | null
}

/** The approved swap an offer produced, with the admin decision on the cycle. */
export type ExchangeCycle = {
  id: string
  status: ExchangeCycleStatus
  adminState: AdminValidationState
  origin: ExchangeCycleOrigin
  createdAt: Date
  updatedAt: Date
  items: ExchangeItem[]
}

/**
 * An exchange offer: exactly one proposed move. `cycle` is `null` while the
 * offer is unclaimed, which is why an `OPEN` offer carries no items.
 */
export type ExchangeRequest = {
  id: string
  creatorId: string
  targetUserId: string | null
  type: ExchangeType
  status: ExchangeOfferStatus
  message: string | null
  occurrenceId: number
  occurrenceYear: number
  fromClassId: number
  toClassId: number
  createdAt: Date
  updatedAt: Date
  cycle: ExchangeCycle | null
}

export type ExchangeRequestPage = {
  current: number
  hasNext: boolean
  hasPrevious: boolean
  data: ExchangeRequest[]
}

export type ExchangeRepository = {
  findForUser(userId: string, filters: ExchangeRequestFilters): Promise<ExchangeRequestPage>
}
