// Resources: https://docs.nestjs.com/middleware

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// You implement custom Nest middleware in either a function, or in a class with an @Injectable() decorator.
// The class should implement the NestMiddleware interface, while the function does not have any special requirements.
// @Injectable()
// export class LoggerMiddleware implements NestMiddleware {
//     use(req: Request, res: Response, next: NextFunction) {
//         console.log('Request...', request);
//         next();
//     }
// }


// Functional middleware  - Consider using the simpler functional middleware alternative any time your middleware doesn't need any dependencies.
// import { Request, Response, NextFunction } from 'express';

// export function logger(req: Request, res: Response, next: NextFunction) {
//   // console.log(`Request...`, req);
//   next();
// };
// 