import {
  IsString,
  IsNotEmpty,
  IsStrongPassword,
} from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

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
  newPassword: string;
}
