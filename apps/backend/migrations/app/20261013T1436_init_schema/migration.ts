#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/b8cf88cef780e6a64cd5f17b631daf8ea2da908d6e3abc62b0300743cbb65fb5/contract'
import endContract from '../../snapshots/b8cf88cef780e6a64cd5f17b631daf8ea2da908d6e3abc62b0300743cbb65fb5/contract.json' with { type: 'json' }
import { Migration, MigrationCLI, checkExpression, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration'

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'AdminCourse',
        columns: [
          col('courseId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['userId', 'courseId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'AdminOccurrence',
        columns: [
          col('occurrenceId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('occurrenceYear', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['userId', 'occurrenceId', 'occurrenceYear'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Class',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('occurrenceId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('occurrenceYear', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('vacancies', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Course',
        columns: [
          col('acronym', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('courseType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('url', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('year', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'CourseUnit',
        columns: [
          col('acronym', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('courseId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('semester', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Enrollment',
        columns: [
          col('classId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['userId', 'classId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'EnrollmentRequest',
        columns: [
          col('adminState', 'text', {
            notNull: true,
            default: lit('UNTREATED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'EnrollmentRequest_adminState_check_49a4ff70',
            `"adminState" IN ('UNTREATED', 'TREATED', 'REJECTED', 'AWAITING_INFORMATION')`,
          ),
          checkExpression(
            'EnrollmentRequest_status_check_a8137f16',
            `"status" IN ('PENDING', 'ACCEPTED', 'CANCELLED')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'EnrollmentRequestOption',
        columns: [
          col('enrolling', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('occurrenceId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('occurrenceYear', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('requestId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['requestId', 'occurrenceId', 'occurrenceYear'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'ExchangeItem',
        columns: [
          col('accepted', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('fromClassId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('occurrenceId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('occurrenceYear', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('requestId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('toClassId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['requestId', 'userId', 'occurrenceId', 'occurrenceYear'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'ExchangePeriod',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('endsAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('occurrenceId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('occurrenceYear', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('startsAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['occurrenceId', 'occurrenceYear', 'startsAt', 'endsAt'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'ExchangeRequest',
        columns: [
          col('adminState', 'text', {
            notNull: true,
            default: lit('UNTREATED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('creatorId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('hash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lastValidated', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('message', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('targetUserId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'ExchangeRequest_adminState_check_49a4ff70',
            `"adminState" IN ('UNTREATED', 'TREATED', 'REJECTED', 'AWAITING_INFORMATION')`,
          ),
          checkExpression('ExchangeRequest_status_check_a8137f16', `"status" IN ('PENDING', 'ACCEPTED', 'CANCELLED')`),
          checkExpression('ExchangeRequest_type_check_a5efca2d', `"type" IN ('DIRECT', 'MARKETPLACE', 'URGENT')`),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Faculty',
        columns: [
          col('acronym', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['acronym'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'FacultyCourse',
        columns: [
          col('courseId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('facultyId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['facultyId', 'courseId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Occurrence',
        columns: [
          col('courseId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('courseUnitId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('ects', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('hash', 'text', {
            notNull: true,
            default: lit(''),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('url', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('year', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id', 'year'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'PlannerState',
        columns: [
          col('state', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('year', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['userId', 'year'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Professor',
        columns: [
          col('acronym', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'ScheduleSlot',
        columns: [
          col('dayOfWeek', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('durationMin', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('lessonType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('location', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('startMinute', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Session',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['tokenHash'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'SlotClass',
        columns: [
          col('classId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('slotId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['slotId', 'classId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'SlotProfessor',
        columns: [
          col('professorId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('slotId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['slotId', 'professorId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'StudentCourseMetadata',
        columns: [
          col('courseId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('festId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('nmec', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['nmec', 'courseId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'User',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('email', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', {
            notNull: true,
            default: lit('USER'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('User_role_check_16739eb3', `"role" IN ('USER', 'ADMIN', 'SUPERUSER')`),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Class',
        constraint: 'Class_name_occurrenceId_occurrenceYear_key',
        columns: ['name', 'occurrenceId', 'occurrenceYear'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Class',
        constraint: 'Class_id_occurrenceId_occurrenceYear_key',
        columns: ['id', 'occurrenceId', 'occurrenceYear'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Occurrence',
        constraint: 'Occurrence_courseUnitId_year_courseId_key',
        columns: ['courseUnitId', 'year', 'courseId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'User',
        constraint: 'User_email_key',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AdminCourse',
        index: 'AdminCourse_courseId_idx_12f72d2a',
        columns: ['courseId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AdminCourse',
        index: 'AdminCourse_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AdminOccurrence',
        index: 'AdminOccurrence_occurrenceId_occurrenceYear_idx_0f44eca6',
        columns: ['occurrenceId', 'occurrenceYear'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AdminOccurrence',
        index: 'AdminOccurrence_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Class',
        index: 'Class_occurrenceId_occurrenceYear_idx_0f44eca6',
        columns: ['occurrenceId', 'occurrenceYear'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Course',
        index: 'Course_year_idx_0af80557',
        columns: ['year'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CourseUnit',
        index: 'CourseUnit_courseId_idx_12f72d2a',
        columns: ['courseId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Enrollment',
        index: 'Enrollment_classId_idx_0089e5e7',
        columns: ['classId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Enrollment',
        index: 'Enrollment_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EnrollmentRequest',
        index: 'EnrollmentRequest_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EnrollmentRequestOption',
        index: 'EnrollmentRequestOption_occurrenceId_occurrenceYear_id_0f44eca6',
        columns: ['occurrenceId', 'occurrenceYear'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EnrollmentRequestOption',
        index: 'EnrollmentRequestOption_requestId_idx_fd667f92',
        columns: ['requestId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeItem',
        index: 'ExchangeItem_fromClassId_occurrenceId_occurrenceYear_i_a94b3366',
        columns: ['fromClassId', 'occurrenceId', 'occurrenceYear'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeItem',
        index: 'ExchangeItem_occurrenceId_occurrenceYear_idx_0f44eca6',
        columns: ['occurrenceId', 'occurrenceYear'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeItem',
        index: 'ExchangeItem_requestId_idx_fd667f92',
        columns: ['requestId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeItem',
        index: 'ExchangeItem_toClassId_occurrenceId_occurrenceYear_idx_47ff9320',
        columns: ['toClassId', 'occurrenceId', 'occurrenceYear'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeItem',
        index: 'ExchangeItem_userId_accepted_idx_b8232572',
        columns: ['userId', 'accepted'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeItem',
        index: 'ExchangeItem_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangePeriod',
        index: 'ExchangePeriod_occurrenceId_occurrenceYear_idx_0f44eca6',
        columns: ['occurrenceId', 'occurrenceYear'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeRequest',
        index: 'ExchangeRequest_adminState_createdAt_idx_3ef72936',
        columns: ['adminState', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeRequest',
        index: 'ExchangeRequest_creatorId_idx_3a77d800',
        columns: ['creatorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeRequest',
        index: 'ExchangeRequest_creatorId_status_idx_3540b79f',
        columns: ['creatorId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeRequest',
        index: 'ExchangeRequest_hash_idx_d25bc543',
        columns: ['hash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeRequest',
        index: 'ExchangeRequest_targetUserId_idx_e0d638f0',
        columns: ['targetUserId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeRequest',
        index: 'ExchangeRequest_type_status_idx_f045f361',
        columns: ['type', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'FacultyCourse',
        index: 'FacultyCourse_courseId_idx_12f72d2a',
        columns: ['courseId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'FacultyCourse',
        index: 'FacultyCourse_facultyId_idx_ff3b8c32',
        columns: ['facultyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Occurrence',
        index: 'Occurrence_courseId_idx_12f72d2a',
        columns: ['courseId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Occurrence',
        index: 'Occurrence_courseId_year_idx_ae755fc5',
        columns: ['courseId', 'year'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Occurrence',
        index: 'Occurrence_courseUnitId_idx_fae358e6',
        columns: ['courseUnitId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PlannerState',
        index: 'PlannerState_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Session',
        index: 'Session_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Session',
        index: 'Session_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'SlotClass',
        index: 'SlotClass_classId_idx_0089e5e7',
        columns: ['classId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'SlotClass',
        index: 'SlotClass_slotId_idx_4d7c6bc9',
        columns: ['slotId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'SlotProfessor',
        index: 'SlotProfessor_professorId_idx_f17aa655',
        columns: ['professorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'SlotProfessor',
        index: 'SlotProfessor_slotId_idx_4d7c6bc9',
        columns: ['slotId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'StudentCourseMetadata',
        index: 'StudentCourseMetadata_courseId_idx_12f72d2a',
        columns: ['courseId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'StudentCourseMetadata',
        index: 'StudentCourseMetadata_nmec_idx_b0591a9a',
        columns: ['nmec'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AdminCourse',
        foreignKey: {
          name: 'AdminCourse_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AdminCourse',
        foreignKey: {
          name: 'AdminCourse_courseId_fkey',
          columns: ['courseId'],
          references: { schema: 'public', table: 'Course', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AdminOccurrence',
        foreignKey: {
          name: 'AdminOccurrence_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AdminOccurrence',
        foreignKey: {
          name: 'AdminOccurrence_occurrenceId_occurrenceYear_fkey',
          columns: ['occurrenceId', 'occurrenceYear'],
          references: { schema: 'public', table: 'Occurrence', columns: ['id', 'year'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Class',
        foreignKey: {
          name: 'Class_occurrenceId_occurrenceYear_fkey',
          columns: ['occurrenceId', 'occurrenceYear'],
          references: { schema: 'public', table: 'Occurrence', columns: ['id', 'year'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CourseUnit',
        foreignKey: {
          name: 'CourseUnit_courseId_fkey',
          columns: ['courseId'],
          references: { schema: 'public', table: 'Course', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Enrollment',
        foreignKey: {
          name: 'Enrollment_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Enrollment',
        foreignKey: {
          name: 'Enrollment_classId_fkey',
          columns: ['classId'],
          references: { schema: 'public', table: 'Class', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'EnrollmentRequest',
        foreignKey: {
          name: 'EnrollmentRequest_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'EnrollmentRequestOption',
        foreignKey: {
          name: 'EnrollmentRequestOption_requestId_fkey',
          columns: ['requestId'],
          references: { schema: 'public', table: 'EnrollmentRequest', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'EnrollmentRequestOption',
        foreignKey: {
          name: 'EnrollmentRequestOption_occurrenceId_occurrenceYear_fkey',
          columns: ['occurrenceId', 'occurrenceYear'],
          references: { schema: 'public', table: 'Occurrence', columns: ['id', 'year'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ExchangeItem',
        foreignKey: {
          name: 'ExchangeItem_requestId_fkey',
          columns: ['requestId'],
          references: { schema: 'public', table: 'ExchangeRequest', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ExchangeItem',
        foreignKey: {
          name: 'ExchangeItem_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ExchangeItem',
        foreignKey: {
          name: 'ExchangeItem_occurrenceId_occurrenceYear_fkey',
          columns: ['occurrenceId', 'occurrenceYear'],
          references: { schema: 'public', table: 'Occurrence', columns: ['id', 'year'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ExchangeItem',
        foreignKey: {
          name: 'ExchangeItem_fromClassId_occurrenceId_occurrenceYear_fkey',
          columns: ['fromClassId', 'occurrenceId', 'occurrenceYear'],
          references: {
            schema: 'public',
            table: 'Class',
            columns: ['id', 'occurrenceId', 'occurrenceYear'],
          },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ExchangeItem',
        foreignKey: {
          name: 'ExchangeItem_toClassId_occurrenceId_occurrenceYear_fkey',
          columns: ['toClassId', 'occurrenceId', 'occurrenceYear'],
          references: {
            schema: 'public',
            table: 'Class',
            columns: ['id', 'occurrenceId', 'occurrenceYear'],
          },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ExchangePeriod',
        foreignKey: {
          name: 'ExchangePeriod_occurrenceId_occurrenceYear_fkey',
          columns: ['occurrenceId', 'occurrenceYear'],
          references: { schema: 'public', table: 'Occurrence', columns: ['id', 'year'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ExchangeRequest',
        foreignKey: {
          name: 'ExchangeRequest_creatorId_fkey',
          columns: ['creatorId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ExchangeRequest',
        foreignKey: {
          name: 'ExchangeRequest_targetUserId_fkey',
          columns: ['targetUserId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'FacultyCourse',
        foreignKey: {
          name: 'FacultyCourse_facultyId_fkey',
          columns: ['facultyId'],
          references: { schema: 'public', table: 'Faculty', columns: ['acronym'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'FacultyCourse',
        foreignKey: {
          name: 'FacultyCourse_courseId_fkey',
          columns: ['courseId'],
          references: { schema: 'public', table: 'Course', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Occurrence',
        foreignKey: {
          name: 'Occurrence_courseUnitId_fkey',
          columns: ['courseUnitId'],
          references: { schema: 'public', table: 'CourseUnit', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Occurrence',
        foreignKey: {
          name: 'Occurrence_courseId_fkey',
          columns: ['courseId'],
          references: { schema: 'public', table: 'Course', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'PlannerState',
        foreignKey: {
          name: 'PlannerState_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Session',
        foreignKey: {
          name: 'Session_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'SlotClass',
        foreignKey: {
          name: 'SlotClass_slotId_fkey',
          columns: ['slotId'],
          references: { schema: 'public', table: 'ScheduleSlot', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'SlotClass',
        foreignKey: {
          name: 'SlotClass_classId_fkey',
          columns: ['classId'],
          references: { schema: 'public', table: 'Class', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'SlotProfessor',
        foreignKey: {
          name: 'SlotProfessor_slotId_fkey',
          columns: ['slotId'],
          references: { schema: 'public', table: 'ScheduleSlot', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'SlotProfessor',
        foreignKey: {
          name: 'SlotProfessor_professorId_fkey',
          columns: ['professorId'],
          references: { schema: 'public', table: 'Professor', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'StudentCourseMetadata',
        foreignKey: {
          name: 'StudentCourseMetadata_nmec_fkey',
          columns: ['nmec'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'StudentCourseMetadata',
        foreignKey: {
          name: 'StudentCourseMetadata_courseId_fkey',
          columns: ['courseId'],
          references: { schema: 'public', table: 'Course', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ]
  }
}

MigrationCLI.run(import.meta.url, M)
