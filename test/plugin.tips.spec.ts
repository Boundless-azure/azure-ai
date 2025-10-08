import { readFileSync } from 'fs';
import { join } from 'path';

describe('Plugin Tip diagnostics marker', () => {
  it('core plugin module.tip should contain #problems_and_diagnostics', () => {
    const p = join(__dirname, '../src/core/plugin/module.tip');
    const content = readFileSync(p, 'utf-8');
    expect(content.includes('#problems_and_diagnostics')).toBe(true);
  });

  it('customer-analytics module.tip should contain #problems_and_diagnostics', () => {
    const p = join(__dirname, '../plugins/customer-analytics/module.tip');
    const content = readFileSync(p, 'utf-8');
    expect(content.includes('#problems_and_diagnostics')).toBe(true);
  });
});
