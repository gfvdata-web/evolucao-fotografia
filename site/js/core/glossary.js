// pt-BR labels, one-line explanations and value translations (pure data).
// Values arrive as ExifTool's English text; anything not listed is shown as is.

export const FIELDS = {
  datetime_original: { label: 'Data e hora', explain: 'Momento do disparo, no relógio da câmera.' },
  'camera.model': { label: 'Câmera', explain: 'Modelo do corpo que fez a foto.' },
  'camera.serial': { label: 'Número de série', explain: 'Identifica o seu corpo; usado para reconhecer reenvios da mesma foto.' },
  'lens.model': { label: 'Lente', explain: 'Lente usada. As suas não têm estabilizador.' },
  'lens.focal_length_mm': {
    label: 'Distância focal',
    explain: 'Quanto a lente aproxima. Quanto maior, mais qualquer tremor da mão aparece na foto.',
  },
  'exposure.program': {
    label: 'Modo de exposição',
    explain: 'Quem decide os ajustes: você (M), a câmera (P) ou dividido (Av: você escolhe a abertura; Tv: a velocidade).',
  },
  'exposure.shutter_s': {
    label: 'Velocidade do obturador',
    explain: 'Tempo de exposição. Mais lento entra mais luz, mas aumenta o risco de tremido e de borrão de movimento.',
  },
  'exposure.aperture': {
    label: 'Abertura',
    explain: 'Tamanho da abertura da lente. f/ baixo (1.8) = mais luz e menos área em foco; f/ alto (8) = mais área nítida.',
  },
  'exposure.iso': {
    label: 'ISO',
    explain: 'Amplificação do sinal do sensor. ISO alto clareia em pouca luz, mas aumenta o ruído (granulado).',
  },
  'exposure.ev_comp': {
    label: 'Compensação de exposição',
    explain: 'Pedido para a câmera clarear (+) ou escurecer (−) em relação ao que ela mediu.',
  },
  'exposure.metering': { label: 'Medição de luz', explain: 'Como a câmera mediu a luz da cena para decidir a exposição.' },
  'focus.af_mode': {
    label: 'Modo de foco',
    explain: 'One-Shot foca uma vez e trava (assunto parado); Servo acompanha o assunto (movimento).',
  },
  'focus.af_area_mode': {
    label: 'Área de AF',
    explain: 'Que parte da cena a câmera usou para focar: um ponto, uma zona ou detecção de rosto.',
  },
  'focus.af_point': {
    label: 'Ponto de AF usado',
    explain: 'Onde o foco foi feito. É ali que a nitidez deve ser avaliada.',
  },
  drive_mode: { label: 'Modo de disparo', explain: 'Uma foto por clique ou várias seguidas (contínuo).' },
  picture_style: {
    label: 'Estilo de imagem',
    explain: 'Receita da câmera para o JPEG: contraste, cor e nitidez aplicada. Não muda o RAW.',
  },
  'noise_reduction.high_iso': {
    label: 'Redução de ruído (ISO alto)',
    explain: 'Suavização aplicada no JPEG para esconder ruído. Forte demais apaga detalhes e deixa aspecto “pintado”.',
  },
  'noise_reduction.long_exposure': {
    label: 'Redução de ruído (longa exposição)',
    explain: 'Em exposições longas, a câmera faz um quadro escuro extra para remover pontos quentes.',
  },
  'image.quality': { label: 'Qualidade de gravação', explain: 'Formato gravado pela câmera (RAW, JPEG fino ou normal).' },
  'image.canon_image_size': {
    label: 'Tamanho do JPEG na câmera',
    explain: 'L é o tamanho máximo (26 MP). M e S reduzem a resolução já na câmera.',
  },
  white_balance: { label: 'Balanço de branco', explain: 'Correção de cor para a luz da cena.' },
  flash: { label: 'Flash', explain: 'Se o flash disparou.' },
  gps: { label: 'Localização (GPS)', explain: 'Coordenadas gravadas na foto, se houver.' },
};

export const fieldLabel = (path) => FIELDS[path]?.label || path;

/** Why a field may be missing, shown in the "what could not be read" list. */
export const MISSING_HINTS = {
  makernote: 'vem dos dados internos da Canon (MakerNotes), que podem ter sido removidos no caminho até aqui',
  standard: 'é um dado EXIF padrão; a ausência indica que o arquivo foi alterado ou regravado no caminho',
};

