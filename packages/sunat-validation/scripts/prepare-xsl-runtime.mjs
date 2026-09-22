/**
 * Prepare a runnable XSL tree for libxslt/xsltproc:
 * - Fix SFS relative includes in commons
 * - Rewrite DataPower local:/// include on Factura → relative commons path
 * - Replace dp:variable(nombreArchivoEnviado) with xsl:param (Saxon/DataPower shim)
 * - Emit OASIS XML catalog mapping local:///commons/ → file commons/
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

function patchValidateUtils(text) {
  let out = text
    .replace(
      /<xsl:include href="\.\.\/\.\.\/\.\.\/VALI\/commons\/error\/error_utils\.xsl"\/>/,
      '<xsl:include href="error_utils.xsl"/>',
    )
    .replace(
      /<xsl:include href="\.\.\/\.\.\/\.\.\/VALI\/commons\/StringTemplates\.xsl"\/>/,
      '<xsl:include href="../StringTemplates.xsl"/>',
    );

  // DataPower ships func: without extension-element-prefixes; libxslt needs it
  // for EXSLT func:function (otherwise xsl:param inside looks "top-level").
  out = out.replace(
    /extension-element-prefixes="dp"/,
    'extension-element-prefixes="dp func"',
  );

  // Relative catalog paths (SFS used ../../../VALI/commons/… or local:///)
  out = out.replace(
    /'\.\.\/\.\.\/\.\.\/VALI\/commons\/cpe\/catalogo\/cat_/g,
    "'../cpe/catalogo/cat_",
  );
  out = out.replace(
    /"\.\.\/\.\.\/\.\.\/VALI\/commons\/cpe\/catalogo\/cat_/g,
    '"../cpe/catalogo/cat_',
  );
  out = out.replace(
    /'local:\/\/\/commons\/cpe\/catalogo\/cat_/g,
    "'../cpe/catalogo/cat_",
  );
  out = out.replace(
    /"local:\/\/\/commons\/cpe\/catalogo\/cat_/g,
    '"../cpe/catalogo/cat_',
  );

  return out;
}

function patchErrorUtils(text) {
  return text.replace(
    /document\('\.\.\/\.\.\/\.\.\/VALI\/commons\/cpe\/catalogo\/CatalogoErrores\.xml'\)/,
    "document('../cpe/catalogo/CatalogoErrores.xml')",
  );
}

function patchFactura(text) {
  let out = text;

  // Prefer relative include over DataPower local:///
  out = out.replace(
    /<xsl:include href="local:\/\/\/commons\/error\/validate_utils\.xsl"[^/]*\/>/,
    '<xsl:include href="../commons/error/validate_utils.xsl"/>',
  );

  // Inject param after stylesheet open tag attributes block — after first >
  if (!out.includes('name="nombreArchivoEnviado"')) {
    out = out.replace(
      /(<xsl:stylesheet\b[^>]*>)/,
      `$1\n\n\t<!-- Factosys shim: DataPower dp:variable(var://context/cpe/nombreArchivoEnviado) -->\n\t<xsl:param name="nombreArchivoEnviado"/>\n`,
    );
  }

  out = out.replace(
    /dp:variable\('var:\/\/context\/cpe\/nombreArchivoEnviado'\)/g,
    "$nombreArchivoEnviado",
  );

  // libxslt forbids redefining xsl:variable in the same template; DataPower allows it.
  // Second totalDescuentosGlobales (codes 02/04) → distinct name used only below.
  out = out.replace(
    /<xsl:variable name="totalDescuentosGlobales" select="sum\(\$root\/cac:AllowanceCharge\[cbc:AllowanceChargeReasonCode \[text\(\) = '02' or text\(\) = '04'\]\]\/cbc:Amount\)"\/>/,
    `<xsl:variable name="totalDescuentosGlobalesIgv" select="sum($root/cac:AllowanceCharge[cbc:AllowanceChargeReasonCode [text() = '02' or text() = '04']]/cbc:Amount)"/>`,
  );
  // Only rewrite the IGV/IVAP calculated lines that follow the 02/04 definition.
  out = out.replace(
    /\$totalBaseIGVxLinea - \$totalDescuentosGlobales \+ \$totalCargosGobales/g,
    "$totalBaseIGVxLinea - $totalDescuentosGlobalesIgv + $totalCargosGobales",
  );
  out = out.replace(
    /\$totalBaseIVAPxLinea - \$totalDescuentosGlobales \+ \$totalCargosGobales/g,
    "$totalBaseIVAPxLinea - $totalDescuentosGlobalesIgv + $totalCargosGobales",
  );

  return out;
}

function writeCatalog(cacheDir) {
  const commonsDir = join(cacheDir, "commons");
  // file:///…/commons/  (trailing slash required for rewritePrefix)
  let prefix = pathToFileURL(commonsDir).href;
  if (!prefix.endsWith("/")) prefix += "/";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE catalog PUBLIC "-//OASIS//DTD Entity Resolution XML Catalog V1.0//EN"
  "http://www.oasis-open.org/committees/entity/release/1.0/catalog.dtd">
<catalog xmlns="urn:oasis:names:tc:entity:xmlns:xml:catalog">
  <!-- Map DataPower / SFS local:///commons/… → unpacked SFS commons -->
  <rewriteURI uriStartString="local:///commons/" rewritePrefix="${prefix}"/>
</catalog>
`;
  const runtimeDir = join(cacheDir, "runtime");
  mkdirSync(runtimeDir, { recursive: true });
  writeFileSync(join(runtimeDir, "catalog.xml"), xml, "utf8");
}

/**
 * @param {string} cacheDir packages/sunat-validation/.cache/xsl-ubl-2.1
 */
export function prepareXslRuntime(cacheDir) {
  const validateUtilsPath = join(cacheDir, "commons/error/validate_utils.xsl");
  const errorUtilsPath = join(cacheDir, "commons/error/error_utils.xsl");
  const facturaSrc = join(
    cacheDir,
    "validaciones/ValidaExprRegFactura-2.0.1.xsl",
  );
  const runtimeDir = join(cacheDir, "runtime");
  const facturaDst = join(runtimeDir, "ValidaExprRegFactura-2.0.1.xsl");

  if (!existsSync(validateUtilsPath) || !existsSync(facturaSrc)) {
    throw new Error(
      `[prepare-xsl] Missing inputs under ${cacheDir} (run unpack first)`,
    );
  }

  writeFileSync(
    validateUtilsPath,
    patchValidateUtils(readFileSync(validateUtilsPath, "utf8")),
    "utf8",
  );
  if (existsSync(errorUtilsPath)) {
    writeFileSync(
      errorUtilsPath,
      patchErrorUtils(readFileSync(errorUtilsPath, "utf8")),
      "utf8",
    );
  }

  mkdirSync(runtimeDir, { recursive: true });
  writeFileSync(
    facturaDst,
    patchFactura(readFileSync(facturaSrc, "utf8")),
    "utf8",
  );
  writeCatalog(cacheDir);

  // Keep a copy of original for audit diff
  copyFileSync(facturaSrc, join(runtimeDir, "ValidaExprRegFactura-2.0.1.xsl.orig"));

  console.log(`[prepare-xsl] Runtime Factura + catalog ready → ${runtimeDir}`);
}
