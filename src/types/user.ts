// src/types/user.ts

export interface RegisteredUser {
  id: string;
  name: string;
  email: string;
  password?: string; // Será armazenado em plain text para fins de demonstração
  role: string; // Ex: 'admin', 'user'
  department: string;
  cpf?: string;
  phone?: string;
  whatsapp?: string;
  dateRegistered: string;
}
