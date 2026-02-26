/**
 * Strong password validation for signup.
 * Ensures: min length 8, at least one uppercase, one lowercase, one digit, one special character.
 */

export type PasswordRule = {
  key: string;
  label: string;
  met: boolean;
};

const MIN_LENGTH = 8;
const HAS_UPPER = /[A-Z]/;
const HAS_LOWER = /[a-z]/;
const HAS_DIGIT = /\d/;
const HAS_SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export function validatePassword(password: string): { valid: boolean; rules: PasswordRule[] } {
  const rules: PasswordRule[] = [
    { key: 'length', label: `At least ${MIN_LENGTH} characters`, met: password.length >= MIN_LENGTH },
    { key: 'upper', label: 'One uppercase letter', met: HAS_UPPER.test(password) },
    { key: 'lower', label: 'One lowercase letter', met: HAS_LOWER.test(password) },
    { key: 'digit', label: 'One number', met: HAS_DIGIT.test(password) },
    { key: 'special', label: 'One special character (!@#$%^&* etc.)', met: HAS_SPECIAL.test(password) },
  ];
  const valid = rules.every((r) => r.met);
  return { valid, rules };
}
