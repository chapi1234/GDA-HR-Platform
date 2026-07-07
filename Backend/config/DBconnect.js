import mongoose from "mongoose";

const connectDB = async () => {
  try {
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
      console.error(`MongoDB connection error: ${err}`);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("MongoDB Disconnected");
    });

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connect attempt using URI:', process.env.MONGODB_URI ? '[REDACTED]' : 'MONGODB_URI not set');
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

export default connectDB;
