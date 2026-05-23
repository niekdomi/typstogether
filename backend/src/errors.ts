export abstract class HttpError extends Error {
  abstract readonly status: number;
}

export class UnauthorizedError extends HttpError {
  readonly status = 401;
}

export class ForbiddenError extends HttpError {
  readonly status = 403;
}

export class NotFoundError extends HttpError {
  readonly status = 404;
}

export class ConflictError extends HttpError {
  readonly status = 409;
}

export class GoneError extends HttpError {
  readonly status = 410;
}

export class UnsupportedMediaTypeError extends HttpError {
  readonly status = 415;
}

export class BadGatewayError extends HttpError {
  readonly status = 502;
}
