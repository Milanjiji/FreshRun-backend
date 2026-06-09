const fs = require('fs');
const path = require('path');

const KEYWORDS = [
  'recurring',
  'subscription',
  'token',
  'tokenization',
  'customer_id',
  'save_card',
  'recurring_payment',
  'card_save',
  'method'
];

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'android',
  'ios',
  '.next',
  '.bundle',
  'vendor',
  'Pods',
  'build'
]);

const IGNORED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz', '.lock', '.webp'
]);

function searchDir(dir, results) {
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (err) {
    return;
  }

  for (const file of files) {
    const fullPath = path.join(dir, file);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (err) {
      continue;
    }

    if (stat.isDirectory()) {
      if (IGNORED_DIRS.has(file)) continue;
      searchDir(fullPath, results);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (IGNORED_EXTENSIONS.has(ext)) continue;

      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          KEYWORDS.forEach(kw => {
            if (line.includes(kw)) {
              results.push({
                file: fullPath,
                line: idx + 1,
                keyword: kw,
                content: line.trim()
              });
            }
          });
        });
      } catch (err) {
        // Skip files that can't be read
      }
    }
  }
}

const results = [];
console.log('Searching in FreshRun...');
searchDir('/Users/milan/Dev/freshrun/FreshRun', results);
console.log('Searching in FreshRun-backend...');
searchDir('/Users/milan/Dev/freshrun/FreshRun-backend', results);

console.log(`\nFound ${results.length} matches:`);
results.forEach(res => {
  // Let's shorten the path to relative path for cleaner output
  const relativePath = res.file.replace('/Users/milan/Dev/freshrun/', '');
  console.log(`[${res.keyword}] ${relativePath}:${res.line} -> ${res.content}`);
});
