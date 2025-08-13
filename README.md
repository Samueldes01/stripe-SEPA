# Stripe Webhook → Email (Cloud Run + Brevo)

## Secrets à créer (Secret Manager)
- STRIPE_WEBHOOK_SECRET = whsec_...
- BREVO_API_KEY = clé API Brevo
- MAIL_TO = destinataire (ex. desplat72@gmail.com)
- MAIL_FROM = expéditeur validé Brevo (ex. desplat72@gmail.com)

## Artifact Registry
gcloud artifacts repositories create cloud-run \
  --repository-format=docker \
  --location=europe-west1 \
  --description="Images Cloud Run"

## Trigger Cloud Build
- Cloud Build → Triggers → Connect Repository (GitHub App)
- Trigger On push sur `main`, fichier de config `cloudbuild.yaml`

## Test local
npm install
PORT=8080 STRIPE_WEBHOOK_SECRET=whsec_test \
BREVO_API_KEY=xxx MAIL_TO=you@example.com MAIL_FROM=you@example.com \
node index.js

stripe listen --forward-to localhost:8080/webhook
stripe trigger payment_intent.processing
