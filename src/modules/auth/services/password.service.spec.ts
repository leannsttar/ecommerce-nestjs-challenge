import { PasswordService } from './password.service';

/**
 * We test with real bcrypt to verify the actual contract (hash format,
 * round-trip compare) rather than mocking the dependency away.
 */
describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  // ─── hashPassword ──────────────────────────────────────────────────────────

  describe('hashPassword', () => {
    it('returns a bcrypt hash string (format: $2b$)', async () => {
      const hash = await service.hashPassword('mySecret123');
      expect(hash).toMatch(/^\$2b\$/);
    });

    it('produces a different hash on each call due to random salting', async () => {
      const password = 'samePassword';
      const hash1 = await service.hashPassword(password);
      const hash2 = await service.hashPassword(password);
      expect(hash1).not.toBe(hash2);
    });
  });

  // ─── comparePassword ──────────────────────────────────────────────────────

  describe('comparePassword', () => {
    it('returns true when the plain password matches its hash', async () => {
      const plain = 'correctPassword';
      const hash = await service.hashPassword(plain);

      await expect(service.comparePassword(plain, hash)).resolves.toBe(true);
    });

    it('returns false when the plain password does not match the hash', async () => {
      const hash = await service.hashPassword('correctPassword');

      await expect(
        service.comparePassword('wrongPassword', hash),
      ).resolves.toBe(false);
    });

    it('returns false when an empty string is compared against a valid hash', async () => {
      const hash = await service.hashPassword('somePassword');

      await expect(service.comparePassword('', hash)).resolves.toBe(false);
    });
  });
});
