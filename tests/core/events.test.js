// tests/core/events.test.js
import { describe, it, assert, assertEqual } from '../test-helper.js';
import { events } from '../../core/events.js';

describe('events — event bus', () => {
  it('emits and receives a custom event', () => {
    let received = null;
    const handler = ({ detail }) => { received = detail; };
    events.addEventListener('test:ping', handler);
    events.dispatchEvent(new CustomEvent('test:ping', { detail: { msg: 'hello' } }));
    events.removeEventListener('test:ping', handler);
    assertEqual(received?.msg, 'hello');
  });

  it('does not receive events after removeEventListener', () => {
    let count = 0;
    const handler = () => count++;
    events.addEventListener('test:count', handler);
    events.removeEventListener('test:count', handler);
    events.dispatchEvent(new CustomEvent('test:count'));
    assertEqual(count, 0);
  });

  it('multiple listeners on same event all fire', () => {
    let a = 0, b = 0;
    const ha = () => a++;
    const hb = () => b++;
    events.addEventListener('test:multi', ha);
    events.addEventListener('test:multi', hb);
    events.dispatchEvent(new CustomEvent('test:multi'));
    events.removeEventListener('test:multi', ha);
    events.removeEventListener('test:multi', hb);
    assertEqual(a, 1);
    assertEqual(b, 1);
  });
});
