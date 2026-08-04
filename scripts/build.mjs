import {cp,mkdir,rm,stat} from 'node:fs/promises';
const files=['index.html','styles.css','app.js','kokoro-worker.js','service-worker.js','manifest.webmanifest','THIRD_PARTY_NOTICES.md'];
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});
for(const file of files)await cp(file,`dist/${file}`);
await cp('assets','dist/assets',{recursive:true});
for(const file of ['dist/index.html','dist/app.js','dist/assets/icon.svg','dist/assets/avatars/suzuki/neutral.webp'])await stat(file);
console.log(`Built ${files.length+101} static assets into dist/`);
