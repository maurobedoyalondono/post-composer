// tests/core/storage-briefs.test.js
import { describe, it, assert, assertEqual } from '../test-helper.js';
import { storage } from '../../core/storage.js';

const T = '__brief_test__';

function makeBrief(id = T, title = 'Test Brief') {
  return {
    id,
    title,
    platform: 'instagram-portrait',
    story: 'A test story.',
    tone: 'cinematic',
    imageMeta: [],
    createdAt: Date.now(),
  };
}

describe('storage.saveBrief / getBrief', () => {
  it('round-trips all fields', () => {
    const b = makeBrief();
    storage.saveBrief(b);
    const got = storage.getBrief(T);
    assertEqual(got.title, 'Test Brief');
    assertEqual(got.platform, 'instagram-portrait');
    assertEqual(got.tone, 'cinematic');
    assert(got.updatedAt > 0, 'updatedAt should be set');
    storage.deleteBrief(T);
  });

  it('getBrief returns null for unknown id', () => {
    assert(storage.getBrief('__nonexistent_brief__') === null);
  });

  it('saveBrief sets updatedAt in stored object', () => {
    const before = Date.now();
    storage.saveBrief(makeBrief());
    const got = storage.getBrief(T);
    assert(got.updatedAt >= before, 'updatedAt should be >= time before save');
    storage.deleteBrief(T);
  });

  it('saveBrief does not mutate the input object', () => {
    const b = makeBrief();
    storage.saveBrief(b);
    assert(!('updatedAt' in b), 'saveBrief must not add updatedAt to the caller\'s object');
    storage.deleteBrief(T);
  });
});

describe('storage.listBriefs', () => {
  it('includes saved brief', () => {
    storage.saveBrief(makeBrief('__bl1__', 'List Test 1'));
    const list = storage.listBriefs();
    assert(list.some(b => b.id === '__bl1__'), 'list should contain saved brief');
    storage.deleteBrief('__bl1__');
  });

  it('does not include deleted brief', () => {
    storage.saveBrief(makeBrief('__bl2__', 'Delete Test'));
    storage.deleteBrief('__bl2__');
    const list = storage.listBriefs();
    assert(!list.some(b => b.id === '__bl2__'), 'list should not contain deleted brief');
  });

  it('updates existing entry on re-save (no duplicates in index)', () => {
    storage.saveBrief(makeBrief('__bl3__', 'Original'));
    storage.saveBrief({ ...makeBrief('__bl3__', 'Updated'), createdAt: Date.now() });
    const list = storage.listBriefs();
    const matches = list.filter(b => b.id === '__bl3__');
    assertEqual(matches.length, 1, 'should have exactly one entry after re-save');
    assertEqual(matches[0].title, 'Updated');
    storage.deleteBrief('__bl3__');
  });
});

describe('storage.deleteBrief', () => {
  it('removes brief from storage and index', () => {
    storage.saveBrief(makeBrief('__bd1__', 'To Delete'));
    storage.deleteBrief('__bd1__');
    assert(storage.getBrief('__bd1__') === null, 'getBrief should return null after delete');
    assert(!storage.listBriefs().some(b => b.id === '__bd1__'), 'listBriefs should not list deleted');
  });

  it('deleteBrief on nonexistent id is a no-op', () => {
    storage.deleteBrief('__nonexistent_delete__');
    assert(true, 'no throw on delete of nonexistent id');
  });
});
