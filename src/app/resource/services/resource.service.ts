import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import * as fs from 'fs';
import * as path from 'path';
import { v7 as uuidv7 } from 'uuid';
import { ResourceEntity } from '../entities/resource.entity';
import type {
  UploadResourceResponse,
  ChunkedUploadInitResponse,
  ChunkedUploadCommitResponse,
} from '../types/resource.types';

type MulterDiskFile = {
  path: string;
  originalname: string;
  mimetype: string;
  size: number;
};

// 大文件阈值 100MB
const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024;
// 抽样区间大小 1MB
const SAMPLE_SIZE = 1 * 1024 * 1024;
// 分片过期时间 24小时
const CHUNK_EXPIRY_HOURS = 24;

/**
 * @title 资源服务
 * @description 负责资源上传入库、SHA256去重、分片上传断点续传与资源元信息读取。
 * @keywords-cn 资源服务, 上传, 去重, SHA256, 分片上传, 断点续传
 * @keywords-en resource-service, upload, dedup, sha256, chunked-upload, resume
 */
@Injectable()
export class ResourceService {
  constructor(
    @InjectRepository(ResourceEntity)
    private readonly repo: Repository<ResourceEntity>,
  ) {}

  // ==================== 工具方法 ====================

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

  private chunkTempRoot(): string {
    const env = process.env.RESOURCE_CHUNK_TEMP_DIR;
    const root =
      env && env.trim()
        ? env.trim()
        : path.join(process.cwd(), 'storage', 'chunks');
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

  // ==================== MD5/SHA256 计算 ====================

  /**
   * 计算文件 MD5
   * @keyword-en compute-md5, md5-hash
   * @param filePath 文件路径
   */
  private async computeMd5(
    filePath: string,
  ): Promise<{ md5: string; bytes: number }> {
    const st = await fs.promises.stat(filePath).catch(() => undefined);
    if (!st || !st.isFile()) throw new BadRequestException('invalid file');

    const hash = createHash('md5');
    const stream = createReadStream(filePath);
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

  /**
   * 同时计算 MD5 和 SHA256，单次文件读取
   * @keyword-en compute-hashes, md5-sha256
   * @param filePath 文件路径
   * @param fileSize 文件大小
   */
  private async computeBothHashes(
    filePath: string,
    fileSize: number,
  ): Promise<{ md5: string; sha256: string; sampled: boolean }> {
    const isLarge = fileSize >= LARGE_FILE_THRESHOLD;

    const md5Hash = createHash('md5');
    const sha256Hash = createHash('sha256');

    if (!isLarge) {
      // 小文件：全量计算，单次读取同时更新两个 hash
      await new Promise<void>((resolve, reject) => {
        const stream = createReadStream(filePath);
        stream.on('data', (chunk: Buffer) => {
          md5Hash.update(chunk);
          sha256Hash.update(chunk);
        });
        stream.on('error', reject);
        stream.on('end', resolve);
      });
      return {
        md5: md5Hash.digest('hex'),
        sha256: sha256Hash.digest('hex'),
        sampled: false,
      };
    }

    // 大文件：抽样计算 SHA256，全量计算 MD5
    const ranges: [number, number][] = [];
    ranges.push([0, Math.min(SAMPLE_SIZE, fileSize)]);
    const lastStart = Math.max(0, fileSize - SAMPLE_SIZE);
    ranges.push([lastStart, fileSize]);
    let pos = SAMPLE_SIZE;
    while (pos < lastStart) {
      ranges.push([pos, Math.min(pos + SAMPLE_SIZE, lastStart)]);
      pos += 10 * 1024 * 1024;
    }

    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(filePath, { autoClose: true });
      let offset = 0;
      let rangeIdx = 0;

      stream.on('data', (chunk: Buffer) => {
        md5Hash.update(chunk); // MD5 始终全量

        const chunkEnd = offset + chunk.length;
        while (rangeIdx < ranges.length) {
          const [start, end] = ranges[rangeIdx];
          if (chunkEnd <= start) break;
          if (offset < end && chunkEnd > start) {
            const intersectStart = Math.max(start, offset);
            const intersectEnd = Math.min(end, chunkEnd);
            if (intersectStart < intersectEnd) {
              const sub = chunk.subarray(
                intersectStart - offset,
                intersectEnd - offset,
              );
              sha256Hash.update(sub);
            }
          }
          if (chunkEnd >= end) rangeIdx++;
          else break;
        }
        offset = chunkEnd;
      });
      stream.on('error', reject);
      stream.on('end', resolve);
    });

    return {
      md5: md5Hash.digest('hex'),
      sha256: sha256Hash.digest('hex'),
      sampled: true,
    };
  }

