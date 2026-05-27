// Resources: https://docs.nestjs.com/modules

import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
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
import { TeacherInvitationModule } from './teacher-invitation/teacher-invitation.module';
import { OrganisationModule } from './organisation/organisation.module';
import { RecordModule } from './record/record.module';
import { AuthGuardsModule } from './auth/auth-guards.module';

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
    TeacherInvitationModule,
    TermModule,
    AssessmentStructureModule,
    GradingSystemModule,
    SubjectsModule,
    ClassesModule,
    StudentsModule,
    StudentViewModule,
    SubjectViewModule,
    RecordModule,
  ],

  controllers: [AppController],  // Controller registration
  providers: [AppService, {
    provide: APP_GUARD,
    useClass: AuthGuard,
  }],  // Provider registration
  // exports: []   // to include providers I want to be accessible from other modules (shared providers)

})

export class AppModule { }

// -----------------------------------------------------------------------------
// Logging & monitoring (reference — implement later)
// -----------------------------------------------------------------------------
// Middleware is the right layer for *transport* observability: every HTTP hit,
// duration, status code, request id — before/without knowing which controller ran.
// For logs that need the authenticated user or handler name, add an *interceptor*
// later (runs after AuthGuard). Use both: middleware = request envelope, interceptor = business context.
//
// Step 1 — create functional middleware (no DI needed), e.g.:
//
//   // middlewares/request-id.middleware.ts
//   import { Request, Response, NextFunction } from 'express';
//   export function requestId(req: Request, res: Response, next: NextFunction) {
//     const id = (req.headers['x-request-id'] as string) ?? crypto.randomUUID();
//     req['requestId'] = id;           // attach for later middleware / interceptors
//     res.setHeader('X-Request-Id', id);
//     next();
//   }
//
//   // middlewares/request-logger.middleware.ts
//   import { Request, Response, NextFunction } from 'express';
//   export function requestLogger(req: Request, res: Response, next: NextFunction) {
//     const start = Date.now();
//     res.on('finish', () => {
//       // Replace console with Pino/Winston/Datadog later
//       console.log(JSON.stringify({
//         requestId: req['requestId'],
//         method: req.method,
//         path: req.originalUrl,
//         status: res.statusCode,
//         durationMs: Date.now() - start,
//       }));
//     });
//     next();
//   }
//
// Step 2 — security headers globally in main.ts (all routes incl. Better Auth):
//
//   // main.ts — after NestFactory.create(...)
//   // import helmet from 'helmet';
//   // app.use(helmet());
//   // Keep enableCors() here only — do not also apply cors() middleware.
//
// Step 3 — wire the stack in this module (uncomment imports + class when ready):
//
//   // import { requestId } from './middlewares/request-id.middleware';
//   // import { requestLogger } from './middlewares/request-logger.middleware';
//
//   // export class AppModule implements NestModule {
//   //   configure(consumer: MiddlewareConsumer) {
//   //     consumer
//   //       .apply(requestId, requestLogger)  // order: id first, then logger
//   //       .exclude(
//   //         // Optional: skip noisy health/readiness probes
//   //         { path: 'health', method: RequestMethod.GET },
//   //       )
//   //       .forRoutes('*');  // all HTTP methods (GET, POST, PATCH, …)
//   //   }
//   // }
//
// Step 4 — optional class middleware if you need ConfigService (e.g. log level from env):
//
//   // providers: [RequestLoggerMiddleware],
//   // consumer.apply(RequestLoggerMiddleware).forRoutes('*');
//
// Remove or replace the old LoggerMiddleware class once the functional stack is in place.