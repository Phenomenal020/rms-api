// Resources: https://docs.nestjs.com/modules

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthGuard, AuthModule } from '@thallesp/nestjs-better-auth';
import { SchoolModule } from './school/school.module';
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
import configuration from './config/configuration';
import { StudentViewModule } from './student-view/student-view.module';
import { SubjectViewModule } from './subject-view/subject-view.module';

// @Global() // make the module global (available to all modules). Think helpers, db connections, etc.
@Module({
  imports: [
    // ConfigModule to manage environment variables
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule.forRootAsync({
      imports: [DatabaseModule],  // import the database module to use the connection
      useFactory: (database: NodePgDatabase, configService: ConfigService) => ({
        auth: createBetterAuth(database, configService),
      }),
      inject: [DATABASE_CONNECTION, ConfigService],  // inject the db connection (with a custom token/id) to use and the config service
    }),   // Creates better-auth instance with the database
    UsersModule,
    SchoolModule,
    StudentsModule,
    SubjectsModule,
    AssessmentStructureModule,
    TermModule,
    StudentViewModule,
    SubjectViewModule,
  ],
  controllers: [AppController],  // Controller registration
  providers: [AppService, {
    provide: APP_GUARD,
    useClass: AuthGuard,   
  }],  // Provider registration
  // exports: []   // include providers you want to be accessible from other modules (shared providers)
})

export class AppModule { }