const VALUES = {
  'exposure.program': {
    Manual: 'Manual (M)', 'Program AE': 'Programa (P)', 'Aperture-priority AE': 'Prioridade de abertura (Av)',
    'Shutter speed priority AE': 'Prioridade de velocidade (Tv)', Bulb: 'Bulb (B)',
    'Flexible-priority AE': 'Prioridade flexível (Fv)', 'Creative (Slow speed)': 'Criativo (velocidade lenta)',
    'Action (High speed)': 'Ação (velocidade alta)', Portrait: 'Retrato', Landscape: 'Paisagem',
    'Not Defined': 'Não definido', 'Scene Intelligent Auto': 'Cena Inteligente Auto (A+)',
    'Full auto': 'Automático total', Easy: 'Automático da câmera',
  },
  'exposure.metering': {
    Evaluative: 'Avaliativa', Partial: 'Parcial', Spot: 'Pontual (spot)',
    'Center-weighted average': 'Média ponderada ao centro', 'Center-weighted Average': 'Média ponderada ao centro',
    Average: 'Média', 'Multi-segment': 'Multissegmento (avaliativa)', 'Multi-spot': 'Múltiplos pontos',
  },
  'focus.af_mode': {
    'One-shot AF': 'One-Shot (foco único)', 'AI Servo AF': 'Servo (contínuo)', 'Servo AF': 'Servo (contínuo)',
    'AI Focus AF': 'AI Focus (automático)', 'Manual Focus': 'Manual (MF)',
  },
  'focus.af_area_mode': {
    'Single-point AF': 'Ponto único', 'Flexizone Single': 'Ponto único (AF em 1 ponto)', 'Spot AF': 'Ponto spot (pequeno)', 'Face + Tracking': 'Rosto + rastreamento',
    'Face Detect AF': 'Detecção de rosto', 'Zone AF': 'Zona', 'Large Zone AF': 'Zona ampla',
    'Large Zone AF (vertical)': 'Zona ampla (vertical)', 'Large Zone AF (horizontal)': 'Zona ampla (horizontal)',
    'AF Point Expansion (4 point)': 'Ponto com expansão (4 pontos)',
    'AF Point Expansion (8 point)': 'Ponto com expansão (8 pontos)',
    'AF Point Expansion (surround)': 'Ponto com expansão ao redor',
    'Off (Manual Focus)': 'Desligado (foco manual)', 'Whole Area AF': 'Área inteira', Auto: 'Automático',
  },
  drive_mode: {
    'Single-frame Shooting': 'Disparo único', Single: 'Disparo único', 'Continuous Shooting': 'Contínuo',
    Continuous: 'Contínuo', 'High-speed Continuous Shooting': 'Contínuo de alta velocidade',
    'High speed continuous': 'Contínuo de alta velocidade', 'Low-speed Continuous Shooting': 'Contínuo de baixa velocidade',
    'Low speed continuous': 'Contínuo de baixa velocidade', 'Self-timer Operation': 'Temporizador',
    'Silent Single': 'Único silencioso',
  },
  picture_style: {
    Standard: 'Padrão', Portrait: 'Retrato', Landscape: 'Paisagem', Neutral: 'Neutro', Faithful: 'Fiel',
    Monochrome: 'Monocromático', Auto: 'Automático', 'Fine Detail': 'Detalhes finos',
    'User Def. 1': 'Definido pelo usuário 1', 'User Def. 2': 'Definido pelo usuário 2', 'User Def. 3': 'Definido pelo usuário 3',
  },
  'noise_reduction.high_iso': {
    Standard: 'Padrão', Low: 'Baixa', Strong: 'Forte', Off: 'Desligada', 'Multi Shot': 'Multidisparo',
  },
  'noise_reduction.long_exposure': { Off: 'Desligada', Auto: 'Automática', On: 'Ligada' },
  'image.quality': {
    RAW: 'RAW', Fine: 'JPEG fino', Normal: 'JPEG normal', Superfine: 'JPEG superfino', 'CRAW': 'C-RAW (RAW compacto)',
  },
  'image.canon_image_size': {
    Large: 'L (grande)', Medium: 'M (médio)', 'Medium 1': 'M1 (médio)', Small: 'S (pequeno)',
    'Small 1': 'S1 (pequeno)', 'Small 2': 'S2 (pequeno)',
  },
  white_balance: {
    Auto: 'Automático', 'Auto (ambience priority)': 'Automático (prioridade ao ambiente)',
    'Auto (white priority)': 'Automático (prioridade ao branco)', Daylight: 'Luz do dia', Shade: 'Sombra',
    Cloudy: 'Nublado', Tungsten: 'Tungstênio', Fluorescent: 'Fluorescente', Flash: 'Flash',
    Custom: 'Personalizado', Kelvin: 'Temperatura (K)', Manual: 'Manual',
  },
};

