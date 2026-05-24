import { randomUUID } from 'crypto';

export function v7(): string {
  return randomUUID();
}

export function v6(): string {
  return randomUUID();
}

export function v5(): string {
  return randomUUID();
}

export function v4(): string {
  return randomUUID();
}

export default {
  v4,
  v5,
  v6,
  v7,
};
