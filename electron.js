const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const url = require('url');
const Store = require('electron-store');
const fs = require('fs');

const store = new Store();

// Initialize API key if not already set
if (!store.get('apiKey')) {
  store.set('apiKey', '');
}
// Initialize PDF header config if not already set
if (!store.get('pdfHeaderConfig')) {
  store.set('pdfHeaderConfig', { logoBase64: null, headerText: `Relatório de Inteligência Financeira - ${new Date().toLocaleDateString('pt-BR')}` });
}


function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: process.env.NODE_ENV !== 'production', // Enable DevTools only in development
    },
  });

  if (process.env.NODE_ENV === 'development') {
    // In development, load from the Next.js dev server
    win.loadURL('http://localhost:9002'); // Make sure this matches your Next.js dev port
     win.webContents.openDevTools();
  } else {
    // In production, load the static export
    const startUrl = url.format({
      pathname: path.join(__dirname, 'out/index.html'),
      protocol: 'file:',
      slashes: true,
    });
    win.loadURL(startUrl);
  }

  // Handle external links
  win.webContents.setWindowOpenHandler(({ url: newUrl }) => {
    // Check if the URL is external
    if (newUrl.startsWith('http:') || newUrl.startsWith('https:') ) {
      shell.openExternal(newUrl); // Open in default browser
      return { action: 'deny' }; // Prevent Electron from opening a new window
    }
    return { action: 'allow' }; // Allow internal navigation
  });
}

app.on('ready', () => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC Handlers
ipcMain.handle('get-api-key', () => {
  return store.get('apiKey');
});

ipcMain.handle('set-api-key', (event, apiKey) => {
  try {
    store.set('apiKey', apiKey);
    return { success: true };
  } catch (error) {
    console.error("Failed to set API key:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-pdf-header-config', () => {
  return store.get('pdfHeaderConfig');
});

ipcMain.handle('set-pdf-header-config', (event, config) => {
   try {
    store.set('pdfHeaderConfig', config);
    return { success: true };
  } catch (error) {
    console.error("Failed to set PDF header config:", error);
    return { success: false, error: error.message };
  }
});

// IPC handler for saving analysis to a case (simulated DB interaction)
ipcMain.handle('save-analysis-to-case-electron', (event, caseId, analysisEntry) => {
  // In a real scenario, this would interact with a local database (e.g., SQLite)
  // For now, we'll log it and simulate success
  console.log(`Electron: Saving analysis to case ${caseId}:`, analysisEntry);
  // You would typically find the case, update its relatedAnalyses array, and save it back.
  return { success: true, data: analysisEntry }; 
});

// IPC handler for fetching all cases (simulated DB interaction)
ipcMain.handle('fetch-cases-electron', () => {
  // Simulate fetching cases from a local store or DB
  const cases = store.get('casesDB', []); // Default to empty array if not found
  console.log('Electron: Fetching cases, count:', cases.length);
  return cases;
});

// IPC handler for fetching a single case by ID
ipcMain.handle('fetch-case-details-electron', (event, caseId) => {
  const cases = store.get('casesDB', []);
  const caseDetail = cases.find(c => c.id === caseId);
  console.log(`Electron: Fetching case details for ${caseId}:`, caseDetail ? 'Found' : 'Not Found');
  return caseDetail || null;
});

// IPC handler for creating a new case
ipcMain.handle('create-case-electron', (event, caseData) => {
  let cases = store.get('casesDB', []);
  const newCase = {
    ...caseData,
    id: crypto.randomUUID(),
    dateCreated: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    relatedAnalyses: [],
  };
  cases.unshift(newCase);
  store.set('casesDB', cases);
  console.log('Electron: Case created:', newCase);
  return newCase;
});

// IPC handler for updating a case
ipcMain.handle('update-case-electron', (event, updatedCaseData) => {
  let cases = store.get('casesDB', []);
  const caseIndex = cases.findIndex(c => c.id === updatedCaseData.id);
  if (caseIndex !== -1) {
    cases[caseIndex] = { ...cases[caseIndex], ...updatedCaseData, lastModified: new Date().toISOString() };
    store.set('casesDB', cases);
    console.log('Electron: Case updated:', cases[caseIndex]);
    return cases[caseIndex];
  }
  return null;
});

// IPC handler for deleting a case
ipcMain.handle('delete-case-electron', (event, caseId) => {
  let cases = store.get('casesDB', []);
  const initialLength = cases.length;
  cases = cases.filter(c => c.id !== caseId);
  store.set('casesDB', cases);
  console.log('Electron: Case deleted:', caseId, cases.length < initialLength);
  return cases.length < initialLength;
});


// Initialize casesDB if it doesn't exist
if (!store.has('casesDB')) {
  store.set('casesDB', [
    {
      id: "mock-case-electron-1",
      name: "Operação Pégaso (Local)",
      description: "Investigação sobre fraudes financeiras online, dados locais.",
      dateCreated: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      lastModified: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      status: "Em Investigação",
      relatedAnalyses: [],
    },
    {
      id: "mock-case-electron-2",
      name: "Caso Testemunha Silenciosa (Local)",
      description: "Análise de documentos e áudios para identificar conexões, dados locais.",
      dateCreated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      lastModified: new Date().toISOString(),
      status: "Aberto",
      relatedAnalyses: [],
    }
  ]);
}
