import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterUserDto } from './dto';
import { hash } from 'bcrypt';
import { PostgresErrorCode } from '../database/postgres-error-code.enum';
import { PasswordService } from './password';
import { configuration } from '../config';
import { SomethingWentWrongException, UserExistsException, WrongCredentialsException } from '../exception';
import { User } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private passwordService: PasswordService,
  ) { }

  async registerUser(data: RegisterUserDto) {
    const { password, ...rest } = data;

    const hashedPassword = await hash(password, 10);

    try {
      const createdUser = await this.usersService.create({
        ...rest,
        password: hashedPassword
      });
      return new User(createdUser);
    } catch (error) {
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new UserExistsException();
      }
      throw new SomethingWentWrongException(error.code);
    }

    // TODO: send email verification
  }

  async getAuthenticatedUser(email: string, plainTextPassword: string): Promise<Omit<User, 'password'> | null> {
    try {
      const user = await this.usersService.findOneByEmail(email);
      await this.passwordService.verifyPassword(plainTextPassword, user.password);
      user.password = undefined;

      return user;
    } catch (error) {
      throw new WrongCredentialsException();
    }
  }

  getCookieWithJwtToken(userId: TokenPayload['userId']) {
    const payload: TokenPayload = { userId };
    const token = this.jwtService.sign(payload);

    return `Authentication=${token}; HttpOnly; Path=/; Max-Age=${configuration().jwt.accessToken.expirationTime}`;
  }

  getCookieForLogOut() {
    return `Authentication=; HttpOnly; Path=/; Max-Age=0`;
  }
}