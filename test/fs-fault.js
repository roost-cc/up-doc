/**
 * Preloaded with `--import` by test/unit/build-static.test.js to interrupt a build at a chosen
 * step. `FS_FAULT` is a JSON array of faults, each firing once, on the first call of `fs[op]`
 * whose first argument contains `match`:
 *
 *   { op, match, action: 'fail', after? }   throw, by default before the call, else after it
 *   { op, match, action: 'append' }         change the file the call names, then carry on
 *   { op, match, action: 'remove' }         delete the file the call names, then carry on
 *   { op, match, action: 'create', file }   create `file`, then carry on
 *   { op, match, action: 'run', argv }      run `node ...argv` to its end, then carry on
 *   { op, match, action: 'retarget', link, to }  point the symlink `link` at `to`, then carry on
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const faults = JSON.parse(process.env.FS_FAULT);
delete process.env.FS_FAULT;

for (const fault of faults) {
  const real = fs[fault.op];
  let fired = false;
  fs[fault.op] = function (...args) {
    if (fired || !String(args[0]).includes(fault.match)) return real.apply(this, args);
    fired = true;
    if (fault.action === 'fail') {
      if (fault.after) real.apply(this, args);
      throw new Error(`injected ${fault.op} failure`);
    }
    if (fault.action === 'append') fs.appendFileSync(args[0], ' changed');
    if (fault.action === 'remove') fs.unlinkSync(args[0]);
    if (fault.action === 'create') fs.writeFileSync(fault.file, 'new');
    if (fault.action === 'run') spawnSync(process.execPath, fault.argv);
    if (fault.action === 'retarget') {
      fs.unlinkSync(fault.link);
      fs.symlinkSync(fault.to, fault.link);
    }
    return real.apply(this, args);
  };
}
