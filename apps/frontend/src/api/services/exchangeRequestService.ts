import { Key } from 'swr'
import { AdminRequestType, CreateRequestData, MarketplaceRequest } from '../../@types'
import api from '../backend'

const isDirectExchange = (requests: IterableIterator<CreateRequestData>) => {
  for (const request of requests) {
    if (!request.other_student) return false
  }

  return true
}

const getRelatedExchanges = async (requests: Map<number, CreateRequestData>) => {
  const formData = new FormData()

  for (const request of requests.values()) {
    formData.append('exchangeChoices[]', JSON.stringify(request))
  }

  return fetch(`${api.BACKEND_URL}/exchange/related/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'X-CSRFToken': api.getCSRFToken(),
    },
    body: formData,
  })
}

const submitExchangeRequest = async (
  requests: Map<number, CreateRequestData>,
  urgentMessage: string = '',
  replace: boolean = false,
) => {
  const formData = new FormData()

  for (const request of requests.values()) {
    formData.append('exchangeChoices[]', JSON.stringify(request))
  }

  if (!isDirectExchange(requests.values()) && requests.values()[0]?.marketplace_id)
    formData.append('marketplace_id', requests.values()[0]?.marketplace_id)

  if (urgentMessage !== '') formData.append('urgentMessage', urgentMessage)

  formData.append('replace', replace.toString())

  try {
    const res = await fetch(
      `${api.BACKEND_URL}/exchange/${isDirectExchange(requests.values()) ? 'direct/' : 'marketplace/'}`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRFToken': api.getCSRFToken(),
        },
        body: formData,
      },
    )
    return res
  } catch (error) {
    console.error(error)
    throw new Error('Network error')
  }
}

const retrieveMarketplaceRequest = async (url: string): Promise<MarketplaceRequest[]> => {
  return fetch(url, { credentials: 'include' })
    .then(async (res) => {
      const json = await res.json()
      return json
    })
    .catch((e) => {
      console.error(e)
      return []
    })
}

const retrieveRequestCardMetadata = async (courseUnitId: Key) => {
  return fetch(`${api.BACKEND_URL}/course_unit/${courseUnitId}/exchange/metadata`, { credentials: 'include' })
    .then(async (res) => {
      if (!res.ok) return []
      return await res.json()
    })
    .catch((e) => {
      console.error(e)
      return []
    })
}

const adminRejectExchangeRequest = async (requestType: AdminRequestType, id: number) => {
  return fetch(`${api.BACKEND_URL}/exchange/admin/request/${requestType}/${id}/reject/`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'X-CSRFToken': api.getCSRFToken(),
    },
  })
}

const adminAcceptExchangeRequest = async (requestType: AdminRequestType, id: number) => {
  return fetch(`${api.BACKEND_URL}/exchange/admin/request/${requestType}/${id}/accept/`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'X-CSRFToken': api.getCSRFToken(),
    },
  })
}

const adminMarkRequestAsAwaitingInformation = async (requestType: AdminRequestType, id: number) => {
  return fetch(`${api.BACKEND_URL}/exchange/admin/request/${requestType}/${id}/awaiting-information/`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'X-CSRFToken': api.getCSRFToken(),
    },
  })
}

const verifyExchangeRequest = async (token: string): Promise<boolean> => {
  token = atob(token)
  return fetch(`${api.BACKEND_URL}/exchange/verify/${token}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'X-CSRFToken': api.getCSRFToken(),
    },
  })
    .then(async (res) => {
      if (res.ok) {
        const json = await res.json()
        return json
      } else {
        return false
      }
    })
    .catch((e) => {
      console.error(e)
      return false
    })
}

const acceptDirectExchangeRequest = async (id: number) => {
  return fetch(`${api.BACKEND_URL}/exchange/direct/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'X-CSRFToken': api.getCSRFToken(),
    },
  })
}

const cancelMarketplaceRequest = async (id: number) => {
  return fetch(`${api.BACKEND_URL}/exchange/marketplace/${id}/cancel/`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'X-CSRFToken': api.getCSRFToken(),
    },
  })
}

const addCourseExchangePeriod = async (startDate: Date, endDate: Date, selectedCourse: number) => {
  const formData = new FormData()
  formData.append('startDate', startDate.toISOString())
  formData.append('endDate', endDate.toISOString())
  return fetch(`${api.BACKEND_URL}/exchange/admin/course/${selectedCourse}/period/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'X-CSRFToken': api.getCSRFToken(),
    },
    body: formData,
  })
}

const addCourseUnitExchangePeriod = async (startDate: Date, endDate: Date, selectedCourseUnit: number) => {
  const formData = new FormData()
  formData.append('startDate', startDate.toISOString())
  formData.append('endDate', endDate.toISOString())
  return fetch(`${api.BACKEND_URL}/exchange/admin/course_unit/${selectedCourseUnit}/period/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'X-CSRFToken': api.getCSRFToken(),
    },
    body: formData,
  })
}

// shortcut: edit/delete send v1 UUID period ids to legacy <int:period_id> routes, which 404 on them;
// move all four to PUT/DELETE /v1/{courses,occurrences}/:id/periods/:periodId once #954 adds them.
const editCourseExchangePeriod = async (startDate: Date, endDate: Date, selectedCourse: number, periodId: string) => {
  const payload = {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  }

  return fetch(`${api.BACKEND_URL}/exchange/admin/course/${selectedCourse}/period/${periodId}/`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': api.getCSRFToken(),
    },
    body: JSON.stringify(payload),
  })
}

const editCourseUnitExchangePeriod = async (
  startDate: Date,
  endDate: Date,
  selectedCourseUnit: number,
  periodId: string,
) => {
  const payload = {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  }
  return fetch(`${api.BACKEND_URL}/exchange/admin/course_unit/${selectedCourseUnit}/period/${periodId}/`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'X-CSRFToken': api.getCSRFToken(),
    },
    body: JSON.stringify(payload),
  })
}

const deleteCourseExchangePeriod = async (selectedCourse: number, periodId: string) => {
  return fetch(`${api.BACKEND_URL}/exchange/admin/course/${selectedCourse}/period/${periodId}/`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'X-CSRFToken': api.getCSRFToken(),
    },
  })
}

const deleteCourseUnitExchangePeriod = async (selectedCourseUnit: number, periodId: string) => {
  return fetch(`${api.BACKEND_URL}/exchange/admin/course_unit/${selectedCourseUnit}/period/${periodId}/`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'X-CSRFToken': api.getCSRFToken(),
    },
  })
}

const revalidateExchangeRequest = async (exchangeRequestId: number) => {
  return fetch(`${api.BACKEND_URL}/exchange/${exchangeRequestId}/revalidate/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'X-CSRFToken': api.getCSRFToken(),
    },
  })
}

const exchangeRequestService = {
  submitExchangeRequest,
  retrieveMarketplaceRequest,
  retrieveRequestCardMetadata,
  adminRejectExchangeRequest,
  adminAcceptExchangeRequest,
  adminMarkRequestAsAwaitingInformation,
  verifyExchangeRequest,
  acceptDirectExchangeRequest,
  cancelMarketplaceRequest,
  isDirectExchange,
  addCourseExchangePeriod,
  addCourseUnitExchangePeriod,
  editCourseExchangePeriod,
  editCourseUnitExchangePeriod,
  deleteCourseExchangePeriod,
  deleteCourseUnitExchangePeriod,
  revalidateExchangeRequest,
  getRelatedExchanges,
}

export default exchangeRequestService
