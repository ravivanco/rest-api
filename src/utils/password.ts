import crypto from 'crypto';

export const generateTemporaryPassword = (length = 14): string => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const special = '!@#$%&*?';
  const all = upper + lower + numbers + special;

  const minLength = Math.max(length, 4);
  const required = [
    upper[crypto.randomInt(upper.length)],
    lower[crypto.randomInt(lower.length)],
    numbers[crypto.randomInt(numbers.length)],
    special[crypto.randomInt(special.length)],
  ];

  while (required.length < minLength) {
    required.push(all[crypto.randomInt(all.length)]);
  }

  for (let i = required.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [required[i], required[j]] = [required[j], required[i]];
  }

  return required.join('');
};
