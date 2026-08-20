importScripts("csvProcessor.js");
self.onmessage = function (event) {
  try {
    const result = self.BancaTrackerCsvProcessor.process(event.data.text, event.data.config, (progress) => self.postMessage({ type: "progress", ...progress }));
    self.postMessage({ type: "complete", result });
  } catch (error) { self.postMessage({ type: "error", message: error.message || "Worker processing failed." }); }
};
