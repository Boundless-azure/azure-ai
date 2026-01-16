import { randomUUID } from 'crypto';

export function v7(): string {
  return randomUUID();
}

export default {
  v7,
};
