import { expect, it } from "vitest";
import { XmlDespatchAdviceBuilder } from "../../sunat-ubl/src/index";
import { greScenario } from "../../sunat-ubl/test-fixtures/gre-scenarios";
import { XmllintXsdValidationAdapter } from "./index";

it.each(["public", "private", "m1", "carrier", "export"] as const)(
  "validates GRE %s against official UBL XSD",
  async (kind) => {
    const c = greScenario(kind);
    const result = await new XmllintXsdValidationAdapter().validateXml({
      documentType: c.document_type,
      xml: new XmlDespatchAdviceBuilder().build(c).xml,
      stages: ["xsd"],
    });
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  },
);
