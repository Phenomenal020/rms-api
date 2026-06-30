import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { ApiResponse } from '../interfaces/api-response.interface';
import { SKIP_RESPONSE_TRANSFORM_KEY } from '../decorators/skip-response-transform.decorator';

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

  // Helper method that checks if the body is already an ApiResponse and returns it as is, otherwise it normalises the response to the ApiResponse interface
  private normaliseResponse(body: T): ApiResponse<T> | T {
    if (this.isApiResponse(body)) {
      return body;
    }  // if the body is already an ApiResponse, return it as is

    return { success: true, data: body } as ApiResponse<T>;
  }

  // Helper method that checks if the body is an ApiResponse
  private isApiResponse(body: T): boolean {
    return (
      typeof body === 'object' &&
      body !== null &&
      (body as unknown as ApiResponse<T>).success === true &&
      'data' in body
    );
  }
}
