import { relations, sql } from "drizzle-orm";
import {pgTable, text, timestamp, boolean, index, pgEnum, integer, unique, check, uniqueIndex, varchar, json, jsonb, serial} from "drizzle-orm/pg-core";

// ENUMS
// Gender for students
export const genderEnum = pgEnum("gender", ["NONE", "MALE", "FEMALE"]);

// Academic term within a school year
export const termEnum = pgEnum("term", ["FIRST", "SECOND", "THIRD"]);

// Academic term status
export const academicTermStatusEnum = pgEnum("academic_term_status", ["DRAFT", "ACTIVE", "ARCHIVED"]);

// Student status
export const studentStatusEnum = pgEnum("student_status", ["ACTIVE", "SUSPENDED", "INACTIVE"]);

// Class record export: teacher submits a snapshot for org-admin approval
export const classRecordExportStatusEnum = pgEnum("class_record_export_status", ["PENDING", "ACCEPTED", "REJECTED"]);


// ***********************************************************************************
// LEVEL 1: ORGANISATIONAL LEVEL (SCHOOL AND MEMBERS -TEACHERS AND ADMINS)
// Better Auth organisation plugin — represents a school.
export const organization = pgTable(
  "organization",
  {
    // Better Auth base fields
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),           // === school name
    slug: text("slug").notNull().unique(),  // === schoolRegistrationId
    logo: text("logo"),
    // Subscription tier lives at the school level (REGULAR or PRO)
    subscription: text("subscription").default("REGULAR"),
    // audit
    createdAt: timestamp("created_at").notNull(),
    metadata: json("metadata"),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (table) => [
    uniqueIndex("organization_slug_uidx").on(table.slug), // must be unique
  ],
);

// User Management by Better Auth
// A user === a teacher or admin. 
export const user = pgTable("user", {
  // Better Auth base fields
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  // twoFactor plugin field
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  // // Additional fields (declared in auth-setup.ts additionalFields)
  firstName: text("first_name"),
  lastName: text("last_name"),
  // admin plugin fields
  role: text("role"),   // role: "TEACHER" | "ADMIN" 
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  // audit
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => /* @__PURE__ */ new Date()),
});

// Session management
export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => /* @__PURE__ */ new Date()).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Organisation plugin — tracks which school the session is currently active for
    activeOrganizationId: text("active_organization_id"),
    // admin plugin — set when an admin is impersonating another user
    impersonatedBy: text("impersonated_by"),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

// Account management
export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").$onUpdate(() => /* @__PURE__ */ new Date()).notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

// Verification management
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()).notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// Required by better-auth twoFactor plugin — stores TOTP secret and backup codes per user
export const twoFactor = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("twoFactor_secret_idx").on(table.secret),
    index("twoFactor_userId_idx").on(table.userId),
  ],
);

// Organisation Plugin Tables
//  member     → represents a teacher (or admin) within a school (added by admin)
//  invitation → admin can send an invitation to a teacher by email 
// member.role: "teacher" | "admin" (custom roles defined in auth-setup.ts)
// STATUS FLOW: only one member with role="orgadmin" is allowed per organisation (partial unique index)
export const member = pgTable(
  "member",
  {
    // identifier
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    // organisation affiliation (1-1 mapping)
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "restrict" }),
    // user affiliation (1-1 mapping)
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
    // role in the organisation (assigned on acceptance: "teacher" | "admin")
    role: text("role").default("member").notNull(),
    // audit
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
    // Enforce one admin per school at the database level
    uniqueIndex("member_organization_admin_unique").on(table.organizationId).where(sql`role = 'orgadmin'`),
  ],
);

