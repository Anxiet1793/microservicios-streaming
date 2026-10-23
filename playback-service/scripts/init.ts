import { container } from "../src/bootstrap/container";
import { initializeMongo } from "../src/modules/playback/infrastructure/mongo";
const c = container();
try {
  await initializeMongo(c.db);
  await c.storage.initialize();
  console.log(JSON.stringify({ status: "initialized", service: "playback-service" }));
} finally {
  await c.client.close();
}
