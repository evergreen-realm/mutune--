import { describe, it, expect, vi } from 'vitest';

vi.mock('../components/PropertyMap', () => ({
  default: () => null
}));

import PropertiesPage from './PropertiesPage';

describe('PropertiesPage Component', () => {
  it('should export a valid React component function', () => {
    expect(typeof PropertiesPage).toBe('function');
  });
});
