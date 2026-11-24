// Vercel entry: the Express app without listen(). All requests are rewritten here (vercel.json).
// The TypeScript sources are compiled to dist/ by buildCommand; laptops and VPSs use src/server.ts.
const { createServerlessApp } = require('../dist/serverless');

module.exports = createServerlessApp();
