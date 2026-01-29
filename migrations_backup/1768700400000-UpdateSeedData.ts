import { MigrationInterface, QueryRunner } from 'typeorm';
import { randomBytes, scryptSync } from 'crypto';

/**
 * @title 迁移：更新种子数据
 * @description 更新默认账号数据以适配新的 users 表结构。
 * @keywords-cn 迁移, 种子数据, 用户
 * @keywords-en migration, seed-data, user
 */
export class UpdateSeedData1768700400000 implements MigrationInterface {
  name = 'UpdateSeedData1768700400000';

  private getDbType(queryRunner: QueryRunner): string {
    const raw = (queryRunner.connection.options as { type?: unknown }).type;
    return typeof raw === 'string' ? raw : 'mysql';
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const type = this.getDbType(queryRunner);
    const isPg = type === 'postgres';

    // 检查是否已有管理员用户记录
    const existingUser = await queryRunner.query(
      isPg
        ? `SELECT id FROM users WHERE email = $1 LIMIT 1`
        : `SELECT id FROM users WHERE email = ? LIMIT 1`,
      ['admin@example.com'],
    );

    if (Array.isArray(existingUser) && existingUser.length > 0) {
      // 已存在，跳过
      return;
    }

    // 查找管理员 principal
    const adminPrincipal = await queryRunner.query(
      isPg
        ? `SELECT id FROM principals WHERE email = $1 AND is_delete = false LIMIT 1`
        : `SELECT id FROM principals WHERE email = ? AND is_delete = 0 LIMIT 1`,
      ['admin@example.com'],
    );

    if (!Array.isArray(adminPrincipal) || adminPrincipal.length === 0) {
      // 创建新的 principal 和 user
      const principalId = cryptoId();
      const userId = cryptoId();
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('admin123', salt, 32).toString('hex');

      // 创建 principal
      if (isPg) {
        await queryRunner.query(
          `INSERT INTO principals (id, display_name, principal_type, email, active) VALUES ($1, $2, $3, $4, $5)`,
          [principalId, 'Administrator', 'system', 'admin@example.com', true],
        );
      } else {
        await queryRunner.query(
          `INSERT INTO principals (id, display_name, principal_type, email, active) VALUES (?, ?, ?, ?, ?)`,
          [principalId, 'Administrator', 'system', 'admin@example.com', 1],
        );
      }

      // 创建 user
      if (isPg) {
        await queryRunner.query(
          `INSERT INTO users (id, principal_id, email, password_hash, password_salt) VALUES ($1, $2, $3, $4, $5)`,
          [userId, principalId, 'admin@example.com', hash, salt],
        );
      } else {
        await queryRunner.query(
          `INSERT INTO users (id, principal_id, email, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)`,
          [userId, principalId, 'admin@example.com', hash, salt],
        );
      }
    } else {
      // Principal 存在但 user 不存在，创建 user 记录
      const principalId = adminPrincipal[0].id as string;
      const userId = cryptoId();
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('admin123', salt, 32).toString('hex');

      if (isPg) {
        await queryRunner.query(
          `INSERT INTO users (id, principal_id, email, password_hash, password_salt) VALUES ($1, $2, $3, $4, $5)`,
          [userId, principalId, 'admin@example.com', hash, salt],
        );
      } else {
        await queryRunner.query(
          `INSERT INTO users (id, principal_id, email, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)`,
          [userId, principalId, 'admin@example.com', hash, salt],
        );
      }
    }

    // 为现有 agents 创建对应的 principals
    const agentsWithoutPrincipal = await queryRunner.query(
      isPg
        ? `SELECT id, nickname FROM agents WHERE principal_id IS NULL AND is_delete = false`
        : `SELECT id, nickname FROM agents WHERE principal_id IS NULL AND is_delete = 0`,
    );

    if (Array.isArray(agentsWithoutPrincipal)) {
      for (const agent of agentsWithoutPrincipal) {
        const agentPrincipalId = cryptoId();
        const agentId = agent.id as string;
        const nickname = agent.nickname as string;

        // 创建 principal
        if (isPg) {
          await queryRunner.query(
            `INSERT INTO principals (id, display_name, principal_type, active) VALUES ($1, $2, $3, $4)`,
            [agentPrincipalId, nickname, 'agent', true],
          );
          // 更新 agent
          await queryRunner.query(
            `UPDATE agents SET principal_id = $1 WHERE id = $2`,
            [agentPrincipalId, agentId],
          );
        } else {
          await queryRunner.query(
            `INSERT INTO principals (id, display_name, principal_type, active) VALUES (?, ?, ?, ?)`,
            [agentPrincipalId, nickname, 'agent', 1],
          );
          await queryRunner.query(
            `UPDATE agents SET principal_id = ? WHERE id = ?`,
            [agentPrincipalId, agentId],
          );
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const type = this.getDbType(queryRunner);
    const isPg = type === 'postgres';

    // 删除为 agents 创建的 principals
    if (isPg) {
      await queryRunner.query(
        `DELETE FROM principals WHERE id IN (SELECT principal_id FROM agents WHERE principal_id IS NOT NULL)`,
      );
      await queryRunner.query(`UPDATE agents SET principal_id = NULL`);
    } else {
      await queryRunner.query(
        `DELETE FROM principals WHERE id IN (SELECT principal_id FROM agents WHERE principal_id IS NOT NULL)`,
      );
      await queryRunner.query(`UPDATE agents SET principal_id = NULL`);
    }

    // 删除创建的 user 记录
    if (isPg) {
      await queryRunner.query(`DELETE FROM users WHERE email = $1`, [
        'admin@example.com',
      ]);
    } else {
      await queryRunner.query(`DELETE FROM users WHERE email = ?`, [
        'admin@example.com',
      ]);
    }
  }
}

function cryptoId(): string {
  const bytes = randomBytes(16);
  const hex = bytes.toString('hex');
  return (
    hex.substring(0, 8) +
    '-' +
    hex.substring(8, 12) +
    '-' +
    hex.substring(12, 16) +
    '-' +
    hex.substring(16, 20) +
    '-' +
    hex.substring(20)
  );
}
