  // middlewares/request-logger.middleware.ts
  import { Request, Response, NextFunction } from 'express';
  
  export function requestLogger(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    res.on('finish', () => {
      // Replace console with Pino/Winston/Datadog later
      // console.log(JSON.stringify({
      //   requestId: req['requestId'],
      //   method: req.method,
      //   path: req.originalUrl,
      //   status: res.statusCode,
      //   durationMs: Date.now() - start,
      // }));
    });
    next();
  }