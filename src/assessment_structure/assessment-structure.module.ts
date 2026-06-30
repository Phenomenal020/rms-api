import { Module } from '@nestjs/common';
import { AssessmentStructureController } from './assessment-structure.controller';
import { AssessmentStructureService } from './assessment-structure.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AssessmentStructureController],
  providers: [AssessmentStructureService],
  exports: [AssessmentStructureService],
})
export class AssessmentStructureModule {}