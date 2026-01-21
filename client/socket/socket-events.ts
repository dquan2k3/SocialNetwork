export const SOCKET_EVENTS = {
  CONNECT: "connect",
  DISCONNECT: "disconnect",

  // Private messaging events
  SEND_MESSAGE: "sendMessage",
  RECEIVE_MESSAGE: "receiveMessage",
  MESSAGE_SENT: "messageSent",
  MESSAGE_ERROR: "messageError",

  //notification
  MESSAGE_NOTIFICATION: "messageNotification",
  NOTIFICATION: "notification",

  // User online mapping
  USER_CONNECT: "userConnect",
  ONLINE_USER: "onlineUser",

  // Room events (group chat)
  JOIN_ROOM: "joinRoom",
  ROOM_JOINED: "roomJoined",
  LEAVE_ROOM: "leaveRoom",
  ROOM_LEFT: "roomLeft",
  SEND_ROOM_MESSAGE: "sendRoomMessage",
  RECEIVE_ROOM_MESSAGE: "receiveRoomMessage",

  // Misc events (add as needed)
};
