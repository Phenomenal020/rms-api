import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { runWithDbContext } from '../common/filters/run-with-db-context';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import * as schema from '../auth/schema';
import { user } from '../auth/schema';
import { eq } from 'drizzle-orm';
import { UpdateProfileDto } from './dto/update-profile.dto';

// UsersService
@Injectable()
export class UsersService {

  // Inject the database connection
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,  // with drizzle client
  ) { }

  async updateProfile(userId: string, updateData: UpdateProfileDto) {
    return runWithDbContext('user', 'Failed to update user profile', async () => {
      const [updatedUser] = await this.db
        .update(user)
        .set({
          firstName: updateData.firstName,
          lastName: updateData.lastName,
          name: `${updateData.firstName} ${updateData.lastName}`,
        })
        .where(eq(user.id, userId))
        .returning({ id: user.id });

      if (!updatedUser) {
        throw new NotFoundException('User not found');
      }
    });
  }

  async getUser(userId: string) {
    return runWithDbContext('user', 'Failed to fetch user', async () => {
      const [userData] = await this.db
        .select({
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (!userData) {
        throw new NotFoundException('User not found');
      }

      return userData;
    });
  }
}
