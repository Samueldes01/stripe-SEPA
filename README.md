# Stripe Webhook → Email (Cloud Run + Brevo)

## Secrets (Secret Manager)
Créez 4 secrets :
- STRIPE_WEBHOOK_SECRET = `whsec_...` (Stripe)
- BREVO_API_KEY = clé API Brevo (Transactional)
- MAIL_TO = destinataire, ex. `vous@domaine.com`
- MAIL_FROM = expéditeur validé sur Brevo, ex. `webhooks@domaine.com`

## Artifact Registry
```bash
gcloud artifacts repositories create cloud-run \
  --repository-format=docker \
  --location=europe-west1 \
  --description="Images Cloud Run"
