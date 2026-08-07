const fs = require('fs');
const path = require('path');
const pages = [];
(function walk(dir){ for(const e of fs.readdirSync(dir,{withFileTypes:true})){ if(e.name==='node_modules')continue; const p=path.join(dir,e.name); if(e.isDirectory())walk(p); else if(/\.(jsx|tsx)$/.test(e.name)&&/pages[\\/]|components[\\/]/.test(p)) pages.push(p);} })('.');

let totalButtons = 0, totalForms = 0, totalLinks = 0;
const badClassHits = [];

for (const f of pages) {
  const c = fs.readFileSync(f,'utf8');
  const lines = c.split('\n');
  const onClick = (c.match(/onClick=\{/g)||[]).length;
  const onSubmit = (c.match(/onSubmit=\{/g)||[]).length;
  const links = (c.match(/<Link\s/g)||[]).length;
  totalButtons += onClick; totalForms += onSubmit; totalLinks += links;
  const bad = new Set();
  lines.forEach(ln=>{
    // 550 shade doesn't exist in default Tailwind; 1000 never exists
    const mm = ln.match(/(?:bg|text|border|from|to|via)-(?:indigo|slate|blue|emerald|amber|red|green|brand)-(550|1000)\b/g);
    if(mm) mm.forEach(x=>bad.add(x));
  });
  const short = f.replace(/\\/g,'/');
  console.log(`${short} (${lines.length}L): onClick=${onClick} onSubmit=${onSubmit} Link=${links}` + (bad.size?`  !! BAD-CLASSES: ${[...bad].join(', ')}`:''));
  if(bad.size) badClassHits.push({file:short, classes:[...bad]});
}
console.log('\n==== TOTALS ====');
console.log(`onClick handlers: ${totalButtons}`);
console.log(`onSubmit handlers: ${totalForms}`);
console.log(`Links: ${totalLinks}`);
console.log(`Files with broken Tailwind classes: ${badClassHits.length}`);
