import { Catch, HttpException, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { mapPostgresError } from './postgres-error.mapper';
import { fail } from '../utils/api-response';
import type { ApiResponse } from '../interfaces/api-response.interface';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  // catch all exceptions and return a consistent shape
  catch(exception: unknown, host: ArgumentsHost): void {
    // Get the context (http, response, request)
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    // Initialise the status and error message with default values
    let status = 500;
    let errorMessage = 'Internal server error';

    // Handle HttpExceptions: update the status and error message from the exception
    // exception.getResponse() returns the payload nestjs attaches to the response eg, { statusCode: 404, message: 'User not found', error: 'Not Found' }
    if (exception instanceof HttpException) {
      status = exception.getStatus();  // update the status code from the exception
      errorMessage = this.extractMessage(exception.getResponse(), status);  // likewise error message
    } else {  // Handle PostgresErrors as a generic error
      const mapped = mapPostgresError(exception, 'generic');
      if (mapped) {
        status = mapped.getStatus();  // update the status code from the mapped error
        errorMessage = this.extractMessage(mapped.getResponse(), status); // likewise error message
      } else {   // Log unexpected errors only (status and errorMessage remain unchanged)
        this.logger.error(
          exception instanceof Error ? exception.stack : exception,
          {
            requestId: request.requestId,
            path: request.url,
          },
        );
      }
    }

    // cast the body as an ApiResponse and return consistent shape
    const body = fail(errorMessage, status) as ApiResponse<null>;
    response.status(status).json(body);
  }

  // Helper function to extract the (error) message from the response
  private extractMessage(res: string | object, status: number): string {
    // if the response is a string, simply return it
    if (typeof res === 'string') {
      return res;
    }

    // if the response is nest's default response object, extract the message
    const message = (res as { message?: string | string[] }).message;
    if (Array.isArray(message)) {  // validation pipes could return an array of strings. If that is the case, return the first string or a default message
      return message[0] ?? `Request failed with status ${status}`;
    }
    // Otherwise, return the message
    if (typeof message === 'string' && message.trim()) {
      return message;
    }

    // If all else fails, return a default message
    return `Request failed with status ${status}`;
  }
}
