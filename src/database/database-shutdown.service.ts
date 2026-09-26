// log the sigterm signal and close the database pool

import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from './database-connection.token';

@Injectable()
export class DatabaseShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseShutdownService.name);

  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(
      `Closing PostgreSQL pool${signal ? ` (${signal})` : ''}`,
    );
    await this.pool.end();
  }
}
