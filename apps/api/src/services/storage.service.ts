import { S3Client } from '@aws-sdk/client-s3'
import { env } from '@/config/env'

/**
 * TWO S3 clients — critical for MinIO deployed via Traefik.
 *
 * s3ForServerOps: internal Docker DNS (http://minio:9000 in prod, localhost in dev).
 *   Used for backend operations that never reach the browser: HeadObject on complete,
 *   DeleteObject on hard-delete, ListObjects for cleanup jobs.
 *
 * s3ForPresign: public hostname the browser can reach (https://minio.dataroom.holy-water.app
 *   in prod, localhost in dev). Used ONLY for getSignedUrl — the URL we hand to the browser
 *   must resolve outside the Docker network.
 *
 * Never swap these two. In dev both endpoints point at localhost:9000 — same code path.
 */

const commonConfig = {
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
}

export const s3ForServerOps = new S3Client({
  ...commonConfig,
  endpoint: env.S3_ENDPOINT_INTERNAL,
})

export const s3ForPresign = new S3Client({
  ...commonConfig,
  endpoint: env.S3_ENDPOINT_PUBLIC,
})

export const BUCKET = env.S3_BUCKET
