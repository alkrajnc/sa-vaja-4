const server = Bun.serve({
  port: 3000,
  routes: {
    "/api/status": new Response("OK"),
  },

  fetch(req) {
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running at ${server.url}`);
