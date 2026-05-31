const { Server } = require("socket.io");

let io;

const init = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // Adjust this in production
      methods: ["GET", "POST", "PATCH"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join room based on user role or specific ID
    socket.on("join_room", (roomName) => {
      socket.join(roomName);
      console.log(`Socket ${socket.id} joined room: ${roomName}`);
    });

    socket.on("leave_room", (roomName) => {
      socket.leave(roomName);
      console.log(`Socket ${socket.id} left room: ${roomName}`);
    });

    // Handle real-time delivery location updates from driver
    socket.on("update_delivery_location", (data = {}) => {
      const { orderId, latitude, longitude } = data;

      if (
        !orderId ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        console.warn("Ignoring invalid delivery location update:", data);
        return;
      }

      io.to(`order_${orderId}`).emit("delivery_location_updated", {
        orderId,
        latitude,
        longitude
      });
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

module.exports = { init, getIO };
