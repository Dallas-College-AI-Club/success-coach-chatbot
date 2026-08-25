#!/usr/bin/env bash
# Deploy the demo build to Vercel and print a shareable link.
#
# Run from apps/frontend:   bash scripts/deploy-demo.sh
#
# You paste your own OpenRouter key when prompted — it goes straight into
# Vercel's encrypted env store and is never written to disk here.

set -euo pipefail

# ── Change these two if you want a different model or subdomain ────────────
MODEL="openai/gpt-4o-mini"
ALIAS="major-demo"          # becomes https://major-demo.vercel.app
# ───────────────────────────────────────────────────────────────────────────

if [ ! -f package.json ] || ! grep -q '"name": "frontend"' package.json; then
  echo "Run this from apps/frontend." >&2
  exit 1
fi

echo "==> 1/6  Verifying the build passes before we spend time deploying"
npm run build

echo
echo "==> 2/6  Vercel sign-in (skipped if you're already logged in)"
npx vercel whoami >/dev/null 2>&1 || npx vercel login

echo
echo "==> 3/6  Linking the project"
echo "         Answer 'no' to 'link to existing project?' the first time."
npx vercel link

echo
echo "==> 4/6  Environment variables"
echo "         Each prompt asks which environments — choose Production."
echo

# Non-secret values are piped in so you can't typo them.
printf '%s' "https://openrouter.ai/api/v1" | npx vercel env add LLM_BASE_URL production || true
printf '%s' "$MODEL"                       | npx vercel env add LLM_MODEL     production || true

echo
echo "         Now the two secrets. Paste each when asked:"
echo "           OPENROUTER_API_KEY  — your key from openrouter.ai/settings/keys"
echo "                                 (must have credits; a ':free' model is NOT enough)"
npx vercel env add OPENROUTER_API_KEY production || true
echo "           DATABASE_URL        — the Neon POOLED string (host contains '-pooler')"
npx vercel env add DATABASE_URL production || true

echo
echo "==> 5/6  Deploying to production"
# vercel prints the deployment URL as its last stdout line.
DEPLOY_URL=$(npx vercel --prod | tail -1)
echo "    deployed: ${DEPLOY_URL}"

echo
echo "==> 6/6  Claiming the short alias"
if npx vercel alias set "$DEPLOY_URL" "${ALIAS}.vercel.app"; then
  echo "    https://${ALIAS}.vercel.app"
else
  echo "    Alias failed — run manually:"
  echo "      npx vercel alias set ${DEPLOY_URL} ${ALIAS}.vercel.app"
fi

echo
echo "Done. Before you present:"
echo "  1. Open the link yourself and send one message — warms the cold start"
echo "     and the MiniLM download into /tmp (first request is slow, once)."
echo "  2. Ask something that hits the catalog, e.g."
echo "     'What do I need for an A.A. in Computer Science?'"
echo "     A real answer with a source means the database is wired up."
echo "  3. Check spend at openrouter.ai/credits after a few messages."
