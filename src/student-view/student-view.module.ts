import { Module } from '@nestjs/common';
import { StudentViewController } from './student-view.controller';
import { StudentViewService } from './student-view.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [StudentViewController],
  providers: [StudentViewService],
})
export class StudentViewModule {}
