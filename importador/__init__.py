"""Importador da Evolução Fotografia (v0.6, decisão 0015).

Lê a pasta do cartão no PC e escreve um pacote de sessão por dia
(``<AAAA-MM-DD>_<nome>.efsessao/``) com os originais, o JSON completo do
ExifTool e a revelação neutra de cada CR3. Não calcula indicadores (regra 6)
e não fala com o Google Drive: o site, aberto no navegador do PC, importa o
pacote, mede tudo e sincroniza.

Code in English, user-facing text in pt-BR (project convention).
"""

__version__ = "0.6.0"
