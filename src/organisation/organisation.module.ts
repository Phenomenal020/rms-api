import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { DatabaseModule } from '../database/database.module';
import { OrganisationController } from './organisation.controller';
import { OrganisationService } from './organisation.service';

@Module({
  imports: [DatabaseModule, AuthModule],  // dependendent modules
  controllers: [OrganisationController],
  providers: [OrganisationService],  // services and injectables scoped to this module
  exports: []
})

export class OrganisationModule {}