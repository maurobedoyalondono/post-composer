// tests/shared/validator.test.js
import { describe, it, assert, assertEqual } from '../test-helper.js';
import { validate, summarise } from '../../shared/validator.js';

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

function frameWith(overrides) {
  return Object.assign({
    id: 'frame-01',
    image_src: 'wide-shot',
    image_filename: 'IMG_001.jpg',
    composition_pattern: 'editorial-anchor',
    layers: [],
  }, overrides);
}

function textLayer(overrides) {
  return Object.assign({
    id: 'text-1', type: 'text',
    content: 'Hello world',
    font: { family: 'Inter', size_pct: 9, weight: 700, color: '#fff', opacity: 1 },
    position: { zone: 'bottom-left', offset_x_pct: 6, offset_y_pct: -8 },
    max_width_pct: 80,
  }, overrides);
}

function shapeLayer(overrides) {
  return Object.assign({
    id: 'shape-1', type: 'shape',
    shape: 'line', role: 'divider',
    position: { zone: 'bottom-left', offset_x_pct: 6, offset_y_pct: -10 },
    dimensions: { width_pct: 20, height_px: 2 },
    fill_color: '#fff', fill_opacity: 0.6,
  }, overrides);
}

function overlayLayer(gradient, overrides) {
  return Object.assign({
    id: 'overlay-1', type: 'overlay',
    color: '#000', opacity: 1,
    gradient: gradient
      ? { enabled: true, direction: 'to-bottom', from_opacity: 0, to_opacity: 0.7, from_position_pct: 40, to_position_pct: 100 }
      : { enabled: false },
  }, overrides);
}

describe('validator — frames', () => {
  it('accepts a valid frame with a text layer', () => {
    const p = minimal();
    p.frames = [frameWith({ layers: [textLayer()] })];
    const r = validate(p);
    assert(r.valid, r.errors?.join(', '));
  });

  it('rejects frame missing composition_pattern', () => {
    const p = minimal();
    p.frames = [frameWith({ composition_pattern: undefined })];
    assert(!validate(p).valid);
  });

  it('rejects invalid composition_pattern', () => {
    const p = minimal();
    p.frames = [frameWith({ composition_pattern: 'not-a-pattern' })];
    assert(!validate(p).valid);
  });

  it('rejects frame missing image_filename', () => {
    const p = minimal();
    p.frames = [frameWith({ image_filename: undefined })];
    assert(!validate(p).valid);
  });

  it('rejects text layer missing max_width_pct', () => {
    const p = minimal();
    p.frames = [frameWith({ layers: [textLayer({ max_width_pct: undefined })] })];
    assert(!validate(p).valid);
  });

  it('rejects shape layer without role', () => {
    const p = minimal();
    p.frames = [frameWith({ layers: [shapeLayer({ role: undefined })] })];
    assert(!validate(p).valid);
  });

  it('rejects shape layer with invalid role', () => {
    const p = minimal();
    p.frames = [frameWith({ layers: [shapeLayer({ role: 'decoration' })] })];
    assert(!validate(p).valid);
  });

  it('rejects duplicate layer ids within a frame', () => {
    const p = minimal();
    p.frames = [frameWith({ layers: [textLayer({ id: 'dup' }), shapeLayer({ id: 'dup' })] })];
    assert(!validate(p).valid);
  });

  it('rejects invalid position zone', () => {
    const p = minimal();
    p.frames = [frameWith({ layers: [textLayer({ position: { zone: 'invalid-zone' } })] })];
    assert(!validate(p).valid);
  });
});

