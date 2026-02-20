import { Module } from '@nestjs/common';
import { SubjectViewController } from './subject-view.controller';
import { SubjectViewService } from './subject-view.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [SubjectViewController],
  providers: [SubjectViewService],
})
export class SubjectViewModule {}
