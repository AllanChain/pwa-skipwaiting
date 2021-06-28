/* global workbox, importScripts */

// Change this line to make service worker differenta

importScripts('https://storage.googleapis.com/workbox-cdn/releases/4.3.1/workbox-sw.js')

const controller = new AbortController()

workbox.routing.registerRoute(
  /.*/,
  new workbox.strategies.StaleWhileRevalidate({
    fetchOptions: { signal: controller.signal }
  }),
  'GET'
)

self.addEventListener('message', (event) => {
  const message = event.data
  if (!message) return
  if (message.type === 'skip-waiting') {
    console.log('trigger skipWaiting at', +new Date())
    self.skipWaiting()
  } else if (message.type === 'abort-connections') {
    controller.abort()
  }
})
