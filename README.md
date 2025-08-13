# Stripe Webhook avec envoi d'email (SendGrid) sur Google Cloud Run

## Variables d'environnement à configurer
- STRIPE_API_KEY = sk_test_...
- STRIPE_WEBHOOK_SECRET = whsec_... (copié depuis le Dashboard Stripe après ajout du webhook)
- SENDGRID_API_KEY = clé API SendGrid
- NOTIFY_EMAIL = ton adresse email de réception
- FROM_EMAIL = adresse d'expéditeur validée dans SendGrid

## Déploiement
```bash
PROJECT_ID=$(gcloud config get-value project)
REGION=europe-west1

gcloud builds submit --tag gcr.io/$PROJECT_ID/stripe-webhook-email

gcloud run deploy stripe-webhook-email \
  --image gcr.io/$PROJECT_ID/stripe-webhook-email \
  --platform=managed --region=$REGION --allow-unauthenticated \
  --set-env-vars STRIPE_API_KEY=sk_test_xxx \
  --set-env-vars STRIPE_WEBHOOK_SECRET=whsec_xxx \
  --set-env-vars SENDGRID_API_KEY=SG.xxxxx \
  --set-env-vars NOTIFY_EMAIL=toi@exemple.com \
  --set-env-vars FROM_EMAIL=noreply@tondomaine.com
