# Stripe Webhook (Ruby/Sinatra) + Email via SendGrid sur Google Cloud Run

## Variables d'environnement à fournir
- STRIPE_API_KEY        = sk_test_... / sk_live_...
- STRIPE_WEBHOOK_SECRET = whsec_... (copié du Dashboard Stripe après ajout d'endpoint)
- SENDGRID_API_KEY      = votre clé SendGrid
- NOTIFY_EMAIL          = desplat.samuel@outlook.be   # (modifiable)
- FROM_EMAIL            = adresse vérifiée dans SendGrid (ex: noreply@votredomaine.com)

## Déploiement
```bash
PROJECT_ID=$(gcloud config get-value project)
REGION=europe-west1

gcloud builds submit --tag gcr.io/$PROJECT_ID/stripe-webhook-email-ruby

gcloud run deploy stripe-webhook-email-ruby \
  --image gcr.io/$PROJECT_ID/stripe-webhook-email-ruby \
  --platform=managed --region=$REGION --allow-unauthenticated \
  --set-env-vars STRIPE_API_KEY=sk_test_xxx,STRIPE_WEBHOOK_SECRET=whsec_xxx,SENDGRID_API_KEY=SG.xxxxxx,NOTIFY_EMAIL=desplat.samuel@outlook.be,FROM_EMAIL=noreply@votredomaine.com
