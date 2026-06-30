  // middlewares/request-id.middleware.ts
  import { Request, Response, NextFunction } from 'express';

  export function requestId(req: Request, res: Response, next: NextFunction) {
    // console.log("request before", req)
    const id = (req.headers['x-request-id'] as string) ?? crypto.randomUUID();
    req['requestId'] = id;           // attach for later middleware / interceptors
    res.setHeader('X-Request-Id', id);
    // console.log("request after", req)
    next();
  }