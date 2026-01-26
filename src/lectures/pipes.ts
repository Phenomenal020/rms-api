//1. Pipes have two typical use cases:
// transformation: transform input data to the desired form (e.g., from string to integer)
// validation: evaluate input data and if valid, simply pass it through unchanged; otherwise, throw an exception

// Nest interposes (inserts) a pipe just before a method is invoked, and the pipe receives the arguments destined for the method and operates on them. Any transformation or validation operation takes place at that time, after which the route handler is invoked with any (potentially) transformed arguments.

//---------------------------------------------------------------------------------------------------------

//2. Binding pipes (Transformation pipes)
// To use a pipe, we want to associate the pipe with a particular route handler method, and make sure it runs before the method is called.


// In the example above, we pass a class (ParseIntPipe), not an instance, leaving responsibility for instantiation to the framework and enabling dependency injection. 

// @Get(':id')
// async findOne(@Param('id', ParseIntPipe) id: number) {
//   return this.catsService.findOne(id);
// }

// As with pipes and guards, we can instead pass an in-place instance. Passing an in-place instance is useful if we want to customize the built-in pipe's behavior by passing options:


// @Get(':id')
// async findOne(
//   @Param('id', new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_ACCEPTABLE }))
//   id: number,
// ) {
//   return this.catsService.findOne(id);
// }

// --------------------------------------------------------------------------------------------------------

//3. Custom pipes

// As mentioned, you can build your own custom pipes. While Nest provides a robust built-in ParseIntPipe and ValidationPipe, let's build simple custom versions of each from scratch to see how custom pipes are constructed.

// PipeTransform<T, R> is a generic interface that must be implemented by any pipe. The generic interface uses T to indicate the type of the input value, and R to indicate the return type of the transform() method.

// Every pipe must implement the transform() method to fulfill the PipeTransform interface contract. This method has two parameters: value and metadata.

// The value parameter is the currently processed method argument (before it is received by the route handling method), and metadata is the currently processed method argument's metadata. The metadata object has these properties:

// export interface ArgumentMetadata {
//     type: 'body' | 'query' | 'param' | 'custom';
//     metatype?: Type<unknown>;
//     data?: string;
// }

// Now, for some schema validation

// 3A. dto.ts file  ✅
// import { z } from 'zod';
// export const createCatSchema = z
//     .object({
//         name: z.string(),
//         age: z.number(),
//         breed: z.string(),
//     })
//     .required();
// export type CreateCatDto = z.infer<typeof createCatSchema>;

// npm install --save zod

//3B zod.pipe.ts file (the pipe transform) ✅
// import { PipeTransform, ArgumentMetadata, BadRequestException } from '@nestjs/common';
// import { ZodSchema  } from 'zod';
// export class ZodValidationPipe implements PipeTransform {
//   constructor(private schema: ZodSchema) {}  <---
//   transform(value: unknown, metadata: ArgumentMetadata) {
//     try {
//       const parsedValue = this.schema.parse(value);  <--- 
//       return parsedValue;
//     } catch (error) {
//       throw new BadRequestException('Validation failed');
//     }
//   }
// }

// type	Indicates whether the argument is a body @Body(), query @Query(), param @Param(), or a custom parameter (read more here).

// metatype	Provides the metatype of the argument, for example, String. Note: the value is undefined if you either omit a type declaration in the route handler method signature, or use vanilla JavaScript.

// data	The string passed to the decorator, for example @Body('string'). It's undefined if you leave the decorator parenthesis empty.

//3C. Binding Pipes (Validation pipes)

// In the controller:
// @Post() ✅
// @UsePipes(new ZodValidationPipe(createCatSchema))  - creates an instance of the zodValidationPipe + pass the context-specific zod schema in the class constructor of the pipe
// async create(@Body() createCatDto: CreateCatDto) {
//   this.catsService.create(createCatDto);  // Bind the pipe to the method
// }

// --------------------------------------------------------------------------------------------------------

//4. Using class-validator package
// class-validator is a library that uses decorators to define validation rules on DTO classes.
// It works seamlessly with NestJS's built-in ValidationPipe.

// npm install class-validator class-transformer

//4A. dto.ts file with class-validator decorators ✅
// import { IsString, IsNotEmpty, IsNumber, IsInt, Min } from 'class-validator';
//
// export class CreateCatDto {
//   @IsString()
//   @IsNotEmpty()
//   name: string;
//
//   @IsNumber()
//   @IsInt()
//   @Min(0)
//   age: number;
//
//   @IsString()
//   @IsNotEmpty()
//   breed: string;
// }

//4B. Common class-validator decorators ✅
// String validation:
// @IsString() - Must be a string
// @IsNotEmpty() - Must not be empty
// @MinLength(3) - Minimum length
// @MaxLength(100) - Maximum length
// @Matches(/^[a-zA-Z]+$/) - Regex pattern
// @IsEmail() - Must be a valid email
//
// Number validation:
// @IsNumber() - Must be a number
// @IsInt() - Must be an integer
// @Min(0) - Minimum value
// @Max(100) - Maximum value
// @IsPositive() - Must be positive
//
// Array validation:
// @IsArray() - Must be an array
// @ArrayMinSize(1) - Minimum array length
// @ArrayMaxSize(10) - Maximum array length
//
// Optional fields:
// @IsOptional() - Field is optional
//
// Enum validation:
// @IsEnum(MyEnum) - Must be one of the enum values
//
// Date validation:
// @IsDateString() - Must be a valid date string
// @IsDate() - Must be a Date object
//
// Boolean validation:
// @IsBoolean() - Must be a boolean

