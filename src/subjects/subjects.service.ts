import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { subject, assessmentStructure, user, academicTerm } from '../auth/schema';
import { eq, and, inArray, asc } from 'drizzle-orm';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { BulkUpdateSubjectsDto } from './dto/bulk-update-subjects.dto';
import { CreateAssessmentStructureDto } from './dto/create-assessment-structure.dto';
import { UpdateAssessmentStructureDto } from './dto/update-assessment-structure.dto';
import { BulkUpdateAssessmentStructureDto } from './dto/bulk-update-assessment-structure.dto';
import {
  validateSubject,
  validateSubjectsInput,
  validateSingleAssessmentStructure,
  validateAssessmentStructureInput,
} from './subjects-validation';

@Injectable()
export class SubjectsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase,
  ) {}

  /**
   * Helper: Get user's academic term and validate prerequisites
   */
  private async getUserAcademicTerm(userId: string) {
    const currentUser = await this.db
      .select({
        id: user.id,
        schoolId: user.schoolId,
        academicTermId: user.academicTermId,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!currentUser || currentUser.length === 0) {
      throw new UnauthorizedException('User unauthorised');
    }

    if (!currentUser[0].schoolId) {
      throw new BadRequestException('Please set up your school first before adding subjects');
    }

    if (!currentUser[0].academicTermId) {
      throw new BadRequestException('Please set up your academic term first before adding subjects');
    }

    const term = await this.db
      .select()
      .from(academicTerm)
      .where(eq(academicTerm.id, currentUser[0].academicTermId))
      .limit(1);

    if (!term || term.length === 0) {
      throw new NotFoundException('Academic term not found');
    }

    return term[0];
  }

  // ==================== SUBJECTS CRUD ====================

  /**
   * 1. GET /subjects - Get all subjects for current user's academic term
   */
  async getAllSubjects(userId: string) {
    const term = await this.getUserAcademicTerm(userId);

    const subjects = await this.db
      .select()
      .from(subject)
      .where(eq(subject.academicTermId, term.id));

    return subjects;
  }

  /**
   * 2. GET /subjects/:id - Get single subject by ID
   */
  async getSubjectById(userId: string, subjectId: string) {
    const term = await this.getUserAcademicTerm(userId);

    const subjectData = await this.db
      .select()
      .from(subject)
      .where(and(eq(subject.id, subjectId), eq(subject.academicTermId, term.id)))
      .limit(1);

    if (!subjectData || subjectData.length === 0) {
      throw new NotFoundException('Subject not found');
    }

    return subjectData[0];
  }

  /**
   * 3. POST /subjects - Create a single subject
   */
  async createSubject(userId: string, subjectData: CreateSubjectDto) {
    const validation = validateSubject(subjectData);
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }

    const term = await this.getUserAcademicTerm(userId);

    try {
      const [newSubject] = await this.db
        .insert(subject)
        .values({
          id: crypto.randomUUID(),
          name: subjectData.name.trim(),
          academicTermId: term.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return newSubject;
    } catch (error) {
      if (error instanceof Error && (error.message.includes('unique') || error.message.includes('duplicate'))) {
        throw new BadRequestException('A subject with this name already exists');
      }
      throw new BadRequestException('Failed to create subject');
    }
  }

  /**
   * 4. POST /subjects/bulk - Create many subjects at once
   */
  async createManySubjects(userId: string, subjects: CreateSubjectDto[]) {
    const validationError = validateSubjectsInput(subjects);
    if (validationError) {
      throw new BadRequestException(validationError);
    }

    const term = await this.getUserAcademicTerm(userId);

    try {
      const createdSubjects = await this.db
        .insert(subject)
        .values(
          subjects.map((s) => ({
            id: crypto.randomUUID(),
            name: s.name.trim(),
            academicTermId: term.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        )
        .returning();

      return {
        success: `${createdSubjects.length} subject${createdSubjects.length > 1 ? 's' : ''} created successfully`,
        subjects: createdSubjects,
      };
    } catch (error) {
      if (error instanceof Error && (error.message.includes('unique') || error.message.includes('duplicate'))) {
        throw new BadRequestException('A subject with this name already exists');
      }
      throw new BadRequestException('Failed to create subjects');
    }
  }

  /**
   * 5. PATCH /subjects/:id - Update a single subject
   */
  async updateSubject(userId: string, subjectId: string, subjectData: UpdateSubjectDto) {
    const validation = validateSubject(subjectData);
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }

    const term = await this.getUserAcademicTerm(userId);

    // Verify subject exists and belongs to this term
    const existingSubject = await this.db
      .select()
      .from(subject)
      .where(and(eq(subject.id, subjectId), eq(subject.academicTermId, term.id)))
      .limit(1);

    if (!existingSubject || existingSubject.length === 0) {
      throw new NotFoundException('Subject not found');
    }

    try {
      const [updatedSubject] = await this.db
        .update(subject)
        .set({
          name: subjectData.name.trim(),
          updatedAt: new Date(),
        })
        .where(eq(subject.id, subjectId))
        .returning();

      return updatedSubject;
    } catch (error) {
      if (error instanceof Error && (error.message.includes('unique') || error.message.includes('duplicate'))) {
        throw new BadRequestException('A subject with this name already exists');
      }
      throw new BadRequestException('Failed to update subject');
    }
  }

  /**
   * 6. PATCH /subjects/bulk - Update multiple subjects (save changes pattern)
   * This handles the "save changes" pattern: delete removed, update existing, create new
   */
  async updateManySubjects(userId: string, bulkData: BulkUpdateSubjectsDto) {
    const validationError = validateSubjectsInput(bulkData.subjects);
    if (validationError) {
      throw new BadRequestException(validationError);
    }

    const term = await this.getUserAcademicTerm(userId);

    // Get existing subjects
    const existingSubjects = await this.db
      .select()
      .from(subject)
      .where(eq(subject.academicTermId, term.id));

    // IDs present from the client payload
    const frontEndIds = bulkData.subjects.map((s) => s.id).filter(Boolean);
    // Records to delete: in DB but not in payload
    const subjectsToDelete = existingSubjects.filter((dbSubject) => !frontEndIds.includes(dbSubject.id));

    try {
      await this.db.transaction(async (tx) => {
        // Delete removed subjects
        if (subjectsToDelete.length > 0) {
          await tx.delete(subject).where(inArray(subject.id, subjectsToDelete.map((s) => s.id)));
        }

        // Update existing subjects
        const subjectsToUpdate = bulkData.subjects.filter((s) => s.id);
        for (const s of subjectsToUpdate) {
          await tx
            .update(subject)
            .set({
              name: s.name.trim(),
              updatedAt: new Date(),
            })
            .where(eq(subject.id, s.id!));
        }

        // Create new subjects
        const subjectsToCreate = bulkData.subjects.filter((s) => !s.id);
        if (subjectsToCreate.length > 0) {
          await tx.insert(subject).values(
            subjectsToCreate.map((s) => ({
              id: crypto.randomUUID(),
              name: s.name.trim(),
              academicTermId: term.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            })),
          );
        }
      });

      // Fetch all updated subjects
      const updatedSubjects = await this.db
        .select()
        .from(subject)
        .where(eq(subject.academicTermId, term.id));

      return {
        success: 'Subjects updated successfully',
        subjects: updatedSubjects,
      };
    } catch (error) {
      if (error instanceof Error && (error.message.includes('unique') || error.message.includes('duplicate'))) {
        throw new BadRequestException('A subject with this name already exists');
      }
      throw new BadRequestException('Failed to update subjects');
    }
  }

  /**
   * 7. DELETE /subjects/:id - Delete a single subject
   */
  async deleteSubject(userId: string, subjectId: string) {
    const term = await this.getUserAcademicTerm(userId);

    // Verify subject exists and belongs to this term
    const existingSubject = await this.db
      .select()
      .from(subject)
      .where(and(eq(subject.id, subjectId), eq(subject.academicTermId, term.id)))
      .limit(1);

    if (!existingSubject || existingSubject.length === 0) {
      throw new NotFoundException('Subject not found');
    }

    await this.db.delete(subject).where(eq(subject.id, subjectId));

    return {
      success: 'Subject deleted successfully',
    };
  }

  /**
   * 8. DELETE /subjects/bulk - Delete many subjects
   */
  async deleteManySubjects(userId: string, subjectIds: string[]) {
    if (!subjectIds || !Array.isArray(subjectIds) || subjectIds.length === 0) {
      throw new BadRequestException('At least one subject ID is required');
    }

    const term = await this.getUserAcademicTerm(userId);

    // Verify all subjects exist and belong to this term
    const existingSubjects = await this.db
      .select()
      .from(subject)
      .where(and(eq(subject.academicTermId, term.id), inArray(subject.id, subjectIds)));

    if (existingSubjects.length !== subjectIds.length) {
      throw new NotFoundException('One or more subjects not found');
    }

    await this.db.delete(subject).where(inArray(subject.id, subjectIds));

    return {
      success: `${subjectIds.length} subject${subjectIds.length > 1 ? 's' : ''} deleted successfully`,
    };
  }

  // ==================== ASSESSMENT STRUCTURE CRUD ====================

  /**
   * 9. GET /subjects/assessment-structure - Get all assessment structures for current user's academic term
   */
  async getAllAssessmentStructures(userId: string) {
    const term = await this.getUserAcademicTerm(userId);

    const structures = await this.db
      .select()
      .from(assessmentStructure)
      .where(eq(assessmentStructure.academicTermId, term.id))
      .orderBy(asc(assessmentStructure.order));

    return structures;
  }

  /**
   * 10. GET /subjects/assessment-structure/:id - Get single assessment structure by ID
   */
  async getAssessmentStructureById(userId: string, structureId: string) {
    const term = await this.getUserAcademicTerm(userId);

    const structure = await this.db
      .select()
      .from(assessmentStructure)
      .where(
        and(eq(assessmentStructure.id, structureId), eq(assessmentStructure.academicTermId, term.id)),
      )
      .limit(1);

    if (!structure || structure.length === 0) {
      throw new NotFoundException('Assessment structure not found');
    }

    return structure[0];
  }

  /**
   * 11. POST /subjects/assessment-structure - Create a single assessment structure
   */
  async createAssessmentStructure(userId: string, structureData: CreateAssessmentStructureDto) {
    const validation = validateSingleAssessmentStructure(structureData);
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }

    const term = await this.getUserAcademicTerm(userId);

    // Check total percentage with existing structures
    const existingStructures = await this.db
      .select()
      .from(assessmentStructure)
      .where(eq(assessmentStructure.academicTermId, term.id));

    const totalPercentage = existingStructures.reduce((sum, s) => sum + s.percentage, 0) + structureData.percentage;
    if (totalPercentage > 100) {
      throw new BadRequestException(
        `Adding this assessment would exceed 100% total. Current total: ${existingStructures.reduce((sum, s) => sum + s.percentage, 0)}%`,
      );
    }

    try {
      const [newStructure] = await this.db
        .insert(assessmentStructure)
        .values({
          id: crypto.randomUUID(),
          type: structureData.type.trim(),
          percentage: structureData.percentage,
          order: structureData.order,
          academicTermId: term.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return newStructure;
    } catch (error) {
      throw new BadRequestException('Failed to create assessment structure');
    }
  }

  /**
   * 12. POST /subjects/assessment-structure/bulk - Create many assessment structures at once
   */
  async createManyAssessmentStructures(userId: string, structures: CreateAssessmentStructureDto[]) {
    const validation = validateAssessmentStructureInput(structures);
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }

    const term = await this.getUserAcademicTerm(userId);

    try {
      const createdStructures = await this.db
        .insert(assessmentStructure)
        .values(
          structures.map((s) => ({
            id: crypto.randomUUID(),
            type: s.type.trim(),
            percentage: s.percentage,
            order: s.order,
            academicTermId: term.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        )
        .returning();

      return {
        success: `${createdStructures.length} assessment structure${createdStructures.length > 1 ? 's' : ''} created successfully`,
        assessmentStructure: createdStructures,
      };
    } catch (error) {
      throw new BadRequestException('Failed to create assessment structures');
    }
  }

  /**
   * 13. PATCH /subjects/assessment-structure/:id - Update a single assessment structure
   */
  async updateAssessmentStructure(
    userId: string,
    structureId: string,
    structureData: UpdateAssessmentStructureDto,
  ) {
    const validation = validateSingleAssessmentStructure(structureData);
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }

    const term = await this.getUserAcademicTerm(userId);

    // Verify structure exists and belongs to this term
    const existingStructure = await this.db
      .select()
      .from(assessmentStructure)
      .where(
        and(eq(assessmentStructure.id, structureId), eq(assessmentStructure.academicTermId, term.id)),
      )
      .limit(1);

    if (!existingStructure || existingStructure.length === 0) {
      throw new NotFoundException('Assessment structure not found');
    }

    // Check total percentage with other structures (excluding current one)
    const allStructures = await this.db
      .select()
      .from(assessmentStructure)
      .where(eq(assessmentStructure.academicTermId, term.id));

    const otherStructuresTotal = allStructures
      .filter((s) => s.id !== structureId)
      .reduce((sum, s) => sum + s.percentage, 0);

    const totalPercentage = otherStructuresTotal + structureData.percentage;
    if (totalPercentage > 100) {
      throw new BadRequestException('Assessment percentages must total exactly 100%');
    }

    try {
      const [updatedStructure] = await this.db
        .update(assessmentStructure)
        .set({
          type: structureData.type.trim(),
          percentage: structureData.percentage,
          order: structureData.order,
          updatedAt: new Date(),
        })
        .where(eq(assessmentStructure.id, structureId))
        .returning();

      return updatedStructure;
    } catch (error) {
      throw new BadRequestException('Failed to update assessment structure');
    }
  }

  /**
   * 14. PATCH /subjects/assessment-structure/bulk - Update multiple assessment structures (save changes pattern)
   * This handles the "save changes" pattern: delete removed, update existing, create new
   */
  async updateManyAssessmentStructures(userId: string, bulkData: BulkUpdateAssessmentStructureDto) {
    const validation = validateAssessmentStructureInput(bulkData.assessmentStructure);
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }

    const term = await this.getUserAcademicTerm(userId);

    // Get existing assessment structures
    const existingStructures = await this.db
      .select()
      .from(assessmentStructure)
      .where(eq(assessmentStructure.academicTermId, term.id));

    // IDs present from the client payload
    const frontEndIds = bulkData.assessmentStructure.map((a) => a.id).filter(Boolean);
    // Records to delete: in DB but not in payload
    const structuresToDelete = existingStructures.filter(
      (dbStruct) => !frontEndIds.includes(dbStruct.id),
    );

    try {
      await this.db.transaction(async (tx) => {
        // Delete removed structures
        if (structuresToDelete.length > 0) {
          await tx
            .delete(assessmentStructure)
            .where(inArray(assessmentStructure.id, structuresToDelete.map((s) => s.id)));
        }

        // Update existing structures
        const structuresToUpdate = bulkData.assessmentStructure.filter((a) => a.id);
        for (const a of structuresToUpdate) {
          await tx
            .update(assessmentStructure)
            .set({
              type: a.type.trim(),
              percentage: Number(a.percentage),
              order: Number(a.order),
              updatedAt: new Date(),
            })
            .where(eq(assessmentStructure.id, a.id!));
        }

        // Create new structures
        const structuresToCreate = bulkData.assessmentStructure.filter((a) => !a.id);
        if (structuresToCreate.length > 0) {
          await tx.insert(assessmentStructure).values(
            structuresToCreate.map((a) => ({
              id: crypto.randomUUID(),
              type: a.type.trim(),
              percentage: Number(a.percentage),
              order: Number(a.order),
              academicTermId: term.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            })),
          );
        }
      });

      // Fetch all updated structures
      const updatedStructures = await this.db
        .select()
        .from(assessmentStructure)
        .where(eq(assessmentStructure.academicTermId, term.id))
        .orderBy(asc(assessmentStructure.order));

      return {
        success: 'Assessment structure updated successfully',
        assessmentStructure: updatedStructures,
      };
    } catch (error) {
      throw new BadRequestException('Failed to update assessment structure');
    }
  }

  /**
   * 15. DELETE /subjects/assessment-structure/:id - Delete a single assessment structure
   */
  async deleteAssessmentStructure(userId: string, structureId: string) {
    const term = await this.getUserAcademicTerm(userId);

    // Verify structure exists and belongs to this term
    const existingStructure = await this.db
      .select()
      .from(assessmentStructure)
      .where(
        and(eq(assessmentStructure.id, structureId), eq(assessmentStructure.academicTermId, term.id)),
      )
      .limit(1);

    if (!existingStructure || existingStructure.length === 0) {
      throw new NotFoundException('Assessment structure not found');
    }

    await this.db.delete(assessmentStructure).where(eq(assessmentStructure.id, structureId));

    return {
      success: 'Assessment structure deleted successfully',
    };
  }

  /**
   * 16. DELETE /subjects/assessment-structure/bulk - Delete many assessment structures
   */
  async deleteManyAssessmentStructures(userId: string, structureIds: string[]) {
    if (!structureIds || !Array.isArray(structureIds) || structureIds.length === 0) {
      throw new BadRequestException('At least one assessment structure ID is required');
    }

    const term = await this.getUserAcademicTerm(userId);

    // Verify all structures exist and belong to this term
    const existingStructures = await this.db
      .select()
      .from(assessmentStructure)
      .where(
        and(
          eq(assessmentStructure.academicTermId, term.id),
          inArray(assessmentStructure.id, structureIds),
        ),
      );

    if (existingStructures.length !== structureIds.length) {
      throw new NotFoundException('One or more assessment structures not found');
    }

    await this.db.delete(assessmentStructure).where(inArray(assessmentStructure.id, structureIds));

    return {
      success: `${structureIds.length} assessment structure${structureIds.length > 1 ? 's' : ''} deleted successfully`,
    };
  }
}
