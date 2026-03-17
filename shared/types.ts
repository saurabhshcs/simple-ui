// Shared API contract types used by both client and server

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  deviceFingerprint: string;
  deviceName: string;
}

export interface VerifyOtpRequest {
  userId: string;
  code: string;
  deviceFingerprint: string;
  deviceName: string;
}

export interface AuthResponse {
  token: string;
  expiresAt: number;
  user: UserInfo;
}

export interface OtpSentResponse {
  otpSent: true;
  userId: string;
}

export interface DevicePendingResponse {
  devicePending: true;
}

export interface UserInfo {
  id: string;
  email: string;
}

// ─── Models ──────────────────────────────────────────────────────────────────

export type Provider = 'openai' | 'anthropic' | 'gemini';

export interface ModelInfo {
  id: string;
  name: string;
  provider: Provider;
  supportsVision: boolean;
  supportsDocuments: boolean;
  contextWindow?: number;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatRequest {
  conversationId?: string;   // omit to start a new conversation
  model: string;
  provider: Provider;
  messages: ChatMessage[];
  fileIds?: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface SseToken {
  token: string;
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  provider: Provider;
  createdAt: number;
  updatedAt: number;
}

export interface ConversationWithMessages extends Conversation {
  messages: StoredMessage[];
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  fileIds: string[];
  createdAt: number;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface ApiKeyEntry {
  provider: Provider;
  maskedKey: string;   // e.g. "sk-...ab12" — last 4 chars only
  updatedAt: number;
}

export interface UpsertApiKeyRequest {
  keyValue: string;
}

// ─── Files ───────────────────────────────────────────────────────────────────

export interface UploadedFile {
  fileId: string;
  filename: string;
  mimeType: string;
  size: number;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  code?: string;
}
