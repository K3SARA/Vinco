import 'dotenv/config';

const REQUIRED_SECRET_LENGTH = 16;
const REQUIRED_PRODUCTION_SECRET_LENGTH = 32;
const PLACEHOLDER_SECRETS = new Set([
  'your_jwt_secret_here',
  'replace_with_a_private_random_secret_32_chars_or_longer',
]);

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret || PLACEHOLDER_SECRETS.has(secret)) {
    throw new Error('JWT_SECRET must be configured with a private value before starting the app.');
  }

  if (secret.length < REQUIRED_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${REQUIRED_SECRET_LENGTH} characters.`);
  }

  if (process.env.NODE_ENV === 'production' && secret.length < REQUIRED_PRODUCTION_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${REQUIRED_PRODUCTION_SECRET_LENGTH} characters in production.`);
  }

  return secret;
}
