import { CallHandler, ExecutionContext, Injectable, NestInterceptor, RequestTimeoutException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, TimeoutError, catchError, throwError, timeout } from 'rxjs';
import { TIMEOUT_MS_KEY } from '../decorators/timeout.decorator';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(
    private readonly defaultMs: number,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ms =
      this.reflector.getAllAndOverride<number>(TIMEOUT_MS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? this.defaultMs;

    return next.handle().pipe(
      timeout(ms),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () => new RequestTimeoutException(`Request timed out after ${ms}ms`),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}