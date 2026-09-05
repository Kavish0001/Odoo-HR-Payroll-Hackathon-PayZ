import pino, { type LoggerOptions } from 'pino';

import { isProduction, isTest } from './env.js';

/**
 * `transport` is spread in conditionally rather than set to undefined:
 * exactOptionalPropertyTypes draws a distinction between "absent" and
 * "present but undefined", and pino only accepts the former.
 */
const options: LoggerOptions = {
  level: isTest ? 'silent' : isProduction ? 'info' : 'debug',

  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }),

  // Credentials and passwords never reach the log (guardrail 10.8).
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.passwordHash',
    ],
    remove: true,
  },
};

export const logger = pino(options);
