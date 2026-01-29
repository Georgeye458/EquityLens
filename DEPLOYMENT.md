# EquityLens Deployment Guide

This guide covers deploying EquityLens to Heroku as two separate applications (backend API and frontend).

## Prerequisites

- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed and logged in
- Git installed
- A Heroku account with billing enabled (for add-ons)
- SCX.ai API key

## Git Remotes Setup

The project uses three git remotes:

| Remote | URL | Purpose |
|--------|-----|---------|
| `origin` | https://github.com/Georgeye458/EquityLens.git | GitHub repository |
| `heroku` | https://git.heroku.com/equitylens-api.git | Backend Heroku app |
| `heroku-frontend` | https://git.heroku.com/equitylens-frontend.git | Frontend Heroku app |

### Setting Up Remotes

```bash
# Add GitHub remote (already set if cloned)
git remote add origin https://github.com/Georgeye458/EquityLens.git

# Add Heroku backend remote
git remote add heroku https://git.heroku.com/equitylens-api.git

# Add Heroku frontend remote
git remote add heroku-frontend https://git.heroku.com/equitylens-frontend.git

# Verify remotes
git remote -v
```

## Initial Heroku Setup

### Create Heroku Apps

```bash
# Create backend app
heroku create equitylens-api

# Create frontend app
heroku create equitylens-frontend
```

### Configure Backend

```bash
# Add PostgreSQL database
heroku addons:create heroku-postgresql:essential-0 -a equitylens-api

# Set environment variables
heroku config:set SCX_API_KEY=your-scx-api-key -a equitylens-api
heroku config:set SCX_API_BASE_URL=https://api.scx.ai/v1 -a equitylens-api
heroku config:set SCX_MODEL=llama-4 -a equitylens-api
heroku config:set SECRET_KEY=your-secret-key-here -a equitylens-api
heroku config:set ALLOWED_ORIGINS=https://equitylens-frontend.herokuapp.com -a equitylens-api

# Verify configuration
heroku config -a equitylens-api
```

### Configure Frontend

```bash
# Set environment variables
heroku config:set VITE_API_URL=https://equitylens-api.herokuapp.com -a equitylens-frontend

# Set Node.js version
heroku config:set NODE_OPTIONS=--max_old_space_size=2560 -a equitylens-frontend

# Verify configuration
heroku config -a equitylens-frontend
```

## Deployment Commands

### Push to GitHub

```bash
git push origin master
```

### Deploy Backend to Heroku

Using git subtree to push only the backend folder:

```bash
git subtree push --prefix backend heroku main
```

### Deploy Frontend to Heroku

Using git subtree to push only the frontend folder:

```bash
git subtree push --prefix frontend heroku-frontend main
```

## Force Push (If Needed)

If you encounter issues with subtree push, use force push:

### PowerShell

```powershell
# Force push backend
$split = git subtree split --prefix backend master
git push heroku "${split}:main" --force

# Force push frontend
$split = git subtree split --prefix frontend master
git push heroku-frontend "${split}:main" --force
```

### Bash/Unix

```bash
# Force push backend
git push heroku $(git subtree split --prefix backend master):main --force

# Force push frontend
git push heroku-frontend $(git subtree split --prefix frontend master):main --force
```

## Post-Deployment

### Initialize Database

The database tables are created automatically on first startup. To manually run migrations:

```bash
heroku run python -c "from app.services.database import init_db; import asyncio; asyncio.run(init_db())" -a equitylens-api
```

### Enable pgvector Extension

```bash
heroku pg:psql -a equitylens-api
# Then run:
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

### Check Logs

```bash
# Backend logs
heroku logs --tail -a equitylens-api

# Frontend logs
heroku logs --tail -a equitylens-frontend
```

### Scale Dynos

```bash
# Scale backend
heroku ps:scale web=1 -a equitylens-api

# Scale frontend
heroku ps:scale web=1 -a equitylens-frontend
```

## URLs

After deployment, your apps will be available at:

- **Backend API**: https://equitylens-api.herokuapp.com
- **Frontend App**: https://equitylens-frontend.herokuapp.com
- **API Health Check**: https://equitylens-api.herokuapp.com/health

## Troubleshooting

### Backend Issues

1. **Database connection errors**
   ```bash
   heroku pg:info -a equitylens-api
   heroku pg:diagnose -a equitylens-api
   ```

2. **Worker timeout**
   - Check if document processing is taking too long
   - Consider using background workers for large documents

3. **Memory issues**
   ```bash
   heroku logs --tail -a equitylens-api | grep Memory
   ```

### Frontend Issues

1. **Build failures**
   ```bash
   heroku logs -a equitylens-frontend | grep error
   ```

2. **API connection issues**
   - Verify VITE_API_URL is set correctly
   - Check CORS settings in backend

### Common Fixes

```bash
# Restart apps
heroku restart -a equitylens-api
heroku restart -a equitylens-frontend

# Clear build cache
heroku plugins:install heroku-builds
heroku builds:cache:purge -a equitylens-frontend

# Check dyno status
heroku ps -a equitylens-api
heroku ps -a equitylens-frontend
```

## CI/CD Considerations

For automated deployments, consider:

1. **GitHub Actions** - Trigger deploys on push to master
2. **Heroku Pipeline** - Set up review apps for PRs

Example GitHub Action:

```yaml
name: Deploy to Heroku

on:
  push:
    branches: [master]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      - name: Deploy to Heroku
        run: |
          git push https://heroku:${{ secrets.HEROKU_API_KEY }}@git.heroku.com/equitylens-api.git \
            $(git subtree split --prefix backend master):main --force

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      - name: Deploy to Heroku
        run: |
          git push https://heroku:${{ secrets.HEROKU_API_KEY }}@git.heroku.com/equitylens-frontend.git \
            $(git subtree split --prefix frontend master):main --force
```

## Security Notes

1. Never commit `.env` files
2. Use Heroku config vars for all secrets
3. Enable SSL (automatic on Heroku)
4. Regularly rotate API keys
5. Monitor for unusual activity

## Cost Optimization

- **Basic Dynos**: Start with basic dynos ($7/month each)
- **Database**: Use Essential-0 for development ($5/month)
- **Scale Down**: Use `heroku ps:scale web=0` when not in use

## Support

For deployment issues:
1. Check Heroku status: https://status.heroku.com
2. Review application logs
3. Contact the development team
