# Evolução Fotografia

Análise da qualidade de captura das fotos de uma Canon EOS RP, direto no navegador:
configuração usada em cada foto, metadados da Canon (ponto de AF, modo de foco, redução de
ruído...), o que se perdeu no caminho até o tablet e, nas próximas versões, indicadores de
nitidez, ruído e tremido.

**Site:** https://gfvdata-web.github.io/evolucao-fotografia/

- Não edita fotos; analisa a captura antes da edição.
- Sem servidor: tudo roda no navegador. Este repositório guarda só o código — nenhuma foto.
- Interface em português, pensada para tablet Android.

Documentação: [docs/INDICE.md](docs/INDICE.md) · Como usar: [docs/GUIA-DE-USO.md](docs/GUIA-DE-USO.md)

```bash
npm ci && npm test      # roda tudo
npm run serve           # http://localhost:8765/
```

Leitura de metadados com [exifr](https://github.com/MikeKovarik/exifr) e
[ExifTool](https://exiftool.org/) de Phil Harvey, compilado para WebAssembly
([@uswriting/exiftool](https://www.npmjs.com/package/@uswriting/exiftool)).
