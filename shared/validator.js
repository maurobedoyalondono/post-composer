// shared/validator.js

const VALID_TARGETS = [
  'instagram-square', 'instagram-portrait', 'instagram-story',
  'facebook-feed', 'facebook-cover',
  'print-a4-portrait', 'print-a4-landscape',
  'custom',
];

const VALID_COMPOSITION_PATTERNS = [
  'editorial-anchor', 'minimal-strip', 'data-callout',
  'full-bleed', 'layered-depth', 'diagonal-tension', 'centered-monument',
];

const VALID_SHAPE_ROLES = [
  'divider', 'accent', 'anchor', 'badge', 'frame', 'silhouette', 'callout',
];

const VALID_ZONES = [
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right',
  'absolute',
];

const VALID_OVERLAY_STRATEGIES = ['gradient', 'solid-bar', 'duotone', 'flat', 'none'];
const VALID_LAYER_TYPES = ['image', 'text', 'shape', 'overlay', 'stats_block', 'logo'];

/**
 * Validate a parsed post-composer project JSON.
 * @param {object} project
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validate(project) {
  const errors = [];

  function err(msg) { errors.push(msg); }

  // Top-level required blocks
  if (!project.project)         err('Missing required block: project');
  if (!project.export)          err('Missing required block: export');
  if (!project.design_tokens)   err('Missing required block: design_tokens');
  if (!project.variety_contract)err('Missing required block: variety_contract');
  if (!Array.isArray(project.frames)) err('Missing required array: frames');

  if (errors.length) return { valid: false, errors };

  // project block
  if (!project.project.id)                          err('project.id is required');
  if (project.project.id && /\s/.test(project.project.id)) err('project.id must not contain spaces');
  if (!project.project.title)                        err('project.title is required');

  // export block
  if (!VALID_TARGETS.includes(project.export.target))
    err(`export.target "${project.export.target}" is not a valid target`);
  if (typeof project.export.width_px  !== 'number') err('export.width_px must be a number');
  if (typeof project.export.height_px !== 'number') err('export.height_px must be a number');

  // design_tokens
  _validateDesignTokens(project.design_tokens, err);

  // variety_contract
  _validateVarietyContract(project.variety_contract, err);

  // frames
  const usedLayerIds = {};
  for (let i = 0; i < project.frames.length; i++) {
    _validateFrame(project.frames[i], i, usedLayerIds, err);
  }

  // variety contract enforcement (only when frames are present)
  if (project.frames.length > 0) {
    _enforceVarietyContract(project, err);
  }

  return { valid: errors.length === 0, errors };
}

function _validateDesignTokens(dt, err) {
  if (!dt.palette)             return err('design_tokens.palette is required');
  const requiredColors = ['background', 'primary', 'accent', 'neutral'];
  for (const key of requiredColors) {
    if (!dt.palette[key]) err(`design_tokens.palette.${key} is required`);
    else if (!/^#[0-9a-fA-F]{6}$/.test(dt.palette[key]))
      err(`design_tokens.palette.${key} must be a 6-digit hex color`);
  }
  if (!dt.type_scale)          return err('design_tokens.type_scale is required');
  for (const role of ['display', 'body', 'data']) {
    if (!dt.type_scale[role])  err(`design_tokens.type_scale.${role} is required`);
    else {
      if (!dt.type_scale[role].family) err(`design_tokens.type_scale.${role}.family is required`);
      if (!dt.type_scale[role].steps)  err(`design_tokens.type_scale.${role}.steps is required`);
    }
  }
  if (!Array.isArray(dt.spacing_scale)) err('design_tokens.spacing_scale must be an array');
}

function _validateVarietyContract(vc, err) {
  if (typeof vc.zone_max_usage_pct !== 'number') err('variety_contract.zone_max_usage_pct must be a number');
  if (!vc.shape_quota)                            err('variety_contract.shape_quota is required');
  if (!Array.isArray(vc.overlay_strategies))      err('variety_contract.overlay_strategies must be an array');
  for (const s of (vc.overlay_strategies ?? [])) {
    if (!VALID_OVERLAY_STRATEGIES.includes(s))
      err(`variety_contract.overlay_strategies: "${s}" is not a valid strategy`);
  }
  if (!Array.isArray(vc.silence_map))             err('variety_contract.silence_map must be an array');
  if (typeof vc.composition_patterns !== 'object' || Array.isArray(vc.composition_patterns))
    err('variety_contract.composition_patterns must be an object');
}

function _validateFrame(frame, index, usedLayerIds, err) {
  const label = `frames[${index}]`;
  if (!frame.id) err(`${label}.id is required`);

  // image_src and image_filename are required only in single-image mode
  if (!frame.multi_image) {
    if (!frame.image_src)      err(`${label}.image_src is required`);
    if (!frame.image_filename) err(`${label}.image_filename is required`);
  }

  // bg_color, if present, must be a valid 6-digit hex color
  if (frame.bg_color != null && !/^#[0-9a-fA-F]{6}$/.test(frame.bg_color)) {
    err(`${label}.bg_color must be a 6-digit hex color`);
  }

  if (!VALID_COMPOSITION_PATTERNS.includes(frame.composition_pattern))
    err(`${label}.composition_pattern "${frame.composition_pattern}" is not a valid pattern`);
  if (!Array.isArray(frame.layers)) err(`${label}.layers must be an array`);

  const frameLayerIds = new Set();
  for (let j = 0; j < (frame.layers ?? []).length; j++) {
    _validateLayer(frame.layers[j], `${label}.layers[${j}]`, frameLayerIds, err);
  }
}

function _validateLayer(layer, label, frameLayerIds, err) {
  if (!layer.id)   return err(`${label}.id is required`);
  if (!layer.type) return err(`${label}.type is required`);
  if (frameLayerIds.has(layer.id)) err(`${label}: duplicate layer id "${layer.id}" within frame`);
  frameLayerIds.add(layer.id);

  if (!VALID_LAYER_TYPES.includes(layer.type)) err(`${label}.type "${layer.type}" is not valid`);

  if (layer.type === 'text') {
    if (!layer.content)         err(`${label}: text layer requires content`);
    if (!layer.font)            err(`${label}: text layer requires font`);
    if (layer.font && !layer.font.size_pct) err(`${label}: text layer font.size_pct is required`);
    if (layer.font && layer.max_width_pct == null) err(`${label}: text layer requires max_width_pct`);
  }

  if (layer.type === 'shape') {
    if (!layer.shape)           err(`${label}: shape layer requires shape type`);
    if (!VALID_SHAPE_ROLES.includes(layer.role))
      err(`${label}: shape layer requires a valid role (got "${layer.role}")`);
  }

  if (layer.position) {
    if (!layer.position.zone)   err(`${label}.position.zone is required`);
    else if (!VALID_ZONES.includes(layer.position.zone))
      err(`${label}.position.zone "${layer.position.zone}" is not valid`);
  }
}

function _enforceVarietyContract(project, err) {
  const vc     = project.variety_contract;
  const frames = project.frames;
  const textFrames = frames.filter(f =>
    f.layers?.some(l => l.type === 'text' || l.type === 'stats_block')
  );

  // Zone distribution
  const zoneCounts = {};
  for (const frame of textFrames) {
    for (const layer of (frame.layers ?? [])) {
      if ((layer.type === 'text' || layer.type === 'stats_block') && layer.position?.zone) {
        const z = layer.position.zone;
        zoneCounts[z] = (zoneCounts[z] ?? 0) + 1;
      }
    }
  }
  if (textFrames.length > 0) {
    const maxAllowed = Math.ceil(textFrames.length * (vc.zone_max_usage_pct / 100));
    for (const [zone, count] of Object.entries(zoneCounts)) {
      if (count > maxAllowed)
        err(`variety_contract: zone "${zone}" used ${count} times but max allowed is ${maxAllowed} (${vc.zone_max_usage_pct}% of ${textFrames.length} text frames)`);
    }
  }

  // Shape quota
  const { min_per_n_frames, waiver } = vc.shape_quota ?? {};
  if (min_per_n_frames && !waiver) {
    const shapeFrames = frames.filter(f => f.layers?.some(l => l.type === 'shape'));
    const required = Math.floor(frames.length / min_per_n_frames);
    if (shapeFrames.length < required)
      err(`variety_contract: shape_quota requires at least ${required} frame(s) with shapes (1 per ${min_per_n_frames}), found ${shapeFrames.length}`);
  }

  // Overlay strategies
  const usedStrategies = new Set();
  for (const frame of frames) {
    for (const layer of (frame.layers ?? [])) {
      if (layer.type === 'overlay') {
        const strat = layer.gradient?.enabled ? 'gradient' : 'solid-bar';
        usedStrategies.add(strat);
      }
    }
  }
  if (vc.overlay_strategies_min && usedStrategies.size < vc.overlay_strategies_min)
    err(`variety_contract: requires ${vc.overlay_strategies_min} overlay strategies, found ${usedStrategies.size}`);

  // Composition pattern distribution
  const patternCounts = {};
  for (const frame of frames) {
    if (frame.composition_pattern) {
      patternCounts[frame.composition_pattern] = (patternCounts[frame.composition_pattern] ?? 0) + 1;
    }
  }
  const maxPatternAllowed = Math.ceil(frames.length * 0.40);
  for (const [pattern, count] of Object.entries(patternCounts)) {
    if (pattern !== 'full-bleed' && pattern !== 'minimal-strip' && count > maxPatternAllowed)
      err(`variety_contract: pattern "${pattern}" used ${count} times, exceeds 40% limit (${maxPatternAllowed} of ${frames.length} frames)`);
  }
}

/**
 * Returns a structured summary of a valid project for display in the UI.
 * Only call after validate() returns valid: true.
 * @param {object} project
 * @returns {{ frameCount: number, layerCount: number, patternDistribution: object, contractSummary: object }}
 */
export function summarise(project) {
  const layerCount = project.frames.reduce((sum, f) => sum + (f.layers?.length ?? 0), 0);
  const patternDistribution = {};
  for (const frame of project.frames) {
    const p = frame.composition_pattern;
    patternDistribution[p] = (patternDistribution[p] ?? 0) + 1;
  }
  return {
    frameCount: project.frames.length,
    layerCount,
    patternDistribution,
    contractSummary: {
      silenceMap:        project.variety_contract.silence_map,
      overlayStrategies: project.variety_contract.overlay_strategies,
      shapeWaiver:       project.variety_contract.shape_quota?.waiver ?? null,
    },
  };
}
