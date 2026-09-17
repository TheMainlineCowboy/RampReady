import fs from 'node:fs';

const target = 'src/components/RampReadyStandupTrainerTerminal4.jsx';
let source = fs.readFileSync(target, 'utf8');
const marker = 'window.__rampReadyUserRepairExport = { scene, environment, aircraft };';
if (!source.includes(marker)) {
  const anchor = '    simRef.current = sim;';
  if (!source.includes(anchor)) throw new Error(`${target}: simRef assignment anchor missing`);
  source = source.replace(anchor, `${anchor}\n    ${marker}`);
  fs.writeFileSync(target, source);
}
console.log('Installed user-repair scene export hook.');
