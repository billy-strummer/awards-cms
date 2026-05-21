// Events system lazy chunk — loaded on first Events tab click.
// seating-enhancements MUST be imported before events.js so that
// window.seatingEnhancements is already set when events.js bottom-runs
// `if (window.seatingEnhancements) window.seatingEnhancements.init()`.
import '../seating-enhancements.js';
import '../events.js';
import '../ticket-management.js';
import '../calendar.js';
import '../winner-pipeline.js';
import '../winner-announcements.js';
