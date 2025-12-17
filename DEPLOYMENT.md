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
1. **GitHub Actions** (automatic):
   - Connect repository to Azure Static Web Apps
   - Uses `.github/workflows/deploy.yml` automatically

2. **Manual deployment**:
   ```bash
   npm run build
   az storage blob upload-batch -s dist -d '$web' --account-name yourstorageaccount
   ```

## 🔒 Security Configuration

### Required Headers
For WASM and SharedArrayBuffer support:
```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

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

### Lighthouse CI
```bash
# Run performance tests
npm install -g @lhci/cli
lhci autorun
```

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

The included GitHub Actions workflow:
1. **Builds** on Node.js 18 and 20
2. **Tests** all functionality
3. **Deploys** to Netlify and Cloudflare Pages
4. **Monitors** with Lighthouse CI

### Manual Triggers
```bash
# Trigger deployment
git tag v1.0.0
git push origin v1.0.0
```

## 📞 Support

For deployment issues:
1. Check the troubleshooting section above
2. Review browser console for errors
3. Verify all required headers are set
4. Test with a minimal reproduction case

---

**Note**: This application requires modern browser features (WASM, SharedArrayBuffer, Workers). Ensure your deployment platform supports these requirements.