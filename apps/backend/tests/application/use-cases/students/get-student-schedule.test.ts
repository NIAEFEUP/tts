import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createGetStudentSchedule } from '@/application/use-cases/students/get-student-schedule'
import type { AuthUser } from '@/core/auth/user'

// The policy: owner, admin, or same-course participant. The cheap checks must
// short-circuit, so the shared-course query only runs when it can change the answer.

const caller = (id: string, role: AuthUser['role'] = 'USER'): AuthUser => ({ id, name: id, email: null, role })

function setup(shares: boolean) {
  let sharesCourseCalls = 0
  const getSchedule = createGetStudentSchedule({
    students: {
      findProfile: async (nmec) => (nmec === '2' ? { nmec, name: 'Target' } : null),
      findCourseMetadata: async () => null,
    },
    schedules: {
      findByStudent: async () => [],
      sharesCourse: async () => {
        sharesCourseCalls++
        return shares
      },
    },
  })

  return { getSchedule, sharesCourseCalls: () => sharesCourseCalls }
}

test('the owner and admins are allowed without a shared-course lookup', async () => {
  const { getSchedule, sharesCourseCalls } = setup(false)

  assert.deepEqual(await getSchedule(caller('2'), '2'), { ok: true, classes: [] })
  assert.deepEqual(await getSchedule(caller('1', 'ADMIN'), '2'), { ok: true, classes: [] })
  assert.deepEqual(await getSchedule(caller('1', 'SUPERUSER'), '2'), { ok: true, classes: [] })
  assert.equal(sharesCourseCalls(), 0)
})

test('a participant is allowed and a stranger is forbidden', async () => {
  assert.deepEqual(await setup(true).getSchedule(caller('1'), '2'), { ok: true, classes: [] })
  assert.deepEqual(await setup(false).getSchedule(caller('1'), '2'), { ok: false, reason: 'forbidden' })
})

test('an unknown student is not-found before access is judged', async () => {
  const { getSchedule, sharesCourseCalls } = setup(false)

  assert.deepEqual(await getSchedule(caller('1'), '404'), { ok: false, reason: 'student-not-found' })
  assert.equal(sharesCourseCalls(), 0)
})
