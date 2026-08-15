# PDF Toolkit - Deployment Guide

This guide covers various deployment options for the PDF Toolkit application.

## 🚀 Quick Deploy Options

### Netlify (Recommended)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/your-username/pdf-toolkit)

1. **One-click deploy**: Click the button above
2. **Manual deploy**: 
   ```bash
   npm run build
   npm run deploy:netlify
   ```

### Cloudflare Pages
1. Connect your GitHub repository to Cloudflare Pages
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Deploy automatically on push to main

### Vercel
```bash
npm i -g vercel
vercel --prod
```

## 🔧 Build Configuration

### Production Build
```bash
# Standard production build
npm run build

# Build with bundle analysis
npm run build:analyze

# Type checking only
npm run type-check
```

### Environment Variables
Create `.env.production` for production-specific settings:
```env
VITE_APP_TITLE=PDF Toolkit
VITE_APP_VERSION=1.0.0
VITE_ENABLE_ANALYTICS=true
```

## 🐳 Docker Deployment

### Local Docker
```bash
# Build and run
docker build -t pdf-toolkit .
docker run -p 3000:80 pdf-toolkit

# Or use docker-compose
docker-compose up --build
```

### Production Docker
```bash
# Build production image
docker build -t pdf-toolkit:latest .

# Run with proper headers for WASM
docker run -p 80:80 \
  --name pdf-toolkit \
  --restart unless-stopped \
  pdf-toolkit:latest
```

## ☁️ Cloud Deployment

### AWS S3 + CloudFront
1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Upload to S3**:
   ```bash
   aws s3 sync dist/ s3://your-bucket-name --delete
   ```

3. **Configure CloudFront**:
   - Origin: Your S3 bucket
   - Behavior: Redirect all to `index.html` for SPA routing
   - Headers: Add COOP and COEP headers for WASM support

### Google Cloud Storage + CDN
1. **Build and upload**:
   ```bash
   npm run build
   gsutil -m rsync -r -d dist/ gs://your-bucket-name
   ```

2. **Configure CDN**:
   - Enable Cloud CDN
   - Set cache policies for static assets
   - Configure headers for WASM support

### Azure Static Web Apps
```bash
npm run build
az storage blob upload-batch -s dist -d '$web' --account-name yourstorageaccount
```

## 🔒 Security Configuration

### Required Headers
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: cross-origin
```

`Cross-Origin-Embedder-Policy: require-corp` is **not** set. It only buys
`SharedArrayBuffer`, which this codebase does not use, and it blocks every
cross-origin frame without a CORP header — ad and analytics embeds included.
See the note in `netlify.toml`.

### Static output

`npm run build` runs `tsc`, `vite build`, then `scripts/prerender.mjs`, which
writes one HTML file per route (`dist/compress/index.html`, …) plus
`sitemap.xml` and `robots.txt`. Any host used here must serve
`dist/<route>/index.html` for `/<route>` and must **not** rewrite every path to
the root `index.html` — that would undo the prerendering.

### Content Security Policy
```
Content-Security-Policy: default-src 'self'; 
  script-src 'self' 'wasm-unsafe-eval'; 
  worker-src 'self' blob:; 
  connect-src 'self' blob:;
```

## 📊 Performance Optimization

### Build Optimizations
- **Code splitting**: Automatic with Vite
- **Tree shaking**: Enabled by default
- **WASM optimization**: Separate chunk for WASM files
- **Asset optimization**: Images and fonts optimized

### CDN Configuration
```javascript
// Recommended cache headers
{
  "/*.html": "no-cache",
  "/assets/*": "max-age=31536000, immutable",
  "/wasm/*": "max-age=31536000, immutable"
}
```

## 🧪 Testing Deployment

### Local Testing
```bash
# Build and preview locally
npm run build
npm run preview

# Test with Docker
docker-compose up
```

### Lighthouse
Netlify runs the Lighthouse plugin on production deploys — thresholds are in
the `[[context.production.plugins]]` block in `netlify.toml`.

### Load Testing
```bash
# Install artillery
npm install -g artillery

# Run load test
artillery quick --count 10 --num 5 https://your-domain.com
```

## 🔍 Monitoring

### Health Checks
- **Endpoint**: `/health` (Docker deployments)
- **Status**: Returns 200 OK when healthy

### Analytics
Configure analytics in production:
```javascript
// Add to index.html
if (import.meta.env.PROD) {
  // Your analytics code
}
```

### Error Monitoring
Consider integrating:
- Sentry for error tracking
- LogRocket for session replay
- Google Analytics for usage metrics

## 🚨 Troubleshooting

### Common Issues

**WASM not loading**:
- Check CORS headers are set correctly
- Verify MIME type for `.wasm` files
- Ensure COOP/COEP headers are present

**Workers not functioning**:
- Check if SharedArrayBuffer is available
- Verify worker files are served with correct headers
- Test in different browsers

**Large bundle size**:
- Use `npm run build:analyze` to identify large dependencies
- Consider lazy loading for heavy components
- Optimize WASM file sizes

### Debug Commands
```bash
# Check bundle size
npm run build:analyze

# Test production build locally
npm run preview

# Validate build output
ls -la dist/
```

## 📋 Deployment Checklist

- [ ] Build passes without errors
- [ ] All tests pass
- [ ] Lighthouse scores meet requirements
- [ ] WASM files load correctly
- [ ] Workers function properly
- [ ] SPA routing works
- [ ] Error boundaries catch issues
- [ ] Performance is acceptable
- [ ] Security headers are set
- [ ] Analytics are configured
- [ ] Health checks respond

## 🔄 CI/CD Pipeline

**Production deploys come from Netlify's own git integration.** Pushing to
`main` triggers a Netlify build that runs `npm run build` and publishes `dist`.
There is nothing else in the loop.

There used to be a `.github/workflows/deploy.yml` on top of that. It was
removed: across 18 runs it never once succeeded, it always died before the
build step, and its deploy jobs never executed as a result — so every
production deploy that has ever happened came from Netlify regardless. It also
carried a Cloudflare Pages job pointing at a project that does not exist and a
Lighthouse job auditing `pdf-toolkit.netlify.app` rather than this domain.

Before reintroducing CI, note that `npm run test` is currently red
independently of any of this — see TODO.md. A workflow that gates on it will
gate on nothing but its own failure. `npm run lint`, `npm run type-check` and
`npm run build` all pass and are the useful checks to run.

## 📞 Support

For deployment issues:
1. Check the troubleshooting section above
2. Review browser console for errors
3. Verify all required headers are set
4. Test with a minimal reproduction case

---

**Note**: This application requires modern browser features (WASM, SharedArrayBuffer, Workers). Ensure your deployment platform supports these requirements.