// An admin invites a teacher by email; on acceptance, a member record is automatically created.
// STATUS FLOW: pending → accepted | rejected | cancelled
export const invitation = pgTable(
  "invitation",
  {
    // identifier
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    // organisation affiliation (1-1 mapping)
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "restrict" }),
    // email of the teacher to invite
    email: text("email").notNull(),
    role: text("role").default("teacher").notNull(),    // role to assign on acceptance: "teacher" | "admin"
    // status of the invitation: "pending" | "accepted" | "rejected" | "cancelled"
    status: text("status").default("pending").notNull(),
    // audit
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    inviterId: text("inviter_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("invitation_organizationId_idx").on(table.organizationId),
    index("invitation_email_idx").on(table.email),
  ],
);



// ***********************************************************************************
// LEVEL 2: SCHOOL-SCOPED TABLES (custom) - Consistent across terms — scoped to an organisation (school).
// Organisation class. Many-to-one: many classes exists in one organisation.
export const organisationClass = pgTable(
  "class",
  {
    // identifier
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    // organisation affiliation (1-1 mapping)
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "restrict" }),
    // name of the class
    name: text("name").notNull(),
    // Form teacher for the class
    formTeacherId: text("form_teacher_id").references(() => user.id, { onDelete: "restrict" }),
    // audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (table) => [
    unique("organisationClass_organizationId_name_key").on(table.organizationId, table.name), // one class per organisation/school
    index("organisationClass_organizationId_idx").on(table.organizationId),
    index("organisationClass_formTeacherId_idx").on(table.formTeacherId),
  ],
);

// Associate a subject to a school across terms and classes (the permanent entity)
export const subject = pgTable(
  "subject",
  {
    // identifier
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    // subject information
    name: varchar("name", { length: 128 }).notNull(),
    department: varchar("department", { length: 128 }),
    // organisation affiliation (one subject is mapped to one organisation using organisationId)
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "restrict" }),
    // audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (table) => [
    unique("subject_organizationId_name_key").on(table.organizationId, table.name),  // unique subject name per organisation
    index("subject_organizationId_idx").on(table.organizationId),
  ],
);


// A student exists within a school for a specific term and class
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
    status: studentStatusEnum("status").default("ACTIVE").notNull(),
    // class assignment — current class (fast operational query); previous assignments stored in classHistory
    classId: text("class_id").references(() => organisationClass.id, { onDelete: "set null" }),
    // append-only JSON audit log — each entry records a class the student was previously assigned to
    classHistory: json("class_history"),
    // organisation (school) affiliation (1-1 mapping)
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "restrict" }),
    // audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (table) => [
    index("student_organizationId_idx").on(table.organizationId),
    index("student_classId_idx").on(table.classId),
  ],
);



// ***********************************************************************************
// LEVEL 3: TERM-SCOPED TABLES (across classes)
// An academic term represents a specific term (FIRST / SECOND / THIRD) for a school in a given academic year.
export const academicTerm = pgTable(
  "academic_term",
  {
    // identifier
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    // academic year and term (immutable)
    academicYear: text("academic_year").notNull(), // immutable
    term: termEnum("term").notNull(),              // immutable
    // term days, start and end dates (mutable)
    termDays: integer("term_days"),
    termStart: timestamp("term_start"),
    termEnd: timestamp("term_end"),
    // Auditing
    status: academicTermStatusEnum("status").default("DRAFT").notNull(), // score locking
    templateSchema: json("template_schema"), // template schema for report cards (pro users)
    templateUrl: text("template_url"), // URL to the generated template file (pro users)
    // organisation (school) affiliation (1-1 mapping)
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "restrict" }),
    // audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (table) => [
    unique("academic_term_organizationId_academicYear_term_key").on(table.organizationId, table.academicYear, table.term), // one term per year per organisation/school
    check("academic_term_termStart_termEnd_check", sql`term_start < term_end`),
    index("academic_term_organizationId_idx").on(table.organizationId),
    index("academic_term_organizationId_status_idx").on(table.organizationId, table.status),
    uniqueIndex("academic_term_organizationId_active_unique").on(table.organizationId).where(sql`status = 'ACTIVE'`), // no two active terms per school
  ],
);
// DRAFT    → ACTIVE   : admin activates the term, teachers can now enter scores
// ACTIVE   → ARCHIVED : admin archives the term, scores locked, report cards generated


