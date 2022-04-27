import sharp, { OverlayOptions, Metadata, Sharp } from 'sharp';
import { resolve } from 'path';
import { defaults, over } from 'lodash';
import { readFile } from 'fs/promises';

const GRADIENT_BUFFER = readFile(resolve(__dirname, '../assets/gradient.svg'));

export interface AquamarkOptions {
  quality?: number;
  gradient?:
    | boolean
    | {
        light?: boolean;
        heightPercent?: number;
      };
}

const DEFAULT_GRADIENT_OPTIONS = {
  light: false,
  heightPercent: 50,
};

export interface AquamarkOverlayOptions extends OverlayOptions {
  overlayWidthPercent: number;
  overlayHeightPercent: number;
  input: Buffer;
}

export default async function aquamark(
  background: Buffer,
  overlay: AquamarkOverlayOptions,
  { quality = 95, gradient = true }: AquamarkOptions,
) {
  const bg = sharp(background);

  let sharpGradient: Sharp | undefined = undefined;
  let gradientPosition: Position | undefined = undefined;

  const { width, height } = await bg.metadata();

  if (gradient) {
    const options = defaults(gradient, DEFAULT_GRADIENT_OPTIONS);

    gradientPosition = await getGradientPosition(overlay);

    sharpGradient = await makeGradient({
      width,
      height: Math.floor((options.heightPercent / 100) * (height || 0)),
      light: options.light,
      position: gradientPosition,
    });
  }

  const sharpInput = sharp(overlay.input);

  const resizedOverlay = sharpInput.resize({
    width: (overlay.overlayWidthPercent / 100) * (width || 0),
    height: (overlay.overlayHeightPercent / 100) * (height || 0),
    fit: 'inside',
  });

  return bg
    .composite([
      {
        input: sharpGradient && (await sharpGradient.toBuffer()),
        gravity: gradientPosition,
      },
      {
        ...overlay,
        input: await resizedOverlay.toBuffer(),
      },
    ])
    .png({ quality });
}

const POSITIONS = ['north', 'east', 'south', 'west'] as const;
type Position = typeof POSITIONS[number];

function getAngle(p: Position) {
  return POSITIONS.indexOf(p) * 90;
}

interface GradientOptions {
  width: Metadata['width'];
  height: Metadata['height'];
  position?: Position;
  light?: boolean;
}

async function makeGradient({
  width,
  height,
  position = 'north',
  light = false,
}: GradientOptions) {
  const gradient = sharp(await GRADIENT_BUFFER).resize({
    width,
    height,
    fit: 'fill',
  });

  gradient.rotate(getAngle(position) + 180);

  if (light) {
    gradient.negate({ alpha: false });
  }

  return gradient;
}

async function getGradientPosition(o: OverlayOptions) {
  return typeof o.gravity === 'string' && o.gravity.includes('north')
    ? 'north'
    : 'south';
}

const asyncSome = async <T>(
  arr: Array<T>,
  predicate: (i: T) => Promise<boolean> | boolean,
) => {
  for (let e of arr) {
    if (await predicate(e)) return true;
  }
  return false;
};
