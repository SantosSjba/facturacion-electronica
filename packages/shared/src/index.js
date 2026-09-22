"use strict";
/**
 * Shared primitives for Factosys packages (errors, Result).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ok = exports.isOk = exports.isErr = exports.err = exports.AppError = exports.AppErrorCode = exports.SHARED_PACKAGE_NAME = void 0;
exports.assertNever = assertNever;
exports.SHARED_PACKAGE_NAME = "@factosys/shared";
function assertNever(value, message = "Unexpected value") {
    throw new Error(`${message}: ${String(value)}`);
}
var app_error_code_1 = require("./errors/app-error-code");
Object.defineProperty(exports, "AppErrorCode", { enumerable: true, get: function () { return app_error_code_1.AppErrorCode; } });
var app_error_1 = require("./errors/app-error");
Object.defineProperty(exports, "AppError", { enumerable: true, get: function () { return app_error_1.AppError; } });
var result_1 = require("./result");
Object.defineProperty(exports, "err", { enumerable: true, get: function () { return result_1.err; } });
Object.defineProperty(exports, "isErr", { enumerable: true, get: function () { return result_1.isErr; } });
Object.defineProperty(exports, "isOk", { enumerable: true, get: function () { return result_1.isOk; } });
Object.defineProperty(exports, "ok", { enumerable: true, get: function () { return result_1.ok; } });
//# sourceMappingURL=index.js.map