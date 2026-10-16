// Reads app.json as is. CHITO_BASE_URL (only set by the one-container Dockerfile) serves the web build under a
// sub-path such as /rider. Unset for Vercel and the Android builds, so they are unchanged.
module.exports = ({ config }) =>
  process.env.CHITO_BASE_URL ? { ...config, experiments: { ...config.experiments, baseUrl: process.env.CHITO_BASE_URL } } : config;
