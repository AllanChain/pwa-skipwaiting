# `skipWaiting()` with `StaleWhileRevalidate` the right way

[View Post on Blog](https://allanchain.github.io/blog/post/pwa-skipwaiting)

> It is common to use workbox `StaleWhileRevalidate` strategy  to cache resources which may take some time to fetch. Usually the resource needs to be updated but not immediately. However if the resource request takes too much time to complete, service worker's life cycle and some functionality may be impacted, especially `self.skipWaiting()`.

---

## Why `skipWaiting` is important?

By default, a service worker takes over the page from start to end, even if new service worker is discovered and installed. This behavior ensures consistency. However if the update is important and does not have conflict with the old one, you may want the new one to activate as soon as installed.

Another use case is click to refresh feature. Remember the old service worker is still in charge even though refreshing the page. To update the PWA app without leaving it, skip the waiting phase of new service worker is needed. Thus after `location.reload()`, new service worker with new precached assets are there. We will focus on this use case in this post.

## How to `skipWaiting` without `StaleWhileRevalidate` strategy

As you may seen in many [documentations](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting#example) and tutorials, it is quite straightforward:

```js
// normal/service-worker.js

// Change this line to make service worker different

self.addEventListener('message', (event) => {
  const message = event.data
  if (!message) return
  if (message.type === 'skip-waiting') {
    console.log('trigger skipWaiting at', +new Date())
    self.skipWaiting()
  }
}
```

You may need to change the comment line to test skip waiting again.

### Complete code for demonstration

Let's add a simple server and some HTML to complete the PWA and  simulate a slow request.

> :notebook: Note:
>
> You can find complete code in my [GitHub repo](https://github.com/AllanChain/pwa-skipwaiting)

```html
<!-- body part of normal/index.html -->

<p><span id="action">No</span> long running request</p>
<button id="upgrade" disabled>Click to skip waiting</button>
<script>
  let newWorker
  const button = document.getElementById('upgrade')
  const listenStage = () => {
    console.log(newWorker.state, +new Date())
    if (newWorker.state === 'installed') {
      button.removeAttribute('disabled')
    } else if (newWorker.state === 'activated') {
      location.reload()
    }
  }
  navigator.serviceWorker.register('./service-worker.js').then((swr) => {
    if (swr.waiting) {
      newWorker = swr.waiting
      newWorker.onstatechange = listenStage
      listenStage() // Trigger installed
    }
    swr.onupdatefound = () => {
      newWorker = swr.installing
      newWorker.onstatechange = listenStage
    }
  })
  button.addEventListener('click', function () {
    // If there is a slow request when upgrading
    const actionElement = document.getElementById('action')
    actionElement.innerText = 'Doing'
    fetch('slow.json').then(() => (actionElement.innerText = 'Done'))

    // Ensure slow request is alive
    setTimeout(() => newWorker.postMessage({ type: 'skip-waiting' }), 100)
    this.setAttribute('disabled', true)
  })
</script>
```

The above code might be a little bit long. It does 3 things:

- register service worker
- watch state change of new service worker
    - log them
    - enable button when ready (installed)
    - refresh page when new worker activated
- send skip-waiting message while performing a slow request

```js
// index.js

const http = require('http')
const statik = require('node-static')

const file = new statik.Server('.')

http.createServer(function (req, res) {
  // Simulate slow request
  if (req.url.endsWith('/slow.json')) {
    setTimeout(() => {
      res.writeHead(200)
      res.end('{}')
    }, 4000)
    return
  }
  file.serve(req, res)
}
).listen(8345)

console.log('Listening on http://localhost:8345')
```

The server is pretty straightforward, using [node-static](https://www.npmjs.com/package/node-static) to serve files.

A `favicon.ico` is also needed to avoid `favicon.ico` not found error.

Now run `index.js` and:

1. open <http://localhost:8345/normal/>
2. wait service worker installed and close page
3. change `service-worker.js`
4. open the page again
5. open the console, check "Preserve log"
6. click the "Click to skip waiting" button
7. change `service-worker.js`, manually reload page and test again

You may found something like this in console:

```
(index):16 installed 1624852106984
service-worker.js:7 trigger skipWaiting at 1624852110391
(index):16 activating 1624852110391
activated 1624852110393
```

Then page reloads, the button stay disabled because the new service worker is active and no service worker waiting.

Open Network tab, you can see `slow.json` is canceled because of page refresh. Or in Firefox it's directly logged into console:

```
installed 1624852139119 normal:16:17
trigger skipWaiting at 1624852141791 service-worker.js:7:13
activating 1624852141795 normal:16:17
activated 1624852141797 normal:16:17
Uncaught (in promise) TypeError: NetworkError when attempting to fetch resource.
```

This is intended because you almost always want to cancel fetching when refreshing the page. But that's where the problem lies when using `StaleWhileRevalidate` strategy

## Still waiting after `skipWaiting`, when `StaleWhileRevalidate`

Now let's add `StaleWhileRevalidate` strategy:

```diff
diff --color -u normal/index.html stuck/index.html
--- normal/index.html   2021-06-28 11:46:20.464842200 +0800
+++ stuck/index.html    2021-06-28 11:44:19.298915100 +0800
@@ -4,7 +4,7 @@
     <meta charset="UTF-8" />
     <meta http-equiv="X-UA-Compatible" content="IE=edge" />
     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
-    <title>Normal</title>
+    <title>Stuck</title>
   </head>
   <body>
     <p><span id="action">No</span> long running request</p>
diff --color -u normal/service-worker.js stuck/service-worker.js
--- normal/service-worker.js    2021-06-28 11:48:22.461331300 +0800
+++ stuck/service-worker.js     2021-06-28 11:44:30.814991700 +0800
@@ -1,4 +1,14 @@
-// Change this line to make service worker differenta
+/* global workbox, importScripts */
+
+// Change this line to make service worker different
+
+importScripts('https://storage.googleapis.com/workbox-cdn/releases/4.3.1/workbox-sw.js')
+
+workbox.routing.registerRoute(
+  /\.json/,
+  new workbox.strategies.StaleWhileRevalidate(),
+  'GET'
+)

 self.addEventListener('message', (event) => {
   const message = event.data
```

open <http://localhost:8345/stuck/>, repeat the above steps. Here is the example output:

```
(index):16 installed 1624853106784
workbox-core.dev.js:45 workbox Router is responding to: /stuck/slow.json
service-worker.js:17 trigger skipWaiting at 1624853112301
workbox-core.dev.js:45 workbox Using StaleWhileRevalidate to respond to '/stuck/slow.json'
workbox-core.dev.js:45 No response found in the 'workbox-runtime-http://localhost:8345/stuck/' cache. Will wait for the network response.
workbox-core.dev.js:45 View the final response here.
(index):16 activating 1624853116470
(index):16 activated 1624853117482
Navigated to http://localhost:8345/stuck/
```

The new service worker is not activated until the request completes. Even if resource is cached:

```
(index):16 installed 1624853346141
workbox-core.dev.js:45 workbox Router is responding to: /stuck/slow.json
workbox-core.dev.js:45 workbox Using StaleWhileRevalidate to respond to '/stuck/slow.json'
service-worker.js:17 trigger skipWaiting at 1624853348949
(index):16 activating 1624853352867
(index):16 activated 1624853353871
```

Though cached, `StaleWhileRevalidate` strategy still revalidates the resource in the background. Thus the old service worker is unable to stop until the request finishes.

## The solution

It's natural to think of aborting the request in the old service worker. Let's add `AbortController`. Notice that you need to let **new** service worker to skip waiting, and let **old** service worker to abort fetches. Don't get confused.

```diff
diff --color -u stuck/index.html solution/index.html
--- stuck/index.html    2021-06-28 11:44:19.298915100 +0800
+++ solution/index.html 2021-06-28 12:18:54.089259800 +0800
@@ -4,13 +4,13 @@
     <meta charset="UTF-8" />
     <meta http-equiv="X-UA-Compatible" content="IE=edge" />
     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
-    <title>Stuck</title>
+    <title>Solution</title>
   </head>
   <body>
     <p><span id="action">No</span> long running request</p>
     <button id="upgrade" disabled>Click to skip waiting</button>
     <script>
-      let newWorker
+      let newWorker, oldWorker
       const button = document.getElementById('upgrade')
       const listenStage = () => {
         console.log(newWorker.state, +new Date())
@@ -21,6 +21,7 @@
         }
       }
       navigator.serviceWorker.register('./service-worker.js').then((swr) => {
+        oldWorker = swr.active
         if (swr.waiting) {
           console.log('Waiting...')
           newWorker = swr.waiting
@@ -38,7 +39,10 @@
         fetch('slow.json').then(() => (actionElement.innerText = 'Done'))

         // Ensure slow request is alive
-        setTimeout(() => newWorker.postMessage({ type: 'skip-waiting' }), 100)
+        setTimeout(() => {
+          oldWorker.postMessage({ type: 'abort-connections' })
+          newWorker.postMessage({ type: 'skip-waiting' })
+        }, 100)
         this.setAttribute('disabled', true)
       })
     </script>
diff --color -u stuck/service-worker.js solution/service-worker.js
--- stuck/service-worker.js     2021-06-28 12:08:58.811435500 +0800
+++ solution/service-worker.js  2021-06-28 12:19:48.204055800 +0800
@@ -1,12 +1,16 @@
 /* global workbox, importScripts */

-// Change this line to make service worker different
+// Change this line to make service worker differenta

 importScripts('https://storage.googleapis.com/workbox-cdn/releases/4.3.1/workbox-sw.js')

+const controller = new AbortController()
+
 workbox.routing.registerRoute(
-  /\.json/,
-  new workbox.strategies.StaleWhileRevalidate(),
+  /.*/,
+  new workbox.strategies.StaleWhileRevalidate({
+    fetchOptions: { signal: controller.signal }
+  }),
   'GET'
 )

@@ -16,5 +20,7 @@
   if (message.type === 'skip-waiting') {
     console.log('trigger skipWaiting at', +new Date())
     self.skipWaiting()
+  } else if (message.type === 'abort-connections') {
+    controller.abort()
   }
 })
```

And the (truncated) output:

```
(index):16 installed 1624853994162
workbox-core.dev.js:45 workbox Router is responding to: /solution/slow.json
service-worker.js:21 trigger skipWaiting at 1624854001606
workbox-strategies.dev.js:1005 Uncaught (in promise) no-response: The strategy could not generate a response for 'http://localhost:8345/solution/slow.json'. The underlying error is AbortError: The user aborted a request..
    at StaleWhileRevalidate.makeRequest (https://storage.googleapis.com/workbox-cdn/releases/4.3.1/workbox-strategies.dev.js:1005:15)
(index):16 activating 1624854001616
(index):16 activated 1624854002627
Navigated to http://localhost:8345/solution/
```

The new service worker is immediately activated after aborting the request :tada:

## Bonus

If you open multiple tabs at the same time, and click the button, all of them are refreshed, avoiding potential conflict between new service worker and old page. If this is not the befavior you want, you can always change the condition for page reload.