describe('validator — variety contract enforcement', () => {
  it('flags zone overuse when one zone exceeds 40%', () => {
    // 4 text frames all using bottom-left = 100% → must fail
    const p = minimal();
    p.variety_contract.zone_max_usage_pct = 40;
    p.frames = [1,2,3,4].map((n, i) => frameWith({
      id: `frame-0${n}`,
      image_filename: `img-0${n}.jpg`,
      composition_pattern: ['editorial-anchor','minimal-strip','data-callout','layered-depth'][i],
      layers: [overlayLayer(true, { id: `ov-${n}` }), textLayer({ id: `t-${n}` })],
    }));
    const r = validate(p);
    assert(!r.valid, 'expected zone overuse to be flagged');
    assert(r.errors.some(e => e.includes('zone')));
  });

  it('accepts zone distribution within 40% limit', () => {
    const zones = ['bottom-left','bottom-right','top-left','top-right'];
    const patterns = ['editorial-anchor','minimal-strip','data-callout','layered-depth'];
    const p = minimal();
    p.variety_contract.zone_max_usage_pct = 40;
    p.variety_contract.overlay_strategies = ['gradient', 'solid-bar'];
    p.variety_contract.overlay_strategies_min = 2;
    p.frames = [1,2,3,4].map((n, i) => frameWith({
      id: `frame-0${n}`,
      image_filename: `img-0${n}.jpg`,
      composition_pattern: patterns[i],
      layers: [
        overlayLayer(i < 2, { id: `ov-${n}` }),
        textLayer({ id: `t-${n}`, position: { zone: zones[i], offset_x_pct: 6, offset_y_pct: -8 } }),
      ],
    }));
    const r = validate(p);
    assert(r.valid, r.errors?.join(', '));
  });

  it('flags shape quota violation when no shapes present', () => {
    const p = minimal();
    p.variety_contract.shape_quota = { min_per_n_frames: 3, waiver: null };
    p.frames = [1,2,3].map((n, i) => frameWith({
      id: `frame-0${n}`,
      image_filename: `img-0${n}.jpg`,
      composition_pattern: ['editorial-anchor','minimal-strip','data-callout'][i],
      layers: [textLayer({ id: `t-${n}` })],
    }));
    assert(!validate(p).valid);
  });

  it('accepts shape quota when waiver is set', () => {
    const p = minimal();
    p.variety_contract.shape_quota = { min_per_n_frames: 3, waiver: 'no scene geometry in this series' };
    p.variety_contract.overlay_strategies_min = 0;
    p.frames = [frameWith({ layers: [textLayer()] })];
    const r = validate(p);
    assert(r.valid, r.errors?.join(', '));
  });
});

describe('validator — summarise', () => {
  it('returns correct frame and layer counts', () => {
    const p = minimal();
    p.frames = [
      frameWith({ id: 'f1', image_filename: 'a.jpg', layers: [textLayer()] }),
      frameWith({ id: 'f2', image_filename: 'b.jpg', composition_pattern: 'minimal-strip', layers: [] }),
    ];
    const s = summarise(p);
    assertEqual(s.frameCount, 2);
    assertEqual(s.layerCount, 1);
  });

  it('returns pattern distribution', () => {
    const p = minimal();
    p.frames = [
      frameWith({ id: 'f1', image_filename: 'a.jpg', composition_pattern: 'editorial-anchor', layers: [] }),
      frameWith({ id: 'f2', image_filename: 'b.jpg', composition_pattern: 'editorial-anchor', layers: [] }),
      frameWith({ id: 'f3', image_filename: 'c.jpg', composition_pattern: 'full-bleed', layers: [] }),
    ];
    const s = summarise(p);
    assertEqual(s.patternDistribution['editorial-anchor'], 2);
    assertEqual(s.patternDistribution['full-bleed'], 1);
  });
});

describe('validator — frame multi_image and bg_color', () => {
  function frameProject(frameOverrides) {
    const p = minimal();
    p.frames = [{
      id: 'f01',
      image_src: 'test-img',
      image_filename: 'test.jpg',
      composition_pattern: 'editorial-anchor',
      layers: [],
      ...frameOverrides,
    }];
    // shape_quota waiver so shape quota doesn't fail with 1 frame
    p.variety_contract.shape_quota = { min_per_n_frames: 3, waiver: 'single frame test' };
    return p;
  }

  it('accepts multi_image: true without image_src/image_filename', () => {
    const p = minimal();
    p.frames = [{
      id: 'f01',
      multi_image: true,
      composition_pattern: 'editorial-anchor',
      layers: [],
    }];
    p.variety_contract.shape_quota = { min_per_n_frames: 3, waiver: 'test' };
    const result = validate(p);
    assert(result.valid, result.errors?.join(', '));
  });

  it('still requires image_src when multi_image is false', () => {
    const p = frameProject({ image_src: undefined });
    assert(!validate(p).valid);
  });

  it('still requires image_filename when multi_image is false', () => {
    const p = frameProject({ image_filename: undefined });
    assert(!validate(p).valid);
  });

  it('accepts a valid bg_color hex', () => {
    const result = validate(frameProject({ bg_color: '#1a2b3c' }));
    assert(result.valid, result.errors?.join(', '));
  });

  it('rejects bg_color that is not 6-digit hex', () => {
    assert(!validate(frameProject({ bg_color: 'red' })).valid);
    assert(!validate(frameProject({ bg_color: '#fff' })).valid);
    assert(!validate(frameProject({ bg_color: '#gggggg' })).valid);
  });

  it('accepts frame with no bg_color (absent)', () => {
    const result = validate(frameProject({}));
    assert(result.valid, result.errors?.join(', '));
  });
});