  /**
   * 计算文件 SHA256，支持大文件抽样
   * - 文件 < 100MB：全量计算
   * - 文件 >= 100MB：抽样计算（前1M + 后1M + 每10M区间取样）
   * @keyword-en compute-sha256, sha256-sampled, large-file
   * @param filePath 文件路径
   * @param fileSize 文件大小
   * @returns SHA256哈希值和是否抽样标识
   */
  private async computeSha256(
    filePath: string,
    fileSize: number,
  ): Promise<{ sha256: string; sampled: boolean }> {
    const hash = createHash('sha256');
    const isLarge = fileSize >= LARGE_FILE_THRESHOLD;

    if (!isLarge) {
      // 小文件全量计算
      const stream = createReadStream(filePath);
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => hash.update(chunk));
        stream.on('error', reject);
        stream.on('end', resolve);
      });
      return { sha256: hash.digest('hex'), sampled: false };
    }

    // 大文件抽样计算
    // 策略：前1M + 后1M + 区间抽样（每10M取样1M）
    const ranges: [number, number][] = [];

    // 前1M
    ranges.push([0, Math.min(SAMPLE_SIZE, fileSize)]);
    // 后1M
    const lastStart = Math.max(0, fileSize - SAMPLE_SIZE);
    ranges.push([lastStart, fileSize]);

    // 中间区间：每10M取样1M
    let pos = SAMPLE_SIZE;
    while (pos < lastStart) {
      const end = Math.min(pos + SAMPLE_SIZE, lastStart);
      ranges.push([pos, end]);
      pos += 10 * 1024 * 1024;
    }

    const stream = createReadStream(filePath, { autoClose: true });
    let offset = 0;
    let rangeIdx = 0;

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => {
        const chunkEnd = offset + chunk.length;

        // 找出与当前chunk相交的所有区间
        while (rangeIdx < ranges.length) {
          const [start, end] = ranges[rangeIdx];
          if (chunkEnd <= start) break;
          if (offset < end && chunkEnd > start) {
            // 计算交集
            const intersectStart = Math.max(start, offset);
            const intersectEnd = Math.min(end, chunkEnd);
            if (intersectStart < intersectEnd) {
              const sub = chunk.subarray(
                intersectStart - offset,
                intersectEnd - offset,
              );
              hash.update(sub);
            }
          }
          if (chunkEnd >= end) rangeIdx++;
          else break;
        }
        offset = chunkEnd;
      });
      stream.on('error', reject);
      stream.on('end', resolve);
    });

    return { sha256: hash.digest('hex'), sampled: true };
  }

  private ensureWithinLimit(size: number, limitMb: number): void {
    const limit = limitMb * 1024 * 1024;
    if (!Number.isFinite(size) || size <= 0) {
      throw new BadRequestException('invalid file size');
    }
    if (size > limit) {
      throw new BadRequestException(`file too large (>${limitMb}MB)`);
    }
  }

  // ==================== 简单上传 ====================

  /**
   * 上传资源文件，使用SHA256做去重判断
   * @keyword-en upload-resource, sha256-dedup
   */
  async upload(
    file: MulterDiskFile,
    uploaderId: string | null,
  ): Promise<UploadResourceResponse> {
    if (!file || typeof file.path !== 'string') {
      throw new BadRequestException('missing file');
    }
    this.ensureWithinLimit(file.size, 100);

    const { md5, sha256, sampled } = await this.computeBothHashes(
      file.path,
      file.size,
    );
    const sizeStr = String(file.size);

    const fileExt = this.normalizeExt(file.originalname);
    const category = this.categoryOf(file.mimetype, fileExt);

    // 用 SHA256 做去重判断（不再依赖MD5）
    const existed = await this.repo.findOne({
      where: { sha256, fileSize: sizeStr, isDelete: false, active: true },
      order: { createdAt: 'DESC' },
    });

    const id = uuidv7();
    const root = this.storageRoot();

    if (existed) {
      // SHA256 重复，直接复用已有文件
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
        sha256,
        sha256Sampled: sampled,
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

    // 没有重复，新文件
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
      sha256,
      sha256Sampled: sampled,
      category,
      storagePath: `${relDir}/${md5}${fileExt}`,
      copiedFromId: null,
      active: true,
      isDelete: false,
      chunkTotal: 0,
      chunkBitmap: '',
      chunkTempDir: null,
      chunkExpiresAt: null,
    });
    await this.repo.save(entity);

    return { id, path: `/resources/${id}`, md5, duplicated: false };
  }

  // ==================== 分片上传 ====================

  /**
   * 初始化分片上传
   * @keyword-en chunked-upload-init, init-chunk
   */
  async initChunkedUpload(
    filename: string,
    totalChunks: number,
    fileSize: number,
    md5: string,
    mimeType: string,
    uploaderId: string | null,
  ): Promise<ChunkedUploadInitResponse> {
    this.ensureWithinLimit(fileSize, 500); // 分片上传最大500MB

    const fileExt = this.normalizeExt(filename);
    const category = this.categoryOf(mimeType, fileExt);
    const sizeStr = String(fileSize);
    const id = uuidv7();

    // 检查是否已存在相同文件（MD5+大小）
    const existed = await this.repo.findOne({
      where: { md5, fileSize: sizeStr, isDelete: false, active: true },
      order: { createdAt: 'DESC' },
    });

    const root = this.storageRoot();
    const tempDir = path.join(this.chunkTempRoot(), id);
    await fs.promises.mkdir(tempDir, { recursive: true });

    if (existed) {
      // 文件已存在，直接复用
      const existedStored = this.normalizeStoredPath(existed.storagePath, root);
      const entity = this.repo.create({
        id,
        uploaderId,
        originalName: filename || 'file',
        fileExt: fileExt || null,
        mimeType: mimeType || null,
        fileSize: sizeStr,
        md5,
        sha256: existed.sha256,
        sha256Sampled: existed.sha256Sampled,
        category,
        storagePath: existedStored || existed.storagePath,
        copiedFromId: existed.id,
        active: true,
        isDelete: false,
        chunkTotal: totalChunks,
        chunkBitmap: '0'.repeat(totalChunks), // 全部"已收"（实际文件已完整）
        chunkTempDir: null,
        chunkExpiresAt: null,
      });
      await this.repo.save(entity);
      return {
        id,
        uploadId: id,
        resumed: true,
        missingChunks: [],
        totalChunks,
      };
    }

    // 新文件，创建分片记录
    const entity = this.repo.create({
      id,
      uploaderId,
      originalName: filename || 'file',
      fileExt: fileExt || null,
      mimeType: mimeType || null,
      fileSize: sizeStr,
      md5,
      sha256: null,
      sha256Sampled: false,
      category,
      storagePath: '',
      copiedFromId: null,
      active: true,
      isDelete: false,
      chunkTotal: totalChunks,
      chunkBitmap: '0'.repeat(totalChunks), // 全0表示全未收
      chunkTempDir: tempDir,
      chunkExpiresAt: new Date(Date.now() + CHUNK_EXPIRY_HOURS * 3600 * 1000),
    });
    await this.repo.save(entity);

    return {
      id,
      uploadId: id,
      resumed: false,
      missingChunks: Array.from({ length: totalChunks }, (_, i) => i),
      totalChunks,
    };
  }

  /**
   * 上传单个分片
   * @keyword-en upload-chunk, chunk-upload
   */
  async uploadChunk(
    uploadId: string,
    chunkIndex: number,
    file: MulterDiskFile,
  ): Promise<{ received: boolean; uploadId: string; chunkIndex: number }> {
    const entity = await this.repo.findOne({
      where: { id: uploadId, isDelete: false },
    });
    if (!entity) throw new NotFoundException('upload session not found');
    if (chunkIndex < 0 || chunkIndex >= entity.chunkTotal) {
      throw new BadRequestException('invalid chunk index');
    }
    if (!entity.chunkTempDir)
      throw new BadRequestException('not a chunked upload');

    // 检查位图
    const bitmap = entity.chunkBitmap || '0'.repeat(entity.chunkTotal);
    if (bitmap[chunkIndex] === '1') {
      // 已存在，直接跳过
      try {
        await fs.promises.unlink(file.path);
      } catch {
        void 0;
      }
      return { received: true, uploadId, chunkIndex };
    }

    // 移动分片到临时目录
    const chunkPath = path.join(
      entity.chunkTempDir,
      `chunk_${String(chunkIndex).padStart(6, '0')}`,
    );
    try {
      await fs.promises.rename(file.path, chunkPath);
    } catch {
      await fs.promises.copyFile(file.path, chunkPath);
      await fs.promises.unlink(file.path).catch(() => undefined);
    }

    // 更新位图
    const newBitmap =
      bitmap.substring(0, chunkIndex) + '1' + bitmap.substring(chunkIndex + 1);
    entity.chunkBitmap = newBitmap;
    await this.repo.save(entity);

    return { received: true, uploadId, chunkIndex };
  }

  /**
   * 获取已上传分片状态（用于断点续传查询）
   * @keyword-en chunk-status, resume-status
   */
  async getChunkStatus(
    uploadId: string,
  ): Promise<{ missingChunks: number[]; uploadedChunks: number[] }> {
    const entity = await this.repo.findOne({
      where: { id: uploadId, isDelete: false },
    });
    if (!entity) throw new NotFoundException('upload session not found');

    const bitmap = entity.chunkBitmap || '';
    const uploaded: number[] = [];
    const missing: number[] = [];
    for (let i = 0; i < entity.chunkTotal; i++) {
      if (bitmap[i] === '1') uploaded.push(i);
      else missing.push(i);
    }
    return { uploadedChunks: uploaded, missingChunks: missing };
  }

  /**
   * 完成分片上传，合并所有分片
   * @keyword-en commit-chunked-upload, merge-chunks
   */
  async commitChunkedUpload(
    uploadId: string,
  ): Promise<ChunkedUploadCommitResponse> {
    const entity = await this.repo.findOne({
      where: { id: uploadId, isDelete: false },
    });
    if (!entity) throw new NotFoundException('upload session not found');

    // 检查所有分片是否已收
    const bitmap = entity.chunkBitmap || '';
    const allReceived = bitmap.split('').every((c) => c === '1');
    if (!allReceived) {
      throw new BadRequestException('not all chunks received');
    }

    const root = this.storageRoot();
    const fileSize = parseInt(entity.fileSize, 10);

    // 计算 SHA256
    // 先把分片合并到临时文件计算
    if (!entity.chunkTempDir) throw new BadRequestException('no temp dir');
    const tempFilePath = path.join(entity.chunkTempDir, '_merged_tmp');
    const writeStream = fs.createWriteStream(tempFilePath);

    for (let i = 0; i < entity.chunkTotal; i++) {
      const chunkPath = path.join(
        entity.chunkTempDir,
        `chunk_${String(i).padStart(6, '0')}`,
      );
      const data = await fs.promises.readFile(chunkPath);
      writeStream.write(data);
    }
    writeStream.end();

    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    const { sha256, sampled } = await this.computeSha256(
      tempFilePath,
      fileSize,
    );

    // 检查 SHA256 是否与已存在文件重复
    const existed = await this.repo.findOne({
      where: {
        sha256,
        fileSize: entity.fileSize,
        isDelete: false,
        active: true,
      },
      order: { createdAt: 'DESC' },
    });

    const md5 = entity.md5;
    const relDir = `${md5.slice(0, 2)}/${md5.slice(2, 4)}`;
    const targetDir = path.join(root, md5.slice(0, 2), md5.slice(2, 4));
    await fs.promises.mkdir(targetDir, { recursive: true });
    const fileExt = entity.fileExt || '';
    const targetPath = path.join(targetDir, `${md5}${fileExt}`);

    if (existed) {
      // SHA256 重复，复用已有文件
      entity.storagePath = existed.storagePath;
      entity.copiedFromId = existed.id;
      entity.sha256 = sha256;
      entity.sha256Sampled = sampled;
      entity.active = true;
      entity.chunkTotal = 0;
      entity.chunkBitmap = '';
      entity.chunkTempDir = null;
      entity.chunkExpiresAt = null;
      await this.repo.save(entity);

      // 清理临时分片
      await this.cleanupTempDir(entity.chunkTempDir).catch(() => undefined);
      try {
        await fs.promises.unlink(tempFilePath);
      } catch {
        void 0;
      }

      return {
        id: entity.id,
        path: `/resources/${entity.id}`,
        sha256,
        duplicated: true,
      };
    }

    // 没有重复，合并文件
    await fs.promises.rename(tempFilePath, targetPath);

    entity.storagePath = `${relDir}/${md5}${fileExt}`;
    entity.sha256 = sha256;
    entity.sha256Sampled = sampled;
    entity.copiedFromId = null;
    entity.chunkTotal = 0;
    entity.chunkBitmap = '';
    entity.chunkTempDir = null;
    entity.chunkExpiresAt = null;
    await this.repo.save(entity);

    // 清理临时分片
    await this.cleanupTempDir(entity.chunkTempDir).catch(() => undefined);

    return {
      id: entity.id,
      path: `/resources/${entity.id}`,
      sha256,
      duplicated: false,
    };
  }

  /**
   * 取消分片上传，清理临时文件
   * @keyword-en abort-chunked-upload, cancel-chunk
   */
  async abortChunkedUpload(uploadId: string): Promise<void> {
    const entity = await this.repo.findOne({
      where: { id: uploadId, isDelete: false },
    });
    if (!entity) return;
    await this.cleanupTempDir(entity.chunkTempDir);
    entity.isDelete = true;
    entity.deletedAt = new Date();
    await this.repo.save(entity);
  }

  private async cleanupTempDir(tempDir: string | null): Promise<void> {
    if (!tempDir) return;
    try {
      const exists = await fs.promises
        .access(tempDir)
        .then(() => true)
        .catch(() => false);
      if (exists) {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    } catch {
      void 0;
    }
  }

  // ==================== 资源读取 ====================

  /**
   * 获取资源文件路径，物理文件不存在时清理所有同SHA256资源并清除MD5
   * @keyword-en get-resource-file, file-not-found-cleanup
   * @param id 资源ID
   */
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
      // 物理文件已丢失，清理所有同SHA256的资源记录并清除MD5字段
      await this.cleanupOrphanedBySha256(entity.sha256, entity.id);
      throw new NotFoundException('resource file not found');
    }

    if (stored && stored !== entity.storagePath) {
      await this.repo.save({ ...entity, storagePath: stored });
      entity.storagePath = stored;
    }

    return { entity, filePath };
  }

  /**
   * 清理所有同SHA256的孤立资源记录，并清除其MD5字段
   * @keyword-en cleanup-orphaned, sha256-cleanup
   * @param sha256 SHA256哈希
   * @param excludeId 排除的资源ID
   */
  private async cleanupOrphanedBySha256(
    sha256: string | null,
    excludeId: string,
  ): Promise<void> {
    if (!sha256) return;
    try {
      const orphans = await this.repo.find({
        where: { sha256, isDelete: false, active: true },
      });
      for (const orphan of orphans) {
        if (orphan.id === excludeId) continue;
        orphan.isDelete = true;
        orphan.deletedAt = new Date();
        orphan.md5 = '';
        await this.repo.save(orphan);
      }
      // 也清理当前这条
      const current = await this.repo.findOne({ where: { id: excludeId } });
      if (current) {
        current.isDelete = true;
        current.deletedAt = new Date();
        current.md5 = '';
        await this.repo.save(current);
      }
    } catch {
      void 0;
    }
  }

  // ==================== 引用计数（跨租户SHA256去重） ====================

  /**
   * 检查给定 SHA256 的资源在所有租户中是否还有引用
   * @keyword-en sha256-ref-count, cross-tenant-dedup
   * @param sha256 文件SHA256
   * @param excludeId 排除的资源ID（如删除操作自己的ID）
   */
  async countSha256References(
    sha256: string,
    excludeId?: string,
  ): Promise<number> {
    const where: Record<string, unknown> = {
      sha256,
      isDelete: false,
      active: true,
    };
    if (excludeId) where['id'] = excludeId;
    return await this.repo.count({ where });
  }

  /**
   * 获取实际存储路径（用于判断是否需要删除物理文件）
   * @keyword-en get-storage-path, storage-path
   */
  async getStoragePath(id: string): Promise<string | null> {
    const entity = await this.repo.findOne({ where: { id, isDelete: false } });
    return entity?.storagePath ?? null;
  }

  /**
   * 通过上传ID列表批量复制资源（粘贴功能）
   * @keyword-en batch-copy-resource, paste-resources
   * @param resourceIds 资源ID列表
   * @param uploaderId 执行粘贴的用户ID
   */
  async batchDuplicate(
    resourceIds: string[],
    uploaderId: string | null,
  ): Promise<
    Array<{ id: string; originalId: string; path: string; name: string }>
  > {
    const results: Array<{
      id: string;
      originalId: string;
      path: string;
      name: string;
    }> = [];

    for (const origId of resourceIds) {
      const orig = await this.repo.findOne({
        where: { id: origId, isDelete: false, active: true },
      });
      if (!orig) continue;

      const newId = uuidv7();
      const root = this.storageRoot();
      const existedStored = this.normalizeStoredPath(orig.storagePath, root);

      const entity = this.repo.create({
        id: newId,
        uploaderId,
        originalName: orig.originalName,
        fileExt: orig.fileExt,
        mimeType: orig.mimeType,
        fileSize: orig.fileSize,
        md5: orig.md5,
        sha256: orig.sha256,
        sha256Sampled: orig.sha256Sampled,
        category: orig.category,
        storagePath: existedStored || orig.storagePath,
        copiedFromId: orig.id,
        active: true,
        isDelete: false,
      });
      await this.repo.save(entity);
      results.push({
        id: newId,
        originalId: origId,
        path: `/resources/${newId}`,
        name: orig.originalName,
      });
    }

    return results;
  }

  /**
   * 复制单个资源，返回新资源 ID
   * @keyword-en duplicate-resource, copy-resource
   */
  async duplicate(
    resourceId: string,
    uploaderId: string | null,
  ): Promise<string> {
    const results = await this.batchDuplicate([resourceId], uploaderId);
    return results[0]?.id ?? resourceId;
  }

  /**
   * 删除资源：检查同 SHA256 共享情况决定是否删除物理文件
   * - 同 SHA256 还有其他 resource → 只软删除 resource，保留物理文件
   * - 同 SHA256 只有自己 → 删物理文件 + 软删除
   * @keyword-en delete-by-id, sha256-ref-check, physical-delete
   * @param resourceId 资源ID
   */
  async deleteById(resourceId: string): Promise<void> {
    const resource = await this.repo.findOne({
      where: { id: resourceId, isDelete: false, active: true },
    });
    if (!resource) return;

    if (!resource.sha256) {
      // 无 SHA256（分片未完成），删物理文件 + 软删除
      await this.deletePhysicalFile(resource.storagePath);
      resource.isDelete = true;
      resource.deletedAt = new Date();
      resource.md5 = '';
      await this.repo.save(resource);
      return;
    }

    // 检查是否有其他 resource 共享同一 SHA256
    const otherResourceRefs = await this.repo.count({
      where: {
        sha256: resource.sha256,
        isDelete: false,
        active: true,
      },
    });

    // 只有当前 resource 引用此 SHA256 → 删物理文件
    if (otherResourceRefs <= 1) {
      await this.deletePhysicalFile(resource.storagePath);
    }

    // 软删除 resource 记录
    resource.isDelete = true;
    resource.deletedAt = new Date();
    resource.md5 = '';
    await this.repo.save(resource);
  }

  /**
   * 删除物理文件
   * @keyword-en delete-physical-file
   * @param storagePath 存储相对路径
   */
  private async deletePhysicalFile(storagePath: string): Promise<void> {
    if (!storagePath) return;
    try {
      const root = this.storageRoot();
      const filePath = path.isAbsolute(storagePath)
        ? storagePath
        : path.join(root, storagePath);
      const exists = await fs.promises
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      if (exists) {
        await fs.promises.unlink(filePath);
      }
    } catch {
      void 0;
    }
  }
}
