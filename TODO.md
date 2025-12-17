# TODO

1. Implement google tag manager, right after <head> it should be:

<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-TAG-HERE');</script>
<!-- End Google Tag Manager -->

And right after <body>

<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-TAG-HERE"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->

Or equvalent working exactly like that with React App.

GOOGLE_TAG_MANAGER env (or another one wirjing with chosen solution) should be used while building and deploying the application.

2. Fix build and configure deployment on Netlify

3. Show debug console only after certain keyboard combination, remember that it's displayed in local storage or other simmilar way

4. Implement scentry error reporting

import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://e2e8b92c12bfdf89bf28d0847e8b3c6c@o93080.ingest.us.sentry.io/4510552255823872",
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true
});

const container = document.getElementById("app");
const root = createRoot(container);
root.render(<App />);

5. Add link to buy me a coffe / sponsor page

6. Create article on Medium to promote the service

