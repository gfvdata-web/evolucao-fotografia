// Browser compatibility checklist (v1.0, decision 0016 item 3). PURE: this file only
// describes the features the app uses and turns test results into screen rows.
// The tests themselves run in pipeline/compat-probe.js.

/**
 * Every browser feature the app depends on. `critical`: without it a core function
 * (store, read or analyze photos) stops. `fallback`: what the person sees/does if it fails.
 * `unknownNote`: why the check can be inconclusive.
 */
export const FEATURES = [
  { id: 'indexeddb', critical: true, name: 'Armazenamento do navegador (IndexedDB)',
    purpose: 'Guarda fotos, avaliações e sessões neste aparelho.',
    fallback: 'Sem isto o app não guarda nada. Saia da aba anônima/privativa ou libere o armazenamento do site.' },
  { id: 'module_worker', critical: true, name: 'Processamento em segundo plano (Web Worker de módulo)',
    purpose: 'Lê metadados, gera prévias e mede a nitidez sem travar a tela.',
    fallback: 'Sem isto o envio de fotos não funciona. Atualize o navegador (Chrome ou Samsung Internet recentes).' },
  { id: 'webassembly', critical: true, name: 'WebAssembly',
    purpose: 'Roda o ExifTool, que lê os metadados completos (inclusive do CR3).',
    fallback: 'Só os metadados básicos do JPEG seriam lidos; o CR3 não pode ser enviado.' },
  { id: 'image_bitmap', critical: true, name: 'Decodificar imagem com orientação (createImageBitmap)',
    purpose: 'Abre a foto, gira conforme a câmera e recorta a 100%.',
    fallback: 'Sem isto não há prévia nem análise de pixels. Atualize o navegador.' },
  { id: 'offscreen_canvas', critical: true, name: 'Desenho fora da tela (OffscreenCanvas e convertToBlob)',
    purpose: 'Monta prévias, miniaturas e recortes dentro do processamento em segundo plano.',
    fallback: 'Sem isto não há prévia nem miniatura. Atualize o navegador.' },
  { id: 'crypto_subtle', critical: true, name: 'Impressão digital das fotos (crypto.subtle, SHA-256)',
    purpose: 'Identifica cada foto para não duplicá-la. Exige página segura (https).',
    fallback: 'Sem isto o envio falha. Abra o app pelo endereço https oficial.' },
  { id: 'wake_lock', name: 'Manter a tela ligada (Wake Lock)',
    purpose: 'Evita que a tela apague durante uma sincronização longa com o Drive.',
    fallback: 'A sincronização pode pausar se a tela apagar: deixe o app aberto e a tela acesa. (Só a existência da API é conferida.)' },
  { id: 'storage_persist', name: 'Armazenamento protegido (storage.persist)',
    purpose: 'Pede ao navegador para não apagar as fotos quando faltar espaço.',
    fallback: 'O navegador pode limpar os dados se faltar espaço. Faça backup (.efbackup) ou conecte o Drive.' },
  { id: 'storage_estimate', name: 'Medir o espaço usado (storage.estimate)',
    purpose: 'Mostra quanto espaço o app usa na aba Sobre.',
    fallback: 'Só some o número de espaço usado; o resto funciona.' },
  { id: 'google_popup', name: 'Janela de login do Google (pop-up)',
    purpose: 'O login do Drive abre uma janela do Google.',
    fallback: 'Permita pop-ups para este site no navegador, senão o login no Drive não abre.',
    unknownNote: 'Não deu para saber sem abrir a janela; teste conectando o Drive.' },
  { id: 'install_pwa', name: 'Instalar como app (PWA)',
    purpose: 'Põe o app na tela inicial e o deixa abrir sem internet.',
    fallback: 'Use o app pela aba do navegador (menu do navegador, "Adicionar à tela inicial").',
    unknownNote: 'O navegador só oferece a instalação depois de algum uso; abra o app mais vezes e confira de novo.' },
  { id: 'service_worker', name: 'Uso sem internet (Service Worker)',
    purpose: 'Guarda o código do app para abrir sem conexão.',
    fallback: 'O app só abre com internet; as fotos já guardadas continuam no aparelho.' },
  { id: 'folder_input', name: 'Escolher pasta (importar pacote do PC)',
    purpose: 'Enviar > Importar pacote do PC lê uma pasta .efsessao inteira.',
    fallback: 'Sem escolher pasta, use o importador pelo computador ou envie as fotos uma a uma.' },
  { id: 'drag_folder', name: 'Arrastar pasta para a tela (webkitGetAsEntry)',
    purpose: 'Arrastar a pasta do pacote para a área de envio, no computador.',
    fallback: 'Use o botão de escolher pasta no lugar de arrastar.',
    unknownNote: 'Em telas de toque o arrastar de pastas quase não existe; teste no computador.' },
  { id: 'intersection_observer', name: 'Montar a grade aos poucos (IntersectionObserver)',
    purpose: 'Carrega as miniaturas só das fotos perto da tela.',
    fallback: 'A grade carrega todas as miniaturas de uma vez: pode ficar lenta com muitas fotos.' },
];

