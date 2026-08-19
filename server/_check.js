const db = require('better-sqlite3')('./pos.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name).join(', '));
tables.forEach(t => {
  try {
    const c = db.prepare(`SELECT count(*) as c FROM "${t.name}"`).get();
    console.log(`  ${t.name}: ${c.c} rows`);
  } catch(e) { console.log(`  ${t.name}: ERROR`); }
});
db.close();
