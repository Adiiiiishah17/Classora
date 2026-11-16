const mongoose = require("mongoose");
const { pipeline } = require("stream/promises");

const isId = (id) => /^[a-f0-9]{24}$/i.test(String(id));
const toId = (id) => new mongoose.Types.ObjectId(String(id));
const bucket = (name) => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: name });

// Stores a readable stream and returns the new file's id (a string)
async function save(bucketName, readable, filename, mime) {
  const upload = bucket(bucketName).openUploadStream(filename, { metadata: { mime } });
  await pipeline(readable, upload);
  return String(upload.id);
}

async function info(bucketName, id) {
  if (!isId(id)) return null;
  const files = await bucket(bucketName).find({ _id: toId(id) }).limit(1).toArray();
  return files[0] || null;
}

const open = (bucketName, id) => bucket(bucketName).openDownloadStream(toId(id));

async function remove(bucketName, id) {
  if (!isId(id)) return;
  try {
    await bucket(bucketName).delete(toId(id));
  } catch (err) {
    if (!/FileNotFound/i.test(err.message)) console.error("Could not delete stored file:", err.message);
  }
}

module.exports = { isId, save, info, open, remove };