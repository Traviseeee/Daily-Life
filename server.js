const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const root = __dirname;
const port = Number(process.env.PORT || 5500);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const server = http.createServer((request, response) => {
  const urlPath = decodeURIComponent(request.url.split("?")[0]);
  const requested = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(root, requested));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("File not found");
      return;
    }

    response.writeHead(200, { "Content-Type": types[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
    response.end(content);
  });
});

server.listen(port, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${port}`;
  console.log(`MYLIFE is running at ${url}`);
  console.log("Keep this window open while using the app.");
  exec(`start "" "${url}"`);
});

server.on("error", error => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Close the other server or run with a different PORT.`);
  } else {
    console.error(error.message);
  }
  process.exit(1);
});
