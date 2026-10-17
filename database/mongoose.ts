import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

declare global {
    var mongooseCache: {
        conn: typeof mongoose | null;
        promise: Promise<typeof mongoose> | null;
    }
}

let cached = global.mongooseCache;

if(!cached) {
    cached = global.mongooseCache = { conn: null, promise: null };
}

export const connectToDatabase = async () => {
    if(!MONGODB_URI) throw new Error('MONGODB_URI must be set within .env');

    if(cached.conn) return cached.conn;

    if(!cached.promise) {
        cached.promise = mongoose.connect(MONGODB_URI, {
            bufferCommands: false,
            serverSelectionTimeoutMS: 15000, // give up quickly when the network is down
            socketTimeoutMS: 45000,
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (err) {
        cached.promise = null;
        throw err;
    }

    // Hide the username/password when logging the connection string
    console.log(`Connected to database ${process.env.NODE_ENV} - ${MONGODB_URI.replace(/\/\/[^@]+@/, '//***:***@')}`);

    return cached.conn;
}
