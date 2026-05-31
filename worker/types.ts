export type Env = {
  DB: D1Database
  FILES: R2Bucket
  AUTH_PASSWORD: string
  JWT_SECRET: string
  ASSETS: Fetcher
}

export type Variables = {
  jwtPayload: { sub: string; exp: number }
}
