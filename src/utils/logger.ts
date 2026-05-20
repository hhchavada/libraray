import { ENV } from '../config/env';

type LogMeta = Record<string, unknown>;

const formatMeta = (meta?: LogMeta): string => {
  if (!meta || Object.keys(meta).length === 0) {
    return '';
  }
  return ` ${JSON.stringify(meta)}`;
};

const maskEmail = (email: string): string => {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
};

const maskSecret = (value?: string): string => {
  if (!value || value.trim() === '') {
    return 'NOT_SET';
  }
  if (value.length <= 8) {
    return '***';
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

export const logger = {
  maskEmail,
  maskSecret,

  info(tag: string, message: string, meta?: LogMeta): void {
    console.log(`[${tag}] ${message}${formatMeta(meta)}`);
  },

  warn(tag: string, message: string, meta?: LogMeta): void {
    console.warn(`[${tag}] ${message}${formatMeta(meta)}`);
  },

  error(tag: string, message: string, meta?: LogMeta): void {
    console.error(`[${tag}] ${message}${formatMeta(meta)}`);
  },

  debug(tag: string, message: string, meta?: LogMeta): void {
    if (ENV.NODE_ENV === 'development') {
      console.log(`[${tag}] [DEBUG] ${message}${formatMeta(meta)}`);
    }
  },
};
