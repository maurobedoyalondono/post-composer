// tests/core/image-store.test.js
import { describe, itAsync, assert, assertDeepEqual } from '../test-helper.js';
import { imageStore } from '../../core/image-store.js';

const BRIEF_A = '__img_test_a__';
const BRIEF_B = '__img_test_b__';

describe('imageStore.save / imageStore.load', () => {
  itAsync('round-trips a single image', async () => {
    await imageStore.save(BRIEF_A, { 'photo.jpg': 'data:image/jpeg;base64,abc' });
    const result = await imageStore.load(BRIEF_A);
    assert(result['photo.jpg'] === 'data:image/jpeg;base64,abc', 'should round-trip dataUrl');
    await imageStore.delete(BRIEF_A);
  });

  itAsync('load returns empty map for unknown briefId', async () => {
    const result = await imageStore.load('__nonexistent_brief_img__');
    assertDeepEqual(result, {}, 'should return empty map for unknown brief');
  });

  itAsync('save overwrites existing entry for same filename', async () => {
    await imageStore.save(BRIEF_A, { 'photo.jpg': 'data:image/jpeg;base64,original' });
    await imageStore.save(BRIEF_A, { 'photo.jpg': 'data:image/jpeg;base64,updated' });
    const result = await imageStore.load(BRIEF_A);
    assert(result['photo.jpg'] === 'data:image/jpeg;base64,updated', 'should have updated value');
    await imageStore.delete(BRIEF_A);
  });

  itAsync('save and load multiple images', async () => {
    await imageStore.save(BRIEF_A, {
      'a.jpg': 'data:image/jpeg;base64,aaa',
      'b.jpg': 'data:image/jpeg;base64,bbb',
    });
    const result = await imageStore.load(BRIEF_A);
    assert(result['a.jpg'] === 'data:image/jpeg;base64,aaa', 'should load a.jpg');
    assert(result['b.jpg'] === 'data:image/jpeg;base64,bbb', 'should load b.jpg');
    await imageStore.delete(BRIEF_A);
  });
});

describe('imageStore.delete', () => {
  itAsync('delete removes all images for a brief', async () => {
    await imageStore.save(BRIEF_A, { 'photo.jpg': 'data:image/jpeg;base64,abc' });
    await imageStore.delete(BRIEF_A);
    const result = await imageStore.load(BRIEF_A);
    assertDeepEqual(result, {}, 'should be empty after delete');
  });

  itAsync('delete does not remove images for other briefs', async () => {
    await imageStore.save(BRIEF_A, { 'photo.jpg': 'data:image/jpeg;base64,aaa' });
    await imageStore.save(BRIEF_B, { 'photo.jpg': 'data:image/jpeg;base64,bbb' });
    await imageStore.delete(BRIEF_A);
    const result = await imageStore.load(BRIEF_B);
    assert(result['photo.jpg'] === 'data:image/jpeg;base64,bbb', 'B images should survive delete of A');
    await imageStore.delete(BRIEF_B);
  });

  itAsync('delete on nonexistent briefId is a no-op', async () => {
    await imageStore.delete('__nonexistent_brief_img_del__');
    assert(true, 'no error on delete of nonexistent brief');
  });
});
