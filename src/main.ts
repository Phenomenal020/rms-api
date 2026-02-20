// api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { HttpStatus, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,  // strip unknown properties
    forbidNonWhitelisted: true, // throw an error if unknown properties are foun
    transform: true, // auto-transform payloads to the DTO type
    disableErrorMessages: false, // hide detailed validation errors in the response (false for now)
    stopAtFirstError: true, // stop validation after the first error
    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY, // 422 status code for validation errors
  }));

  const configService = app.get(ConfigService);
  
  // Enable CORS with credentials to allow cookies
  app.enableCors({
    origin: configService.get('clientUrl'),
    credentials: true, // Crucial for cookies to work
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  });
  
  // app.use(logger);  - Global middleware
  await app.listen(configService.get<number>('port') ?? 5000);  // Extra precaution
}
bootstrap();