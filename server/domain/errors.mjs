export class DomainError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "DomainError";
    this.code = code;
    this.httpStatus = options.httpStatus ?? 400;
  }
}
