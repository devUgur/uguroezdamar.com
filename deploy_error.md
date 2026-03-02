12:52:44 AM: Next.js cache saved
12:52:45 AM: ​
12:52:45 AM: Functions bundling                                            
12:52:45 AM: ────────────────────────────────────────────────────────────────
12:52:45 AM: ​
12:52:45 AM: Packaging Functions from .netlify/functions-internal directory:
12:52:45 AM:  - ___netlify-server-handler/___netlify-server-handler.mjs
12:52:45 AM: ​
12:52:47 AM: ​
12:52:47 AM: (Functions bundling completed in 2s)
12:52:47 AM: ​
12:52:47 AM: Edge Functions bundling                                       
12:52:47 AM: ────────────────────────────────────────────────────────────────
12:52:47 AM: ​
12:52:47 AM: Packaging Edge Functions from .netlify/edge-functions directory:
12:52:47 AM:  - ___netlify-edge-handler-node-middleware
12:52:49 AM: Error: Failed to compile CJS module: /opt/build/repo/.netlify/edge-functions/___netlify-edge-handler-node-middleware/server/.next/server/middleware.js
12:52:49 AM:     at seedCJSModuleCacheAndReturnTarget (file:///opt/build/repo/.netlify/edge-functions/___netlify-edge-handler-node-middleware/edge-runtime/lib/cjs.ts:252:11)
12:52:49 AM:     at Module._resolveFilename (file:///opt/build/repo/.netlify/edge-functions/___netlify-edge-handler-node-middleware/edge-runtime/lib/cjs.ts:366:16)
12:52:49 AM:     at Module._load (node:module:498:27)
12:52:49 AM:     at Module.require (node:module:696:19)
12:52:49 AM:     at require (node:module:830:16)
12:52:49 AM:     at file:///opt/build/repo/.netlify/edge-functions/___netlify-edge-handler-node-middleware/server/node-middleware.js:270:24
12:52:49 AM: Caused by Error: Failed to load external module mongodb-bafbf586cb3129c0: Error: Failed to compile CJS module: /opt/build/repo/.netlify/edge-functions/___netlify-edge-handler-node-middleware/server/node_modules/.pnpm/mongodb@5.9.2/node_modules/mongodb/lib/index.js
12:52:49 AM:     at Context.externalRequire [as x] (/opt/build/repo/.netlify/edge-functions/___netlify-edge-handler-node-middleware/server/.next/server/chunks/[turbopack]_runtime.js:535:15)
12:52:49 AM:     at module evaluation (/opt/build/repo/.netlify/edge-functions/___netlify-edge-handler-node-middleware/server/.next/server/chunks/[externals]__c22d93a9._.js:1:928)
12:52:49 AM:     at instantiateModule (/opt/build/repo/.netlify/edge-functions/___netlify-edge-handler-node-middleware/server/.next/server/chunks/[turbopack]_runtime.js:740:9)
12:52:49 AM:     at getOrInstantiateModuleFromParent (/opt/build/repo/.netlify/edge-functions/___netlify-edge-handler-node-middleware/server/.next/server/chunks/[turbopack]_runtime.js:763:12)
12:52:49 AM:     at Context.esmImport [as i] (/opt/build/repo/.netlify/edge-functions/___netlify-edge-handler-node-middleware/server/.next/server/chunks/[turbopack]_runtime.js:228:20)
12:52:49 AM:     at module evaluation (/opt/build/repo/.netlify/edge-functions/___netlify-edge-handler-node-middleware/server/.next/server/chunks/[root-of-the-server]__8f6d0ef2._.js:26:37854)
12:52:49 AM:     at instantiateModule (/opt/build/repo/.netlify/edge-functions/___netlify-edge-handler-node-middleware/server/.next/server/chunks/[turbopack]_runtime.js:740:9)
12:52:49 AM:     at instantiateRuntimeModule (/opt/build/repo/.netlify/edge-functions/___netlify-edge-handler-node-middleware/server/.next/server/chunks/[turbopack]_runtime.js:768:12)
12:52:49 AM:     at getOrInstantiateRuntimeModule (/opt/build/repo/.netlify/edge-functions/___netlify-edge-handler-node-middleware/server/.next/server/chunks/[turbopack]_runtime.js:781:12)
12:52:49 AM:     at Object.m (/opt/build/repo/.netlify/edge-functions/___netlify-edge-handler-node-middleware/server/.next/server/chunks/[turbopack]_runtime.js:790:18)
12:52:49 AM: ​
12:52:49 AM: Bundling of edge function failed                              
12:52:49 AM: ────────────────────────────────────────────────────────────────
12:52:49 AM: ​
12:52:49 AM:   Error message
12:52:49 AM:   Could not load edge function at '/opt/build/repo/.netlify/edge-functions/___netlify-edge-handler-node-middleware/___netlify-edge-handler-node-middleware.js'. More on the Edge Functions API at https://ntl.fyi/edge-api.
12:52:49 AM: ​
12:52:49 AM:   Error location
12:52:49 AM:   While bundling edge function
12:52:49 AM: ​
12:52:49 AM:   Resolved config
12:52:49 AM:   build:
12:52:49 AM:     command: npm run build
12:52:49 AM:     commandOrigin: ui
12:52:49 AM:     environment:
12:52:49 AM:       - MONGODB_URI
12:52:49 AM:     publish: /opt/build/repo/.next
12:52:49 AM:     publishOrigin: ui
12:52:49 AM:   headers:
12:52:49 AM:     - for: /_next/static/*
      values:
        Cache-Control: public, max-age=31536000, immutable
  headersOrigin: inline
  plugins:
    - inputs: {}
      origin: ui
      package: "@netlify/plugin-nextjs"
  redirects:
    - from: /_next/image
      query:
        q: :quality
        url: :url
        w: :width
      status: 200
      to: /.netlify/images?url=:url&w=:width&q=:quality
    - from: /_ipx/*
      query:
        q: :quality
        url: :url
        w: :width
      status: 200
      to: /.netlify/images?url=:url&w=:width&q=:quality
  redirectsOrigin: inline
12:52:49 AM: Build failed due to a user error: Build script returned non-zero exit code: 2
12:52:49 AM: Failing build: Failed to build site
12:52:49 AM: Finished processing build request in 40.147s
12:52:49 AM: Failed during stage 'building site': Build script returned non-zero exit code: 2 (https://ntl.fyi/exit-code-2)