const fs = require('fs');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content.replace(/\\\`/g, '`').replace(/\\\$/g, '$');
  if (content !== newContent) {
    fs.writeFileSync(file, newContent);
    console.log('Fixed', file);
  }
}

const files = [
  'server.ts',
  'src/components/Layout.tsx',
  'src/lib/api.ts',
  'src/pages/Settings.tsx',
  'src/pages/Users.tsx',
  'src/api/phase2.ts',
  'src/api/reports.ts'
];

files.forEach(fixFile);
