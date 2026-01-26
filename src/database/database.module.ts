// This file defines a database connection module (provider)

import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Pool } from "pg";
import { DATABASE_CONNECTION } from "./database-connection.token";
import { drizzle } from "drizzle-orm/node-postgres";
import * as authSchema from "../auth/schema";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
    ],
    providers: [
        {
            provide: DATABASE_CONNECTION,  // key/id
            useFactory: (configService: ConfigService) => {  // Create this only when nest is ready with these dependencies
                const pool = new Pool({
                    connectionString: configService.get('DATABASE_URL'),
                });
                return drizzle(pool, {
                    schema: {
                        ...authSchema,
                    }
                });
            },
            inject: [ConfigService],  // inject ConfigService to use 
        }
    ],
    exports: [DATABASE_CONNECTION],  // export the connection to be used in other modules
})

export class DatabaseModule { }