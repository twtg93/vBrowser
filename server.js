const express = require("express");
const sass = require("node-sass");
const app = express();
const fs = require('fs');
const showdown  = require('showdown'),
      converter = new showdown.Converter();
const http = require('http').createServer(app)
require('./proxyServer.js')(http);


// make all the files in 'public' available
// https://expressjs.com/en/starter/static-files.html
app.get('/*', function(req, res, next) {
  var url = req.url.split('.');
  var filename = req.url.split('/');
  filename = filename[filename.length-1];
  console.log(url[url.length-1]);
  switch (url[url.length-1]) {
    case 'scss':
      res.type('css');
      res.write(sass.renderSync({
        file: __dirname + '/public/' + filename
      }).css);
      res.end(); break;
    case 'md':
      res.send(converter.makeHtml(fs.readFileSync(__dirname + (filename == 'README.md' ? '/' : '/public/')  + filename, 'utf-8')) );
      break;
    default:
      express.static("public")(req, res, next);
  }
});

// https://expressjs.com/en/starter/basic-routing.html
app.get("/", (request, response) => {
  //response.redirect('/index.html');
  response.sendFile(__dirname + "/public/index.html");
});


http.listen(3000, () => {
  console.log('Your app is listening on port 3000');
});
