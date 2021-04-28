export default class CustomError extends Error {
  constructor(...args: any[]) {
    super(...args);
    Error.captureStackTrace(this, CustomError);
    this.name = 'CustomError';
  }
}
