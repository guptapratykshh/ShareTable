# Live demo on AWS (App Runner + S3 + EventBridge + Bedrock)

Do **not** use Lambda/SAM for the Ship It demo. Keep MongoDB Atlas and JWT.

## Services

- **App Runner** (`ap-south-1`): Express API + Vite SPA from the repo-root `Dockerfile` (0.25 vCPU / 0.5 GB). Live URL: `https://vmcwfgh43e.ap-south-1.awsapprunner.com`
- **S3**: meal photos (`share-table-food-rescue`, prefix `photos/*`) and a static copy of the Vite build (`sharetable-web-982428800112`).
- **CloudFront**: blocked until this AWS account finishes verification. Use the App Runner HTTPS URL until then. After verification, attach CloudFront to the web bucket and set `PHOTO_CLOUDFRONT_URL` / `VITE_API_URL` as needed.
- **EventBridge**: `rate(1 minute)` POST to `/api/internal/rescue-tick` with header `x-internal-secret`.
- **Bedrock Nova Micro** (`amazon.nova-micro-v1:0`): donate description, assistant classify/FAQ rephrase, kitchen pattern copy. Converse API only — no Claude. First invoke is denied until AWS account verification finishes (usually under 2 hours).

## App Runner env

Set on the service (never commit): `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN`, `AWS_REGION=ap-south-1`, `S3_BUCKET`, `BEDROCK_MODEL_ID=amazon.nova-micro-v1:0`, `INTERNAL_TICK_SECRET`, `RUNTIME=ap-runner`, optional `PHOTO_CLOUDFRONT_URL`.

Instance role needs `bedrock:InvokeModel` on Nova Micro and `s3:PutObject` on `photos/*`.

## Health

`GET /api/health` reports `runtime`, `region`, and `bedrock` only after a real Converse succeeded recently.
