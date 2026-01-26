// Exception handling for RMS API
// This file implements exception handling that matches the current Next.js API response format:
// Success: { success: string }
// Error: { error: string }

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request, Response } from 'express';

//---------------------------------------------------------------------------------------------------------
// Custom Exceptions
// These exceptions match the error format used in the current Next.js API
//---------------------------------------------------------------------------------------------------------

/**
 * Custom exception for unauthorized access
 * Matches: { error: "Unauthorised" } or { error: "Unauthorised user" }
 */
export class UnauthorisedException extends UnauthorizedException {
  constructor(message: string = 'Unauthorised') {
    super(message);
  }
}

/**
 * Custom exception for validation errors
 * Matches: { error: "First name is required" } etc.
 */
export class ValidationException extends BadRequestException {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Custom exception for database constraint violations (e.g., Prisma P2002)
 * Matches: { error: "School name already exists" }
 */
export class DuplicateException extends ConflictException {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Custom exception for not found errors
 * Matches: { error: "User unauthorised" } or { error: "School not found" }
 */
export class NotFoundErrorException extends NotFoundException {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Custom exception for general operation failures
 * Matches: { error: "Failed to update profile" }
 */
export class OperationFailedException extends InternalServerErrorException {
  constructor(message: string = 'Operation failed') {
    super(message);
  }
}

//---------------------------------------------------------------------------------------------------------
// Global Exception Filter
// This filter formats all exceptions to match the current API response format
//---------------------------------------------------------------------------------------------------------

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Determine HTTP status code
    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Get error message
    let errorMessage: string;
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        errorMessage = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && 'message' in exceptionResponse) {
        // Handle array of messages from validation
        const message = exceptionResponse.message;
        errorMessage = Array.isArray(message) ? message[0] : message;
      } else {
        errorMessage = 'An error occurred';
      }
    } else if (exception instanceof Error) {
      errorMessage = exception.message || 'Internal server error';
    } else {
      errorMessage = 'Internal server error';
    }

    // Format response to match current API: { error: string }
    const responseBody = {
      error: errorMessage,
    };

    // Log the exception (optional - you can enhance this with proper logging)
    console.error('Exception caught:', {
      status: httpStatus,
      message: errorMessage,
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
    });

    httpAdapter.reply(response, responseBody, httpStatus);
  }
}

//---------------------------------------------------------------------------------------------------------
// Usage Examples in Services
//---------------------------------------------------------------------------------------------------------

/**
 * Example: Profile Service
 * 
 * import { Injectable } from '@nestjs/common';
 * import { UnauthorisedException, ValidationException, OperationFailedException } from '../api.exceptions';
 * 
 * @Injectable()
 * export class ProfileService {
 *   async updateProfile(userId: string, profileData: UpdateProfileDto) {
 *     // Check authorization
 *     if (!userId) {
 *       throw new UnauthorisedException('Unauthorised');
 *     }
 * 
 *     // Validation (or use class-validator DTOs)
 *     if (!profileData.firstName || !profileData.lastName) {
 *       throw new ValidationException('First name and last name are required');
 *     }
 * 
 *     try {
 *       // Database operation
 *       const updatedUser = await prisma.user.update({
 *         where: { id: userId },
 *         data: {
 *           firstName: profileData.firstName.trim(),
 *           lastName: profileData.lastName.trim(),
 *         },
 *       });
 * 
 *       return { success: 'Profile updated successfully' };
 *     } catch (error) {
 *       // Handle Prisma errors
 *       if (error.code === 'P2002') {
 *         throw new DuplicateException('A user with this information already exists');
 *       }
 *       throw new OperationFailedException('Failed to update profile');
 *     }
 *   }
 * }
 */

/**
 * Example: School Service
 * 
 * import { Injectable } from '@nestjs/common';
 * import { UnauthorisedException, DuplicateException, OperationFailedException } from '../api.exceptions';
 * 
 * @Injectable()
 * export class SchoolService {
 *   async updateSchool(userId: string, schoolData: UpdateSchoolDto) {
 *     if (!userId) {
 *       throw new UnauthorisedException('Unauthorised user');
 *     }
 * 
 *     try {
 *       // Database operations
 *       await prisma.$transaction(async (tx) => {
 *         // ... school update logic
 *       });
 * 
 *       return { success: 'School information updated successfully' };
 *     } catch (error) {
 *       // Handle Prisma unique constraint violation
 *       if (error.code === 'P2002') {
 *         throw new DuplicateException('School name already exists');
 *       }
 *       throw new OperationFailedException('Failed to update school information');
 *     }
 *   }
 * }
 */

