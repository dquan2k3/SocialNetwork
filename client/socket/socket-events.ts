export const SOCKET_EVENTS = {
  CONNECT: "connect",
  DISCONNECT: "disconnect",

  // Private messaging events
  SEND_MESSAGE: "sendMessage",
  RECEIVE_MESSAGE: "receiveMessage",
  MESSAGE_SENT: "messageSent",
  MESSAGE_ERROR: "messageError",

  // notification
  MESSAGE_NOTIFICATION: "messageNotification",
  NOTIFICATION: "notification",

  // User online mapping
  USER_CONNECT: "userConnect",
  ONLINE_USER: "onlineUser",
  CREATED_GROUP: "onCreateGroup",
  DISBAND_GROUP: "onDisbandGroup",

  // Room events (group chat)
  JOIN_ROOM: "joinRoom",
  ROOM_JOINED: "roomJoined",
  LEAVE_ROOM: "leaveRoom",
  ROOM_LEFT: "roomLeft",
  SEND_ROOM_MESSAGE: "sendRoomMessage",
  RECEIVE_ROOM_MESSAGE: "receiveRoomMessage",

  // Video call events (P2P)
  CALL_OFFER: "callOffer",              
  LISTEN_CALL_OFFER: "listenCallOffer",
  CALL_ACCEPT: "callAccept",
  CALL_DECLINE: "callDecline",
  LISTEN_ACCEPT_CALL: "listenAcceptCall",

  
  CALL_ANSWER: "callAnswer",            // Server => Client A: forward WebRTC answer
  CALL_ICE_CANDIDATE: "callIceCandidate", // Both clients: send/receive ICE candidates via server
  CALL_ACCEPTED: "callAccepted",        // Server => Call initiator: receiver accepted
  CALL_REJECTED: "callRejected",        // Server => Call initiator: receiver declined
  CALL_ENDED: "callEnded",              // Notify both users to end/hangup call

  // Misc events (add as needed)
};
