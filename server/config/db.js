
const mongoose = require("mongoose");

async function connectDB() {
  try {
    console.log("Connecting to MongoDB Atlas...");

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
    });

    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("\nMongoDB connection failed.");
    console.error("Error type:", error.name);
    console.error("Error code:", error.code || "N/A");
    console.error("Error message:", error.message);

    const servers = error.reason?.servers;

    if (servers) {
      for (const [host, details] of servers.entries()) {
        console.error("\nHost:", host);
        console.error("Underlying error type:", details.error?.name);
        console.error("Underlying error:", details.error?.message);
      }
    }

    throw error;
  }
}

module.exports = connectDB;
