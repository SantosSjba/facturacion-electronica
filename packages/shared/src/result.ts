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
