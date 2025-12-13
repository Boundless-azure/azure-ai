import type { ValidationPipeOptions } from '@nestjs/common';
import * as ws from '@nestjs/websockets';

export const appValidationPipeOptions: ValidationPipeOptions = {
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  transformOptions: {
    enableImplicitConversion: true,
  },

  exceptionFactory: (errors) => new ws.WsException(errors),
};
