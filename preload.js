
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // API Key Management
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  setApiKey: (apiKey) => ipcRenderer.invoke('set-api-key', apiKey),

  // PDF Header Configuration
  getPdfHeaderConfig: () => ipcRenderer.invoke('get-pdf-header-config'),
  setPdfHeaderConfig: (config) => ipcRenderer.invoke('set-pdf-header-config', config),

  // Case Management IPC
  fetchCases: () => ipcRenderer.invoke('fetch-cases-electron'),
  fetchCaseDetails: (caseId) => ipcRenderer.invoke('fetch-case-details-electron', caseId),
  createCase: (caseData) => ipcRenderer.invoke('create-case-electron', caseData),
  updateCase: (updatedCaseData) => ipcRenderer.invoke('update-case-electron', updatedCaseData),
  deleteCase: (caseId) => ipcRenderer.invoke('delete-case-electron', caseId),
  saveAnalysisToCase: (caseId, analysisEntry) => ipcRenderer.invoke('save-analysis-to-case-electron', caseId, analysisEntry),

  // User Management IPC (New)
  registerUserElectron: (userData) => ipcRenderer.invoke('register-user-electron', userData),
  loginUserElectron: (credentials) => ipcRenderer.invoke('login-user-electron', credentials),
  fetchRegisteredUsersElectron: () => ipcRenderer.invoke('fetch-registered-users-electron'),
});