/**
 * Example: Students Service
 * 
 * import { Injectable } from '@nestjs/common';
 * import { ValidationException, NotFoundErrorException } from '../api.exceptions';
 * 
 * @Injectable()
 * export class StudentsService {
 *   async updateStudents(userId: string, studentsData: UpdateStudentsDto) {
 *     // Validate students array
 *     if (!studentsData.students || studentsData.students.length === 0) {
 *       throw new ValidationException('At least one student is required');
 *     }
 * 
 *     // Check if user has school and term
 *     const user = await prisma.user.findUnique({
 *       where: { id: userId },
 *       include: { school: true, academicTerms: true },
 *     });
 * 
 *     if (!user.schoolId) {
 *       throw new ValidationException('Please set up your school first before adding students');
 *     }
 * 
 *     if (!user.academicTerms || user.academicTerms.length === 0) {
 *       throw new ValidationException('Please set up your academic term first before adding students');
 *     }
 * 
 *     // ... rest of logic
 *   }
 * }
 */

//---------------------------------------------------------------------------------------------------------
// Using Built-in Exceptions
//---------------------------------------------------------------------------------------------------------

/**
 * You can also use NestJS built-in exceptions directly:
 * 
 * throw new BadRequestException('First name is required');
 * throw new UnauthorizedException('Unauthorised');
 * throw new NotFoundException('User not found');
 * throw new ConflictException('School name already exists');
 * throw new InternalServerErrorException('Failed to update profile');
 * 
 * The global filter will format them as { error: string }
 */

//---------------------------------------------------------------------------------------------------------
// Registering the Global Exception Filter
//---------------------------------------------------------------------------------------------------------

/**
 * In main.ts, register the global exception filter:
 * 
 * import { NestFactory } from '@nestjs/core';
 * import { AppModule } from './app.module';
 * import { ApiExceptionFilter } from './api.exceptions';
 * 
 * async function bootstrap() {
 *   const app = await NestFactory.create(AppModule);
 *   
 *   // Register global exception filter
 *   const { httpAdapterHost } = app.get(HttpAdapterHost);
 *   app.useGlobalFilters(new ApiExceptionFilter(httpAdapterHost));
 *   
 *   await app.listen(process.env.PORT ?? 5000);
 * }
 * bootstrap();
 */

//---------------------------------------------------------------------------------------------------------
// Method/Controller Scoped Filters (Optional)
//---------------------------------------------------------------------------------------------------------

/**
 * If you want to apply a filter to a specific controller or method:
 * 
 * import { Controller, Post, UseFilters } from '@nestjs/common';
 * import { ApiExceptionFilter } from './api.exceptions';
 * 
 * @Controller('profile')
 * @UseFilters(ApiExceptionFilter)  // Controller-scoped
 * export class ProfileController {
 *   @Post()
 *   @UseFilters(ApiExceptionFilter)  // Method-scoped
 *   updateProfile() {
 *     // ...
 *   }
 * }
 * 
 * Note: Prefer using classes instead of instances for better memory usage
 */

//---------------------------------------------------------------------------------------------------------
// Handling Prisma Errors
//---------------------------------------------------------------------------------------------------------

/**
 * Common Prisma error codes and how to handle them:
 * 
 * P2002 - Unique constraint violation
 *   throw new DuplicateException('Resource already exists');
 * 
 * P2025 - Record not found
 *   throw new NotFoundErrorException('Resource not found');
 * 
 * P2003 - Foreign key constraint violation
 *   throw new ValidationException('Invalid reference to related resource');
 * 
 * Example:
 * 
 * try {
 *   await prisma.school.create({ data: schoolData });
 * } catch (error) {
 *   if (error.code === 'P2002') {
 *     throw new DuplicateException('School name already exists');
 *   }
 *   throw new OperationFailedException('Failed to create school');
 * }
 */