// Grading rules are school-specific and term-specific
export const gradingEntry = pgTable(
  "grading_entry",
  {
    // identifier
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    // grade information
    grade: text("grade").notNull(),
    minScore: integer("min_score").notNull(),
    maxScore: integer("max_score").notNull(),
    remark: text("remark"),
    // academic term affiliation (1-1 mapping)
    academicTermId: text("academic_term_id").notNull().references(() => academicTerm.id, { onDelete: "cascade" }),
    // denormalise organisationId
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "restrict" }),
    // audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (table) => [
    unique("grading_entry_academicTermId_grade_key").on(table.academicTermId, table.grade), // no two identical grades for the same term
    index("grading_entry_academicTermId_idx").on(table.academicTermId),
    index("grading_entry_organizationId_idx").on(table.organizationId),
    check("grading_entry_min_max_score_check", sql`min_score <= max_score`),
    check("grading_entry_score_range_check", sql`min_score >= 0 AND max_score <= 100`),
  ],
);


// Defines how assessments are structured for a term (e.g., CA = 30%, Exam = 70%)
export const assessmentStructure = pgTable(
  "assessment_structure",
  {
    // identifier
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    // assessment type and percentage
    type: text("type").notNull(),                    // e.g., CA, Exam
    percentage: integer("percentage").notNull(),     // e.g., 30
    displayOrder: integer("display_order").notNull(), // e.g., 1
    // academic term affiliation (1-1 mapping)
    academicTermId: text("academic_term_id").notNull().references(() => academicTerm.id, { onDelete: "cascade" }),
    // organisation affiliation (denormalisation)
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "restrict" }),
    // audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (table) => [
    unique("assessment_structure_organizationId_academicTermId_type_key").on(table.organizationId, table.academicTermId, table.type),  // unique assessment type per term
    unique("assessment_structure_organizationId_academicTermId_displayOrder_key").on(table.organizationId, table.academicTermId, table.displayOrder),  // unique assessment display order per term
    index("assessment_structure_academicTermId_idx").on(table.academicTermId),
    index("assessment_structure_organizationId_idx").on(table.organizationId),
    check("assessment_structure_percentage_range_check", sql`percentage > 0 AND percentage <= 100`),  // percentage must be between 0 and 100
    check("assessment_structure_displayOrder_check", sql`display_order > 0`),  // display order must be greater than 0
  ],
);



// ***********************************************************************************
// LEVEL 4: CLASS-IN-TERM SCOPED TABLES (within a class)
// Each term, a class has many subjects (may change from term to term).
// Junction table between organisationClass and subject.
export const subjectClassAssignment = pgTable(
  "subject_class_assignment",
  {
    // identifier
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    // academic term affiliation (1-1 mapping)
    academicTermId: text("academic_term_id").notNull().references(() => academicTerm.id, { onDelete: "restrict" }),
    // term class affiliation (1-1 mapping)
    organisationClassId: text("organisation_class_id").notNull().references(() => organisationClass.id, { onDelete: "restrict" }),
    // subject affiliation (1-1 mapping)
    subjectId: text("subject_id").notNull().references(() => subject.id, { onDelete: "restrict" }),
    // organisation affiliation (1-1 mapping)
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "restrict" }),
    // audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (table) => [
    unique("subjectClassAssignment_organisationClassId_subjectId_academicTermId_key").on(table.organisationClassId, table.subjectId, table.academicTermId), // unique subject per class per term
    index("subjectClassAssignment_organisationClassId_idx").on(table.organisationClassId),
    index("subjectClassAssignment_subjectId_idx").on(table.subjectId),
    index("subjectClassAssignment_organizationId_idx").on(table.organizationId),
    index("subjectClassAssignment_academicTermId_idx").on(table.academicTermId),
  ],
);

