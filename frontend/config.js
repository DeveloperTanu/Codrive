// Deployment configuration. Change only this value when publishing the static
// frontend; every authenticated page reads its API address from this file.
//
// Local development: http://localhost:4000/api
// Production example: https://api.your-domain.com/api
window.CODRIVE_CONFIG = {
  apiBase: ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:4000/api"
    : "/api",
};
