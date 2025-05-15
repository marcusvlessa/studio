
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

// Initialize registeredUsersDB if it doesn't exist
if (!store.has('registeredUsersDB')) {
  store.set('registeredUsersDB', []);
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
    win.loadURL('http://localhost:9002'); 
     win.webContents.openDevTools();
  } else {
    const startUrl = url.format({
      pathname: path.join(__dirname, 'out/index.html'),
      protocol: 'file:',
      slashes: true,
    });
    win.loadURL(startUrl);
  }

  win.webContents.setWindowOpenHandler(({ url: newUrl }) => {
    if (newUrl.startsWith('http:') || newUrl.startsWith('https:') ) {
      shell.openExternal(newUrl); 
      return { action: 'deny' }; 
    }
    return { action: 'allow' }; 
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

// Case Management IPC
ipcMain.handle('save-analysis-to-case-electron', (event, caseId, analysisEntry) => {
  console.log(`Electron: Saving analysis to case ${caseId}:`, analysisEntry);
  let cases = store.get('casesDB', []);
  const caseIndex = cases.findIndex(c => c.id === caseId);
  if (caseIndex !== -1) {
    if (!cases[caseIndex].relatedAnalyses) {
      cases[caseIndex].relatedAnalyses = [];
    }
    cases[caseIndex].relatedAnalyses.push(analysisEntry);
    cases[caseIndex].lastModified = new Date().toISOString();
    store.set('casesDB', cases);
    return { success: true, data: analysisEntry };
  }
  return { success: false, error: "Caso não encontrado." };
});

ipcMain.handle('fetch-cases-electron', () => {
  const cases = store.get('casesDB', []); 
  console.log('Electron: Fetching cases, count:', cases.length);
  return cases;
});

ipcMain.handle('fetch-case-details-electron', (event, caseId) => {
  const cases = store.get('casesDB', []);
  const caseDetail = cases.find(c => c.id === caseId);
  console.log(`Electron: Fetching case details for ${caseId}:`, caseDetail ? 'Found' : 'Not Found');
  return caseDetail || null;
});

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

ipcMain.handle('delete-case-electron', (event, caseId) => {
  let cases = store.get('casesDB', []);
  const initialLength = cases.length;
  cases = cases.filter(c => c.id !== caseId);
  store.set('casesDB', cases);
  console.log('Electron: Case deleted:', caseId, cases.length < initialLength);
  return cases.length < initialLength;
});

// User Management IPC
ipcMain.handle('register-user-electron', (event, userData) => {
  let users = store.get('registeredUsersDB', []);
  const existingUser = users.find(u => u.email === userData.email);
  if (existingUser) {
    return { success: false, error: 'Email já cadastrado.' };
  }
  const newUser = {
    id: crypto.randomUUID(),
    ...userData,
    dateRegistered: new Date().toISOString(),
  };
  users.unshift(newUser);
  store.set('registeredUsersDB', users);
  console.log('Electron: User registered (simulated email):', newUser.email, 'Password:', newUser.password);
  // SIMULATE EMAIL SENDING: Log credentials. In a real app, send an email.
  // This is highly insecure for production.
  dialog.showMessageBox({
    type: 'info',
    title: 'Usuário Registrado (Simulado)',
    message: `Usuário ${newUser.email} registrado com senha (temporária): ${newUser.password}\nEm uma aplicação real, esta senha seria enviada por email e deveria ser alterada no primeiro login.`,
  });
  return { success: true, data: newUser };
});

ipcMain.handle('login-user-electron', (event, { email, password }) => {
  const users = store.get('registeredUsersDB', []);
  const user = users.find(u => u.email === email && u.password === password); // Insecure: plain text password check
  if (user) {
    console.log('Electron: User login successful:', email);
    const { password, ...userWithoutPassword } = user; // Don't send password to renderer
    return { success: true, user: userWithoutPassword };
  }
  console.log('Electron: User login failed for:', email);
  return { success: false, error: 'Email ou senha inválidos.' };
});

ipcMain.handle('fetch-registered-users-electron', () => {
  const users = store.get('registeredUsersDB', []);
  // Remove passwords before sending to renderer
  return users.map(user => {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  });
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
