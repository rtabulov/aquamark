import Router from '@koa/router';
import aquamark from '@aquamark/core';
import multer from '@koa/multer';
import mime from 'mime-types';
import 'reflect-metadata';
import {
  IsBoolean,
  IsIn,
  IsInt,
  Max,
  Min,
  validate,
  ValidationError,
} from 'class-validator';
import { plainToInstance, Type } from 'class-transformer';
import path from 'path';

const router = new Router();
const upload = multer({
  fileFilter: function (_req, file, cb) {
    const allow = checkFileType(file);
    if (allow) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
}); // note you can pass `multer` options here

export class AquamarkBody {
  @Type(() => String)
  @IsIn([
    'north',
    'northeast',
    'east',
    'southeast',
    'south',
    'southwest',
    'west',
  ])
  gravity: string;

  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  quality: number = 90;

  @Type(() => Boolean)
  @IsBoolean()
  gradient: boolean;

  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  gradientHeight: number = 30;

  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  overlayWidth: number = 20;

  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  overlayHeight: number = 20;
}

router.post(
  '/aquamark',

  upload.fields([
    { name: 'background', maxCount: 1 },
    { name: 'overlay', maxCount: 10 },
  ]),

  async (ctx) => {
    if (
      !(
        ctx.request.files &&
        !Array.isArray(ctx.request.files) &&
        ctx.request.files.overlay &&
        ctx.request.files.overlay.length === 1 &&
        ctx.request.files.background &&
        ctx.request.files.background.length === 1
      )
    ) {
      return ctx.badRequest({
        error:
          '`background` and `overlay` files must be in jpeg|jpg|png|svg format',
      });
    }

    const body = plainToInstance(AquamarkBody, ctx.request.body, {
      enableImplicitConversion: true,
    });

    const errors = await validate(body);

    if (errors.length) {
      return ctx.badRequest(getErrorMessages(errors));
    }

    const background = ctx.request.files.background[0];
    const overlay = ctx.request.files.overlay[0];

    const res = await aquamark(
      background.buffer,
      {
        input: overlay.buffer,
        gravity: body.gravity,
        overlayWidthPercent: body.overlayWidth,
        overlayHeightPercent: body.overlayHeight,
      },
      {
        quality: body.quality,
        gradient: body.gradient && { heightPercent: body.gradientHeight },
      },
    );

    const { format } = await res.metadata();

    ctx.response.set(
      'content-type',
      mime.lookup(format as string) || 'application/octet-stream',
    );
    ctx.body = await res.toBuffer();
  },
);

router.get('/', async (ctx) => {
  ctx.body = 'hello world';
});

export default router;

type ValidationErrorWithConstraints = ValidationError & {
  constraints: Record<string, string>;
};

function validateConstraints(
  e: ValidationError,
): e is ValidationErrorWithConstraints {
  return !!e.constraints;
}

function getErrorMessages(errors: ValidationError[]) {
  return Object.fromEntries(
    errors
      .filter(validateConstraints)
      .map((e) => [
        e.property,
        [
          ...Object.values(e.constraints).reverse(),
          `got ${typeof e.value} ${e.value}`,
        ].join(', '),
      ]),
  );
}

function checkFileType(file: multer.File) {
  // Allowed ext
  const filetypes = /jpeg|jpg|png|svg/;
  // Check ext
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  // Check mime
  const mimetype = filetypes.test(file.mimetype);

  return mimetype && extname;
}
