const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const root = path.resolve(__dirname, "..");
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

  // Run the existing Vercel-style handlers locally as well as serving static files.
  const apiMatch = urlPath.match(/^\/api\/([a-z0-9-]+)(?:\.js)?$/i);
  if (apiMatch) {
    const apiFile = path.join(root, "api", `${apiMatch[1]}.js`);
    let handler;
    try {
      handler = require(apiFile);
    } catch (error) {
      if (error.code === "MODULE_NOT_FOUND" && error.message.includes(apiFile)) {
        response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "not_found" }));
        return;
      }
      console.error(`MYLIFE API load failed (${apiMatch[1]}).`, error.message);
      response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "api_load_failed" }));
      return;
    }

    const chunks = [];
    let bodySize = 0;
    request.on("data", chunk => {
      bodySize += chunk.length;
      if (bodySize > 10 * 1024 * 1024) {
        response.writeHead(413, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "too_large" }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", async () => {
      if (response.writableEnded) return;
      let body = {};
      if (bodySize) {
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          response.end(JSON.stringify({ error: "invalid_json" }));
          return;
        }
      }

      const apiResponse = {
        status(code) {
          response.statusCode = code;
          return this;
        },
        setHeader(name, value) {
          response.setHeader(name, value);
          return this;
        },
        json(data) {
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(JSON.stringify(data));
          return this;
        }
      };

      try {
        const query = Object.fromEntries(new URL(request.url, "http://127.0.0.1").searchParams);
        await handler({ method: request.method, headers: request.headers, body, query }, apiResponse);
        if (!response.writableEnded) response.end();
      } catch (error) {
        console.error(`MYLIFE API request failed (${apiMatch[1]}).`, error.message);
        if (!response.headersSent) response.statusCode = 500;
        if (!response.writableEnded) {
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(JSON.stringify({ error: "internal_error" }));
        }
      }
    });
    return;
  }

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