// Students enrolled in a subject for a particular term and class.
// Many-to-many between term class students and term class subjects.
export const studentSubjectEnrollment = pgTable(
  "student_subject_enrollment",
  {
    // identifier
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    // student affiliation (1-1 mapping)
    studentId: text("student_id").notNull().references(() => student.id, { onDelete: "restrict" }),           // prevent deletion if enrollments exist
    subjectClassAssignmentId: text("subject_class_assignment_id").notNull().references(() => subjectClassAssignment.id, { onDelete: "restrict" }), // prevent deletion if enrollments exist
    // organisation affiliation (1-1 mapping)
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "restrict" }),
    // academic term affiliation (1-1 mapping)
    academicTermId: text("academic_term_id").notNull().references(() => academicTerm.id, { onDelete: "restrict" }),
    // audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (table) => [
    unique("studentSubjectEnrollment_studentId_subjectClassAssignmentId_key").on(table.studentId, table.subjectClassAssignmentId),
    index("student_subject_studentId_idx").on(table.studentId),
    index("studentSubjectEnrollment_subjectClassAssignmentId_idx").on(table.subjectClassAssignmentId),
    index("studentSubjectEnrollment_organizationId_idx").on(table.organizationId),
    index("studentSubjectEnrollment_academicTermId_idx").on(table.academicTermId),
  ],
);



// ***********************************************************************************
// LEVEL 5: ASSESSMENT TABLES (scoped to an actual enrollment)
// Each enrollment produces one assessment record
export const assessment = pgTable(
  "assessment",
  {
    // identifier
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    // student subject enrollment affiliation (1-1 mapping)
    // Assessments must be deleted manually before removing an enrollment — prevents silent data loss
    studentSubjectEnrollmentId: text("student_subject_enrollment_id").notNull().references(() => studentSubjectEnrollment.id, { onDelete: "restrict" }),
    // audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (table) => [
    unique("assessment_studentSubjectEnrollmentId_key").on(table.studentSubjectEnrollmentId),
    index("assessment_studentSubjectEnrollmentId_idx").on(table.studentSubjectEnrollmentId),
  ],
);

// Individual score entries per assessment type (e.g., CA score, Exam score)
export const assessmentScore = pgTable(
  "assessment_score",
  {
    // identifier
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    // assessment affiliation (1-1 mapping)
    // assessment structure affiliation (1-1 mapping)
    assessmentId: text("assessment_id").notNull().references(() => assessment.id, { onDelete: "cascade" }),
    assessmentStructureId: text("assessment_structure_id").notNull().references(() => assessmentStructure.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    // audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (table) => [
    unique("assessment_score_assessmentId_assessmentStructureId_key").on(table.assessmentId, table.assessmentStructureId),
    index("assessment_score_assessmentId_idx").on(table.assessmentId),
    index("assessment_score_assessmentStructureId_idx").on(table.assessmentStructureId),
    check("assessment_score_score_range_check", sql`score >= 0 AND score <= 100`),
  ],
);




// ***********************************************************************************
// CLASS RECORD EXPORT (teacher submit → org-admin review)
// Snapshot of getClassRecord-style payload; one row links request ↔ stored JSON (1:1).
// FK: classRecordExportRecord.requestId → classRecordExportRequest.id (unique).
// No duplicate recordId on request — join record on record.requestId = request.id or use relations.
export const classRecordExportRequest = pgTable(
  "class_record_export_request",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    comment: text("comment"),
    classId: text("class_id").notNull().references(() => organisationClass.id, { onDelete: "restrict" }),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "restrict" }),
    academicTermId: text("academic_term_id").notNull().references(() => academicTerm.id, { onDelete: "restrict" }),
    status: classRecordExportStatusEnum("status").default("PENDING").notNull(),
    createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "restrict" }),
    reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("class_record_export_request_organizationId_idx").on(table.organizationId),
    index("class_record_export_request_academicTermId_idx").on(table.academicTermId),
    index("class_record_export_request_classId_idx").on(table.classId),
    index("class_record_export_request_status_idx").on(table.status),
    index("class_record_export_request_createdBy_idx").on(table.createdBy),
  ],
);

