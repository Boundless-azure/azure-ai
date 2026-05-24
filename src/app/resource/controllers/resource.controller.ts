import {
  Controller,
  BadRequestException,
  Get,
  Param,
  Post,
  Delete,
  Body,
  Query,
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
import { z } from 'zod';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { Public } from '@/core/auth/decorators/public.decorator';
import type { JwtPayload } from '@/core/auth/types/auth.types';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import type { HookInvocationContext } from '@/core/hookbus/types/hook.types';
import { ResourceService } from '../services/resource.service';
import { ResourceSignService } from '../services/resource-sign.service';
import type {
  UploadResourceResponse,
  ChunkedUploadInitResponse,
  ChunkedUploadCommitResponse,
  ChunkStatusResponse,
  BatchDuplicateRequest,
  BatchDuplicateResponse,
  ResourceListItem,
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
 * Hook payload schema (SSOT) — currentSession 仅接受分页 + 过滤参数, sessionId 强制由 ctx 注入。
 * @keyword-en resource-current-session-payload, ctx-driven-session
 */
const currentSessionInput = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('返回数量, 默认 20, 上限 100'),
  offset: z.number().int().min(0).optional().describe('分页偏移, 默认 0'),
  category: z
    .enum(['image', 'video', 'document', 'audio', 'archive', 'code', 'other'])
    .optional()
    .describe('按资源类别过滤; 留空表示不过滤'),
  q: z.string().optional().describe('按文件名子串过滤 (大小写不敏感)'),
});

/**
 * @title 资源控制器
 * @description 提供统一资源上传（简单/分片）、资源访问（流式/Range/缓存头）、断点续传和批量复制接口。
 * @keywords-cn 资源控制器, 上传, 下载, 流式返回, Range, 分片上传, 断点续传
 * @keywords-en resource-controller, upload, download, streaming, range, chunked-upload, resume
 */
@HookController({ pluginName: 'resource', tags: ['resource', 'file'] })
@Controller('resources')
export class ResourceController {
  constructor(
    private readonly service: ResourceService,
    private readonly sign: ResourceSignService,
  ) {}

  /**
   * Hook only: saas.app.resource.currentSession
   * 列出当前聊天会话已上传的资源 (按 createdAt DESC 排序, 分页)。
   * sessionId 由 invocationContext.extras.sessionId 强制注入, LLM 无法跨会话查询。
   *
   * @keyword-cn 当前会话资源, 列表分页
   * @keyword-en current-session-resources, paged-list
   */
  @HookRoute({
    hook: 'saas.app.resource.currentSession',
    description:
      '列出"当前聊天会话"已上传的资源, 按上传时间倒序分页。' +
      'sessionId 由系统从当前对话上下文自动注入, LLM 无法跨会话查询。' +
      '返回 items[].id 即 resourceId, 可作为 saas.app.storage.createNode 的 resourceId 入参。',
    args: [currentSessionInput],
  })
  @CheckAbility('read', 'resource')
  async currentSessionResources(
    body: z.infer<typeof currentSessionInput>,
    context?: HookInvocationContext,
  ): Promise<{
    items: Array<{
      resourceId: string;
      name: string;
      path: string;
      category: string;
      mimeType: string | null;
      fileSize: string;
      createdAt: Date;
    }>;
    total: number;
    hasMore: boolean;
    limit: number;
    offset: number;
  }> {
    const sessionId =
      typeof context?.extras?.sessionId === 'string'
        ? context.extras.sessionId
        : null;
    if (!sessionId) {
      throw new BadRequestException(
        'saas.app.resource.currentSession 只能在聊天会话上下文中调用 (extras.sessionId 缺失); 如需跨会话查询请走 HTTP GET /resources?sessionId=...',
      );
    }
    const page = await this.service.listPaged({
      sessionId,
      limit: body.limit,
      offset: body.offset,
      category: body.category,
      q: body.q,
    });
    return {
      items: page.items.map((item) => ({
        resourceId: item.id,
        name: item.originalName,
        path: item.path,
        category: item.category,
        mimeType: item.mimeType,
        fileSize: item.fileSize,
        createdAt: item.createdAt,
      })),
      total: page.total,
      hasMore: page.hasMore,
      limit: page.limit,
      offset: page.offset,
    };
  }

