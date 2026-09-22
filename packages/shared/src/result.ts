export interface ResultOk<T> {
  ok: true;
  value: T;
}

export interface ResultErr<E> {
  ok: false;
  error: E;
}

export type Result<T, E = Error> = ResultOk<T> | ResultErr<E>;

export function ok<T>(value: T): ResultOk<T> {
  return { ok: true, value };
}

export function err<E>(error: E): ResultErr<E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is ResultOk<T> {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is ResultErr<E> {
  return !result.ok;
}
