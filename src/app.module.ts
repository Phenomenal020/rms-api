// Resources: https://docs.nestjs.com/modules

import { Module, Global } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthGuard, AuthModule } from '@thallesp/nestjs-better-auth';
import { ConfigModule } from '@nestjs/config';
import { ProfileModule } from './profile/profile.module';
import { SchoolModule } from './school/school.module';
import { StudentsModule } from './students/students.module';
import { SubjectsModule } from './subjects/subjects.module';
import { TermModule } from './term/term.module';
import { ViewsModule } from './views/views.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { DATABASE_CONNECTION } from './database/database-connection.token';
import { UsersModule } from './users/users.module';
import { APP_GUARD } from '@nestjs/core';

// @Global() // make the module global (available to all modules). Think helpers, db connections, etc.
@Module({
  imports: [
    ConfigModule.forRoot(),  // loads environment variables from .env file
    DatabaseModule,  // creates a database connection
    AuthModule.forRootAsync({
      imports: [DatabaseModule],  // import the database module to use the connection
      useFactory: (database: NodePgDatabase) => ({
        auth: betterAuth({
          database: drizzleAdapter(database, {
            provider: 'pg',
          })
        }),
      }),  // DI
      inject: [DATABASE_CONNECTION],  // inject the connection to use 
    }),   // Creates better-auth instance with the database
    UsersModule,
    ProfileModule,
    SchoolModule,
    StudentsModule,
    SubjectsModule,
    TermModule,
    ViewsModule,
  ],
  controllers: [AppController],  // Controller registration
  providers: [AppService, {
    provide: APP_GUARD,
    useClass: AuthGuard,   
  }],  // Provider registration
  // exports: []   // include providers you want to be accessible from other modules (shared providers)
})

export class AppModule { }





























// TODO: Consider dynamic modules
















































// Modules that include Middleware have to implement the NestModule interface.

// import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
// import { LoggerMiddleware } from './common/middleware/logger.middleware';
// import { CatsModule } from './cats/cats.module';

// @Module({
//   imports: [CatsModule],
// })
// export class AppModule implements NestModule {
//   configure(consumer: MiddlewareConsumer) {
//     consumer
//       .apply(LoggerMiddleware)  // The apply() method may either take a single middleware, or multiple arguments to specify multiple middlewares
// .exclude({}, {}) // exclude routes from having the middleware applied
//       .forRoutes({ path: 'cats', method: RequestMethod.GET });  // The forRoutes() method can take a single string, multiple strings, a RouteInfo object, a controller class and even multiple controller classes
//   }
// }
