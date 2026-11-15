import { client } from '../client'

// Replaces the legacy `GET /student/schedule` (#941). The mapper to `ClassDescriptor[]`
// lands next, shared with the admin hook (#864).
const getMySchedule = async () => {
  const { data, error } = await client.v1.users.me.schedule.get({ fetch: { credentials: 'include' } })
  if (error) throw error
  return data
}

const scheduleService = {
  getMySchedule,
}

export default scheduleService
