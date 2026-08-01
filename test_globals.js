console.log('typeof app:', typeof app);
console.log('typeof BrowserWindow:', typeof BrowserWindow);
console.log('typeof globalShortcut:', typeof globalShortcut);
console.log('app:', app);

if (app) {
  app.whenReady().then(() => {
    console.log('Electron is ready via global!');
  });
}
