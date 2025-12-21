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

export class DuplicateEmailError extends Error {
  constructor(message: string = "Email already registered") {
    super(message);
    this.name = "DuplicateEmailError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string = "Resource not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}
