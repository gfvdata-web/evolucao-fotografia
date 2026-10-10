# 0002 — Leitura de metadados híbrida: exifr + ExifTool em WebAssembly

**Data:** 2026-10-10 · **Situação:** aceita (aprovada pelo Guilherme)

## Contexto
Além do EXIF padrão, a análise precisa dos MakerNotes da Canon: ponto e modo de AF, modo de
disparo, redução de ruído, estilo de imagem, lente. E precisa ler CR3. Tudo no navegador.

## Opções pesquisadas
| Opção | CR3 | MakerNotes Canon | Tamanho |
|---|---|---|---|
| exifr 7.1.3 | não | não decodifica | 22 KB gz |
| ExifReader 4.48 | não | só 3 tags (rotação, tipo e modelo da lente) | 146 KB |
| ExifTool em WebAssembly (`@uswriting/exiftool` 1.0.9, ExifTool 13.42, Apache-2.0) | sim | completo | `.wasm` 25 MB (7,5 MB compactado) |
| Leitor próprio | possível | só o que for programado | pequeno |

Medição local (Node, desktop): 0,8 s na primeira leitura, 0,4 s nas seguintes, ~200 MB de
memória. Não exige cabeçalhos especiais (sem SharedArrayBuffer), então roda no GitHub Pages.

## Escolha
**Híbrida:** exifr lê o EXIF padrão na hora (a ficha aparece já); o ExifTool-WASM roda em Web
Worker e completa os MakerNotes em segundo plano. O mesmo ExifTool será usado no importador
Python, então os nomes de campos coincidem. O leitor próprio foi descartado pelo Guilherme.

Saída do ExifTool: `-json -l -G1` (grupo + valor legível + número exato numa leitura).

## Consequências
- Primeiro uso baixa ~7,5 MB (depois fica em cache; na v0.4 o service worker garante).
- O carregador do Perl decide "navegador" testando `window`/`document`, que não existem em
  worker: `exiftool-engine.js` define os dois antes de chamar. No Node os testes fazem o mesmo.
- O JSON completo do ExifTool é guardado por foto: permite rever campos sem os originais.
- Se o ExifTool falhar, a foto fica com os dados do exifr e a ficha diz que a leitura completa
  falhou.
