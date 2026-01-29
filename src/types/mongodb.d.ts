// Minimal ambient module declaration for mongodb to satisfy TypeScript when the dependency
// may not be installed yet. Avoids TS2307 during dynamic import/build steps.
declare module 'mongodb' {
  export interface Db {
    collection<T = unknown>(name: string): Collection<T>;
  }
  export interface FindCursor<T = unknown> {
    project(projection?: Record<string, number>): FindCursor<T>;
    sort(sort?: Record<string, 1 | -1>): FindCursor<T>;
    limit(n: number): FindCursor<T>;
    toArray(): Promise<T[]>;
  }
  export interface Collection<T = unknown> {
    find(filter?: Record<string, unknown>): FindCursor<T>;
    findOne(filter: Record<string, unknown>): Promise<T | null>;
    insertOne(doc: T): Promise<unknown>;
    updateOne(
      filter: Record<string, unknown>,
      update: Record<string, unknown>,
      options?: Record<string, unknown>,
    ): Promise<unknown>;
  }
  export class MongoClient {
    constructor(uri: string);
    connect(): Promise<void>;
    db(name: string): Db;
    close(): Promise<void>;
  }
}
