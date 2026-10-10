# 0004 — Identificador estável da foto

**Data:** 2026-10-10 · **Situação:** aceita

## Contexto
Precisamos reconhecer reenvios, juntar JPEG e CR3 do mesmo disparo e, mais tarde, as versões
do cartão e do tablet — mesmo que um app no caminho remova o número de série.

## Escolha
- `id = <série>-<data/hora com subsegundos>-<nome sem extensão>` (pedido original).
- `match_key = <data/hora com subsegundos>-<nome>`: igual entre versões mesmo sem série.
  Uma variante nova se junta ao registro com o mesmo `id` ou `match_key`.
- Data/hora vem do composto `SubSecDateTimeOriginal` do ExifTool (preserva zeros à esquerda
  dos subsegundos; o campo isolado vira número no JSON e perderia o "0" de "05").
- Sem data: `semexif-<hash>-<nome>` (hash do tamanho + primeiros 256 KB).
- Repetido = mesma variante com mesmo nome e tamanho → ignorado.

## Consequências
- O `id` nunca muda depois de criado; variantes posteriores herdam o registro.
- Se o Camera Connect renomear arquivos, a junção cartão × tablet pode falhar; a conferência
  das amostras reais (`tests/amostras/`) vai mostrar e, se preciso, a chave passa a usar só a
  data/hora com subsegundos.
