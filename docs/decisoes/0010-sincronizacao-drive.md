# 0010 — Sincronização com o Google Drive

Data: 2026-10-12 · Situação: proposta (v0.4; rever no uso real com a conta do Guilherme)

Completa as decisões 0005 (login com token de 1 h) e 0006 (envio com o app aberto).

## Contexto

O tablet e, na v0.5, o PC precisam ver as mesmas sessões, avaliações e arquivos, sem servidor.
O Drive é o único lugar compartilhado. Restrições:

- escopo `drive.file`: o app só vê o que ele mesmo criou;
- token de 1 h, renovado só com um toque (0005);
- envio só com o app aberto (0006);
- o Guilherme pode avaliar no tablet sem internet;
- GPS descartado por padrão; originais grandes (CR3 ≈ 30 MB).

## Decisão

1. **Um `sessao.json` por sessão**, com a sessão, os registros completos das fotos e a lista
   de fotos excluídas. Mais `_sem_sessao/` para as fotos sem sessão, `indice.json` (sessões e
   sessões excluídas) e `config.json` (configurações). Cada arquivo leva `appProperties`
   (`ef_kind`, `ef_session`, `ef_photo`, `ef_asset`), e o app acha tudo por busca no Drive, sem
   depender de nomes nem do índice.
2. **Junção registro a registro, vence o `updated_at` mais novo** (foto, sessão,
   configurações). Cada execução **traz antes de enviar**: lê os `sessao.json` que mudaram
   desde a última vez, junta e só então regrava. Uma foto que só existe no Drive chega com
   prévia e recortes; o original fica no Drive.
3. **Exclusões viajam como "lápides"** (`deleted_photos` no `sessao.json`, `deleted_sessions`
   no `indice.json`), para o outro aparelho não devolver o que foi apagado. Os arquivos vão
   para a lixeira do Drive (recuperáveis por 30 dias), nunca são apagados de vez.
4. **O estado do envio fica fora do registro da foto**, numa store local `sync`: o que já foi
   enviado, com o id no Drive e uma assinatura do conteúdo. Uma assinatura diferente (recortes
   refeitos, GPS ligado) reenvia só aquele arquivo. Os ids também vão no `sessao.json`
   (`drive_assets`), para o outro aparelho baixar sem reenviar.
5. **Originais**: envio "resumable" em partes de 8 MB; o endereço do envio fica guardado e um
   envio interrompido continua de onde parou. Se o navegador não deixar ler o endereço ou a
   posição, o app envia de uma vez ou recomeça, sem travar.
6. **GPS**: com "Guardar a localização" desligado, a localização é zerada numa cópia do
   arquivo (o bloco de GPS do EXIF no JPEG e o CMT4 no CR3), removida do JSON do ExifTool e dos
   registros no `sessao.json`. O arquivo guardado neste aparelho não muda.
7. **Limite de espaço**: o app soma o tamanho dos próprios arquivos no Drive e, antes de passar
   do limite (100 GB por padrão), segura só os originais e avisa. Prévias, recortes e
   avaliações continuam indo.
8. **Histórico**: antes de regravar um `sessao.json`, uma cópia datada vai para `_historico/`;
   ficam as N mais novas (10 por padrão).

## Alternativas consideradas

- **Um arquivo por foto** (`fotos/<id>.json`): junção mais fina e menos dados por envio, mas
  centenas de arquivos por sessão para listar e baixar no tablet, e o `sessao.json` do
  roteiro deixaria de ser a "foto da sessão" legível por fora do app.
- **API de mudanças do Drive** (`changes.list` com `pageToken`): menos listagens, mas com
  `drive.file` ela devolve só os arquivos do app de forma pouco previsível entre aparelhos, e a
  busca por `appProperties` já é barata no volume esperado (dezenas de sessões).
- **Guardar o token** (localStorage) para não pedir de novo ao recarregar: o token vale 1 h e
  daria acesso ao Drive a qualquer script da página. Fica só na memória.

## Consequências

- Duas mudanças na mesma foto em aparelhos diferentes, entre duas sincronizações: vale a
  última, e a outra se perde (só aquela foto). Aceitável para um usuário só.
- O PC (v0.5) segue o mesmo formato: lê e grava `sessao.json` e respeita as lápides.
- Reprocessar fotos antigas a partir dos originais no Drive (V2) usa os `drive_assets`.
