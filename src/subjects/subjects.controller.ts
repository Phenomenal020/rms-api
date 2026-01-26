import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { BulkUpdateSubjectsDto } from './dto/bulk-update-subjects.dto';
import { CreateAssessmentStructureDto } from './dto/create-assessment-structure.dto';
import { UpdateAssessmentStructureDto } from './dto/update-assessment-structure.dto';
import { BulkUpdateAssessmentStructureDto } from './dto/bulk-update-assessment-structure.dto';
import { auth } from '../auth/auth';

@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  /**
   * Helper: Get session user
   */
  private async getSessionUser(request: Request) {
    const session = await auth.api.getSession({
      headers: request.headers as any,
    });

    if (!session?.user) {
      throw new UnauthorizedException('Unauthorised user');
    }

    return session.user.id;
  }

  // ==================== SUBJECTS ROUTES ====================

  /**
   * 1. GET /subjects - Get all subjects for current user's academic term
   */
  @Get()
  async getAllSubjects(@Req() request: Request) {
    const userId = await this.getSessionUser(request);
    return this.subjectsService.getAllSubjects(userId);
  }

  // Assessment structure routes must come before :id routes to avoid route conflicts
  /**
   * 9. GET /subjects/assessment-structure - Get all assessment structures
   */
  @Get('assessment-structure')
  async getAllAssessmentStructures(@Req() request: Request) {
    const userId = await this.getSessionUser(request);
    return this.subjectsService.getAllAssessmentStructures(userId);
  }

  /**
   * 10. GET /subjects/assessment-structure/:id - Get single assessment structure by ID
   */
  @Get('assessment-structure/:id')
  async getAssessmentStructureById(@Req() request: Request, @Param('id') structureId: string) {
    const userId = await this.getSessionUser(request);
    return this.subjectsService.getAssessmentStructureById(userId, structureId);
  }

  /**
   * 2. GET /subjects/:id - Get single subject by ID
   */
  @Get(':id')
  async getSubjectById(@Req() request: Request, @Param('id') subjectId: string) {
    const userId = await this.getSessionUser(request);
    return this.subjectsService.getSubjectById(userId, subjectId);
  }

  /**
   * 3. POST /subjects - Create a single subject
   */
  @Post()
  async createSubject(@Req() request: Request, @Body() subjectData: CreateSubjectDto) {
    const userId = await this.getSessionUser(request);
    return this.subjectsService.createSubject(userId, subjectData);
  }

  /**
   * 4. POST /subjects/bulk - Create many subjects at once
   */
  @Post('bulk')
  async createManySubjects(@Req() request: Request, @Body() subjects: CreateSubjectDto[]) {
    const userId = await this.getSessionUser(request);
    return this.subjectsService.createManySubjects(userId, subjects);
  }

  /**
   * 5. PATCH /subjects/:id - Update a single subject
   */
  @Patch(':id')
  async updateSubject(
    @Req() request: Request,
    @Param('id') subjectId: string,
    @Body() subjectData: UpdateSubjectDto,
  ) {
    const userId = await this.getSessionUser(request);
    return this.subjectsService.updateSubject(userId, subjectId, subjectData);
  }

  /**
   * 6. PATCH /subjects/bulk - Update multiple subjects (save changes pattern)
   */
  @Patch('bulk')
  async updateManySubjects(@Req() request: Request, @Body() bulkData: BulkUpdateSubjectsDto) {
    const userId = await this.getSessionUser(request);
    return this.subjectsService.updateManySubjects(userId, bulkData);
  }

  /**
   * 7. DELETE /subjects/:id - Delete a single subject
   */
  @Delete(':id')
  async deleteSubject(@Req() request: Request, @Param('id') subjectId: string) {
    const userId = await this.getSessionUser(request);
    return this.subjectsService.deleteSubject(userId, subjectId);
  }

  /**
   * 8. DELETE /subjects/bulk - Delete many subjects
   */
  @Delete('bulk')
  async deleteManySubjects(@Req() request: Request, @Body() body: { subjectIds: string[] }) {
    const userId = await this.getSessionUser(request);
    return this.subjectsService.deleteManySubjects(userId, body.subjectIds);
  }

  // ==================== ASSESSMENT STRUCTURE ROUTES ====================

  /**
   * 11. POST /subjects/assessment-structure - Create a single assessment structure
   */
  @Post('assessment-structure')
  async createAssessmentStructure(
    @Req() request: Request,
    @Body() structureData: CreateAssessmentStructureDto,
  ) {
    const userId = await this.getSessionUser(request);
    return this.subjectsService.createAssessmentStructure(userId, structureData);
  }

  /**
   * 12. POST /subjects/assessment-structure/bulk - Create many assessment structures
   */
  @Post('assessment-structure/bulk')
  async createManyAssessmentStructures(
    @Req() request: Request,
    @Body() structures: CreateAssessmentStructureDto[],
  ) {
    const userId = await this.getSessionUser(request);
    return this.subjectsService.createManyAssessmentStructures(userId, structures);
  }

  /**
   * 13. PATCH /subjects/assessment-structure/:id - Update a single assessment structure
   */
  @Patch('assessment-structure/:id')
  async updateAssessmentStructure(
    @Req() request: Request,
    @Param('id') structureId: string,
    @Body() structureData: UpdateAssessmentStructureDto,
  ) {
    const userId = await this.getSessionUser(request);
    return this.subjectsService.updateAssessmentStructure(userId, structureId, structureData);
  }

  /**
   * 14. PATCH /subjects/assessment-structure/bulk - Update multiple assessment structures (save changes pattern)
   */
  @Patch('assessment-structure/bulk')
  async updateManyAssessmentStructures(
    @Req() request: Request,
    @Body() bulkData: BulkUpdateAssessmentStructureDto,
  ) {
    const userId = await this.getSessionUser(request);
    return this.subjectsService.updateManyAssessmentStructures(userId, bulkData);
  }

  /**
   * 15. DELETE /subjects/assessment-structure/:id - Delete a single assessment structure
   */
  @Delete('assessment-structure/:id')
  async deleteAssessmentStructure(@Req() request: Request, @Param('id') structureId: string) {
    const userId = await this.getSessionUser(request);
    return this.subjectsService.deleteAssessmentStructure(userId, structureId);
  }

  /**
   * 16. DELETE /subjects/assessment-structure/bulk - Delete many assessment structures
   */
  @Delete('assessment-structure/bulk')
  async deleteManyAssessmentStructures(
    @Req() request: Request,
    @Body() body: { structureIds: string[] },
  ) {
    const userId = await this.getSessionUser(request);
    return this.subjectsService.deleteManyAssessmentStructures(userId, body.structureIds);
  }
}
