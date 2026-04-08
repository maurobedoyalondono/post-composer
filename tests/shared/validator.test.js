// tests/shared/validator.test.js
import { describe, it, assert, assertEqual } from '../test-helper.js';
import { validate } from '../../shared/validator.js';

// Minimal valid project fixture used across all tests
function minimal() {
  return {
    project: { id: 'test-project', title: 'Test', version: '1.0', created: '2026-04-08' },
    export: { target: 'instagram-portrait', width_px: 1080, height_px: 1350, dpi: 72, scale_factor: 2, format: 'png' },
    design_tokens: {
      palette: { background: '#000000', primary: '#ffffff', accent: '#ff0000', neutral: '#888888' },
      type_scale: {
        display: { family: 'Cormorant Garamond', weight: 700, steps: { xl: 12, lg: 10, md: 8, sm: 6 } },
        body:    { family: 'Inter', weight: 400, steps: { md: 3.5, sm: 3.0, xs: 2.5 } },
        data:    { family: 'Inter', weight: 700, steps: { xl: 16, lg: 12, md: 8, sm: 5 } },
      },
      spacing_scale: [4, 6, 8, 12, 16, 24],
    },
    variety_contract: {
      zone_max_usage_pct: 40,
      shape_quota: { min_per_n_frames: 3, waiver: null },
      overlay_strategies: ['gradient', 'solid-bar'],
      overlay_strategies_min: 2,
      accent_color_frames: [],
      accent_color_min: 0,
      copy_tone_variety: false,
      silence_map: [],
      composition_patterns: {},
    },
    globals: { background_color: '#000000', safe_zone_pct: 5 },
    frames: [],
    image_index: [],
  };
}

describe('validator — top-level structure', () => {
  it('accepts a minimal valid project', () => {
    const result = validate(minimal());
    assert(result.valid, result.errors?.join(', '));
  });

  it('rejects missing project block', () => {
    const p = minimal(); delete p.project;
    assert(!validate(p).valid);
  });

  it('rejects missing export block', () => {
    const p = minimal(); delete p.export;
    assert(!validate(p).valid);
  });

  it('rejects missing design_tokens', () => {
    const p = minimal(); delete p.design_tokens;
    assert(!validate(p).valid);
  });

  it('rejects missing variety_contract', () => {
    const p = minimal(); delete p.variety_contract;
    assert(!validate(p).valid);
  });

  it('rejects missing frames array', () => {
    const p = minimal(); delete p.frames;
    assert(!validate(p).valid);
  });

  it('rejects project.id with spaces', () => {
    const p = minimal(); p.project.id = 'has spaces';
    assert(!validate(p).valid);
  });

  it('rejects unknown export.target', () => {
    const p = minimal(); p.export.target = 'not-a-target';
    assert(!validate(p).valid);
  });
});
