// Single source of truth for the synthetic fixtures: the generator writes these
// values into the files and the tests assert that the app reads them back.
import {
  ascii, short, sshort, long, slong, rational, srational, subIfd, makerNote,
} from './lib/tiff-writer.mjs';

export const EXPECTED = {
  make: 'Canon',
  model: 'Canon EOS RP',
  serial: '012345678901',
  lens: 'RF50mm F1.8 STM',
  datetime: '2026:10:10 14:30:12',
  subsec: '45',
  offset: '-03:00',
  shutter: 1 / 250,
  aperture: 1.8,
  iso: 400,
  focal: 50,
  evComp: -1 / 3,
  exifWidth: 6240,
  exifHeight: 4160,
  gps: { lat: -19.9167, lon: -43.9345 },
  measuredEv: 9.5,
  focusDistance: { near: 2.4, far: 2.81 },
  af: { imageWidth: 6240, imageHeight: 4160, width: 312, height: 312, x: -1560, y: 1040 },
};

const gpsDms = (deg) => {
  const a = Math.abs(deg);
  const d = Math.floor(a); const mFloat = (a - d) * 60; const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60 * 100);
  return [[d, 1], [m, 1], [s, 100]];
};

/**
 * Per-fixture variations. Defaults reproduce EXPECTED (IMG_0001).
 * @typedef {{datetime?: string, subsec?: string, exifWidth?: number, exifHeight?: number,
 *   shutter?: [number, number], imageSizeCode?: number}} Shot
 */
const shot = (o = {}) => ({
  datetime: EXPECTED.datetime, subsec: EXPECTED.subsec, exifWidth: EXPECTED.exifWidth,
  exifHeight: EXPECTED.exifHeight, shutter: [1, 250], imageSizeCode: 0, easyMode: null, ...o,
});

export const ifd0Entries = (o = {}) => [
  ascii(0x010f, EXPECTED.make),
  ascii(0x0110, EXPECTED.model),
  short(0x0112, 1),
  ascii(0x0131, 'Firmware Version 1.6.0'),
  ascii(0x0132, shot(o).datetime),
];

export const exifEntries = ({ withMakerNote = true, ...o } = {}) => {
  const s = shot(o);
  return [
    rational(0x829a, s.shutter),
    rational(0x829d, [18, 10]),
    short(0x8822, s.easyMode ? 2 : 3), // Program AE in A+ (same as P), else Aperture-priority AE
    short(0x8827, EXPECTED.iso),
    ascii(0x9003, s.datetime),
    ascii(0x9011, EXPECTED.offset),
    ascii(0x9291, s.subsec),
    srational(0x9204, [-1, 3]),
    short(0x9207, 5), // Multi-segment (evaluative)
    short(0x9209, 16), // Off, did not fire
    rational(0x920a, [50, 1]),
    short(0xa002, s.exifWidth),
    short(0xa003, s.exifHeight),
    short(0xa403, 0), // Auto white balance
    ascii(0xa431, EXPECTED.serial),
    ascii(0xa434, EXPECTED.lens),
    ...(withMakerNote ? [makerNote(canonMakerNoteEntries(s))] : []),
  ];
};

export const gpsEntries = () => [
  ascii(0x0001, 'S'), rational(0x0002, ...gpsDms(EXPECTED.gps.lat)),
  ascii(0x0003, 'W'), rational(0x0004, ...gpsDms(EXPECTED.gps.lon)),
];

