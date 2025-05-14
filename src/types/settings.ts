// src/types/settings.ts

export interface PdfHeaderConfig {
  logoBase64: string | null;
  headerText: string;
}

export interface ApiKeyConfig {
  googleApiKey: string | null;
}
