# AWS deployment files

| File | Use |
|---|---|
| `cloudformation-frontend.yaml` | Private S3 + CloudFront (OAC) + SPA error responses for the React build |
| `apprunner.yaml` | Backend on App Runner (source-based, Python 3.11, secrets from Secrets Manager) |
| `.ebextensions/`, `.platform/` | Backend on Elastic Beanstalk (copy into `backend/` bundle; `backend/Procfile` starts uvicorn) |
| `ec2-setup.sh` | Backend on a single EC2 (systemd + nginx); you create `/etc/creatorhub/backend.env` |
| `iam-policy-example.json` | Least-privilege example; replace the placeholders |

No credentials are stored here. Use IAM roles, Secrets Manager or Parameter Store. Full guide: `docs/deployment/AWS_DEPLOYMENT.md`.
Free Tier terms change; verify on the AWS pricing page and set a billing alarm first.
