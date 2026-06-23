import { describe, it, expect } from 'vitest';
import ChatAssistant from './ChatAssistant';

describe('ChatAssistant component exports', () => {
  it('should be a function', () => {
    expect(typeof ChatAssistant).toBe('function');
  });
});
