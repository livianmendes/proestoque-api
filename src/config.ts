function getEnvVar(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Variavel de ambiente faltando: ${key}`);
  }

  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3333),
  jwtSecret: getEnvVar("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "30d",
  nodeEnv: process.env.NODE_ENV ?? "development",
} as const;

export { getEnvVar };
