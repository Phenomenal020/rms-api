// This file defines the database schema wiith pgTable() functions.

import { relations, sql } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, index, pgEnum, integer, unique, check } from "drizzle-orm/pg-core";

// Enums
// Gender for students
export const genderEnum = pgEnum("gender", ["NONE", "MALE", "FEMALE"]);

// Academic term within a school year
export const termEnum = pgEnum("term", ["FIRST", "SECOND", "THIRD"]);

// User roles (teachers and admins)
export const roleEnum = pgEnum("role", ["TEACHER", "ADMIN"]);

// Subscription tier
export const subscriptionEnum = pgEnum("subscription", ["REGULAR", "PRO"]);

// Student department / stream
export const departmentEnum = pgEnum("department", ["NONE", "SCIENCE", "ARTS", "GENERAL"]);

// A school is the top-level organisational unit
export const school = pgTable("school", {
  // identifier
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  // school information
  schoolName: text("school_name").notNull(),
  schoolAddress: text("school_address"),
  schoolMotto: text("school_motto"),
  schoolTelephone: text("school_telephone"),
  schoolEmail: text("school_email"),
  // date management
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// A user === a teacher
export const user = pgTable(
  "user",
  {
    // identifier
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    // user information
    name: text("name").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    role: roleEnum("role").default("TEACHER").notNull(),
    subscription: subscriptionEnum("subscription").default("REGULAR").notNull(),
    // school affiliation (one user record has one school using schoolId)
    schoolId: text("school_id").references(() => school.id, { onDelete: "cascade" }),
    // academic term affiliation (one user record to one academic term using academicTermId)
    academicTermId: text("academic_term_id").references(() => academicTerm.id, { onDelete: "set null" }),
    // date management
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    // Justification (school has >100 users, )
    // Possible patterns: 1) Get all users for a school 
    // 2) Filter users by school
    // 3) Check if user has a school
    // 4) Get all users for an academic term (maybe all teachers for that term)

    // Use Case (Todo: School Admin wants to view all teachers for their school)
    // Todo: School Admin wants to view all teachers for a specific academic term
    index("user_schoolId_idx").on(table.schoolId),
    index("user_academicTermId_idx").on(table.academicTermId),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// A class is a persistent entity within a school. It exists across years and terms.
export const classTable = pgTable(
  "class",
  {
    // identifier
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    // class information
    name: text("name").notNull(),
    // school affiliation (one class record has one school using schoolId)
    schoolId: text("school_id")
      .notNull()
      .references(() => school.id, { onDelete: "cascade" }),
    // date management
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    // Justification (class name must be unique within a school eg, no two JSS1Bs)
    unique("class_schoolId_name_key").on(table.schoolId, table.name),
    //  Index for querying classes by school
    // Case study: 1) Get all classes for a school
    // 2) Filter classes by school
    // 3) Count classes for a school
    index("class_schoolId_idx").on(table.schoolId),
  ],
);

// An academic term represents a specific term (FIRST / SECOND / THIRD) for a class in a given academic year.
export const academicTerm = pgTable(
  "academic_term",
  {
    // identifier
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    // academic term information
    academicYear: text("academic_year").notNull(),
    term: termEnum("term").notNull(),
    termDays: integer("term_days"),
    termStart: timestamp("term_start"),
    termEnd: timestamp("term_end"),
    // term information
    resultTemplateUrl: text("result_template_url"), // for pro users
    // user affiliation (one to one using userId)
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // class affiliation (one to one using classId)
    classId: text("class_id")
      .notNull()
      .references(() => classTable.id, { onDelete: "cascade" }),
    // school affiliation (one to one using schoolId)
    schoolId: text("school_id")
      .notNull()
      .references(() => school.id, { onDelete: "cascade" }),
    // date management
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    // Justification: One term per class per year 
    unique("academic_term_classId_academicYear_term_key").on(table.classId, table.academicYear, table.term),
    //  Index for querying academic terms by user, class, school
    // Justifications: Frequently accessed columns
    // - userId: Get all academic terms for a user
    // - schoolId: Get all academic terms for a school
    index("academic_term_userId_idx").on(table.userId),
    index("academic_term_classId_idx").on(table.classId),
    index("academic_term_schoolId_idx").on(table.schoolId),
  ],
);

// Grading rules are term-specific
export const gradingEntry = pgTable(
  "grading_entry",
  {
    // identifier
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    // grading entry information
    grade: text("grade").notNull(),
    minScore: integer("min_score").notNull(),
    maxScore: integer("max_score").notNull(),
    remark: text("remark"),
    // academic term affiliation (one grading entry to one academic term using academicTermId)
    academicTermId: text("academic_term_id")
      .notNull()
      .references(() => academicTerm.id, { onDelete: "cascade" }),
    // date management
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    // Justification: Get grading entry for an academic term
    index("grading_entry_academicTermId_idx").on(table.academicTermId),
    // Justification: Each grade (A, B, C, etc.) should be unique per academic term
    // Prevents duplicate grades like having two "A" entries for the same term
    unique("grading_entry_academicTermId_grade_key").on(table.academicTermId, table.grade),
    // Justification: Ensure minScore is less than or equal to maxScore
    // Prevents invalid score ranges like minScore=80, maxScore=70
    check("grading_entry_min_max_score_check", sql`min_score <= max_score`),
    // Justification: Ensure scores are within valid range (0-100)
    check("grading_entry_score_range_check", sql`min_score >= 0 AND max_score <= 100`),
  ],
);

// Defines how assessments are structured for a term (e.g., CA = 30%, Exam = 70%). It is a resuable entity
export const assessmentStructure = pgTable(
  "assessment_structure",
  {
    // identifier
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    // assessment structure information
    type: text("type").notNull(), // e.g., CA, Exam
    percentage: integer("percentage").notNull(), // e.g., 30
    order: integer("order").notNull(), // e.g., 1
    // academic term affiliation (one assessment structure to one academic term using academicTermId)
    academicTermId: text("academic_term_id")
      .notNull()
      .references(() => academicTerm.id, { onDelete: "cascade" }),
    // date management
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  // Justification: Get assessment structure for an academic term
  (table) => [index("assessment_structure_academicTermId_idx").on(table.academicTermId)],
);

// A subject exists within a term and class
export const subject = pgTable(
  "subject",
  {
    // identifier
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    // subject information
    name: text("name").notNull(),
    // academic term affiliation (one subject is mapped to one academic term using academicTermId)
    academicTermId: text("academic_term_id")
      .notNull()
      .references(() => academicTerm.id, { onDelete: "cascade" }),
    // assessment structure affiliation (one subject is mapped to one assessment structure using assessmentStructureId). Ie, each subject does not have its own assessment structure.
    assessmentStructureId: text("assessment_structure_id").references(() => assessmentStructure.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("subject_academicTermId_idx").on(table.academicTermId),
    index("subject_assessmentStructureId_idx").on(table.assessmentStructureId),
  ],
);

// A student exists within a specific academic term
export const student = pgTable(
  "student",
  {
    // identifier
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    // student information
    firstName: text("first_name").notNull(),
    middleName: text("middle_name"),
    lastName: text("last_name").notNull(),
    dateOfBirth: timestamp("date_of_birth"),
    gender: genderEnum("gender").default("NONE").notNull(),
    department: departmentEnum("department").default("NONE").notNull(),
    daysPresent: integer("days_present"),
    // academic term affiliation (one student record is scoped to one academic term using academicTermId)
    academicTermId: text("academic_term_id")
      .notNull()
      .references(() => academicTerm.id, { onDelete: "cascade" }),
    // date management
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  // Justification: Get students for an academic term
  (table) => [index("student_academicTermId_idx").on(table.academicTermId)],
);

// Junction table: students enrolled in a subject
export const studentSubject = pgTable(
  "student_subject",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    // if a student is deleted, prevent deletion if enrollments exist.
    studentId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "restrict" }),
    // if a subject is deleted (hard delete), prevent deletion if enrollments exist
    subjectId: text("subject_id")
      .notNull()
      .references(() => subject.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    unique("student_subject_studentId_subjectId_key").on(table.studentId, table.subjectId),
    index("student_subject_studentId_idx").on(table.studentId),
    index("student_subject_subjectId_idx").on(table.subjectId),
  ],
);

// One assessment per student–subject–term
export const assessment = pgTable(
  "assessment",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    // if a student is deleted,their assessments should not be removed (restrict)
    studentId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "restrict" }),
    // if a subject is deleted (hard delete), prevent deletion if assessments exist
    subjectId: text("subject_id")
      .notNull()
      .references(() => subject.id, { onDelete: "restrict" }),
    // if a student enrollment in a subject is deleted, prevent deletion if assessments exist (restrict)
    // This prevents data loss - assessments must be deleted manually or student must be removed from assessments first
    studentSubjectId: text("student_subject_id")
      .notNull()
      .references(() => studentSubject.id, { onDelete: "restrict" }),
    academicTermId: text("academic_term_id")
      .notNull()
      .references(() => academicTerm.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    unique("assessment_studentId_subjectId_academicTermId_key").on(
      table.studentId,
      table.subjectId,
      table.academicTermId,
    ),
    index("assessment_studentId_idx").on(table.studentId),
    index("assessment_subjectId_idx").on(table.subjectId),
    index("assessment_academicTermId_idx").on(table.academicTermId),
    index("assessment_studentSubjectId_idx").on(table.studentSubjectId),
    index("assessment_studentId_academicTermId_idx").on(table.studentId, table.academicTermId),
  ],
);

// Individual score entries per assessment type
export const assessmentScore = pgTable(
  "assessment_score",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    // if an assessment is deleted, delete the scores as well.
    assessmentId: text("assessment_id")
      .notNull()
      .references(() => assessment.id, { onDelete: "cascade" }),
    assessmentStructureId: text("assessment_structure_id")
      .notNull()
      .references(() => assessmentStructure.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    unique("assessment_score_assessmentId_assessmentStructureId_key").on(
      table.assessmentId,
      table.assessmentStructureId,
    ),
    index("assessment_score_assessmentId_idx").on(table.assessmentId),
    index("assessment_score_assessmentStructureId_idx").on(table.assessmentStructureId),
  ],
);

// Summary: A School has many users, classes, academic terms
export const schoolRelations = relations(school, ({ many }) => ({
  users: many(user), // school.users → get all users for a school
  classes: many(classTable), // school.classes → get all classes for a school
  academicTerms: many(academicTerm), // school.academicTerms → get all academic terms for a school
}));

// Summary: A User has one school, one academic term, many sessions, many accounts
export const userRelations = relations(user, ({ one, many }) => ({
  school: one(school, {
    fields: [user.schoolId],
    references: [school.id],
  }), // user.school → get the school for a user
  academicTerm: one(academicTerm, {
    fields: [user.academicTermId],
    references: [academicTerm.id],
  }), // user.academicTerm → get the academic term for a user
  sessions: many(session), // user.sessions → get all sessions for a user
  accounts: many(account), // user.accounts → get all accounts for a user
}));

// Summary: A Class has one school and can exist across many academic terms
export const classRelations = relations(classTable, ({ one, many }) => ({
  school: one(school, {
    fields: [classTable.schoolId],
    references: [school.id],
  }), // class.school → get the school for a class
  academicTerms: many(academicTerm), // class.academicTerms → get all academic terms for a class
}));

// Summary: An Academic term record is scoped to one user, one class, one school, many grading entries, many assessment structures, many subjects, many students, many assessments
export const academicTermRelations = relations(academicTerm, ({ one, many }) => ({
  user: one(user, {
    fields: [academicTerm.userId],
    references: [user.id],
  }), // academicTerm.user → get the user for an academic term
  class: one(classTable, {
    fields: [academicTerm.classId],
    references: [classTable.id],
  }), // academicTerm.class → get the class for an academic term
  school: one(school, {
    fields: [academicTerm.schoolId],
    references: [school.id],
  }), // academicTerm.school → get the school for an academic term
  gradingEntry: many(gradingEntry), // academicTerm.gradingEntry → get all grading entries for an academic term
  assessmentStructure: many(assessmentStructure), // academicTerm.assessmentStructure → get all assessment structures for an academic term
  subjects: many(subject), // academicTerm.subjects → get all subjects for an academic term
  students: many(student), // academicTerm.students → get all students for an academic term
  assessments: many(assessment), // academicTerm.assessments → get all assessments for an academic term
}));

// Summary: A Grading entry in one academic term. Multiple grading entries can exist for an academic term.
export const gradingEntryRelations = relations(gradingEntry, ({ one }) => ({
  academicTerm: one(academicTerm, {
    fields: [gradingEntry.academicTermId],
    references: [academicTerm.id],
  }), // gradingEntry.academicTerm → get the academic term for a grading entry
}));

// Summary: Assessment structure has one academic term, many subjects, many scores. It is a resuable entity.
export const assessmentStructureRelations = relations(assessmentStructure, ({ one, many }) => ({
  academicTerm: one(academicTerm, {
    fields: [assessmentStructure.academicTermId],
    references: [academicTerm.id],
  }), // assessmentStructure.academicTerm → get the academic term for an assessment structure
  subjects: many(subject), // assessmentStructure.subjects → get all subjects for an assessment structure
  scores: many(assessmentScore), // assessmentStructure.scores → get all scores for an assessment structure
}));

export const subjectRelations = relations(subject, ({ one, many }) => ({
  academicTerm: one(academicTerm, {
    fields: [subject.academicTermId],
    references: [academicTerm.id],
  }), // subject.academicTerm → get the academic term for a subject
  assessmentStructure: one(assessmentStructure, {
    fields: [subject.assessmentStructureId],
    references: [assessmentStructure.id],
  }), // subject.assessmentStructure → get the assessment structure for a subject
  students: many(studentSubject), // subject.students → get all students for a subject
  assessments: many(assessment), // subject.assessments → get all assessments for a subject
}));

export const studentRelations = relations(student, ({ one, many }) => ({
  academicTerm: one(academicTerm, {
    fields: [student.academicTermId],
    references: [academicTerm.id],
  }),
  subjects: many(studentSubject),
  assessments: many(assessment),
}));

export const studentSubjectRelations = relations(studentSubject, ({ one, many }) => ({
  student: one(student, {
    fields: [studentSubject.studentId],
    references: [student.id],
  }),
  subject: one(subject, {
    fields: [studentSubject.subjectId],
    references: [subject.id],
  }),
  assessments: many(assessment),
}));

export const assessmentRelations = relations(assessment, ({ one, many }) => ({
  student: one(student, {
    fields: [assessment.studentId],
    references: [student.id],
  }),
  subject: one(subject, {
    fields: [assessment.subjectId],
    references: [subject.id],
  }),
  studentSubject: one(studentSubject, {
    fields: [assessment.studentSubjectId],
    references: [studentSubject.id],
  }),
  academicTerm: one(academicTerm, {
    fields: [assessment.academicTermId],
    references: [academicTerm.id],
  }),
  scores: many(assessmentScore),
}));

export const assessmentScoreRelations = relations(assessmentScore, ({ one }) => ({
  assessment: one(assessment, {
    fields: [assessmentScore.assessmentId],
    references: [assessment.id],
  }),
  assessmentStructure: one(assessmentStructure, {
    fields: [assessmentScore.assessmentStructureId],
    references: [assessmentStructure.id],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));
