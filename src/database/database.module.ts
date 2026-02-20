// This file defines a (drizzle) database connection module (provider)
// Drizzle doesn't have an official @nestjs/drizzle package (yet), so this file uses a custom provuder with drizle() factory.

import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";
import { DATABASE_CONNECTION } from "./database-connection.token";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../auth/schema";

@Module({
    providers: [
        {
            provide: DATABASE_CONNECTION,  // key/id
            useFactory: (configService: ConfigService) => {  // Create this only when nest is ready with these dependencies
                const pool = new Pool({
                    connectionString: configService.get('database.url'),
                    // max: 10,                       // max connections in pool
                    // idleTimeoutMillis: 30_000,     // close idle connections after 30s
                    // connectionTimeoutMillis: 10_000, // timeout if connection takes >10s
                });

                // Handle unexpected connection errors gracefully 
                // (e.g. Neon dropping idle connections) instead of crashing
                pool.on('error', (err) => {
                    console.error('Unexpected database pool error:', err.message); // TODO: Change to logging
                });

                return drizzle(pool, {
                    schema: {
                        ...schema,
                    }
                });
            },
            inject: [ConfigService],  // inject ConfigService to use 
        }
    ],
    exports: [DATABASE_CONNECTION],  // export the connection to be used in other modules
})

export class DatabaseModule { }