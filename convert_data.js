const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const inputPath = 'c:\\Users\\mvall\\Documents\\learning-sequences-review\\data\\ArticlesByCategory.xlsx';
const outputDir = 'public/data';
const outputPath = path.join(outputDir, 'articles.json');

if (!fs.existsSync(outputDir)){
    fs.mkdirSync(outputDir, { recursive: true });
}

console.log(`Reading from ${inputPath}...`);
const workbook = XLSX.readFile(inputPath);
const sheetName = workbook.SheetNames[0]; 
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
console.log(`Converted ${data.length} records to ${outputPath}`);
