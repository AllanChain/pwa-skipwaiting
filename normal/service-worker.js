// Change this line to make service worker differenta

self.addEventListener('message', (event) => {
  const message = event.data
  if (!message) return
  if (message.type === 'skip-waiting') {
    console.log('trigger skipWaiting at', +new Date())
    self.skipWaiting()
  }
})
