// Resources: https://docs.nestjs.com/modules
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuthGuard, AuthModule } from '@thallesp/nestjs-better-auth';
import { ClassesModule } from './classes/classes.module';
import { StudentsModule } from './students/students.module';
import { SubjectsModule } from './subjects/subjects.module';
import { TermModule } from './term/term.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from './database/database-connection.token';
import { UsersModule } from './users/users.module';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createBetterAuth } from './auth/auth-setup';
import { AssessmentStructureModule } from './assessment_structure/assessment-structure.module';
import { GradingSystemModule } from './grading_system/grading-system.module';
import configuration from './config/configuration';
import { StudentViewModule } from './student-view/student-view.module';
import { SubjectViewModule } from './subject-view/subject-view.module';
import { OrganisationModule } from './organisation/organisation.module';
import { AuthGuardsModule } from './auth/auth-guards.module';
import { requestId } from './middlewares/request-id.middleware';
import { requestLogger } from './middlewares/request-logger.middleware';
import { OnboardingModule } from './onboarding/onboarding.module';

// @Global() // make the module global (available to all modules). Think helpers, db connections, etc.
@Module({

  imports: [
    // Dynamic modules: Requires runtime configs/dependencies
    // ConfigModule to manage environment variables
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    DatabaseModule,
    AuthGuardsModule,
    AuthModule.forRootAsync({  // Better Auth but at Runtime
      imports: [DatabaseModule],  // import the database module to use the connection
      useFactory: (database: NodePgDatabase, configService: ConfigService) => ({
        auth: createBetterAuth(database, configService),
      }),
      inject: [DATABASE_CONNECTION, ConfigService],  // inject the db connection (with a custom token/id) to use and the config service
    }),   // Creates better-auth instance with the database

    // Static modules: Can be imported at compile time
    UsersModule,
    OrganisationModule,
    TermModule,
    AssessmentStructureModule,
    GradingSystemModule,
    SubjectsModule,
    ClassesModule,
    StudentsModule,
    StudentViewModule,
    SubjectViewModule,
    // RecordModule,
    OnboardingModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    }],  // Provider registration
  // exports: [] 
})

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(requestId, requestLogger)
      // .exclude(
      //   { path: 'health', method: RequestMethod.GET },
      // )
      .forRoutes('*');
  }
}