export const classRecordExportRecord = pgTable(
  "class_record_export_record",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    requestId: text("request_id").notNull().references(() => classRecordExportRequest.id, { onDelete: "cascade" }).unique(),
    content: jsonb("content").notNull(),
    version: serial("version"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("class_record_export_record_requestId_idx").on(table.requestId),
  ],
);


// ***********************************************************************************
// RELATIONS
// ----------------- LEVEL 1 -----------------
export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
  organisationClasses: many(organisationClass),
  // departments: many(department),
  subjects: many(subject),
  students: many(student),
  academicTerms: many(academicTerm),
  classRecordExportRequests: many(classRecordExportRequest),
}));


// ----------------- LEVEL 2: Better Auth core -----------------
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  twoFactors: many(twoFactor),
  // Organisation plugin
  members: many(member),
  invitations: many(invitation),
  // Application-level — subjects this teacher is assigned to teach
  taughtSubjects: many(subjectClassAssignment),
  classRecordExportRequestsCreated: many(classRecordExportRequest, {
    relationName: "classRecordExportRequestCreator",
  }),
  classRecordExportRequestsReviewed: many(classRecordExportRequest, {
    relationName: "classRecordExportRequestReviewer",
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

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
  user: one(user, {
    fields: [twoFactor.userId],
    references: [user.id],
  }),
}));


// ----------------- LEVEL 2: Organisation plugin -----------------
export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  inviter: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}));


// ----------------- LEVEL 2: School-scoped -----------------
export const organisationClassRelations = relations(organisationClass, ({ one, many }) => ({
  organization: one(organization, {
    fields: [organisationClass.organizationId],
    references: [organization.id],
  }),
  // studentClassAssignments: many(studentClassAssignment),
  subjectClassAssignments: many(subjectClassAssignment),
  classRecordExportRequests: many(classRecordExportRequest),
  formTeacher: one(user, {
    fields: [organisationClass.formTeacherId],
    references: [user.id],
  }),
}));

export const subjectRelations = relations(subject, ({ one, many }) => ({
  organization: one(organization, {
    fields: [subject.organizationId],
    references: [organization.id],
  }),
  subjectClassAssignments: many(subjectClassAssignment),
}));

export const studentRelations = relations(student, ({ one, many }) => ({
  organization: one(organization, {
    fields: [student.organizationId],
    references: [organization.id],
  }),
  class: one(organisationClass, {
    fields: [student.classId],
    references: [organisationClass.id],
  }),
  // classAssignments: many(studentClassAssignment),
  subjectEnrollments: many(studentSubjectEnrollment),
}));


// ----------------- LEVEL 3 -----------------
export const academicTermRelations = relations(academicTerm, ({ one, many }) => ({
  organization: one(organization, {
    fields: [academicTerm.organizationId],
    references: [organization.id],
  }),
  gradingEntries: many(gradingEntry),
  assessmentStructures: many(assessmentStructure),
  // studentClassAssignments: many(studentClassAssignment),
  subjectClassAssignments: many(subjectClassAssignment),
  studentSubjectEnrollments: many(studentSubjectEnrollment),
  classRecordExportRequests: many(classRecordExportRequest),
}));

export const gradingEntryRelations = relations(gradingEntry, ({ one }) => ({
  academicTerm: one(academicTerm, {
    fields: [gradingEntry.academicTermId],
    references: [academicTerm.id],
  }),
  organization: one(organization, {
    fields: [gradingEntry.organizationId],
    references: [organization.id],
  }),
}));

