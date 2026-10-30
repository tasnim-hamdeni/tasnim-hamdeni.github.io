-- Tasnim Classroom: MySQL 8 preparation only. Not deployed.
-- Export/import rows privately; provision fresh authentication credentials.
-- No production records, sessions, or OAuth secrets are included here.

CREATE TABLE `lms_teachers` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(320) NOT NULL DEFAULT '',
  `code_hash` CHAR(64) NULL,
  `created` VARCHAR(255) NOT NULL,
  UNIQUE KEY `lms_teachers_unique_0` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_years` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `starts` VARCHAR(255) NOT NULL,
  `active` BIGINT NOT NULL DEFAULT 0,
  `created` VARCHAR(255) NOT NULL,
  UNIQUE KEY `lms_years_unique_0` (`teacher_id`,`label`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_courses` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `year_id` VARCHAR(100) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `position` BIGINT NOT NULL DEFAULT 0,
  `archived` BIGINT NOT NULL DEFAULT 0,
  `created` VARCHAR(255) NOT NULL,
  KEY `lms_courses_index_0` (`teacher_id`,`year_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_chapters` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `course_id` VARCHAR(100) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `position` BIGINT NOT NULL DEFAULT 0,
  `status` VARCHAR(255) NOT NULL DEFAULT 'hidden',
  `publish_at` VARCHAR(255) NULL,
  `deleted` BIGINT NOT NULL DEFAULT 0,
  `created` VARCHAR(255) NOT NULL,
  KEY `lms_chapters_index_0` (`teacher_id`,`course_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_documents` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `chapter_id` VARCHAR(100) NOT NULL,
  `file_id` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `status` VARCHAR(255) NOT NULL DEFAULT 'hidden',
  `publish_at` VARCHAR(255) NULL,
  `position` BIGINT NOT NULL DEFAULT 0,
  `example` BIGINT NOT NULL DEFAULT 0,
  `deleted` BIGINT NOT NULL DEFAULT 0,
  `created` VARCHAR(255) NOT NULL,
  KEY `lms_documents_index_0` (`teacher_id`,`chapter_id`),
  KEY `lms_documents_index_1` (`teacher_id`,`file_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_students` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `first_name` VARCHAR(255) NOT NULL,
  `last_name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(320) NOT NULL,
  `active` BIGINT NOT NULL DEFAULT 1,
  `created` VARCHAR(255) NOT NULL,
  UNIQUE KEY `lms_students_unique_0` (`teacher_id`,`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_enrollments` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `student_id` VARCHAR(100) NOT NULL,
  `year_id` VARCHAR(100) NOT NULL,
  `course_id` VARCHAR(100) NOT NULL,
  `status` VARCHAR(255) NOT NULL DEFAULT 'active',
  `code_hash` CHAR(64) NOT NULL,
  `code_version` BIGINT NOT NULL DEFAULT 1,
  `created` VARCHAR(255) NOT NULL,
  UNIQUE KEY `lms_enrollments_unique_0` (`student_id`,`year_id`),
  UNIQUE KEY `lms_enrollments_unique_1` (`code_hash`),
  KEY `lms_enrollments_index_0` (`teacher_id`,`year_id`,`course_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_sessions` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `role` VARCHAR(255) NOT NULL,
  `student_id` VARCHAR(100) NULL,
  `enrollment_id` VARCHAR(100) NULL,
  `code_version` BIGINT NULL,
  `expires` BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_settings` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `value` MEDIUMTEXT NOT NULL,
  UNIQUE KEY `lms_settings_unique_0` (`teacher_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_announcements` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `year_id` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `body` MEDIUMTEXT NOT NULL,
  `course_ids` MEDIUMTEXT NOT NULL,
  `status` VARCHAR(255) NOT NULL DEFAULT 'draft',
  `publish_at` VARCHAR(255) NULL,
  `attachments` MEDIUMTEXT NOT NULL DEFAULT ('[]'),
  `created` VARCHAR(255) NOT NULL,
  `updated` VARCHAR(255) NOT NULL,
  KEY `lms_announcements_index_0` (`teacher_id`,`year_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_announcement_reads` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `announcement_id` VARCHAR(100) NOT NULL,
  `enrollment_id` VARCHAR(100) NOT NULL,
  `read_at` VARCHAR(255) NOT NULL,
  UNIQUE KEY `lms_announcement_reads_unique_0` (`announcement_id`,`enrollment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_attendance_sessions` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `course_id` VARCHAR(100) NOT NULL,
  `year_id` VARCHAR(100) NOT NULL,
  `date` VARCHAR(255) NOT NULL,
  `time` VARCHAR(255) NOT NULL DEFAULT '',
  `title` VARCHAR(255) NOT NULL DEFAULT '',
  `finalized` BIGINT NOT NULL DEFAULT 0,
  `revision` BIGINT NOT NULL DEFAULT 1,
  `created` VARCHAR(255) NOT NULL,
  `write_token` VARCHAR(255) NOT NULL DEFAULT '',
  KEY `lms_attendance_sessions_index_0` (`teacher_id`,`year_id`,`course_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_attendance_records` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `session_id` VARCHAR(100) NOT NULL,
  `student_id` VARCHAR(100) NOT NULL,
  `status` VARCHAR(255) NOT NULL,
  `note` VARCHAR(255) NOT NULL DEFAULT '',
  `updated` VARCHAR(255) NOT NULL,
  UNIQUE KEY `lms_attendance_records_unique_0` (`session_id`,`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_assignments` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `course_id` VARCHAR(100) NOT NULL,
  `year_id` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `body` MEDIUMTEXT NOT NULL DEFAULT (''),
  `deadline` VARCHAR(255) NULL,
  `status` VARCHAR(255) NOT NULL DEFAULT 'draft',
  `max_file_bytes` BIGINT NOT NULL DEFAULT 10485760,
  `max_total_bytes` BIGINT NOT NULL DEFAULT 52428800,
  `allow_late` BIGINT NOT NULL DEFAULT 0,
  `allow_replace` BIGINT NOT NULL DEFAULT 1,
  `groups` BIGINT NOT NULL DEFAULT 0,
  `created` VARCHAR(255) NOT NULL,
  KEY `lms_assignments_index_0` (`teacher_id`,`year_id`,`course_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_submissions` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `assignment_id` VARCHAR(100) NOT NULL,
  `enrollment_id` VARCHAR(100) NOT NULL,
  `member_ids` MEDIUMTEXT NOT NULL DEFAULT ('[]'),
  `submitted_at` VARCHAR(255) NOT NULL,
  `late` BIGINT NOT NULL DEFAULT 0,
  `feedback` VARCHAR(255) NOT NULL DEFAULT '',
  `grade` VARCHAR(255) NOT NULL DEFAULT '',
  `retention_exempt` BIGINT NOT NULL DEFAULT 0,
  `group_id` VARCHAR(100) NULL,
  UNIQUE KEY `lms_submissions_unique_0` (`assignment_id`,`enrollment_id`),
  KEY `lms_submissions_index_0` (`teacher_id`,`group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_submission_files` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `submission_id` VARCHAR(100) NOT NULL,
  `file_id` VARCHAR(100) NOT NULL,
  `created` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_files` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `category` VARCHAR(255) NOT NULL,
  `year_id` VARCHAR(100) NOT NULL,
  `course_id` VARCHAR(100) NOT NULL,
  `parent_id` VARCHAR(100) NOT NULL,
  `enrollment_id` VARCHAR(100) NULL,
  `name` VARCHAR(255) NOT NULL,
  `mime` VARCHAR(255) NOT NULL,
  `size` BIGINT NOT NULL,
  `provider` VARCHAR(255) NOT NULL,
  `storage_key` MEDIUMTEXT NOT NULL DEFAULT (''),
  `status` VARCHAR(255) NOT NULL DEFAULT 'pending',
  `created` VARCHAR(255) NOT NULL,
  KEY `lms_files_index_0` (`teacher_id`,`category`,`year_id`),
  KEY `lms_files_index_1` (`teacher_id`,`parent_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_templates` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `columns_json` MEDIUMTEXT NOT NULL,
  `original_file_id` VARCHAR(100) NULL,
  `version` BIGINT NOT NULL DEFAULT 1,
  `created` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_sheets` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `template_id` VARCHAR(100) NOT NULL,
  `course_id` VARCHAR(100) NOT NULL,
  `year_id` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `columns_json` MEDIUMTEXT NOT NULL,
  `status` VARCHAR(255) NOT NULL DEFAULT 'hidden',
  `opens_at` VARCHAR(255) NULL,
  `closes_at` VARCHAR(255) NULL,
  `created` VARCHAR(255) NOT NULL,
  UNIQUE KEY `lms_sheets_unique_0` (`template_id`,`course_id`,`year_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_project_entries` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `sheet_id` VARCHAR(100) NOT NULL,
  `enrollment_id` VARCHAR(100) NOT NULL,
  `member_ids` MEDIUMTEXT NOT NULL DEFAULT ('[]'),
  `values_json` MEDIUMTEXT NOT NULL,
  `revision` BIGINT NOT NULL DEFAULT 1,
  `deleted` BIGINT NOT NULL DEFAULT 0,
  `updated` VARCHAR(255) NOT NULL,
  `group_id` VARCHAR(100) NULL,
  UNIQUE KEY `lms_project_entries_unique_0` (`sheet_id`,`enrollment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_project_history` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `entry_id` VARCHAR(100) NOT NULL,
  `actor_id` VARCHAR(100) NOT NULL,
  `before_json` MEDIUMTEXT NOT NULL,
  `after_json` MEDIUMTEXT NOT NULL,
  `revision` BIGINT NOT NULL,
  `created` VARCHAR(255) NOT NULL,
  UNIQUE KEY `lms_project_history_unique_0` (`entry_id`,`revision`),
  KEY `lms_project_history_index_0` (`teacher_id`,`entry_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_exceptions` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `parent_id` VARCHAR(100) NOT NULL,
  `enrollment_id` VARCHAR(100) NOT NULL,
  `closes_at` VARCHAR(255) NOT NULL,
  UNIQUE KEY `lms_exceptions_unique_0` (`parent_id`,`enrollment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_jobs` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `kind` VARCHAR(255) NOT NULL,
  `job_key` VARCHAR(255) NOT NULL,
  `payload` MEDIUMTEXT NOT NULL,
  `status` VARCHAR(255) NOT NULL DEFAULT 'pending',
  `attempts` BIGINT NOT NULL DEFAULT 0,
  `next_run` VARCHAR(255) NOT NULL,
  `result` MEDIUMTEXT NOT NULL DEFAULT ('{}'),
  `created` VARCHAR(255) NOT NULL,
  UNIQUE KEY `lms_jobs_unique_0` (`job_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_oauth_states` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `verifier` VARCHAR(255) NOT NULL,
  `expires` BIGINT NOT NULL,
  `provider` VARCHAR(255) NOT NULL DEFAULT 'onedrive'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_groups` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `parent_id` VARCHAR(100) NOT NULL,
  `kind` VARCHAR(255) NOT NULL,
  `course_id` VARCHAR(100) NOT NULL,
  `year_id` VARCHAR(100) NOT NULL,
  `owner_enrollment_id` VARCHAR(100) NOT NULL,
  `member_ids` MEDIUMTEXT NOT NULL,
  `invite_hash` CHAR(64) NOT NULL,
  `created` VARCHAR(255) NOT NULL,
  UNIQUE KEY `lms_groups_unique_0` (`invite_hash`),
  KEY `lms_groups_index_0` (`teacher_id`,`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `lms_group_memberships` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(100) NOT NULL,
  `parent_id` VARCHAR(100) NOT NULL,
  `group_id` VARCHAR(100) NOT NULL,
  `enrollment_id` VARCHAR(100) NOT NULL,
  UNIQUE KEY `lms_group_memberships_unique_0` (`parent_id`,`enrollment_id`),
  KEY `lms_group_memberships_index_0` (`teacher_id`,`group_id`,`enrollment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

