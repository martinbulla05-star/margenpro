-- Stable commercial product catalog entry. No price or payment is enabled.
INSERT INTO products(id, code, name)
VALUES ('margenpro-core', 'margenpro', 'MargenPro')
ON CONFLICT(code) DO NOTHING;
