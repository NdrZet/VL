// ─── Shared Utilities ────────────────────────────────────────────────────────

const VIDEO_EXTENSIONS = [
    '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv',
    '.webm', '.m4v', '.3gp', '.ogv', '.ts', '.mts'
];

const VIDEO_EXT_REGEX = /\.(mp4|avi|mkv|mov|wmv|flv|webm|m4v|3gp|ogv|ts|mts)$/i;

/**
 * Formats seconds into human-readable time string (e.g. "1:23:45" or "3:07").
 * @param {number} seconds
 * @returns {string}
 */
function formatTime(seconds) {
    if (isNaN(seconds)) seconds = 0;
    if (seconds === 0) return '0:00';

    const hours   = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs    = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Escapes HTML special characters to prevent XSS in innerHTML.
 * @param {string} str
 * @returns {string}
 */
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
