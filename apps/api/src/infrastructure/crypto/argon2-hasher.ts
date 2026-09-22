import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";

@Injectable()
export class Argon2Hasher {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  verify(hashed: string, plain: string): Promise<boolean> {
    return argon2.verify(hashed, plain);
  }
}
