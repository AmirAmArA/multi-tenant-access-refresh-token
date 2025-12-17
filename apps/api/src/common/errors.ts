export class AuthenticationError extends Error {
  constructor(message: string = "Authentication failed") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class InvalidCredentialsError extends AuthenticationError {
  constructor(message: string = "Invalid email or password") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

export class InvalidTokenError extends AuthenticationError {
  constructor(message: string = "Invalid or expired refresh token") {
    super(message);
    this.name = "InvalidTokenError";
  }
}