  /**
   * GET /resources
   * @keyword-en list-resources
   */
  @Get()
  @CheckAbility('read', 'resource')
  async list(
    @Query('sessionId') sessionId?: string,
    @Query('category') category?: string,
    @Query('q') q?: string,
    @Query('limit') limitStr?: string,
  ): Promise<ResourceListItem[]> {
    const limit = limitStr ? Number(limitStr) : undefined;
    return await this.service.list({
      sessionId,
      category,
      q,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

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
    @Body('sessionId') sessionId?: string,
  ): Promise<UploadResourceResponse> {
    try {
      const uploaderId = req.user?.id ?? req.user?.principalId ?? null;
      const tenantId = req.user?.tenantId ?? null;
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
        sessionId,
        tenantId,
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
    @Body('sessionId') sessionId?: string,
  ): Promise<UploadResourceResponse[]> {
    const uploaderId = req.user?.id ?? req.user?.principalId ?? null;
    const tenantId = req.user?.tenantId ?? null;
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
          sessionId,
          tenantId,
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
    const tenantId = req.user?.tenantId ?? null;
    return await this.service.initChunkedUpload(
      dto.filename,
      dto.totalChunks,
      dto.fileSize,
      dto.md5,
      dto.mimeType || 'application/octet-stream',
      uploaderId,
      dto.sessionId,
      tenantId,
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
    const tenantId = req.user?.tenantId ?? null;
    const items = await this.service.batchDuplicate(
      body.resourceIds,
      uploaderId,
      tenantId,
    );
    return { items };
  }

  // ==================== 资源访问 ====================

  /**
   * GET /resources/:id?sig=<hmac>&tid=<tenantId>
   *
   * 鉴权设计:
   *   - 保留 @Public 以兼容 <img>/<video> 浏览器原生标签 (无法附带 Authorization Bearer)
   *   - 强制要求 sig + tid query 参数, 并比对 entity.channelId === tid + sig 通过
   *   - 历史资源 (channelId == null) 不强制要求 sig, 兼容期内允许访问 (后续可关闭)
   *
   * 防御设计:
   *   - 全部强制 Content-Disposition: attachment + Content-Type: application/octet-stream
   *   - 浏览器一律走下载流, 杜绝 HTML / SVG / JS 在同源被渲染导致 XSS
   *   - X-Content-Type-Options: nosniff 关闭 MIME sniff
   *
   * @keyword-en get-resource, signed-access, tenant-isolation, force-download, nosniff
   */
  @Get(':id')
  @Public()
  async get(
    @Param('id') id: string,
    @Query('sig') sig: string | undefined,
    @Query('tid') tid: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { entity, filePath } = await this.service.getResourceFileOrThrow(id);

    // 租户隔离 + 签名校验
    const entityTenant = entity.channelId ?? null;
    if (entityTenant !== null) {
      // 必须带 sig + tid, 且 tid 必须等于资源租户, sig 必须 HMAC 匹配
      if (!sig || !tid) {
        res
          .status(403)
          .json({ message: 'resource access denied: missing sig' });
        return;
      }
      if (tid !== entityTenant) {
        res
          .status(403)
          .json({ message: 'resource access denied: tenant mismatch' });
        return;
      }
      if (!this.sign.verify(id, tid, sig)) {
        res.status(403).json({ message: 'resource access denied: bad sig' });
        return;
      }
    }
    // entityTenant === null: legacy resource, 兼容期放行
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
    // 资源已租户隔离, 不进入 CDN/共享缓存
    res.setHeader('Cache-Control', 'private, max-age=86400');
    // 关键防御: nosniff 关闭 MIME sniff, 阻止"伪装成图片的 HTML"被当 HTML 执行
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // 仅"非脚本可渲染类型"允许 inline, 保留聊天图片/视频/PDF 预览体验
    // 其它一切 (HTML / SVG / JS / EXE / 文档 ...) 强制 octet-stream + attachment, 浏览器一律下载
    const rawMime = (entity.mimeType || '').toLowerCase();
    const isInlineSafe =
      rawMime.startsWith('image/') &&
      !rawMime.includes('svg') && // SVG 能跑 JS, 排除
      !rawMime.includes('xml');
    const isMediaSafe =
      rawMime.startsWith('video/') || rawMime.startsWith('audio/');
    const isPdfSafe = rawMime === 'application/pdf';
    const allowInline = isInlineSafe || isMediaSafe || isPdfSafe;

    const safeName = (entity.originalName || 'file').replace(/[\r\n"\\]/g, '_');
    const asciiName = safeName.replace(/[^\x20-\x7E]/g, '_');
    const utf8Name = encodeURIComponent(safeName);

    if (allowInline) {
      res.setHeader('Content-Type', rawMime);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      );
    } else {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      );
    }

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
