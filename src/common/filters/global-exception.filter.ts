import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { GraphQLError } from 'graphql';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const { status, message } = this.resolveError(exception);

    const contextType = host.getType<'http' | 'graphql'>();

    if (contextType === 'graphql') {
      this.logger.error(`[GraphQL] ${message}`, this.getStack(exception));
      throw new GraphQLError(message, {
        extensions: { code: this.getGraphqlCode(status), statusCode: status },
      });
    }

    // HTTP context
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    this.logger.error(
      `[HTTP] ${request.method} ${request.url} - ${status}: ${message}`,
      this.getStack(exception),
    );

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private resolveError(exception: unknown): {
    status: number;
    message: string;
  } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return { status: exception.getStatus(), message: response };
      }

      const responseMessage = (response as { message?: string | string[] })
        .message;
      if (!responseMessage) {
        return { status: exception.getStatus(), message: exception.message };
      }

      const message = Array.isArray(responseMessage)
        ? responseMessage.join(', ')
        : responseMessage;
      return { status: exception.getStatus(), message };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrismaError(exception);
    }

    this.logger.error('Unexpected error', this.getStack(exception));
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  private resolvePrismaError(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
  } {
    const modelName =
      (exception.meta?.modelName as string | undefined) || 'Record';
    const entityName = modelName.toLowerCase();

    switch (exception.code) {
      case 'P2002': // Unique constraint violation
        return {
          status: HttpStatus.CONFLICT,
          message: `A ${entityName} with this data already exists`,
        };
      case 'P2025': // Record not found
        return {
          status: HttpStatus.NOT_FOUND,
          message: `${modelName} not found`,
        };
      case 'P2003': // Foreign key constraint violation
        return {
          status: HttpStatus.BAD_REQUEST,
          message: `Related ${entityName} does not exist`,
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
        };
    }
  }

  private getGraphqlCode(status: number): string {
    switch (status) {
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }

  private getStack(exception: unknown): string | undefined {
    return exception instanceof Error ? exception.stack : undefined;
  }
}
