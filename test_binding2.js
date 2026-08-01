try {
  console.log('process.binding("electron"):', process.binding('electron'));
} catch (e) {
  console.log('process.binding("electron") error:', e.message);
}
try {
  console.log('process._linkedBinding("electron"):', process._linkedBinding('electron'));
} catch (e) {
  console.log('process._linkedBinding("electron") error:', e.message);
}
