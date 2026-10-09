ALTER TABLE companies ADD COLUMN pdf_format text NOT NULL DEFAULT 'A4';
ALTER TABLE companies ADD CONSTRAINT companies_pdf_format_check CHECK (pdf_format IN ('A4', 'A5', 'TICKET80', 'TICKET58'));
