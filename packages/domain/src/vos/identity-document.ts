/**
 * Party identity (Catálogo 06) — skeleton VO.
 */
export class IdentityDocument {
  readonly identityType: string;
  readonly identityNumber: string;

  private constructor(identityType: string, identityNumber: string) {
    this.identityType = identityType;
    this.identityNumber = identityNumber;
  }

  static create(identityType: string, identityNumber: string): IdentityDocument {
    return new IdentityDocument(identityType, identityNumber);
  }
}
