// api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { HttpStatus, ValidationPipe, VersioningType } from '@nestjs/common';

async function bootstrap() {

  // Create the Nest application (With express adapter)
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

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

  // app.use(logger); Global middleware
  
  // app.use(logger);  - Global middleware
  await app.listen(configService.get<number>('port') ?? 5000);  // Extra precaution
}
bootstrap();