//4C. Transformation with class-transformer ✅
// class-transformer can transform plain objects to class instances and transform values.
//
// import { Transform } from 'class-transformer';
//
// export class CreateCatDto {
//   @IsString()
//   @IsNotEmpty()
//   name: string;
//
//   @Transform(({ value }) => parseInt(value))  // Transform string to number
//   @IsNumber()
//   @IsInt()
//   age: number;
//
//   @IsString()
//   @IsNotEmpty()
//   breed: string;
// }

// --------------------------------------------------------------------------------------------------------

//5. Using NestJS built-in ValidationPipe
// ValidationPipe is NestJS's built-in pipe that uses class-validator and class-transformer.
// It automatically validates DTOs decorated with class-validator decorators.

//5A. Enable ValidationPipe globally (recommended) ✅
// In main.ts:
//
// import { NestFactory } from '@nestjs/core';
// import { ValidationPipe } from '@nestjs/common';
// import { AppModule } from './app.module';
//
// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);
//
//   // Enable ValidationPipe globally
//   app.useGlobalPipes(new ValidationPipe({
//     whitelist: true,              // Strip properties that don't have decorators
//     forbidNonWhitelisted: true,    // Throw error if non-whitelisted properties exist
//     transform: true,               // Automatically transform payloads to DTO instances
//     transformOptions: {
//       enableImplicitConversion: true,  // Automatically convert types (e.g., string to number)
//     },
//   }));
//
//   await app.listen(3000);
// }
// bootstrap();

//5B. Enable ValidationPipe at controller level ✅
// In controller:
//
// import { Controller, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
// import { CreateCatDto } from './dto/create-cat.dto';
//
// @Controller('cats')
// @UsePipes(new ValidationPipe())  // Controller-scoped
// export class CatsController {
//   @Post()
//   async create(@Body() createCatDto: CreateCatDto) {
//     // ValidationPipe automatically validates createCatDto
//     return this.catsService.create(createCatDto);
//   }
// }

//5C. Enable ValidationPipe at method level ✅
// In controller:
//
// import { Controller, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
// import { CreateCatDto } from './dto/create-cat.dto';
//
// @Controller('cats')
// export class CatsController {
//   @Post()
//   @UsePipes(new ValidationPipe())  // Method-scoped
//   async create(@Body() createCatDto: CreateCatDto) {
//     return this.catsService.create(createCatDto);
//   }
// }

//5D. Enable ValidationPipe at parameter level ✅
// In controller:
//
// import { Controller, Post, Body, ValidationPipe } from '@nestjs/common';
// import { CreateCatDto } from './dto/create-cat.dto';
//
// @Controller('cats')
// export class CatsController {
//   @Post()
//   async create(@Body(ValidationPipe) createCatDto: CreateCatDto) {
//     // ValidationPipe validates only this parameter
//     return this.catsService.create(createCatDto);
//   }
// }

//5E. ValidationPipe options explained ✅
// new ValidationPipe({
//   whitelist: true,
//   // Removes properties that don't have any decorators
//   // Example: If DTO has @IsString() name, but request has { name: "Fluffy", extra: "data" }
//   // Result: { name: "Fluffy" } - extra is stripped
//
//   forbidNonWhitelisted: true,
//   // Throws error if non-whitelisted properties are present
//   // Example: Request { name: "Fluffy", extra: "data" } throws BadRequestException
//
//   transform: true,
//   // Automatically transforms plain objects to DTO class instances
//   // Enables class-transformer transformations
//
//   transformOptions: {
//     enableImplicitConversion: true,
//     // Automatically converts types (string "3" → number 3)
//     // Works with @IsNumber(), @IsInt(), etc.
//   },
//
//   disableErrorMessages: false,
//   // Set to true to disable detailed error messages (not recommended)
//
//   validationError: {
//     target: false,  // Don't include target object in error response
//     value: false,   // Don't include invalid value in error response
//   },
//
//   exceptionFactory: (errors) => {
//     // Custom exception factory
//     return new BadRequestException(errors);
//   },
// })

//5F. Complete example with class-validator + ValidationPipe ✅
// dto/create-cat.dto.ts:
//
// import { IsString, IsNotEmpty, IsNumber, IsInt, Min } from 'class-validator';
//
// export class CreateCatDto {
//   @IsString()
//   @IsNotEmpty()
//   name: string;
//
//   @IsNumber()
//   @IsInt()
//   @Min(0)
//   age: number;
//
//   @IsString()
//   @IsNotEmpty()
//   breed: string;
// }
//
// controller.ts:
//
// import { Controller, Post, Body } from '@nestjs/common';
// import { CreateCatDto } from './dto/create-cat.dto';
//
// @Controller('cats')
// export class CatsController {
//   @Post()
//   // ValidationPipe (if global) automatically validates createCatDto
//   async create(@Body() createCatDto: CreateCatDto) {
//     return this.catsService.create(createCatDto);
//   }
// }
//
// main.ts:
//
// app.useGlobalPipes(new ValidationPipe({
//   whitelist: true,
//   forbidNonWhitelisted: true,
//   transform: true,
// }));