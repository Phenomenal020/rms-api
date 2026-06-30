import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { mapPostgresError } from './postgres-error.mapper';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    // Get the context (http, response, request)
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    // Initialise the status and body
    let status = 500;
    let body: Record<string, unknown>;

    // Handle HttpExceptions
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      body =
        typeof res === 'string'
          ? { statusCode: status, message: res }
          : { statusCode: status, ...(res as object) };
    } else {
      // Handle PostgresErrors
      const mapped = mapPostgresError(exception, 'generic');
      if (mapped) {
        status = mapped.getStatus();
        const res = mapped.getResponse();
        body =
          typeof res === 'string'
            ? { statusCode: status, message: res }
            : { statusCode: status, ...(res as object) };
      } else {
        // Handle other errors
        this.logger.error(
          exception instanceof Error ? exception.stack : exception,
          {
            requestId: request.requestId,
            path: request.url,
          },
        );
        body = {
          statusCode: 500,
          message: 'Internal server error',
        };
      }
    }

    if (request.requestId) {
      body.requestId = request.requestId;
    }

    response.status(status).json(body);
  }
}