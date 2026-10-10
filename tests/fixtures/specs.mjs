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
  af: { imageWidth: 6240, imageHeight: 4160, width: 312, height: 312, x: -1560, y: 1040 },
};

const gpsDms = (deg) => {
  const a = Math.abs(deg);
  const d = Math.floor(a); const mFloat = (a - d) * 60; const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60 * 100);
  return [[d, 1], [m, 1], [s, 100]];
};

export const ifd0Entries = () => [
  ascii(0x010f, EXPECTED.make),
  ascii(0x0110, EXPECTED.model),
  short(0x0112, 1),
  ascii(0x0131, 'Firmware Version 1.6.0'),
  ascii(0x0132, EXPECTED.datetime),
];

export const exifEntries = ({ withMakerNote = true } = {}) => [
  rational(0x829a, [1, 250]),
  rational(0x829d, [18, 10]),
  short(0x8822, 3), // Aperture-priority AE
  short(0x8827, EXPECTED.iso),
  ascii(0x9003, EXPECTED.datetime),
  ascii(0x9011, EXPECTED.offset),
  ascii(0x9291, EXPECTED.subsec),
  srational(0x9204, [-1, 3]),
  short(0x9207, 5), // Multi-segment (evaluative)
  short(0x9209, 16), // Off, did not fire
  rational(0x920a, [50, 1]),
  short(0xa002, EXPECTED.exifWidth),
  short(0xa003, EXPECTED.exifHeight),
  short(0xa403, 0), // Auto white balance
  ascii(0xa431, EXPECTED.serial),
  ascii(0xa434, EXPECTED.lens),
  ...(withMakerNote ? [makerNote(canonMakerNoteEntries())] : []),
];

export const gpsEntries = () => [
  ascii(0x0001, 'S'), rational(0x0002, ...gpsDms(EXPECTED.gps.lat)),
  ascii(0x0003, 'W'), rational(0x0004, ...gpsDms(EXPECTED.gps.lon)),
];

// Canon MakerNote (subset). Array tags start with their own byte size.
export function canonMakerNoteEntries() {
  const cameraSettings = new Array(49).fill(0);
  cameraSettings[0] = 98;
  cameraSettings[3] = 4; // Quality: RAW
  cameraSettings[5] = 0; // ContinuousDrive: Single
  cameraSettings[7] = 0; // FocusMode: One-shot AF
  cameraSettings[17] = 3; // MeteringMode: Evaluative
  cameraSettings[20] = 3; // CanonExposureMode: Aperture-priority AE
  cameraSettings[22] = 61182; // LensType: Canon RF lens
  cameraSettings[23] = 50; cameraSettings[24] = 50; cameraSettings[25] = 1;

  const { af } = EXPECTED;
  const afInfo2 = [0, 2, 1, 1, af.imageWidth, af.imageHeight, af.imageWidth, af.imageHeight,
    af.width, af.height, af.x, af.y, 1, 1, 0];
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
    long(0x0010, 0x80000433), // CanonModelID (EOS RP)
    sshort(0x0026, afInfo2),
    ascii(0x0095, EXPECTED.lens),
    sshort(0x00a0, processing),
    slong(0x4018, lightingOpt),
  ];
}

/** Full IFD0 tree for a JPEG straight from the camera. */
export const fullTree = () => [
  ...ifd0Entries(),
  subIfd(0x8769, exifEntries()),
  subIfd(0x8825, gpsEntries()),
];

/** Standard EXIF but no MakerNote and no GPS (what a transfer app might keep). */
export const noMakerNoteTree = () => [
  ...ifd0Entries(),
  subIfd(0x8769, exifEntries({ withMakerNote: false })),
];
