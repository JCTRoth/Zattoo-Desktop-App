console.log('process.electronBinding:', process.electronBinding);
console.log('process._linkedBinding:', process._linkedBinding);
console.log('process.versions:', process.versions);
console.log('Object.keys(process):', Object.keys(process).filter(k => k.includes('electron') || k.includes('binding')));
