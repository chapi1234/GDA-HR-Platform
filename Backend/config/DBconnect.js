import mongoose from "mongoose";

const connectDB = async (retries = 5) => {
  if (!process.env.MONGODB_URI) {
    console.error(
      "MONGODB_URI is not set. Add MONGODB_URI to Backend/.env and restart the server."
    );
    process.exit(1);
  }

  mongoose.connection.on("connected", () => {
    console.log("MongoDB Connected");
  });

  mongoose.connection.on("error", (err) => {
    console.error(`MongoDB connection error: ${err?.message || err}`);
  });

  mongoose.connection.on("disconnected", () => {
    console.log("MongoDB Disconnected — will keep trying to reconnect");
  });

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 15000,
        family: 4, // prefer IPv4 — avoids some mobile/hotspot DNS issues
      });
      console.log(
        "MongoDB connect attempt using URI:",
        process.env.MONGODB_URI ? "[REDACTED]" : "MONGODB_URI not set"
      );
      return;
    } catch (error) {
      console.error(
        `MongoDB connect failed (attempt ${attempt}/${retries}):`,
        error?.message || error
      );
      if (attempt < retries) {
        const waitMs = attempt * 3000;
        console.log(`Retrying in ${waitMs / 1000}s…`);
        console.log(
          "If this keeps failing: Atlas → Network Access → add your current IP (or 0.0.0.0/0 for testing)."
        );
        await new Promise((r) => setTimeout(r, waitMs));
      } else {
        console.error(
          "Could not reach MongoDB Atlas. Server will stay up; fix Network Access / cluster status, then restart."
        );
        // Do not process.exit — keep HTTP server alive so nodemon does not die
      }
    }
  }
};

export default connectDB;
