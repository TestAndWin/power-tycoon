import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from '@power-tycoon/engine';

describe('api', () => {
  it('resolves the engine from source', () => {
    expect(ENGINE_VERSION).toBe(1);
  });
});
