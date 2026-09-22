export interface ResultOk<T> {
    ok: true;
    value: T;
}
export interface ResultErr<E> {
    ok: false;
    error: E;
}
export type Result<T, E = Error> = ResultOk<T> | ResultErr<E>;
export declare function ok<T>(value: T): ResultOk<T>;
export declare function err<E>(error: E): ResultErr<E>;
export declare function isOk<T, E>(result: Result<T, E>): result is ResultOk<T>;
export declare function isErr<T, E>(result: Result<T, E>): result is ResultErr<E>;
//# sourceMappingURL=result.d.ts.map