if (process.env.SERVICE_ROLE === "worker") {
  import("./queue/worker");
} else {
  import("./server");
}
