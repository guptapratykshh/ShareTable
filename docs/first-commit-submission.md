# First Commit hackathon — ShareTable submission pack

**Submit by:** 8 PM IST · https://www.wemakedevs.org/aws/first-commit/submit

**Public GitHub repos:**  
- Web: https://github.com/guptapratykshh/ShareTable · https://github.com/the-ivii/ShareTable  
- Mobile: https://github.com/guptapratykshh/ShareTableMobile · https://github.com/the-ivii/ShareTableMobile  

**Live demo:** https://vmcwfgh43e.ap-south-1.awsapprunner.com  

**Health (show AWS runtime):** https://vmcwfgh43e.ap-south-1.awsapprunner.com/api/health  
Current live health reports `runtime: "ap-runner"`, `region: "ap-south-1"`, and `llm: { provider: "groq", model: "openai/gpt-oss-20b" }`.

**YouTube demo:** https://youtu.be/eZ2PY4_q9ak  

**Mobile test builds:**  
- Android APK: https://sharetable-mobile-786742959627.s3.ap-south-1.amazonaws.com/releases/ShareTable-android-test.apk  
- iOS IPA: https://sharetable-mobile-786742959627.s3.ap-south-1.amazonaws.com/releases/ShareTable-ios-test.ipa  

**Demo video file:** `docs/artifacts/ShareTable-FirstCommit-demo.mp4`  
Upload to YouTube as **public or unlisted**, then paste the YouTube link in the form.

**Track:** primarily **SHIP IT** (live App Runner URL). Also uses **BUILD IT** tooling (AWS SDK for JS v3, Docker image, Bedrock Converse client wired in code).

---

## Form answers (copy-paste)

### 2. What does your project do? *(required)*

ShareTable is a food-rescue web app for college messes, restaurants, and households with leftover meals, and for nearby registered recipients (NGOs and community members). Donors post surplus food with quantity, location, storage condition, allergens, and pickup times. Recipients within about 2.5 km get in-app notifications, claim meals atomically inside a one-hour window, and pick up with a code like ST-1234. Unclaimed food can escalate 2.5 km → 4 km → 6 km so more recipients see it. Only meals marked PICKED_UP count as rescued. The product includes donor/recipient/admin dashboards, Leaflet maps with privacy-snapped heatmaps, AI-assisted food descriptions, and a confirm-before-send assistant for late, arrival, and pickup notes. Live demo: https://vmcwfgh43e.ap-south-1.awsapprunner.com

### 3. How did you use AWS in your project? *(required)*

ShareTable is shipped as one container (Express API + Vite SPA) and uses AWS for hosting, storage, scheduled rescue escalation, IAM, and a Bedrock-ready AI path.

**SHIP IT (cloud services we actually run):**
- **App Runner** (`ap-south-1`, 0.25 vCPU / 0.5 GB): public HTTPS app + API at https://vmcwfgh43e.ap-south-1.awsapprunner.com. `GET /api/health` returns `runtime: ap-runner` and `region: ap-south-1`.
- **ECR**: image `sharetable:latest` that App Runner deploys from.
- **S3**: meal photos in `share-table-food-rescue` (`photos/*` via `POST /api/uploads/photo-url` presigned PUT) and a static Vite copy in `sharetable-web-982428800112`.
- **EventBridge**: rule `sharetable-rescue-tick` on a 1-minute schedule POSTs `/api/internal/rescue-tick` (with `x-internal-secret`) so rescue radius can widen without a user refresh.
- **IAM**: App Runner access role for ECR pull and instance role for S3 put / Bedrock invoke.

**BUILD IT (AWS open-source / SDK in the repo):**
- AWS SDK for JavaScript v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@aws-sdk/client-bedrock-runtime`) for uploads and Amazon Bedrock Converse (Nova Micro) when `LLM_PROVIDER=bedrock`.
- Root Dockerfile for the App Runner image. An older SAM/Lambda packaging path remains in the repo; the live Ship It path is App Runner.

**Honest split:** data is MongoDB Atlas (not RDS/DynamoDB). Auth is JWT (not Cognito). Live LLM helpers use Groq `openai/gpt-oss-20b` because Bedrock Nova Micro is still gated by AWS account verification; the Bedrock client and env flip are already in code.

### 4. Team leader's contributions *(required)*

**Pratyksh Gupta (guptapratykshh):** Express API and MongoDB models, geospatial matching and atomic claims, rescue escalation + EventBridge tick handler, ShareTable Assistant propose/confirm flows, S3 photo-url route, Bedrock/Groq LLM wiring, App Runner + ECR deploy, API tests, and `/api/health` runtime checks.

### Second team member's contributions *(required)*

**Divyanshi Talreja (the-ivii):** React + Vite UI, donate/claim/register flows, Leaflet maps and location picker, dashboards and admin console, assistant panel UX, branding/theme, and packaging the client into the App Runner Docker image. Public repo owner: https://github.com/the-ivii/ShareTable

### 5. Help us evaluate you: what you didn’t like *(required)*

- **App Runner memory (0.5 GB):** too small to host a local LLM, so we could not run Ollama in-container and had to call an external model API.
- **Bedrock access gating:** Nova Micro is integrated via Converse, but account verification blocked production use on the hackathon timeline, so we kept `LLM_PROVIDER=groq` live.
- **CloudFront:** account verification also blocked putting a CDN in front of the static web bucket, so demos use the App Runner URL directly.
- **Deploy loop:** ECR rebuild + App Runner redeploy is slow for tiny UI fixes compared with local Vite.
- **Statelessness:** assistant pending confirmations are process-local memory; an App Runner restart drops them, which pushed us toward shorter pending lifetimes and clear Confirm / Cancel UX.
- **EventBridge API destinations:** short timeouts forced the rescue-tick handler to stay fast and idempotent, and schedule vs app logs live in different consoles.

### 6. What did you like about the AWS services you used? *(required)*

- **App Runner:** one HTTPS URL for frontend and API from a single Dockerfile, with a clear `runtime: ap-runner` health signal for judges.
- **ECR + App Runner:** push `sharetable:latest` and roll a new deployment without managing EC2.
- **S3 + presigned PUT:** meal photo uploads never need AWS keys in the browser.
- **EventBridge:** minute rule `sharetable-rescue-tick` makes 2.5 → 4 → 6 km escalation work even when nobody is refreshing nearby.
- **Bedrock SDK (Converse):** clean env flip to Nova Micro (`LLM_PROVIDER=bedrock`) once access is approved, without rewriting product flows.
- **ap-south-1:** fits a Bengaluru campus food-rescue demo (Polaris-area seed data).

---

## Video checklist

- [x] Core demo recorded (landing, donate, claim, admin, App Runner, S3, assistant)
- [x] Problem-statement intro in `docs/artifacts/ShareTable-FirstCommit-demo.mp4`
- [ ] Upload MP4 to YouTube (public or unlisted)
- [ ] Prefer a short EventBridge `sharetable-rescue-tick` / health `runtime: ap-runner` insert if re-editing (optional but strong)

### Problem intro line (already in final MP4)

College messes and restaurants throw away leftover food because nearby NGOs never get a fast signal. ShareTable lets donors post surplus within 2.5 km, recipients claim in one hour, and only confirmed pickups count as rescued. Live on AWS App Runner in ap-south-1.

---

## Submit steps

1. Open https://www.wemakedevs.org/aws/first-commit/submit
2. Paste GitHub: `https://github.com/the-ivii/ShareTable`
3. Paste YouTube link after upload
4. Paste answers 2–6 from this file
5. Submit before 8 PM IST
