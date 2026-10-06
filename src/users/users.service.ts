import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { DatabaseService } from 'src/database/database.service';
import { User } from './types/user.type';
import * as argon2 from 'argon2';
import { UsersRepository } from './users.repository';
import { PaginationDto } from './dto/pagination.dto';
import { UpdatePasswordDto } from './dto/dupdate-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findAll(paginationDto: PaginationDto) {
    const { page, limit } = paginationDto;
    const offset = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.usersRepository.findAll({
        limit,
        offset,
      }),
      this.usersRepository.count(),
    ]);
    return {
      data: users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  async createUser(createUserDto: CreateUserDto) {
    const { name, email, password } = createUserDto;
    const passwordHash = await argon2.hash(password);

    return this.usersRepository.create({
      name,
      email,
      passwordHash,
    });
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.usersRepository.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { name, email } = updateUserDto;

    if (email && email !== user.email) {
      const existingUser = await this.usersRepository.findByEmail(email);

      if (existingUser && existingUser.id !== id) {
        throw new ConflictException('Email is already registered');
      }
    }

    return this.usersRepository.update(id, {
      name,
      email,
    });
  }

  async updatePassword(id: string, updatePasswordDto: UpdatePasswordDto) {
    const user = await this.usersRepository.findByIdWithPassword(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await argon2.verify(
      user.password_hash,
      updatePasswordDto.currentPassword,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (updatePasswordDto.currentPassword === updatePasswordDto.newPassword) {
      throw new ConflictException(
        'New password must be different from current password',
      );
    }

    const newPasswordHash = await argon2.hash(updatePasswordDto.newPassword);

    return this.usersRepository.updatePassword(id, newPasswordHash);
  }
}
