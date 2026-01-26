import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, index, pgEnum, integer, unique } from "drizzle-orm/pg-core";

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
  id: text("id").primaryKey(),
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

export const user = pgTable(
  "user",
  {
    // identifier
    id: text("id").primaryKey(),
    // user information
    name: text("name").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    role: roleEnum("role").default("TEACHER").notNull(),
    subscription: subscriptionEnum("subscription").default("REGULAR").notNull(),
    // school affiliation
    schoolId: text("school_id").references(() => school.id, { onDelete: "cascade" }),
    academicTermId: text("academic_term_id").references(() => academicTerm.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
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
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    schoolId: text("school_id")
      .notNull()
      .references(() => school.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    unique("class_schoolId_name_key").on(table.schoolId, table.name),
    index("class_schoolId_idx").on(table.schoolId),
  ],
);

// An academic term represents a specific term (FIRST / SECOND / THIRD) for a class in a given academic year.
export const academicTerm = pgTable(
  "academic_term",
  {
    id: text("id").primaryKey(),
    academicYear: text("academic_year").notNull(),
    term: termEnum("term").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    classId: text("class_id")
      .notNull()
      .references(() => classTable.id, { onDelete: "cascade" }),
    schoolId: text("school_id")
      .notNull()
      .references(() => school.id, { onDelete: "cascade" }),
    termDays: integer("term_days"),
    termStart: timestamp("term_start"),
    termEnd: timestamp("term_end"),
    resultTemplateUrl: text("result_template_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    unique("academic_term_classId_academicYear_term_key").on(table.classId, table.academicYear, table.term),
    index("academic_term_userId_idx").on(table.userId),
    index("academic_term_classId_idx").on(table.classId),
    index("academic_term_schoolId_idx").on(table.schoolId),
  ],
);

// Grading rules are term-specific
export const gradingSystem = pgTable(
  "grading_system",
  {
    id: text("id").primaryKey(),
    grade: text("grade").notNull(),
    minScore: integer("min_score").notNull(),
    maxScore: integer("max_score").notNull(),
    remark: text("remark"),
    academicTermId: text("academic_term_id")
      .notNull()
      .references(() => academicTerm.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("grading_system_academicTermId_idx").on(table.academicTermId)],
);

// Defines how assessments are structured for a term (e.g., CA = 30%, Exam = 70%)
export const assessmentStructure = pgTable(
  "assessment_structure",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    percentage: integer("percentage").notNull(),
    order: integer("order").notNull(),
    academicTermId: text("academic_term_id")
      .notNull()
      .references(() => academicTerm.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("assessment_structure_academicTermId_idx").on(table.academicTermId)],
);

// A subject exists within a term and class
export const subject = pgTable(
  "subject",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    academicTermId: text("academic_term_id")
      .notNull()
      .references(() => academicTerm.id, { onDelete: "cascade" }),
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
    id: text("id").primaryKey(),
    firstName: text("first_name").notNull(),
    middleName: text("middle_name"),
    lastName: text("last_name").notNull(),
    dateOfBirth: timestamp("date_of_birth"),
    gender: genderEnum("gender").default("NONE").notNull(),
    department: departmentEnum("department").default("NONE").notNull(),
    daysPresent: integer("days_present"),
    academicTermId: text("academic_term_id")
      .notNull()
      .references(() => academicTerm.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("student_academicTermId_idx").on(table.academicTermId)],
);

// Junction table: students enrolled in a subject
export const studentSubject = pgTable(
  "student_subject",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subject.id, { onDelete: "cascade" }),
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
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subject.id, { onDelete: "cascade" }),
    studentSubjectId: text("student_subject_id")
      .notNull()
      .references(() => studentSubject.id, { onDelete: "cascade" }),
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
    id: text("id").primaryKey(),
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

// Relations
export const schoolRelations = relations(school, ({ many }) => ({
  users: many(user),
  classes: many(classTable),
  academicTerms: many(academicTerm),
}));

export const userRelations = relations(user, ({ one, many }) => ({
  school: one(school, {
    fields: [user.schoolId],
    references: [school.id],
  }),
  academicTerm: one(academicTerm, {
    fields: [user.academicTermId],
    references: [academicTerm.id],
  }),
  sessions: many(session),
  accounts: many(account),
}));

export const classRelations = relations(classTable, ({ one, many }) => ({
  school: one(school, {
    fields: [classTable.schoolId],
    references: [school.id],
  }),
  academicTerms: many(academicTerm),
}));

export const academicTermRelations = relations(academicTerm, ({ one, many }) => ({
  user: one(user, {
    fields: [academicTerm.userId],
    references: [user.id],
  }),
  class: one(classTable, {
    fields: [academicTerm.classId],
    references: [classTable.id],
  }),
  school: one(school, {
    fields: [academicTerm.schoolId],
    references: [school.id],
  }),
  gradingSystem: many(gradingSystem),
  assessmentStructure: many(assessmentStructure),
  subjects: many(subject),
  students: many(student),
  assessments: many(assessment),
}));

export const gradingSystemRelations = relations(gradingSystem, ({ one }) => ({
  academicTerm: one(academicTerm, {
    fields: [gradingSystem.academicTermId],
    references: [academicTerm.id],
  }),
}));

export const assessmentStructureRelations = relations(assessmentStructure, ({ one, many }) => ({
  academicTerm: one(academicTerm, {
    fields: [assessmentStructure.academicTermId],
    references: [academicTerm.id],
  }),
  subjects: many(subject),
  scores: many(assessmentScore),
}));

export const subjectRelations = relations(subject, ({ one, many }) => ({
  academicTerm: one(academicTerm, {
    fields: [subject.academicTermId],
    references: [academicTerm.id],
  }),
  assessmentStructure: one(assessmentStructure, {
    fields: [subject.assessmentStructureId],
    references: [assessmentStructure.id],
  }),
  students: many(studentSubject),
  assessments: many(assessment),
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
