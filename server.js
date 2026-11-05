const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Base landing route to check if the service is alive
app.get('/', (req, res) => {
    res.send(`
        <h1>Advanced Web Proxy</h1>
        <p>Use the path below to route your requests:</p>
        <code>${req.protocol}://${req.get('host')}/service/YOUR_TARGET_URL</code>
    `);
});

// Dynamic proxy engine middleware
app.use('/service/:targetUrl*', (req, res, next) => {
    const rawTarget = req.params.targetUrl + (req.params[0] || '');
    
    if (!rawTarget) {
        return res.status(400).json({ error: 'No target URL provided.' });
    }

    // Ensure the target URL has a proper protocol prefix
    let targetBase = rawTarget;
    if (!/^https?:\/\//i.test(targetBase)) {
        targetBase = 'https://' + targetBase;
    }

    try {
        const parsedTarget = new URL(targetBase);
        const originUrl = parsedTarget.origin;

        // Configure the proxy middleware instance
        const dynamicProxy = createProxyMiddleware({
            target: originUrl,
            changeOrigin: true,         // Rewrites the 'Host' header to match the destination
            followRedirects: true,      // Automatically follows 301/302 redirects
            secure: true,               // Verifies SSL certificates
            
            // Modify request headers before they are sent to the target
            on: {
                proxyReq: (proxyReq, req, res) => {
                    // Spoof standard browser headers to avoid automated scraping blocks
                    proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                    proxyReq.setHeader('Accept-Language', 'en-US,en;q=0.9');
                    proxyReq.setHeader('Referer', originUrl);
                    proxyReq.setHeader('Origin', originUrl);
                },
                proxyRes: (proxyRes, req, res) => {
                    // Bypass strict Content Security Policies (CSP) and CORS that block third-party rendering
                    delete proxyRes.headers['content-security-policy'];
                    delete proxyRes.headers['content-security-policy-report-only'];
                    delete proxyRes.headers['x-frame-options'];
                    
                    // Allow your proxy to read and render the content across domains
                    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
                    proxyRes.headers['Access-Control-Allow-Headers'] = '*';
                },
                error: (err, req, res) => {
                    console.error('Proxy Error:', err.message);
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Proxy forwarding failed.', details: err.message });
                    }
                }
            },
            
            // Adjust paths so assets route through the proxy domain recursively
            pathRewrite: (path, req) => {
                // Strips the internal /service/prefix matching sequence
                return path.replace(/^\/service\/[^/]+/, '');
            }
        });

        // Execute the proxy configuration for this request
        dynamicProxy(req, res, next);

    } catch (error) {
        return res.status(400).json({ error: 'Invalid destination URL structure.' });
    }
});

// Start listening
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Advanced Proxy online at port ${PORT}`);
});
