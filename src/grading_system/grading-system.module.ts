import { Module } from '@nestjs/common';
import { GradingSystemController } from './grading-system.controller';
import { GradingSystemService } from './grading-system.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [GradingSystemController],
  providers: [GradingSystemService],
})
export class GradingSystemModule { }
