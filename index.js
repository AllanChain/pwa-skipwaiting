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
