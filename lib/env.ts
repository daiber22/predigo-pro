export function envFlag(name: string, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
}

export function allowDemoFallback() {
  return envFlag('ALLOW_DEMO_FALLBACK', false);
}

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta configurar ${name} en .env.local o en tu plataforma de despliegue.`);
  }
  return value;
}