export const assessmentStructureRelations = relations(assessmentStructure, ({ one, many }) => ({
  academicTerm: one(academicTerm, {
    fields: [assessmentStructure.academicTermId],
    references: [academicTerm.id],
  }),
  organization: one(organization, {
    fields: [assessmentStructure.organizationId],
    references: [organization.id],
  }),
  assessmentScores: many(assessmentScore),
}));


// ----------------- LEVEL 4 -----------------
export const subjectClassAssignmentRelations = relations(subjectClassAssignment, ({ one, many }) => ({
  academicTerm: one(academicTerm, {
    fields: [subjectClassAssignment.academicTermId],
    references: [academicTerm.id],
  }),
  organisationClass: one(organisationClass, {
    fields: [subjectClassAssignment.organisationClassId],
    references: [organisationClass.id],
  }),
  subject: one(subject, {
    fields: [subjectClassAssignment.subjectId],
    references: [subject.id],
  }),
  enrollments: many(studentSubjectEnrollment),
}));


// ----------------- LEVEL 5 -----------------
export const studentSubjectEnrollmentRelations = relations(studentSubjectEnrollment, ({ one }) => ({
  student: one(student, {
    fields: [studentSubjectEnrollment.studentId],
    references: [student.id],
  }),
  subjectClassAssignment: one(subjectClassAssignment, {
    fields: [studentSubjectEnrollment.subjectClassAssignmentId],
    references: [subjectClassAssignment.id],
  }),
  academicTerm: one(academicTerm, {
    fields: [studentSubjectEnrollment.academicTermId],
    references: [academicTerm.id],
  }),
  // one enrollment produces one assessment record
  assessment: one(assessment, {
    fields: [studentSubjectEnrollment.id],
    references: [assessment.studentSubjectEnrollmentId],
  }),
}));

export const assessmentRelations = relations(assessment, ({ one, many }) => ({
  enrollment: one(studentSubjectEnrollment, {
    fields: [assessment.studentSubjectEnrollmentId],
    references: [studentSubjectEnrollment.id],
  }),
  // one assessment can have many scores (shaped by assessment structure)
  scores: many(assessmentScore),  
}));

export const assessmentScoreRelations = relations(assessmentScore, ({ one }) => ({
  // one score belongs to one assessment and defined by an assessment structure
  assessment: one(assessment, {
    fields: [assessmentScore.assessmentId],
    references: [assessment.id],
  }),
  assessmentStructure: one(assessmentStructure, {
    fields: [assessmentScore.assessmentStructureId],
    references: [assessmentStructure.id],
  }),
}));

export const classRecordExportRequestRelations = relations(
  classRecordExportRequest,
  ({ one }) => ({
    organization: one(organization, {
      fields: [classRecordExportRequest.organizationId],
      references: [organization.id],
    }),
    class: one(organisationClass, {
      fields: [classRecordExportRequest.classId],
      references: [organisationClass.id],
    }),
    academicTerm: one(academicTerm, {
      fields: [classRecordExportRequest.academicTermId],
      references: [academicTerm.id],
    }),
    createdByUser: one(user, {
      relationName: "classRecordExportRequestCreator",
      fields: [classRecordExportRequest.createdBy],
      references: [user.id],
    }),
    reviewedByUser: one(user, {
      relationName: "classRecordExportRequestReviewer",
      fields: [classRecordExportRequest.reviewedBy],
      references: [user.id],
    }),
    record: one(classRecordExportRecord, {
      fields: [classRecordExportRequest.id],
      references: [classRecordExportRecord.requestId],
    }),
  }),
);

export const classRecordExportRecordRelations = relations(classRecordExportRecord, ({ one }) => ({
  request: one(classRecordExportRequest, {
    fields: [classRecordExportRecord.requestId],
    references: [classRecordExportRequest.id],
  }),
}));