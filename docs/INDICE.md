# Índice da documentação

| Documento | Do que trata |
|---|---|
| [../CLAUDE.md](../CLAUDE.md) | Contrato de trabalho: regras, convenções, comandos, rotina de testes e commits |
| [../README.md](../README.md) | Apresentação curta do projeto e link do site |
| [ARQUITETURA.md](ARQUITETURA.md) | Como o site funciona: fluxo de entrada, leitura de metadados, CR3, armazenamento, publicação |
| [MODELO-DE-DADOS.md](MODELO-DE-DADOS.md) | Formato do registro da foto, identidade, captura, IndexedDB, Drive (v0.4), migrações |
| [ROADMAP.md](ROADMAP.md) | V1 por entrega (v0.1 a v1.0), V2, V3 (IA) e ideias |
| [GUIA-DE-USO.md](GUIA-DE-USO.md) | Para o Guilherme: uso no tablet, Google Cloud (v0.4), importador no PC (v0.6) |
| [AMOSTRAS-CALIBRACAO.md](AMOSTRAS-CALIBRACAO.md) | Protocolo das fotos reais de calibração (1ª rodada: séries F e T; Rodada 2: equipamento e mão) e como entregá-las |
| [CALIBRACAO-RESULTADOS.md](CALIBRACAO-RESULTADOS.md) | Resultados da 1ª rodada com fotos reais: valores da EOS RP para o normalizador e métricas da v0.2 nas amostras |
| [guia-fotos/Guia-fotos-calibracao.pdf](guia-fotos/Guia-fotos-calibracao.pdf) | O mesmo protocolo em versão para imprimir ou levar no celular (fonte: `guia.html`) |
| [CHANGELOG.md](CHANGELOG.md) | O que mudou em cada versão |
| [decisoes/0001-site-estatico-sem-build.md](decisoes/0001-site-estatico-sem-build.md) | JS puro sem build, publicação por Actions |
| [decisoes/0002-leitura-de-metadados-hibrida.md](decisoes/0002-leitura-de-metadados-hibrida.md) | exifr + ExifTool-WASM (comparação das bibliotecas) |
| [decisoes/0003-cr3-no-navegador.md](decisoes/0003-cr3-no-navegador.md) | Seletor sem filtro para o CR3 e uso do JPEG embutido |
| [decisoes/0004-identificador-estavel.md](decisoes/0004-identificador-estavel.md) | Id da foto e chave de pareamento entre versões |
| [decisoes/0005-login-google-token.md](decisoes/0005-login-google-token.md) | Token de 1 h do Google sem servidor e como contornar |
| [decisoes/0006-envio-com-app-aberto.md](decisoes/0006-envio-com-app-aberto.md) | Envio ao Drive com o app aberto (rever no uso real) |
| [decisoes/0007-testes.md](decisoes/0007-testes.md) | node:test, Playwright, fixtures sintéticas, amostras locais |
| [decisoes/0010-sincronizacao-drive.md](decisoes/0010-sincronizacao-drive.md) | Drive: um sessao.json por sessão, junção pelo mais novo, lápides, GPS, originais retomáveis, limite de espaço |
| [decisoes/0009-sessoes-e-avaliacao.md](decisoes/0009-sessoes-e-avaliacao.md) | Sessões sugeridas por dia, vínculo na foto, avaliação por toque com avanço automático |
| [decisoes/0008-versao-principal-e-campo-de-visao.md](decisoes/0008-versao-principal-e-campo-de-visao.md) | Qual versão mede nitidez e ruído; mesma parte da cena em versões com campos diferentes (16:9, recorte, CR3) |
| [decisoes/0011-diagnostico-com-orientacao.md](decisoes/0011-diagnostico-com-orientacao.md) | O site passa a orientar (com o porquê); cenas com arrastar e soltar; motor de diagnóstico sem IA; IA fica para a V3 |
| [decisoes/0012-avaliacao-por-sintoma.md](decisoes/0012-avaliacao-por-sintoma.md) | Avaliação: nitidez 1–5 em botões (não slider), problema principal pelo sintoma, onde/luz/assunto; luz da cena calculada pela exposição |
| [decisoes/0013-motor-de-diagnostico.md](decisoes/0013-motor-de-diagnostico.md) | v0.5 em duas entregas; luz pelo fotômetro; desfoque de Crété-Roffet; foco errado pelos trechos a 100%; limites calibrados nas amostras |
| [decisoes/0014-cenas-na-sessao.md](decisoes/0014-cenas-na-sessao.md) | Cenas: separação automática com motivo, vínculo na foto, congelar ao mover, arrastar e soltar com o dedo, diagnóstico por cena e variação dos ajustes |
