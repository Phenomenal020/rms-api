import { ApiResponse } from '../interfaces/api-response.interface';

// Standard success envelope for Nest service/controller returns
export function ok<T>(data: T | null = null): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    statusCode: 200,
  };
}

// Standard error envelope (used by the global exception filter)
export function fail(error: string, statusCode: number): ApiResponse<null> {
  return {
    success: false,
    data: null,
    error,
    statusCode,  // Unlike in ok(), default status code is set before this function is called
  };
}