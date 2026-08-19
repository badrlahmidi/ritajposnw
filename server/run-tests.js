const { execSync } = require('child_process');
try {
  const output = execSync('npx jest --forceExit --detectOpenHandles --runInBand', { encoding: 'utf8' });
  console.log('TESTS PASSED');
  // Extract Test Suites line
  const match = output.match(/Test Suites: (\d+)/);
  if (match) console.log('Test Suites:', match[1]);
  const match2 = output.match(/Tests: (\d+)/);
  if (match2) console.log('Tests:', match2[1]);
} catch (err) {
  console.error('TESTS FAILED');
  console.error(err.message);
}