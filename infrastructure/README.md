# Live demo on AWS (App Runner + S3 + EventBridge + Bedrock)

Do **not** use Lambda/SAM for the Ship It demo. Keep MongoDB Atlas and JWT.

## Services

- **App Runner** (`ap-south-1`): Express API + Vite SPA from the repo-root `Dockerfile` (0.25 vCPU / 0.5 GB). Live URL: `https://vmcwfgh43e.ap-south-1.awsapprunner.com`
- **S3**: meal photos (`share-table-food-rescue`, prefix `photos/*`), static Vite copy (`sharetable-web-982428800112`), and mobile test builds (`sharetable-mobile-786742959627/releases/`): [Android APK](https://sharetable-mobile-786742959627.s3.ap-south-1.amazonaws.com/releases/ShareTable-android-test.apk), [iOS IPA](https://sharetable-mobile-786742959627.s3.ap-south-1.amazonaws.com/releases/ShareTable-ios-test.ipa).
- **Repos:** [guptapratykshh/ShareTable](https://github.com/guptapratykshh/ShareTable), [the-ivii/ShareTable](https://github.com/the-ivii/ShareTable), [guptapratykshh/ShareTableMobile](https://github.com/guptapratykshh/ShareTableMobile), [the-ivii/ShareTableMobile](https://github.com/the-ivii/ShareTableMobile). YouTube: https://youtu.be/eZ2PY4_q9ak
- **CloudFront**: blocked until this AWS account finishes verification. Use the App Runner HTTPS URL until then. After verification, attach CloudFront to the web bucket and set `PHOTO_CLOUDFRONT_URL` / `VITE_API_URL` as needed.
- **EventBridge**: `rate(1 minute)` POST to `/api/internal/rescue-tick` with header `x-internal-secret`.
- **Groq GPT-OSS 20B** (`LLM_PROVIDER=groq`, `GROQ_MODEL=openai/gpt-oss-20b`): donate description, assistant classify/FAQ rephrase, kitchen pattern copy. Free-tier open-weight model over HTTPS. Llama 3.1 8B Instant was retired for free/developer tiers on 16 Aug 2026. App Runner is 0.5 GB and cannot host Ollama.
- **Bedrock Nova Micro** (`amazon.nova-micro-v1:0`): same helpers, Converse API only — no Claude. Leave unused until AWS account verification finishes. Then set `LLM_PROVIDER=bedrock`. Do not probe Bedrock on every request while it is gated.

## App Runner env

Set on the service (never commit): `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN`, `AWS_REGION=ap-south-1`, `S3_BUCKET`, `LLM_PROVIDER=groq`, `GROQ_API_KEY`, `GROQ_MODEL=openai/gpt-oss-20b`, `BEDROCK_MODEL_ID=amazon.nova-micro-v1:0`, `INTERNAL_TICK_SECRET`, `RUNTIME=ap-runner`, optional `PHOTO_CLOUDFRONT_URL`.

Instance role still needs `bedrock:InvokeModel` on Nova Micro (for the later flip) and `s3:PutObject` on `photos/*`. Groq uses the API key only.

## Health

`GET /api/health` reports `runtime`, `region`, `bedrock` only after a real Nova Converse succeeded recently, and `llm: { provider, model, ok }` after the active provider succeeded recently.
