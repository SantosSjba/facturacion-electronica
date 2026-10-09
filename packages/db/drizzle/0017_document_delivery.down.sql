DROP TABLE document_shares;
DROP TABLE document_deliveries;
DELETE FROM permissions WHERE code IN ('documents:deliver','documents:share');
