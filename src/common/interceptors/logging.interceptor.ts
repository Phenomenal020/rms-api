import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';

type RequestWithContext = Request & {
  requestId?: string;
  user?: { id?: string };
  session?: { user?: { id?: string } };
};

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // get the http context, request and response objects
    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithContext>();
    const res = http.getResponse<Response>();

    // take note of the start time
    const startedAt = Date.now();

    // Same lookup pattern used by OrgAdminGuard; works after global AuthGuard.
    const userId = req.user?.id ?? req.session?.user?.id ?? 'anonymous';

    // get the controller and handler names
    const controller = context.getClass().name;
    const handler = context.getHandler().name;

    // handle the request, then log the relevant info: requestId, userId, method, path, handler, status and duration
    return next.handle().pipe(
      tap(() => {
        this.logger.log(
          JSON.stringify({
            requestId: req.requestId,
            userId,
            method: req.method,
            path: req.originalUrl,
            handler: `${controller}.${handler}`,
            status: res.statusCode,
            durationMs: Date.now() - startedAt,
          }),
        );
      }),
    );
  }
}
