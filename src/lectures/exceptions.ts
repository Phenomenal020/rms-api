// Exceptions
// Nest comes with a built-in exceptions layer which is responsible for processing all unhandled exceptions across an application. When an exception is not handled by your application code, it is caught by this layer, which then automatically sends an appropriate user-friendly response.

//---------------------------------------------------------------------------------------------------------

// Throwing standard exceptions
// @Get()
// async findAll() {
//   throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
// }

//---------------------------------------------------------------------------------------------------------
// When an exception is unrecognized (is neither HttpException nor a class that inherits from HttpException), the built-in exception filter generates the following default JSON response:
// {
//   "statusCode": 500,
//   "message": "Internal server error"
// }

//---------------------------------------------------------------------------------------------------------
// @Get() - overriding the entire response body and providing an error cause:
// async findAll() {
//   try {
//     await this.service.findAll()
//   } catch (error) {
//     throw new HttpException({
//       status: HttpStatus.FORBIDDEN,
//       error: 'This is a custom message',
//     }, HttpStatus.FORBIDDEN, {
//       cause: error
//     });
//   }
// }

//---------------------------------------------------------------------------------------------------------
// Exceptions Logging
// By default, the exception filter does not log built-in exceptions like HttpException (and any exceptions that inherit from it). When these exceptions are thrown, they won't appear in the console, as they are treated as part of the normal application flow.
// If you want to log these exceptions, you can create a custom exception filter. 
// export class ForbiddenException extends HttpException {
//     constructor() {
//       super('Forbidden', HttpStatus.FORBIDDEN);
//     }
//   }


// Built-in HTTP exceptions: 
// BadRequestException
// UnauthorizedException
// NotFoundException
// ForbiddenException
// NotAcceptableException
// RequestTimeoutException
// ConflictException
// GoneException
// HttpVersionNotSupportedException
// PayloadTooLargeException
// UnsupportedMediaTypeException
// UnprocessableEntityException
// InternalServerErrorException
// NotImplementedException
// ImATeapotException
// MethodNotAllowedException
// BadGatewayException
// ServiceUnavailableException
// GatewayTimeoutException
// PreconditionFailedException


// You can use these built-in exceptions this way
// throw new BadRequestException('Something bad happened', {
//     cause: new Error(),
//     description: 'Some error description',
//   });

//---------------------------------------------------------------------------------------------------------
// Exception filters#
// While the base (built-in) exception filter can automatically handle many cases for you, you may want full control over the exceptions layer. For example, you may want to add logging or use a different JSON schema based on some dynamic factors. Exception filters are designed for exactly this purpose. They let you control the exact flow of control and the content of the response sent back to the client.

// Let's create an exception filter that is responsible for catching exceptions which are an instance of the HttpException class, and implementing custom response logic for them. To do this, we'll need to access the underlying platform Request and Response objects. We'll access the Request object so we can pull out the original url and include that in the logging information. We'll use the Response object to take direct control of the response that is sent, using the response.json() method.

// import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
// import { Request, Response } from 'express';

// @Catch(HttpException)
// export class HttpExceptionFilter implements ExceptionFilter {
//   catch(exception: HttpException, host: ArgumentsHost) {
//     const ctx = host.switchToHttp();
//     const response = ctx.getResponse<Response>();
//     const request = ctx.getRequest<Request>();
//     const status = exception.getStatus();

//     response
//       .status(status)
//       .json({
//         statusCode: status,
//         timestamp: new Date().toISOString(),
//         path: request.url,
//       });
//   }
// }

// The idea: All exception filters should implement the generic ExceptionFilter<T> interface. This requires you to provide the catch(exception: T, host: ArgumentsHost) method with its indicated signature. T indicates the type of the exception.

// The @Catch() decorator may take a single parameter, or a comma-separated list. This lets you set up the filter for several types of exceptions at once.

//---------------------------------------------------------------------------------------------------------
// ArgumentsHost
// The ArgumentsHost interface is a utility class that provides access to the arguments being processed for the current execution context. It is used to retrieve the request and response objects from the current execution context. The reason for this level of abstraction is that ArgumentsHost functions in all contexts (e.g., the HTTP server context we're working with now, but also Microservices and WebSockets)

// --------------------------------------------------------------------------------------------------------
// Binding Filters
// @Post()
// @UseFilters(new HttpExceptionFilter())
// async create(@Body() createCatDto: CreateCatDto) {
//     throw new ForbiddenException();
// }  <-- Controller file

// Similar to the @Catch() decorator, it can take a single filter instance, or a comma-separated list of filter instances.
// Alternatively, you may pass the class (instead of an instance), leaving responsibility for instantiation to the framework, and enabling dependency injection.

// Prefer applying filters by using classes instead of instances when possible. It reduces memory usage since Nest can easily reuse instances of the same class across your entire module.

//---------------------------------------------------------------------------------------------------------
// Scoping Filters
// Exception filters can be scoped at different levels: method-scoped of the controller/resolver/gateway, controller-scoped, or global-scoped.


// @Controller()
// @UseFilters(new HttpExceptionFilter())
// export class CatsController {}  <-- Controller scoped (available for every route handler defined inside the controller)
// --------------------------------------------------------------------------------------------------------

// Global scoped filters
// @appModule
// app.useGlobalFilters(new HttpExceptionFilter());

// --------------------------------------------------------------------------------------------------------
// Catch everything#
// In order to catch every unhandled exception (regardless of the exception type), leave the @Catch() decorator's parameter list empty, e.g., @Catch().

// In the example below we have a code that is platform-agnostic because it uses the HTTP adapter to deliver the response, and doesn't use any of the platform-specific objects (Request and Response) directly:

// import {
//     ExceptionFilter,
//     Catch,
//     ArgumentsHost,
//     HttpException,
//     HttpStatus,
//   } from '@nestjs/common';
//   import { HttpAdapterHost } from '@nestjs/core';
  
//   @Catch()
//   export class CatchEverythingFilter implements ExceptionFilter {
//     constructor(private readonly httpAdapterHost: HttpAdapterHost) {}
  
//     catch(exception: unknown, host: ArgumentsHost): void {
//       // In certain situations `httpAdapter` might not be available in the
//       // constructor method, thus we should resolve it here.
//       const { httpAdapter } = this.httpAdapterHost;
  
//       const ctx = host.switchToHttp();
  
//       const httpStatus =
//         exception instanceof HttpException
//           ? exception.getStatus()
//           : HttpStatus.INTERNAL_SERVER_ERROR;
  
//       const responseBody = {
//         statusCode: httpStatus,
//         timestamp: new Date().toISOString(),
//         path: httpAdapter.getRequestUrl(ctx.getRequest()),
//       };
  
//       httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
//     }
//   }
  

// --------------------------------------------------------------------------------------------------------