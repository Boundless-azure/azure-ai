import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Server as NetServer } from 'net';
import { AppModule } from '../../../src/app.module';

type SupertestRequestTarget = string | NetServer;

function isSupertestTarget(server: unknown): server is SupertestRequestTarget {
  return typeof server === 'string' || server instanceof NetServer;
}

function toSupertestTarget(server: unknown): SupertestRequestTarget {
  if (isSupertestTarget(server)) {
    return server;
  }
  throw new Error('Invalid server type passed to supertest request(...)');
}

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', async () => {
    return await request(toSupertestTarget(app.getHttpServer()))
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
