const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, 'package.json');
const versionFilePath = path.join(__dirname, 'src/app/service/version.ts');

const packageJson = require(packageJsonPath);
const version = packageJson.version;

const versionFileContent = `export const VERSION = '${version}';\n`;

fs.writeFileSync(versionFilePath, versionFileContent);

console.log(`Version ${version} updated in ${versionFilePath}`);
