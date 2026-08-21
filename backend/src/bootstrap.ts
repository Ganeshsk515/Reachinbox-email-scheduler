if (process.env.SERVICE_ROLE === "worker") {
  require("./queue/worker");
} else {
  require("./server");
}
