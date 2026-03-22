import {
  Controller,
  BadRequestException,
  Get,
  Param,
  Post,
  Delete,
  Body,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Request, Response } from 'express';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { Public } from '@/core/auth/decorators/public.decorator';
import type { JwtPayload } from '@/core/auth/types/auth.types';
import { ResourceService } from '../services/resource.service';
import type {
  UploadResourceResponse,
  ChunkedUploadInitResponse,
  ChunkedUploadCommitResponse,
  ChunkStatusResponse,
  BatchDuplicateRequest,
  BatchDuplicateResponse,
} from '../types/resource.types';
import { InitChunkedUploadDto } from '../types/resource.types';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';

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

function tempDir(): string {
  const dir = path.join(os.tmpdir(), 'azure-ai-upload');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * @title 资源控制器
 * @description 提供统一资源上传（简单/分片）、资源访问（流式/Range/缓存头）、断点续传和批量复制接口。
 * @keywords-cn 资源控制器, 上传, 下载, 流式返回, Range, 分片上传, 断点续传
 * @keywords-en resource-controller, upload, download, streaming, range, chunked-upload, resume
 */
@Controller('resources')
export class ResourceController {
  constructor(private readonly service: ResourceService) {}

  // ==================== 简单上传 ====================

  @Post('upload')
  @CheckAbility('create', 'resource')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          cb(null, tempDir());
        },
        filename: (_req, file, cb) => {
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
    try {
      const uploaderId = req.user?.id ?? req.user?.principalId ?? null;
      if (!isMulterFileLike(file)) {
        throw new BadRequestException('file is required');
      }
      return await this.service.upload(
        {
          path: file.path,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        uploaderId,
      );
    } catch (err) {
      console.error('[Resource] Upload error:', err);
      throw err;
    }
  }

  // ==================== 多文件上传 ====================

  @Post('upload/multiple')
  @CheckAbility('create', 'resource')
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      storage: diskStorage({
        destination: () => tempDir(),
        filename: (_req, file, cb) => {
          const base = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const ext = path.extname(file.originalname || '').toLowerCase();
          cb(null, `${base}${ext}`);
        },
      }),
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  async uploadMultiple(
    @UploadedFiles() files: unknown[],
    @Req() req: AuthedReq,
  ): Promise<UploadResourceResponse[]> {
    const uploaderId = req.user?.id ?? req.user?.principalId ?? null;
    const results: UploadResourceResponse[] = [];
    for (const file of files) {
      if (!isMulterFileLike(file)) continue;
      try {
        const result = await this.service.upload(
          {
            path: file.path,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          },
          uploaderId,
        );
        results.push(result);
      } catch {
        void 0;
      }
    }
    return results;
  }

  // ==================== 分片上传 ====================

  /**
   * 初始化分片上传
   * POST /resources/chunked/init
   */
  @Post('chunked/init')
  @CheckAbility('create', 'resource')
  async initChunkedUpload(
    @Body() body: InitChunkedUploadDto,
    @Req() req: AuthedReq,
  ): Promise<ChunkedUploadInitResponse> {
    const dto = plainToInstance(InitChunkedUploadDto, body);
    await validateOrReject(dto);

    const uploaderId = req.user?.id ?? req.user?.principalId ?? null;
    return await this.service.initChunkedUpload(
      dto.filename,
      dto.totalChunks,
      dto.fileSize,
      dto.md5,
      dto.mimeType || 'application/octet-stream',
      uploaderId,
    );
  }

  /**
   * 上传单个分片
   * POST /resources/chunked/upload
   */
  @Post('chunked/upload')
  @CheckAbility('create', 'resource')
  @UseInterceptors(
    FileInterceptor('chunk', {
      storage: diskStorage({
        destination: () => tempDir(),
        filename: (_req, _file, cb) => {
          cb(
            null,
            `chunk_${Date.now()}-${Math.random().toString(16).slice(2)}`,
          );
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 单分片最大10MB
    }),
  )
  async uploadChunk(
    @UploadedFile() file: unknown,
    @Body('uploadId') uploadId: string,
    @Body('chunkIndex') chunkIndexStr: string,
  ): Promise<{ received: boolean; uploadId: string; chunkIndex: number }> {
    if (!isMulterFileLike(file))
      throw new BadRequestException('chunk file required');
    const chunkIndex = parseInt(chunkIndexStr, 10);
    if (!Number.isFinite(chunkIndex))
      throw new BadRequestException('invalid chunkIndex');
    return await this.service.uploadChunk(uploadId, chunkIndex, {
      path: file.path,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });
  }

  /**
   * 查询分片上传状态（断点续传查询）
   * GET /resources/chunked/status/:uploadId
   */
  @Get('chunked/status/:uploadId')
  @CheckAbility('read', 'resource')
  async getChunkStatus(
    @Param('uploadId') uploadId: string,
  ): Promise<ChunkStatusResponse> {
    return await this.service.getChunkStatus(uploadId);
  }

  /**
   * 完成分片上传（合并分片）
   * POST /resources/chunked/commit
   */
  @Post('chunked/commit')
  @CheckAbility('create', 'resource')
  async commitChunkedUpload(
    @Body('uploadId') uploadId: string,
  ): Promise<ChunkedUploadCommitResponse> {
    return await this.service.commitChunkedUpload(uploadId);
  }

  /**
   * 取消分片上传
   * DELETE /resources/chunked/abort/:uploadId
   */
  @Delete('chunked/abort/:uploadId')
  @CheckAbility('delete', 'resource')
  async abortChunkedUpload(
    @Param('uploadId') uploadId: string,
  ): Promise<{ success: boolean }> {
    await this.service.abortChunkedUpload(uploadId);
    return { success: true };
  }

  // ==================== 批量操作 ====================

  /**
   * 批量复制资源（粘贴）
   * POST /resources/batch/copy
   */
  @Post('batch/copy')
  @CheckAbility('create', 'resource')
  async batchDuplicate(
    @Body() body: BatchDuplicateRequest,
    @Req() req: AuthedReq,
  ): Promise<BatchDuplicateResponse> {
    const uploaderId = req.user?.id ?? req.user?.principalId ?? null;
    const items = await this.service.batchDuplicate(
      body.resourceIds,
      uploaderId,
    );
    return { items };
  }

  // ==================== 资源访问 ====================

  @Get(':id')
  @Public()
  async get(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { entity, filePath } = await this.service.getResourceFileOrThrow(id);
    const stat = await fs.promises.stat(filePath);

    const etag = `"${entity.sha256 || entity.md5}"`;
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
