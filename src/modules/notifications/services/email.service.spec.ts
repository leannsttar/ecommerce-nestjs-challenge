import { ConfigService } from '@nestjs/config';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import sgMail from '@sendgrid/mail';
import { EmailService } from './email.service';

// jest.mock replaces the sgMail module singleton before the service imports it.
// This is necessary because sgMail is not constructor-injected
jest.mock('@sendgrid/mail', () => ({
  __esModule: true,
  default: {
    setApiKey: jest.fn(),
    send: jest.fn(),
  },
}));

// ─── Shared Fixtures ──────────────────────────────────────────────────────────

const FROM_EMAIL = 'noreply@store.com';
const RECIPIENT = 'customer@example.com';

// ─── EmailService ─────────────────────────────────────────────────────────────

describe('EmailService', () => {
  let service: EmailService;
  let configService: DeepMocked<ConfigService>;
  const mockSend = sgMail.send as jest.Mock;

  beforeEach(() => {
    configService = createMock<ConfigService>();

    (configService.getOrThrow as jest.Mock)
      .mockReturnValueOnce('sg-test-api-key')
      .mockReturnValueOnce(FROM_EMAIL);

    service = new EmailService(configService);
    mockSend.mockResolvedValue([{ statusCode: 202 }, {}]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── sendResetPasswordEmail ─────────────────────────────────────────────────

  describe('sendResetPasswordEmail', () => {
    it('should send a password reset email to the correct recipient with the configured sender', async () => {
      await service.sendResetPasswordEmail(
        RECIPIENT,
        'reset-token-abc',
        new Date(Date.now() + 1000 * 60 * 30), //expires at
        new Date(), //created at
      );

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: RECIPIENT, from: FROM_EMAIL }),
      );
    });
  });

  // ─── sendChangedPasswordEmail ───────────────────────────────────────────────

  describe('sendChangedPasswordEmail', () => {
    it('should send a password-changed confirmation email to the correct recipient', async () => {
      await service.sendChangedPasswordEmail(RECIPIENT, new Date());

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: RECIPIENT, from: FROM_EMAIL }),
      );
    });
  });

  // ─── sendStockNotificationEmail ─────────────────────────────────────────────

  describe('sendStockNotificationEmail', () => {
    it('should send an email via sgMail when NODE_ENV is not "test"', async () => {
      configService.get.mockReturnValue('production');

      await service.sendStockNotificationEmail(
        RECIPIENT,
        'Product A',
        'img.jpg',
      );

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: RECIPIENT, from: FROM_EMAIL }),
      );
    });

    it('should NOT call sgMail.send when NODE_ENV is "test" (prevents real emails in CI)', async () => {
      configService.get.mockReturnValue('test');

      await service.sendStockNotificationEmail(
        RECIPIENT,
        'Product A',
        'img.jpg',
      );

      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
