# Optional AWS packaging

Use this **only after** `npm run dev` can complete the 3-minute local demo.

CloudFront is not required for a hackathon. S3 + API Gateway + Lambda is enough.

```bash
cd server && npm run build && cd ..
sam build -t infrastructure/template.yaml
sam deploy --guided
```

Parameters: `DatabaseUrl`, `JwtSecret`, `ClientOrigin`.

Then build the frontend:

```bash
VITE_API_URL=https://YOUR_API.execute-api.REGION.amazonaws.com/prod npm run build -w client
```

Upload `client/dist` to an S3 website bucket if you want a public URL.
