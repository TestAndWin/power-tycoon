import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from '../src/index.js';

describe('engine', () => {
  it('exports a version', () => {
    expect(ENGINE_VERSION).toBe(1);
  });
});