// Canon MakerNote (subset). Array tags start with their own byte size.
export function canonMakerNoteEntries(o = {}) {
  const s = shot(o);
  const cameraSettings = new Array(49).fill(0);
  cameraSettings[0] = 98;
  cameraSettings[3] = 4; // Quality: RAW
  cameraSettings[5] = 0; // ContinuousDrive: Single
  cameraSettings[7] = 0; // FocusMode: One-shot AF
  cameraSettings[10] = s.imageSizeCode; // CanonImageSize: 0 Large, 15 Small 2
  if (s.easyMode) cameraSettings[11] = s.easyMode; // EasyMode: 59 Scene Intelligent Auto
  cameraSettings[17] = 3; // MeteringMode: Evaluative
  cameraSettings[20] = s.easyMode ? 0 : 3; // CanonExposureMode: Easy (A+, SCN...) or Aperture-priority AE
  cameraSettings[22] = 61182; // LensType: Canon RF lens
  cameraSettings[23] = 50; cameraSettings[24] = 50; cameraSettings[25] = 1;
  cameraSettings[26] = 54; // MaxAperture: Canon EV 54/32 → f/1.8
  cameraSettings[27] = 288; // MinAperture: f/22.6

  // ShotInfo: MeasuredEV (val/32 + 5) and focus distance (cm).
  const shotInfo = new Array(34).fill(0);
  shotInfo[0] = 68;
  shotInfo[3] = Math.round((EXPECTED.measuredEv - 5) * 32);
  shotInfo[19] = EXPECTED.focusDistance.far * 100;
  shotInfo[20] = EXPECTED.focusDistance.near * 100;

  // Like the EOS RP: the lists have NumAFPoints slots (143 there, 4 here) but
  // only ValidAFPoints (1 with 1-point AF) are real; the rest are zeros.
  const { af } = EXPECTED;
  const slots = 4;
  const list = (first) => [first, ...new Array(slots - 1).fill(0)];
  const afInfo2 = [0, 2, slots, 1, af.imageWidth, af.imageHeight, af.imageWidth, af.imageHeight,
    ...list(af.width), ...list(af.height), ...list(af.x), ...list(af.y), 1, 1, 0];
  afInfo2[0] = afInfo2.length * 2;

  const processing = new Array(16).fill(0);
  processing[0] = 32;
  processing[10] = 0x81; // PictureStyle: Standard

  const lightingOpt = new Array(12).fill(0);
  lightingOpt[0] = 48;
  lightingOpt[4] = 1; // LongExposureNoiseReduction: Auto
  lightingOpt[5] = 0; // HighISONoiseReduction: Standard

  return [
    sshort(0x0001, cameraSettings),
    sshort(0x0004, shotInfo),
    long(0x0010, 0x80000433), // CanonModelID (EOS RP)
    sshort(0x0026, afInfo2),
    ascii(0x0095, EXPECTED.lens),
    sshort(0x00a0, processing),
    slong(0x4018, lightingOpt),
  ];
}

/** Full IFD0 tree for a JPEG straight from the camera. */
export const fullTree = (o = {}) => [
  ...ifd0Entries(o),
  subIfd(0x8769, exifEntries(o)),
  subIfd(0x8825, gpsEntries()),
];

/** Standard EXIF but no MakerNote and no GPS (what a transfer app might keep). */
export const noMakerNoteTree = (o = {}) => [
  ...ifd0Entries(o),
  subIfd(0x8769, exifEntries({ ...o, withMakerNote: false })),
];

/** Shots used by the v0.2 fixtures (resolution, shake and version chain). */
export const SHOTS = {
  // JPEG S2 chosen in the camera, slow shutter (1/15 s at 50 mm → 3.3× the 1/focal reference).
  small: { datetime: '2026:10:11 08:00:00', subsec: '10', exifWidth: 2400, exifHeight: 1600, shutter: [1, 15], imageSizeCode: 15 },
  // Same shot as written to the card and as received on the tablet.
  chain: { datetime: '2026:10:11 09:00:00', subsec: '20', exifWidth: 2400, exifHeight: 1600, imageSizeCode: 15 },
  // Scene Intelligent Auto (A+): EXIF says Program AE, only the MakerNote tells it apart from P.
  auto: { datetime: '2026:10:11 10:00:00', subsec: '30', easyMode: 59 },
  // v0.5.0: blown sky (pixels in generate.mjs, skyJpeg), S2 like IMG_0010.
  sky: { datetime: '2026:10:11 11:00:00', subsec: '40', exifWidth: 2400, exifHeight: 1600, imageSizeCode: 15 },
};
