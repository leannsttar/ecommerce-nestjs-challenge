## Unit Testing Strategy — General Rules

Our unit tests must focus on **behavior, not implementation**. We test the public interface of our services in complete isolation. Tests exist to validate **business logic** — if a test doesn't verify a meaningful business rule or edge case, it shouldn't exist.

---

### 1. The 5 Questions Every Test Must Answer

Every test block must visually address these questions through its structure and comments:

| Question                            | Purpose                 | Implementation                          |
| ----------------------------------- | ----------------------- | --------------------------------------- |
| **What are you testing?**           | The method being tested | `describe('methodName')`                |
| **What should it do?**              | The expected behavior   | `it('should...')`                       |
| **How can the test be reproduced?** | The Setup/Arrange phase | Mocked inputs and mocked resolves       |
| **What is the actual output?**      | The execution/Act phase | `const actual = await service.method()` |
| **What is the expected output?**    | The Assert phase        | `expect(actual).toEqual(...)`           |

---

### 2. Strict Mocking Strategy

Because we do not use a repository layer, all dependencies must be completely isolated.

- **For Prisma ONLY:** Use `mockDeep<PrismaClient>()` from `jest-mock-extended`. This handles Prisma's deeply nested and chainable typing perfectly without breaking TypeScript.
- **For everything else:** Use `createMock<T>()` from `@golevelup/ts-jest`. Use this for internal services (e.g., `JwtService`, `ConfigService`) and external integrations (e.g., Stripe, S3, Email).

---

### 3. Core Testing Rules

- **No real databases:** Never execute real Prisma queries. Pure unit tests run in memory.
- **Test the unhappy paths:** Explicitly test scenarios where dependencies fail, throw exceptions, or return null.
- **Clean state:** Always clear or re-instantiate mocks inside `beforeEach()` or use `jest.clearAllMocks()` in `afterEach()` to prevent state leakage between tests.

---

### 4. Quality Over Quantity

More tests are not better tests. Every test must earn its place by covering a **real business rule or a meaningful edge case**.

Before writing a test, ask yourself: _"Does this test verify something the business actually cares about?"_ If the answer is no, don't write it.

**Write tests for:**

- Core business rules (e.g., a user cannot purchase a plan they are already subscribed to)
- Conditional logic with different outcomes (e.g., trial vs. paid user flows)
- Known edge cases and boundary conditions (e.g., expiry dates, zero amounts, empty arrays)
- Critical failure paths (e.g., a payment charge fails — what happens next?)

**Do not write tests for:**

- Trivial pass-through logic with no branching or transformation
- Behavior that is already covered by another test from a different angle
- Implementation details that could change without affecting the observable outcome

---

### 5. Assert Outcomes AND Behavior

A test is not complete just because it checks a return value. Business logic often involves **side effects** — sending an email, charging a customer, writing an audit log, calling an external service. These must be explicitly asserted.

Use the full range of Jest's mock assertions to verify **what happened**, not just **what was returned**:

- `expect(mock.method).toHaveBeenCalled()` — verify a critical side effect was triggered at all
- `expect(mock.method).toHaveBeenCalledTimes(1)` — guard against unintended duplicate calls (e.g., charging a customer twice)
- `expect(mock.method).toHaveBeenCalledWith(expectedArgs)` — verify the correct data was passed downstream (e.g., the right email address, the right amount)
- `expect(mock.method).not.toHaveBeenCalled()` — verify that a side effect was correctly suppressed in a given scenario (e.g., no email sent when a user is inactive)

**The guiding principle:** if your service calls another service, ask yourself _"does it matter that this was called, how many times, and with what data?"_ In business logic, the answer is almost always yes.
