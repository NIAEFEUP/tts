import type { Db } from '@/infrastructure/database/prisma'

import type { FacultyRepository } from '@/domain/ports/faculty.repository'

import { loadCourses } from './course-mapper'

/**
 * Prisma implementation of `FacultyRepository`. `FacultyCourse` is an explicit
 * many-to-many join, so resolving a faculty's courses reads the join rows first
 * and then delegates to the shared course mapper (see `course-mapper.ts`).
 *
 * This is a factory function: it receives a database connection and returns
 * an object matching the FacultyRepository interface. The route never calls
 * this directly — it's wired up in main.ts via createRepositories(db).
 */
export function createFacultyRepository({ db }: { db: Db }): FacultyRepository {
  return {
    // GET /v1/faculties/ — fetch all faculties, sorted alphabetically.
    async findAll() {
      // db.orm.public.Faculty accesses the Faculty table (Prisma 8 fluent API).
      // .orderBy().all() fetches all rows sorted by acronym ascending.
      const rows = await db.orm.public.Faculty.orderBy((faculty) => faculty.acronym.asc()).all()

      // Transform database rows into the Faculty shape (just acronym + name).
      return rows.map((row) => ({ acronym: row.acronym, name: row.name }))
    },

    // GET /v1/faculties/:acronym — fetch a single faculty by acronym.
    async findByAcronym(acronym) {
      // .where({ acronym }) filters to matching rows; .first() returns one or null.
      const row = await db.orm.public.Faculty.where({ acronym }).first()

      // Return the Faculty shape if found, otherwise null (route converts to 404).
      return row ? { acronym: row.acronym, name: row.name } : null
    },

    // GET /v1/faculties/:acronym/courses?year=2024 — fetch courses for a faculty.
    //
    // Database relationship (many-to-many):
    //   Faculty ←──→ FacultyCourse (join table) ←──→ Course
    // A faculty can offer many courses; a course can be offered by many faculties.
    async findCoursesByFaculty(acronym, year) {
      // Step 1: Find all FacultyCourse join rows where this faculty is linked.
      const links = await db.orm.public.FacultyCourse.where((link) => link.facultyId.eq(acronym)).all()
      const courseIds = links.map((link) => link.courseId)
      // Early return: if no links exist, skip the remaining queries.
      if (courseIds.length === 0) return []

      // Step 2+3: fetch the courses (optionally year-filtered) and attach the
      // faculty acronyms of EACH course — not just the one we searched for —
      // because courses can be shared across multiple faculties.
      return loadCourses(db, { ids: courseIds, year })
    },
  }
}
