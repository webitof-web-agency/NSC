'use strict';

/**
 * Recursively scans an object for strings that look like local file paths (e.g. uploads/products/xyz.jpg)
 * and returns a Set of those paths.
 */
function extractFilePaths(obj, paths = new Set()) {
  if (!obj) return paths;
  if (typeof obj === 'string') {
    if (obj.includes('uploads/') || obj.includes('/uploads/')) {
       let cleanPath = obj;
       if (cleanPath.startsWith('/')) cleanPath = cleanPath.substring(1);
       if (cleanPath.startsWith('uploads/')) paths.add(cleanPath);
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj) extractFilePaths(item, paths);
  } else if (typeof obj === 'object') {
    for (const key in obj) {
      // Avoid recursive mongoose internals
      if (key !== '_id' && key !== '__v' && key !== '$__') {
        extractFilePaths(obj[key], paths);
      }
    }
  }
  return paths;
}

module.exports = { extractFilePaths };
