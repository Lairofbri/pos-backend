const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/;

export const toCents = (value: unknown, field = 'monto'): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const cents = Math.round(value * 100);
    if (cents >= 0 && Math.abs(value * 100 - cents) < 1e-7) return cents;
  }

  if (typeof value === 'string' && MONEY_PATTERN.test(value.trim())) {
    const [whole, fraction = ''] = value.trim().split('.');
    return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  }

  throw { status: 400, mensaje: `${field} debe ser un monto válido con hasta dos decimales.` };
};

export const fromCents = (cents: number): number => {
  if (!Number.isInteger(cents)) throw new Error('El monto interno debe estar expresado en centavos enteros.');
  return cents / 100;
};

export const sumCents = (values: unknown[], field = 'monto'): number =>
  values.reduce<number>((sum, value) => sum + toCents(value, field), 0);

export const percentageCents = (baseCents: number, percentage: unknown, field = 'porcentaje'): number => {
  if (typeof percentage !== 'number' || !Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw { status: 400, mensaje: `${field} debe estar entre 0 y 100.` };
  }
  return Math.round((baseCents * percentage) / 100);
};
