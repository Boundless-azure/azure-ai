import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { v7 as uuidv7 } from 'uuid';
import { ResourceEntity } from '../entities/resource.entity';
import type { UploadResourceResponse } from '../types/resource.types';

type MulterDiskFile = {
  path: string;
  originalname: string;
  mimetype: string;
  size: number;
};

/**
 * @title 资源服务
 * @description 负责资源上传入库、MD5 去重与资源元信息读取。
 * @keywords-cn 资源服务, 上传, 去重, MD5, 入库
 * @keywords-en resource-service, upload, dedup, md5, persistence
 */
@Injectable()
export class ResourceService {
  constructor(
    @InjectRepository(ResourceEntity)
    private readonly repo: Repository<ResourceEntity>,
  ) {}

  private normalizeStoredPath(storedPath: string, root: string): string {
    if (!storedPath) return storedPath;
    if (!path.isAbsolute(storedPath)) {
      return storedPath.replace(/\\/g, '/').replace(/^\/+/, '');
    }

    const rootAbs = path.resolve(root);
    const fileAbs = path.resolve(storedPath);
    if (fileAbs.startsWith(rootAbs + path.sep)) {
      return path.relative(rootAbs, fileAbs).replace(/\\/g, '/');
    }
    return storedPath;
  }

  private resolveStoragePath(storedPath: string, root: string): string {
    if (!storedPath) return '';
    if (path.isAbsolute(storedPath)) return storedPath;

    const rootAbs = path.resolve(root);
    const resolved = path.resolve(rootAbs, storedPath);
    if (resolved !== rootAbs && !resolved.startsWith(rootAbs + path.sep)) {
      throw new BadRequestException('invalid storage path');
    }
    return resolved;
  }

  private storageRoot(): string {
    const env = process.env.RESOURCE_STORAGE_DIR;
    const root =
      env && env.trim()
        ? env.trim()
        : path.join(process.cwd(), 'storage', 'resources');
    if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
    return root;
  }

  private normalizeExt(originalName: string): string {
    const ext = path.extname(originalName || '').toLowerCase();
    if (!ext) return '';
    if (!/^[a-z0-9.]+$/.test(ext)) return '';
    return ext.length > 12 ? ext.slice(0, 12) : ext;
  }

  private categoryOf(mimeType: string, extWithDot: string): string {
    const mime = (mimeType || '').toLowerCase();
    const ext = (extWithDot || '').toLowerCase().replace(/^\./, '');

    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';

    const office = new Set([
      'pdf',
      'doc',
      'docx',
      'xls',
      'xlsx',
      'ppt',
      'pptx',
      'csv',
      'txt',
      'md',
    ]);
    const code = new Set([
      'js',
      'ts',
      'tsx',
      'jsx',
      'json',
      'yaml',
      'yml',
      'toml',
      'xml',
      'html',
      'css',
      'scss',
      'less',
      'py',
      'go',
      'rs',
      'java',
      'kt',
      'c',
      'cpp',
      'h',
      'hpp',
      'sh',
      'bat',
      'ps1',
      'sql',
    ]);
    const design = new Set(['psd', 'sketch', 'fig', 'xd', 'ai']);

    if (office.has(ext)) return 'office';
    if (code.has(ext)) return 'code';
    if (design.has(ext)) return 'design';
    return 'other';
  }

  private async computeMd5(
    filePath: string,
  ): Promise<{ md5: string; bytes: number }> {
    const st = await fs.promises.stat(filePath).catch(() => undefined);
    if (!st || !st.isFile()) throw new BadRequestException('invalid file');

    const hash = createHash('md5');
    const stream = fs.createReadStream(filePath);
    let bytes = 0;
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        hash.update(chunk);
      });
      stream.on('error', reject);
      stream.on('end', resolve);
    });
    return { md5: hash.digest('hex'), bytes };
  }

  private ensureWithin100m(size: number): void {
    const limit = 100 * 1024 * 1024;
    if (!Number.isFinite(size) || size <= 0) {
      throw new BadRequestException('invalid file size');
    }
    if (size > limit) {
      throw new BadRequestException('file too large (>100MB)');
    }
  }

  async upload(
    file: MulterDiskFile,
    uploaderId: string | null,
  ): Promise<UploadResourceResponse> {
    if (!file || typeof file.path !== 'string') {
      throw new BadRequestException('missing file');
    }
    this.ensureWithin100m(file.size);

    const { md5, bytes } = await this.computeMd5(file.path);
    this.ensureWithin100m(bytes);

    const fileExt = this.normalizeExt(file.originalname);
    const category = this.categoryOf(file.mimetype, fileExt);
    const sizeStr = String(bytes);

    const existed = await this.repo.findOne({
      where: { md5, fileSize: sizeStr, isDelete: false, active: true },
      order: { createdAt: 'DESC' },
    });

    const id = uuidv7();

    const root = this.storageRoot();

    if (existed) {
      const existedStored = this.normalizeStoredPath(existed.storagePath, root);
      if (existedStored && existedStored !== existed.storagePath) {
        await this.repo.save({ ...existed, storagePath: existedStored });
      }

      const entity = this.repo.create({
        id,
        uploaderId,
        originalName: file.originalname || 'file',
        fileExt: fileExt || null,
        mimeType: file.mimetype || null,
        fileSize: sizeStr,
        md5,
        category,
        storagePath: existedStored || existed.storagePath,
        copiedFromId: existed.id,
        active: true,
        isDelete: false,
      });
      await this.repo.save(entity);
      try {
        await fs.promises.unlink(file.path);
      } catch {
        void 0;
      }
      return { id, path: `/resources/${id}`, md5, duplicated: true };
    }

    const relDir = `${md5.slice(0, 2)}/${md5.slice(2, 4)}`;
    const targetDir = path.join(root, md5.slice(0, 2), md5.slice(2, 4));
    await fs.promises.mkdir(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, `${md5}${fileExt}`);

    if (!fs.existsSync(targetPath)) {
      try {
        await fs.promises.rename(file.path, targetPath);
      } catch {
        await fs.promises.copyFile(file.path, targetPath);
        await fs.promises.unlink(file.path).catch(() => undefined);
      }
    } else {
      await fs.promises.unlink(file.path).catch(() => undefined);
    }

    const entity = this.repo.create({
      id,
      uploaderId,
      originalName: file.originalname || 'file',
      fileExt: fileExt || null,
      mimeType: file.mimetype || null,
      fileSize: sizeStr,
      md5,
      category,
      storagePath: `${relDir}/${md5}${fileExt}`,
      copiedFromId: null,
      active: true,
      isDelete: false,
    });
    await this.repo.save(entity);

    return { id, path: `/resources/${id}`, md5, duplicated: false };
  }

  async getResourceFileOrThrow(id: string): Promise<{
    entity: ResourceEntity;
    filePath: string;
  }> {
    const entity = await this.repo.findOne({
      where: { id, isDelete: false, active: true },
    });
    if (!entity) throw new NotFoundException('resource not found');

    const root = this.storageRoot();
    const normalized = this.normalizeStoredPath(entity.storagePath, root);
    const stored = normalized || entity.storagePath;
    const filePath = this.resolveStoragePath(stored, root);

    if (!filePath || !fs.existsSync(filePath)) {
      throw new NotFoundException('resource file not found');
    }

    if (stored && stored !== entity.storagePath) {
      await this.repo.save({ ...entity, storagePath: stored });
      entity.storagePath = stored;
    }

    return { entity, filePath };
  }
}
