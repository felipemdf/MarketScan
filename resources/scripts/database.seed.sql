-- Inserir os 4 mercados (apenas campos obrigatórios)
INSERT INTO market (
    name, 
    city, 
    instagram_username, 
    created_at, 
    updated_at
) VALUES 
(
    'Irmãos Gonçalves Supermercado',
    'Cacoal',
    'irmaosgoncalves',
    datetime('now'),
    datetime('now')
),
(
    'Smart Gama Supermercado',
    'Cacoal', 
    'smartgamasupermercado',
    datetime('now'),
    datetime('now')
),
(
    'Mercado Martins',
    'Cacoal',
    'mercadomartinscacoal', 
    datetime('now'),
    datetime('now')
),
(
    'Supermercado Rodrigues',
    'Cacoal',
    'suprodriguescacoal',
    datetime('now'),
    datetime('now')
);