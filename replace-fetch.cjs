const fs = require('fs');

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
  if (content.includes('fetch(') || content.includes('fetch (')) {
    content = content.replace(/fetch\(/g, 'fetchApi(');
    content = content.replace(/fetch \(/g, 'fetchApi(');
    
    // figure out depth
    const depth = file.split('/').length - 2; 
    let importPath = '../lib/api';
    if (file === 'src/store/useStore.ts') importPath = '../lib/api';
    else if (depth > 1) importPath = '../../lib/api';
    
    if (!content.includes(`import { fetchApi }`)) {
      content = `import { fetchApi } from '${importPath}';\n` + content;
    }
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  }
});
