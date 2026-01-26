import { Module } from '@nestjs/common';
import { TermController } from './term.controller';
import { TermService } from './term.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [TermController],
  providers: [TermService],
})
export class TermModule {}
