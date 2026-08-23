const fs = require('fs');
const glob = require('glob'); // Need a simple search, or I'll just hardcode the files

const files = [
  'src/pages/CashSession.tsx',
  'src/pages/Dashboard.tsx',
  'src/pages/POS.tsx',
  'src/pages/Products.tsx',
  'src/pages/Suppliers.tsx',
  'src/pages/Purchases.tsx',
  'src/pages/Expenses.tsx',
  'src/pages/Customers.tsx',
  'src/pages/Inventory.tsx',
  'src/pages/Reports.tsx',
  'src/store/useStore.ts'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('fetch(')) {
    content = content.replace(/fetch\(/g, 'fetchApi(');
    
    // figure out depth
    const depth = file.split('/').length - 2; // src/pages/file -> 1
    const importPath = depth === 1 ? '../lib/api' : '../../lib/api';
    
    if (!content.includes('fetchApi')) { // it should include it now
      content = `import { fetchApi } from '${importPath}';\n` + content;
    } else {
      content = `import { fetchApi } from '${importPath}';\n` + content;
    }
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  }
});
