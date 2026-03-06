import {
  Controller,
  BadRequestException,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Request, Response } from 'express';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { Public } from '@/core/auth/decorators/public.decorator';
import type { JwtPayload } from '@/core/auth/types/auth.types';
import { ResourceService } from '../services/resource.service';
import type { UploadResourceResponse } from '../types/resource.types';

type AuthedReq = Request & { user?: JwtPayload & { principalId?: string } };

type MulterFileLike = {
  path: string;
  originalname: string;
  mimetype: string;
  size: number;
};

function isMulterFileLike(v: unknown): v is MulterFileLike {
  if (!v || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.path === 'string' &&
    typeof obj.originalname === 'string' &&
    typeof obj.mimetype === 'string' &&
    typeof obj.size === 'number'
  );
}

/**
 * @title 资源控制器
 * @description 提供统一资源上传与资源访问（流式/Range/缓存头）接口。
 * @keywords-cn 资源控制器, 上传, 下载, 流式返回, Range
 * @keywords-en resource-controller, upload, download, streaming, range
 */
@Controller('resources')
export class ResourceController {
  constructor(private readonly service: ResourceService) {}

  @Post('upload')
  @CheckAbility('create', 'resource')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (
          _req: Request,
          _file: { originalname?: string },
          cb: (error: Error | null, destination: string) => void,
        ) => {
          const dir = path.join(os.tmpdir(), 'azure-ai-upload');
          try {
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          } catch {
            void 0;
          }
          cb(null, dir);
        },
        filename: (
          _req: Request,
          file: { originalname?: string },
          cb: (error: Error | null, filename: string) => void,
        ) => {
          const base = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const ext = path.extname(file.originalname || '').toLowerCase();
          cb(null, `${base}${ext}`);
        },
      }),
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: unknown,
    @Req() req: AuthedReq,
  ): Promise<UploadResourceResponse> {
    const uploaderId = req.user?.id ?? req.user?.principalId ?? null;

    if (!isMulterFileLike(file)) {
      throw new BadRequestException('file is required');
    }

    const diskFile = {
      path: file.path,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
    return await this.service.upload(diskFile, uploaderId);
  }

  @Get(':id')
  @Public()
  async get(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // TODO(resource-guard): 为资源访问增加 Guard（鉴权/签名URL/访问控制）
    const { entity, filePath } = await this.service.getResourceFileOrThrow(id);
    const stat = await fs.promises.stat(filePath);

    const etag = `"${entity.md5}"`;
    const ifNoneMatch = req.headers['if-none-match'];
    if (typeof ifNoneMatch === 'string' && ifNoneMatch === etag) {
      res.status(304);
      res.end();
      return;
    }

    res.setHeader('ETag', etag);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader(
      'Content-Type',
      entity.mimeType || 'application/octet-stream',
    );

    const range = req.headers.range;
    if (typeof range === 'string' && range.startsWith('bytes=')) {
      const [startStr, endStr] = range.replace('bytes=', '').split('-');
      const start = startStr ? Number(startStr) : 0;
      const end = endStr ? Number(endStr) : stat.size - 1;
      const safeStart = Number.isFinite(start) ? start : 0;
      const safeEnd = Number.isFinite(end) ? end : stat.size - 1;
      if (safeStart < 0 || safeEnd < safeStart || safeEnd >= stat.size) {
        res.status(416);
        res.setHeader('Content-Range', `bytes */${stat.size}`);
        res.end();
        return;
      }
      res.status(206);
      res.setHeader(
        'Content-Range',
        `bytes ${safeStart}-${safeEnd}/${stat.size}`,
      );
      res.setHeader('Content-Length', String(safeEnd - safeStart + 1));
      const stream = fs.createReadStream(filePath, {
        start: safeStart,
        end: safeEnd,
      });
      stream.pipe(res);
      return;
    }

    res.status(200);
    res.setHeader('Content-Length', String(stat.size));
    fs.createReadStream(filePath).pipe(res);
  }
}
