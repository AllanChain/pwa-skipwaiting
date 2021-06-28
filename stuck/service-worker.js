/* global workbox, importScripts */

// Change this line to make service worker different

importScripts('https://storage.googleapis.com/workbox-cdn/releases/4.3.1/workbox-sw.js')

workbox.routing.registerRoute(
  /\.json/,
  new workbox.strategies.StaleWhileRevalidate(),
  'GET'
)

self.addEventListener('message', (event) => {
  const message = event.data
  if (!message) return
  if (message.type === 'skip-waiting') {
    console.log('trigger skipWaiting at', +new Date())
    self.skipWaiting()
  }
})
