/**
 * Configuration Validation Script
 * 
 * Validates all configuration files and templates before deployment
 */

const fs = require('fs');
const path = require('path');

// This would use the actual ConfigValidator in production
// For now, it's a placeholder that checks file existence

const templatesDir = path.join(__dirname, '../templates');
const errors = [];
const warnings = [];

console.log('Validating configuration files...\n');

// Check templates
const templateFiles = fs.readdirSync(templatesDir).filter(f => f.endsWith('.json'));

for (const file of templateFiles) {
  const filePath = path.join(templatesDir, file);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const template = JSON.parse(content);
    
    // Basic validation
    if (!template.templateId) {
      errors.push(`${file}: Missing templateId`);
    }
    if (!template.masterAgent) {
      errors.push(`${file}: Missing masterAgent`);
    }
    if (!template.subAgents || template.subAgents.length === 0) {
      errors.push(`${file}: Missing subAgents`);
    }
    
    console.log(`✓ ${file} - Valid`);
  } catch (error) {
    errors.push(`${file}: ${error.message}`);
  }
}

// Report results
console.log('\n--- Validation Results ---');
if (errors.length > 0) {
  console.error('\nErrors:');
  errors.forEach(err => console.error(`  ✗ ${err}`));
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn('\nWarnings:');
  warnings.forEach(warn => console.warn(`  ⚠ ${warn}`));
}

console.log('\n✓ All configurations valid!');
process.exit(0);

