# sfs-vali-commons

| Field | Value |
| --- | --- |
| Source URL | https://ww2.sunat.gob.pe/facturador/Archivos_actualizacion_sfs.zip |
| Extracted | `sunat_archivos/sfs/VALI/commons/{error,cpe,StringTemplates.xsl}` |
| Vendor zip | `sfs-vali-commons.zip` (+ `.sha256`) |
| Fetched | 2026-09-22 |

## Notes

- Omits `commons/xsd` and `commons/xsl` (not required by `ValidaExprRegFactura` includes).
- Adds stub `commons/cpe/datos/dat_fechas.xml` (absent from the update zip; used for MIGE-Factoring cutoff `@valor`).
- Adds seed `commons/cpe/catalogo/cat_03.xml` (unit of measure) — **not** in SFS update zip; generated from planificacion `artifacts/catalogs/03-unit-of-measure.json`.
