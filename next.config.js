/** @type {import('next').NextConfig} */

module.exports = {
  outputFileTracingRoot: __dirname,
  output: 'standalone',
  // In Docker, we want to bind to 0.0.0.0
  hostname: process.env.HOSTNAME || 'localhost',
  port: parseInt(process.env.PORT || '2225', 10),
};


