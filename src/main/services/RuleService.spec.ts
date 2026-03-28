import { describe, it, expect } from 'vitest';
import { RuleService } from './RuleService';

describe('RuleService.apply basic rules', () => {
  it('replaces exact text', async () => {
    const content = 'hello world';
    const result = (RuleService as any).applyRule(content, {
      id: '1',
      type: 'exact',
      find: 'world',
      replace: 'user'
    });
    expect(result.updated).toBe('hello user');
    expect(result.count).toBe(1);
  });

  it('replaces regex pattern', async () => {
    const content = '123 456';
    const result = (RuleService as any).applyRule(content, {
      id: '1',
      type: 'regex',
      find: '\\d+',
      replace: 'x'
    });
    expect(result.updated).toBe('x x');
    expect(result.count).toBe(2);
  });
});