export const FEATURE_IDS = FEATURES.map((f) => f.id);

/** 'ok' | 'fail' | 'unknown' for a raw probe value (anything but true/false is unknown). */
export const stateOf = (value) => (value === true ? 'ok' : value === false ? 'fail' : 'unknown');

export const STATE_LABEL = { ok: 'OK', fail: 'Falhou', unknown: 'Não deu para saber' };

/**
 * Rows for the screen, in FEATURES order. A feature missing from `results` counts as unknown.
 * `advice` is the warning/alternative on fail, or the note on unknown ('' when ok).
 */
export function compatRows(results = {}) {
  return FEATURES.map((f) => {
    const state = stateOf(results?.[f.id]);
    const advice = state === 'fail' ? f.fallback : state === 'unknown' ? (f.unknownNote || 'O teste não foi conclusivo neste navegador.') : '';
    return {
      id: f.id, name: f.name, purpose: f.purpose, critical: Boolean(f.critical),
      state, label: STATE_LABEL[state], advice,
    };
  });
}

/** Counts and a one-line verdict. Critical failures are called out first. */
export function compatSummary(results = {}) {
  const rows = compatRows(results);
  const count = (s) => rows.filter((r) => r.state === s).length;
  const ok = count('ok'); const fail = count('fail'); const unknown = count('unknown');
  const criticalFails = rows.filter((r) => r.state === 'fail' && r.critical);
  let text;
  if (criticalFails.length) {
    text = `${criticalFails.length} recurso(s) essencial(is) falharam: o app não funciona direito neste navegador.`;
  } else if (fail) {
    text = `O app funciona, mas ${fail} recurso(s) opcional(is) falharam (veja os avisos).`;
  } else if (unknown) {
    text = `Tudo o que dá para testar passou; ${unknown} item(ns) só se confirmam no uso.`;
  } else {
    text = 'Tudo certo neste navegador.';
  }
  return { total: rows.length, ok, fail, unknown, criticalFails: criticalFails.map((r) => r.id), text };
}

/** Short "Browser version · system" from a userAgent string. Best effort. */
export function browserLabel(ua = '') {
  const pick = (re, name) => { const m = ua.match(re); return m ? `${name} ${m[1]}` : null; };
  const name = pick(/SamsungBrowser\/([\d.]+)/, 'Samsung Internet')
    || pick(/EdgA?\/([\d.]+)/, 'Edge')
    || pick(/Firefox\/([\d.]+)/, 'Firefox')
    || pick(/(?:Chrome|CriOS)\/([\d.]+)/, 'Chrome')
    || pick(/Version\/([\d.]+).*Safari/, 'Safari')
    || (ua ? ua.slice(0, 60) : 'navegador desconhecido');
  const android = ua.match(/Android ([\d.]+)/);
  const os = android ? `Android ${android[1]}` : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${name} · ${os}` : name;
}

/** Plain-text report to copy and send: browser, summary and one line per feature. */
export function compatReport(results, ua = '') {
  const s = compatSummary(results);
  const lines = compatRows(results).map((r) => `${r.state === 'ok' ? '[ok]' : r.state === 'fail' ? '[FALHOU]' : '[?]'} ${r.name}`);
  return ['Evolução Fotografia — compatibilidade', browserLabel(ua), s.text, ...lines].join('\n');
}
