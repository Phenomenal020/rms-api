// This file defines a (drizzle) database connection module (provider)
// Drizzle doesn't have an official @nestjs/drizzle package (yet), so this file uses a custom provuder with drizle() factory.
// The DB Module is delebrately not made a Global module to make dependencies obvious, avoid surprise coupling, and prevent accidental multiple “hidden” providers when the app grows


import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";
import { DATABASE_CONNECTION, DATABASE_POOL } from "./database-connection.token";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../auth/schema";
import { DatabaseShutdownService } from "./database-shutdown.service";


// @Global()
@Module({
    providers: [
        DatabaseShutdownService,
        // Database pool provider
        {
            provide: DATABASE_POOL,
            useFactory: (configService: ConfigService) => {
                const pool = new Pool({
                    connectionString: configService.get('database.url'),
                    // max: 10,                       // max connections in pool
                    // idleTimeoutMillis: 30_000,     // close idle connections after 30s
                    // connectionTimeoutMillis: 10_000, // timeout if connection takes >10s
                });

                pool.on('error', (err) => {
                    console.error('Unexpected database pool error:', err.message); // TODO: Change to logging
                });

                return pool;
            },
            inject: [ConfigService],
        },
        // Database connection provider
        {
            provide: DATABASE_CONNECTION,  // key/id
            useFactory: (pool: Pool) =>
                drizzle(pool, {
                    schema: {
                        ...schema,
                    },
                }),
            inject: [DATABASE_POOL],
        },
    ],
    exports: [DATABASE_CONNECTION],  // export the connection to be used in other modules
})

export class DatabaseModule { }