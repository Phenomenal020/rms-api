import { HttpException, InternalServerErrorException } from '@nestjs/common';
import { mapPostgresError, PgErrorContext } from './postgres-error.mapper';

export async function runWithDbContext<T>(
  // The context of the error
  context: PgErrorContext,
  // The fallback message to use if no match is found
  fallbackMessage: string,
  // The function to run
  fn: () => Promise<T>,
): Promise<T> {
  try {
    // Run the function
    return await fn();
  } catch (error) {
    // Handle HttpExceptions
    if (error instanceof HttpException) {
      throw error;
    }
    // Handle PostgresErrors (via mapper function)
    const mapped = mapPostgresError(error, context);
    if (mapped) {
      throw mapped;
    }
    // Handle other errors if no match is found
    throw new InternalServerErrorException(fallbackMessage);
  }
}