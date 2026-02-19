export interface AuthResult {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshTokenExpirationMs: number;
}