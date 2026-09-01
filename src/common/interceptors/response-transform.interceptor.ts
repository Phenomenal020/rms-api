import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { ApiResponse } from '../interfaces/api-response.interface';
import { SKIP_RESPONSE_TRANSFORM_KEY } from '../decorators/skip-response-transform.decorator';
import { ok } from '../utils/api-response';

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  constructor(private readonly reflector: Reflector) { }

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T> | T> {
    // check if the skipResponseTransform decorator is applied to the controller or the method
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_RESPONSE_TRANSFORM_KEY,
      [context.getHandler(), context.getClass()],
    );
    // if it is, simply return the response as is
    if (skip) {
      return next.handle();
    }

    // http context is implicitly assumed
    // otherwise, normalise the response to the ApiResponse interface
    return next.handle().pipe(map((body) => this.normaliseResponse(body)));
  }

  // Pass through bodies that already match the envelope;
  // Wrap unmatched bodies in an ApiResponse with the defaults
  private normaliseResponse(body: T): ApiResponse<T> | T {
    if (this.isApiResponse(body)) {
      return body;
    }

    // if the body is not an ApiResponse, set it to null and return the default values
    return ok(body ?? null) as ApiResponse<T>;
  }

  // check if the body is an ApiResponse. Returns true if it is, false otherwise
  private isApiResponse(body: T): boolean {
    if (typeof body !== 'object' || body === null) {
      return false;
    }
    const candidate = body as unknown as ApiResponse<T>;
    return (
      typeof candidate.success === 'boolean' &&
      'data' in candidate &&
      'error' in candidate &&
      'statusCode' in candidate
    );
  }
}
