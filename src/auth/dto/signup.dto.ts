import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsStrongPassword,
  IsNotEmpty,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from 'generated/prisma/client';

export class SignUpDto {
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 0,
  }, {
    message: 'Password must have at least 8 characters, one uppercase letter, one lowercase letter and one number'
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  fullName: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
