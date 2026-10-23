// mongosh script, single-node replica set exclusively for this local stack.
try {
  const config = rs.conf();
  if (
    config._id !== "rs0" ||
    config.members.length !== 1 ||
    config.members[0].host !== "playback-mongodb:27017"
  ) {
    throw new Error("Existing replica set differs from the local stack contract");
  }
} catch (error) {
  if (error.code !== 94 && error.codeName !== "NotYetInitialized") throw error;
  const result = rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "playback-mongodb:27017" }] });
  if (!result.ok) throw new Error("Replica initiation failed");
}
let primary = false;
for (let attempt = 0; attempt < 60; attempt++) {
  if (db.hello().isWritablePrimary) {
    primary = true;
    break;
  }
  sleep(1000);
}
if (!primary) throw new Error("Playback replica set did not elect a primary");
print("Playback rs0 ready (PRIMARY)");