/** Versions of a shot (variant.kind): badge and description. */
export const VARIANT_BADGE = { jpeg: 'JPEG', cr3: 'CR3', raw_neutral: 'RAW' };
export const VARIANT_KIND_LABEL = {
  jpeg: 'JPEG',
  cr3: 'CR3 (JPEG embutido)',
  raw_neutral: 'RAW sem processamento',
};
export const variantBadge = (kind) => VARIANT_BADGE[kind] || String(kind).toUpperCase();
export const variantKindLabel = (kind) => VARIANT_KIND_LABEL[kind] || kind;

/** Translates an engine value to pt-BR, or returns it unchanged. */
export function translate(path, value) {
  if (value === null || value === undefined) return value;
  if (path === 'focus.af_mode' && /^Manual Focus/.test(value)) return 'Manual (MF)';
  if (path === 'flash') {
    if (/^(Off|No Flash)/i.test(value) || /did not fire/i.test(value)) return 'Não disparou';
    if (/fired/i.test(value)) return 'Disparou';
  }
  return VALUES[path]?.[value] ?? value;
}

/** Rating options (keys stored in English, see core/rating.js). */
export const RATING_LABELS = {
  problem: {
    none: 'Nenhum problema', soft: 'Mole por inteiro', missed_focus: 'Foco no lugar errado',
    motion_blur: 'Arrastada', grain: 'Granulada', blocky: 'Quadriculada ao ampliar', other: 'Outro',
  },
  place: { indoor: 'Dentro', outdoor: 'Fora' },
  light: { strong: 'Forte', medium: 'Média', weak: 'Fraca' },
  subject: { still: 'Parado', moving: 'Em movimento' },
};

/** One-line description of each problem as seen on screen (a symptom, never the cause). */
export const PROBLEM_HINTS = {
  none: 'O que eu queria está nítido.',
  soft: 'Nada fica bem nítido, sem rastro.',
  missed_focus: 'Algo está nítido, mas não o assunto.',
  motion_blur: 'Rastro numa direção: a câmera ou o assunto mexeu.',
  grain: 'Grão ou manchas de cor, mais visível nas áreas lisas.',
  blocky: 'Blocos, serrilhado ou “aquarela” ao dar zoom.',
  other: 'Outro problema; descreva na nota.',
};

/** Short form of the problem for chips and summaries ("Nitidez 4 · Granulada"). */
export function ratingText(rating) {
  if (!rating) return '';
  return [
    rating.sharpness ? `Nitidez ${rating.sharpness}/5` : 'nitidez não marcada',
    rating.problem ? RATING_LABELS.problem[rating.problem] : 'problema não marcado',
  ].join(' · ');
}

/** Parameters an experiment can vary (keys in core/sessions.js). */
export const EXPERIMENT_LABELS = {
  iso: 'ISO', shutter: 'Velocidade do obturador', aperture: 'Abertura', focal_length: 'Distância focal',
  lens: 'Lente', af_mode: 'Modo de foco', af_area: 'Área de AF', drive_mode: 'Modo de disparo',
  transfer: 'Forma de transferência (Camera Connect)', other: 'Outro',
};

/** Painel (v1.0): names of the categories that are not in the other tables. */
export const DASHBOARD_LABELS = {
  verdict: { good: 'Boa', usable: 'Aceitável', problem: 'Com problema', unknown: 'Sem diagnóstico' },
  unrated: 'Não avaliada',
  no_session: 'Fotos sem sessão',
};
