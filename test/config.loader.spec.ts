import { loadDatabaseConfigFromEnv } from '../src/config/database.config';
import { loadAIConfigFromEnv } from '../src/config/ai.config';
import { loadLoggingConfigFromEnv } from '../src/config/logging.config';
import { loadHookBusConfigFromEnv } from '../src/config/hookbus.config';

describe('Config loaders', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    // restore env
    process.env = { ...envBackup };
  });

  it('loads database config from env', () => {
    process.env.DB_TYPE = 'mysql';
    process.env.DB_HOST = '127.0.0.1';
    process.env.DB_PORT = '3307';
    process.env.DB_USERNAME = 'tester';
    process.env.DB_PASSWORD = 'secret';
    process.env.DB_DATABASE = 'test_db';
    process.env.DB_SYNC = 'true';

    const db = loadDatabaseConfigFromEnv();
    expect(db.type).toBe('mysql');
    expect(db.host).toBe('127.0.0.1');
    expect(db.port).toBe(3307);
    expect(db.username).toBe('tester');
    expect(db.password).toBe('secret');
    expect(db.database).toBe('test_db');
    expect(db.synchronize).toBe(true);
  });

  it('loads AI config from env', () => {
    process.env.AI_PROXY_ENABLED = 'true';
    process.env.AI_PROXY_URL = 'http://localhost:7890';
    process.env.AI_PROXY_NO_PROXY = 'localhost,127.0.0.1';
    process.env.AI_TIMEOUT_MS = '60000';
    process.env.AI_MAX_RETRIES = '5';

    const ai = loadAIConfigFromEnv();
    expect(ai.proxy.enabled).toBe(true);
    expect(ai.proxy.url).toBe('http://localhost:7890');
    expect(ai.proxy.noProxy).toBe('localhost,127.0.0.1');
    expect(ai.client.timeoutMs).toBe(60000);
    expect(ai.client.maxRetries).toBe(5);
  });

  it('loads logging config from env', () => {
    process.env.LOG_LEVEL = 'debug';
    process.env.LOG_PRETTY = 'false';
    process.env.LOG_TO_FILE = 'true';
    process.env.LOG_DIR = 'tmp-logs';

    const log = loadLoggingConfigFromEnv();
    expect(log.level).toBe('debug');
    expect(log.prettyPrint).toBe(false);
    expect(log.writeToFile).toBe(true);
    expect(log.dir).toBe('tmp-logs');
  });

  it('loads hookbus config from env', () => {
    process.env.HOOKBUS_ENABLED = 'true';
    process.env.HOOKBUS_DEBUG = 'true';
    process.env.HOOKBUS_BUFFER_SIZE = '2048';

    const hb = loadHookBusConfigFromEnv();
    expect(hb.enabled).toBe(true);
    expect(hb.debug).toBe(true);
    expect(hb.bufferSize).toBe(2048);
  });
});
