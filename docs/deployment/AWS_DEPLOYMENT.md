# AWS Deployment

Optional, more advanced path. Files are in `deploy/aws/`. **AWS Free Tier terms change (and differ for accounts created at different dates): verify on the AWS pricing page and Free Tier page before using anything, and create a billing alarm/budget first.** Nothing below should be assumed permanently free.

## Architecture
```
Browser -> CloudFront (OAC) -> private S3 (React build)
Browser -> HTTPS -> App Runner | Elastic Beanstalk | EC2+nginx (FastAPI) -> RDS PostgreSQL or Supabase
Secrets: Secrets Manager / SSM Parameter Store -> backend via IAM role
```

## Cost awareness (verify current terms)
| Service | Role | Free-tier / cost note |
|---|---|---|
| S3 | frontend files | may have a limited free allowance; storage and requests are billed beyond it |
| CloudFront | CDN | may have a monthly free allowance; data transfer beyond it is billed |
| Amplify Hosting | alternative frontend hosting | build minutes/storage/transfer may be billed |
| App Runner | backend | generally billed for provisioned/active compute; may generate charges even when idle |
| EC2 | backend VM | some instance types may qualify for a limited time; EBS, public IPv4 and data transfer can be billed |
| Elastic Beanstalk | orchestrator (no fee itself) | you pay for the EC2, load balancer and other resources it creates; a load balancer can generate charges |
| Lambda | not used by default | has an allowance in some terms; would need an adapter such as Mangum |
| RDS | PostgreSQL | may have limited-time free usage; storage, backups, and running hours are billed after |
| Secrets Manager | secrets | typically billed per secret per month (may have a trial); SSM Parameter Store standard parameters are a cheaper option |
| Route 53 | DNS | hosted zones are billed monthly; domain registration is extra |
| Data transfer out | everything | beyond a small allowance is billed |

Set up: Billing console > Budgets > create a monthly cost budget with email alerts, and enable Free Tier usage alerts.

## 1-4. Database
Easiest: keep Supabase ([SUPABASE_SETUP.md](SUPABASE_SETUP.md)). Or RDS PostgreSQL 16: create in a private subnet, security group allowing only the backend, then run `psql "$DATABASE_URL" -f database/schema.sql` from a host that can reach it. Store `DATABASE_URL` and `JWT_SECRET` in Secrets Manager (`creatorhub/database-url`, `creatorhub/jwt-secret`) or Parameter Store. Variables: [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md). Never put AWS keys in the repo; use IAM roles. See `deploy/aws/iam-policy-example.json`.

## 5. Deploy the backend (pick one)
- **App Runner**: Console > Create service > source code repository > directory `backend`; use `deploy/aws/apprunner.yaml` values (runtime python311, build `pip install -r requirements.txt`, start uvicorn on port 8000). Attach an instance role allowed to read your secrets; set health check path `/health`.
- **Elastic Beanstalk**: `pip install awsebcli`; copy `deploy/aws/.ebextensions` and `.platform` into the `backend` folder (Procfile already there); `eb init` (Python 3.11 platform), `eb create`, then `eb setenv APP_ENV=production JWT_SECRET=... DATABASE_URL=... CORS_ORIGINS=... FRONTEND_URL=...`. Use a single-instance environment to avoid a load balancer cost.
- **EC2**: launch Ubuntu, open ports 80/443 (22 from your IP only), create `/etc/creatorhub/backend.env`, then `sudo REPO_URL=<repo> bash deploy/aws/ec2-setup.sh` and add HTTPS (certbot).

## 6. Configure the frontend API URL
`cd frontend && VITE_API_URL=https://<api-host>/api/v1 npm run build`

## 7. Deploy the frontend
```
aws cloudformation deploy --template-file deploy/aws/cloudformation-frontend.yaml \
  --stack-name creatorhub-frontend --parameter-overrides BucketName=<unique-name>
aws s3 sync frontend/dist s3://<unique-name> --delete
aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
```
The bucket is private; only CloudFront (OAC) reads it; 403/404 return `index.html` for SPA routes. Credentials come from your AWS CLI profile or SSO, never from files in the repo.

## 8. Configure CORS
Set `FRONTEND_URL` and `CORS_ORIGINS` to the CloudFront (or custom domain) HTTPS origin. No `*`.

## 9. Test authentication
```
curl -s -X POST $API/api/v1/auth/register -H "Content-Type: application/json" \
  -d '{"full_name":"Test User","email":"test@example.com","password":"ChangeMe123","role":"creator"}'
```
Expect `access_token`. Then log in through the web app. Register with role `admin` must return 422.

## 10. Test AI generation
Log in, open the AI generator, enter a topic. Without `OPENAI_API_KEY` the result is labelled "Sample content" (`is_sample: true`). With a key, a valid result needs a funded OpenAI account; failures show a friendly "temporarily unavailable" message (503 `AI_UNAVAILABLE`).

## 11. Test database operations
Create a content item, schedule it on the calendar, refresh the page and confirm it persists. In the database (psql or Supabase Table Editor), check `content` has the row. `GET $API/ready` should return `{"status":"ok"}`.

## 12. Test production
- `GET $API/health` returns 200; browser console shows no CORS errors.
- Deep-link (e.g. `/dashboard`) and refresh: the SPA must not 404.
- Logout, then reuse the old token: expect 401.
- Run through [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md).

## Clean up to stop charges
Delete the CloudFormation stack (empty the bucket first), App Runner/Beanstalk/EC2/RDS resources, secrets and any Elastic IPs.
