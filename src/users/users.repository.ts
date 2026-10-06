import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { User } from './types/user.type';
import { UserCredentials } from './types/userCredentials.type';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersRepository {
  constructor(private readonly database: DatabaseService) {}

  async findAll({ limit, offset }: { limit: number; offset: number }) {
    const result = await this.database.query<User>(
      `SELECT 
      id, 
      name,
      email, 
      avatar_url, created_at, 
      updated_at 
      FROM 
      users 
      ORDER BY created_at DESC
      LIMIT $1
      OFFSET $2`,
      [limit, offset],
    );
    return result.rows;
  }

  async count() {
    const result = await this.database.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM users`,
    );
    return Number(result.rows[0].count);
  }

  async findById(id: string) {
    const result = await this.database.query<User>(
      `SELECT id, name, email, avatar_url, created_at, updated_at FROM users WHERE id = $1`,
      [id],
    );
    return result.rows[0];
  }

  async create(data: { name: string; email: string; passwordHash: string }) {
    const result = await this.database.query<User>(
      `INSERT INTO users (
            name, email, password_hash)
            VALUES ($1, $2, $3)
            RETURNING
            id, name, email, avatar_url, created_at, updated_at`,
      [data.name, data.email, data.passwordHash],
    );
    return result.rows[0];
  }

  async findByEmail(email: string) {
    const result = await this.database.query<User>(
      `SELECT 
      id,
      name, 
      email, 
      avatar_url, created_at, 
      updated_at 
      FROM users 
      WHERE email = $1`,
      [email],
    );
    return result.rows[0];
  }
  async findCredentialsByEmail(email: string) {
    const result = await this.database.query<UserCredentials>(
      `SELECT
      id,
      email,
      password_hash as "passwordHash"
      FROM users
      WHERE email = $1`,
      [email],
    );
    return result.rows[0];
  }

  async findByIdWithPassword(id: string) {
    const result = await this.database.query(
      `
      SELECT
        id,
        name,
        email,
        password_hash,
        avatar_url,
        created_at,
        updated_at
      FROM users
      WHERE id = $1
      `,
      [id],
    );

    return result.rows[0] ?? null;
  }

  async update(id: string, data: UpdateUserDto) {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) {
      fields.push(`name = $${values.length + 1}`);
      values.push(data.name);
    }

    if (data.email !== undefined) {
      fields.push(`email = $${values.length + 1}`);
      values.push(data.email);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);

    values.push(id);

    const result = await this.database.query(
      `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${values.length}
      RETURNING
        id,
        name,
        email,
        avatar_url,
        created_at,
        updated_at
      `,
      values,
    );

    return result.rows[0] ?? null;
  }

  async updatePassword(id: string, passwordHash: string) {
    const result = await this.database.query(
      `
      UPDATE users
      SET
        password_hash = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        name,
        email,
        avatar_url,
        created_at,
        updated_at
      `,
      [passwordHash, id],
    );

    return result.rows[0] ?? null;
  }
}
