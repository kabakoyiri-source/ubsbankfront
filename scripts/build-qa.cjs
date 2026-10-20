const path = require('node:path');
const { spawnSync } = require('node:child_process');
const vite = path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js');
const result = spawnSync(process.execPath,[vite,'build'],{stdio:'inherit',env:{...process.env,
  VITE_SUPABASE_URL:'http://127.0.0.1:54321',VITE_SUPABASE_PUBLISHABLE_KEY:'test-public-key'}});
process.exitCode=result.status??1;
