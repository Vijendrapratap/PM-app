import mongoose from 'mongoose';
import dns from 'dns';

// Node's resolver can fall back to an unreachable 127.0.0.1 on machines with
// misconfigured/virtual network adapters (VPN, Hyper-V, WSL), breaking the
// SRV lookups mongodb+srv:// URIs need. Force known-good public DNS servers.
dns.setServers(['8.8.8.8', '1.1.1.1']);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/project_management');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
