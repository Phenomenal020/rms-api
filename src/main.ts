import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { HttpStatus, Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Create the Nest application (With express adapter)
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // Cloud Run: SIGTERM on scale-in / new revision → close HTTP server, lifecycle hooks, then exit.
  app.enableShutdownHooks(['SIGTERM', 'SIGINT'], { useProcessExit: true });

  app.useBodyParser('json', { limit: '100kb' });
  app.use(helmet());

  // Register the global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // use the reflector class to get the metadata of the controller and the method (we'll be looking for the skipResponse decorator)
  const reflector = app.get(Reflector);
  // Order matters: outer -> inner.
  // - Timeout wraps the entire handler chain
  // - ResponseTransform is closest to the handler (final success envelope)
  // LoggingInterceptor is opt-in per controller via @UseInterceptors (see classes/).
  app.useGlobalInterceptors(
    new TimeoutInterceptor(15_000, reflector),
    new ResponseTransformInterceptor(reflector),
  );   // Register global interceptors. We use the reflector to skip the response transform for certain controllers and methods.

  // Enable api versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'api/v',
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,  // strip unknown properties
    forbidNonWhitelisted: true, // throw an error if unknown properties are found
    transform: true, // auto-transform payloads to the DTO type
    disableErrorMessages: false, // hide detailed validation errors in the response (false for development)
    stopAtFirstError: true, // stop validation after the first error
    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY, // 422 status code for validation errors
  }));

  // Get the config service
  const configService = app.get(ConfigService);
  
  // Enable CORS with credentials to allow cookies
  app.enableCors({
    origin: configService.get('clientUrl'),
    credentials: true, // Crucial for cookies to work
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  });

  const port = configService.get<number>('port') ?? 5000;
  await app.listen(port);
  logger.log(`Listening on port ${port}`);
}
bootstrap();
