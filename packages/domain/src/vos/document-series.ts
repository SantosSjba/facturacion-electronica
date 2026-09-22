/**
 * Document series / correlative skeleton (serie + next number live in DB later).
 */
export class DocumentSeries {
  readonly documentType: string;
  readonly series: string;

  private constructor(documentType: string, series: string) {
    this.documentType = documentType;
    this.series = series;
  }

  static create(documentType: string, series: string): DocumentSeries {
    return new DocumentSeries(documentType, series);
  }
}
