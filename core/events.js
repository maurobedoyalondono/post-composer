// core/events.js
// Singleton event bus. Modules emit and listen here — never call each other directly.
export const events = new EventTarget();
