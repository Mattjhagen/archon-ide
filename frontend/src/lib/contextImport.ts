export type ImportedContextSource = 'chatgpt' | 'claude' | 'gemini' | 'markdown' | 'text' | 'unknown';

export interface ImportedContextMessage {
  role: 'user' | 'assistant' | 'system' | 'unknown';
  content: string;
}

export interface ImportedConversation {
  source: ImportedContextSource;
  title: string;
  messages: ImportedContextMessage[];
  characterCount: number;
  preview: string;
  warnings: string[];
}

const MAX_IMPORT_CHARACTERS = 120_000;
const MAX_MESSAGE_CHARACTERS = 12_000;

function cleanText(value: unknown, max = MAX_MESSAGE_CHARACTERS): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim().slice(0, max);
}

function roleFrom(value: unknown): ImportedContextMessage['role'] {
  if (value === 'user' || value === 'assistant' || value === 'system') return value;
  return 'unknown';
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return cleanText(content);
  if (!content || typeof content !== 'object') return '';
  const record = content as Record<string, unknown>;
  if (Array.isArray(record.parts)) return cleanText(record.parts.filter(part => typeof part === 'string').join('\n'));
  if (typeof record.text === 'string') return cleanText(record.text);
  return '';
}

function fromMessageArray(messages: unknown): ImportedContextMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages.flatMap((message): ImportedContextMessage[] => {
    if (!message || typeof message !== 'object') return [];
    const record = message as Record<string, unknown>;
    const content = textFromContent(record.content ?? record.text ?? record.message);
    return content ? [{ role: roleFrom(record.role ?? record.author), content }] : [];
  });
}

function fromChatGptMapping(mapping: unknown): ImportedContextMessage[] {
  if (!mapping || typeof mapping !== 'object') return [];
  const nodes = Object.values(mapping as Record<string, unknown>)
    .filter((node): node is Record<string, unknown> => Boolean(node) && typeof node === 'object')
    .sort((a, b) => Number(a.create_time ?? 0) - Number(b.create_time ?? 0));
  return nodes.flatMap((node): ImportedContextMessage[] => {
    const message = node.message;
    if (!message || typeof message !== 'object') return [];
    const record = message as Record<string, unknown>;
    const author = record.author;
    const role = author && typeof author === 'object' ? (author as Record<string, unknown>).role : undefined;
    const content = textFromContent(record.content);
    return content ? [{ role: roleFrom(role), content }] : [];
  });
}

function detectSource(data: unknown, filename: string): ImportedContextSource {
  const lower = filename.toLowerCase();
  if (/\.mdx?$/.test(lower)) return 'markdown';
  if (/\.txt$/.test(lower)) return 'text';
  if (!data || typeof data !== 'object') return 'unknown';
  const value = data as Record<string, unknown>;
  if ('mapping' in value || lower.includes('conversation')) return 'chatgpt';
  if ('chat_messages' in value || lower.includes('claude')) return 'claude';
  if ('contents' in value || lower.includes('gemini')) return 'gemini';
  return 'unknown';
}

function truncateMessages(messages: ImportedContextMessage[]): { messages: ImportedContextMessage[]; truncated: boolean } {
  let characters = 0;
  let truncated = false;
  const accepted: ImportedContextMessage[] = [];
  for (const message of messages) {
    const remaining = MAX_IMPORT_CHARACTERS - characters;
    if (remaining <= 0) { truncated = true; break; }
    const content = message.content.slice(0, remaining);
    if (content.length < message.content.length) truncated = true;
    accepted.push({ ...message, content });
    characters += content.length;
  }
  return { messages: accepted, truncated };
}

export function parseConversationImport(raw: string, filename: string): ImportedConversation {
  const plainText = /\.(md|mdx|txt)$/i.test(filename);
  let data: unknown = raw;
  const warnings: string[] = [];

  if (!plainText) {
    try { data = JSON.parse(raw); }
    catch { warnings.push('This file is not valid JSON, so it was treated as plain text.'); }
  }

  const source = detectSource(data, filename);
  const record = data && typeof data === 'object' ? data as Record<string, unknown> : undefined;
  const title = cleanText(record?.title) || filename.replace(/\.[^.]+$/, '') || 'Imported conversation';
  let messages: ImportedContextMessage[] = [];

  if (typeof data === 'string') messages = [{ role: 'unknown', content: cleanText(data, MAX_IMPORT_CHARACTERS) }];
  else if (record) {
    messages = fromChatGptMapping(record.mapping);
    if (messages.length === 0) messages = fromMessageArray(record.messages ?? record.chat_messages ?? record.contents);
    if (messages.length === 0 && typeof record.text === 'string') messages = [{ role: 'unknown', content: cleanText(record.text, MAX_IMPORT_CHARACTERS) }];
  }

  if (messages.length === 0) warnings.push('No readable conversation messages were found in this export.');
  const normalized = truncateMessages(messages);
  if (normalized.truncated) warnings.push(`Only the first ${MAX_IMPORT_CHARACTERS.toLocaleString()} characters are prepared for review.`);
  const characterCount = normalized.messages.reduce((total, message) => total + message.content.length, 0);
  const preview = normalized.messages.map(message => `${message.role}: ${message.content}`).join('\n\n').slice(0, 1_200);

  return { source, title, messages: normalized.messages, characterCount, preview, warnings };
}

export const contextImportLimits = { maxCharacters: MAX_IMPORT_CHARACTERS, maxMessageCharacters: MAX_MESSAGE_CHARACTERS };
