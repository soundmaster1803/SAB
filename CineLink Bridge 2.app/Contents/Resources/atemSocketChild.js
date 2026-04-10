"use strict";

// node_modules/atem-connection/dist/lib/atemSocketChild.js
Object.defineProperty(exports, "__esModule", { value: true });
exports.AtemSocketChild = exports.PacketFlag = exports.ConnectionState = exports.COMMAND_CONNECT_HELLO = void 0;
var dgram_1 = require("dgram");
var perf_hooks_1 = require("perf_hooks");
var IN_FLIGHT_TIMEOUT = 60;
var CONNECTION_TIMEOUT = 5e3;
var CONNECTION_RETRY_INTERVAL = 1e3;
var RETRANSMIT_INTERVAL = 10;
var MAX_PACKET_RETRIES = 10;
var MAX_PACKET_ID = 1 << 15;
var MAX_PACKET_PER_ACK = 16;
exports.COMMAND_CONNECT_HELLO = Buffer.from([
  16,
  20,
  83,
  171,
  0,
  0,
  0,
  0,
  0,
  58,
  0,
  0,
  1,
  0,
  0,
  0,
  0,
  0,
  0,
  0
]);
var ConnectionState;
(function(ConnectionState2) {
  ConnectionState2[ConnectionState2["Closed"] = 0] = "Closed";
  ConnectionState2[ConnectionState2["SynSent"] = 1] = "SynSent";
  ConnectionState2[ConnectionState2["Established"] = 2] = "Established";
  ConnectionState2[ConnectionState2["Disconnected"] = 3] = "Disconnected";
})(ConnectionState = exports.ConnectionState || (exports.ConnectionState = {}));
var PacketFlag;
(function(PacketFlag2) {
  PacketFlag2[PacketFlag2["AckRequest"] = 1] = "AckRequest";
  PacketFlag2[PacketFlag2["NewSessionId"] = 2] = "NewSessionId";
  PacketFlag2[PacketFlag2["IsRetransmit"] = 4] = "IsRetransmit";
  PacketFlag2[PacketFlag2["RetransmitRequest"] = 8] = "RetransmitRequest";
  PacketFlag2[PacketFlag2["AckReply"] = 16] = "AckReply";
})(PacketFlag = exports.PacketFlag || (exports.PacketFlag = {}));
var AtemSocketChild = class {
  constructor(options, onDisconnect, onLog, onCommandReceived, onCommandAcknowledged) {
    this._connectionState = ConnectionState.Closed;
    this._nextSendPacketId = 1;
    this._sessionId = 0;
    this._lastReceivedAt = perf_hooks_1.performance.now();
    this._lastReceivedPacketId = 0;
    this._inFlight = [];
    this._receivedWithoutAck = 0;
    this._debugBuffers = options.debugBuffers;
    this._address = options.address;
    this._port = options.port;
    this.onDisconnect = onDisconnect;
    this.onLog = onLog;
    this.onCommandsReceived = onCommandReceived;
    this.onPacketsAcknowledged = onCommandAcknowledged;
    this._socket = this._createSocket();
  }
  startTimers() {
    if (!this._reconnectTimer) {
      this._reconnectTimer = setInterval(() => {
        if (this._lastReceivedAt + CONNECTION_TIMEOUT > perf_hooks_1.performance.now()) {
          return;
        }
        this.restartConnection().catch((e) => {
          this.log(`Reconnect failed: ${e}`);
        });
      }, CONNECTION_RETRY_INTERVAL);
    }
  }
  async connect(address, port) {
    this._address = address;
    this._port = port;
    return this.restartConnection();
  }
  async disconnect() {
    this._clearTimers();
    return this._closeSocket().then(async () => {
      this._connectionState = ConnectionState.Disconnected;
      return this.onDisconnect();
    });
  }
  _clearTimers() {
    if (this._retransmitTimer) {
      clearTimeout(this._retransmitTimer);
      this._retransmitTimer = void 0;
    }
    if (this._reconnectTimer) {
      clearInterval(this._reconnectTimer);
      this._reconnectTimer = void 0;
    }
  }
  async restartConnection() {
    this._clearTimers();
    if (this._connectionState === ConnectionState.Established) {
      this._connectionState = ConnectionState.Closed;
      this._recreateSocket();
      await this.onDisconnect();
    } else if (this._connectionState === ConnectionState.Disconnected) {
      this._createSocket();
    }
    this._nextSendPacketId = 1;
    this._sessionId = 0;
    this._inFlight = [];
    this.log("reconnect");
    this.startTimers();
    this._sendPacket(exports.COMMAND_CONNECT_HELLO);
    this._connectionState = ConnectionState.SynSent;
  }
  log(message) {
    void this.onLog(message);
  }
  sendPackets(packets) {
    for (const packet of packets) {
      this.sendPacket(packet.payloadLength, packet.payloadHex, packet.trackingId);
    }
  }
  sendPacket(payloadLength, payloadHex, trackingId) {
    const packetId = this._nextSendPacketId++;
    if (this._nextSendPacketId >= MAX_PACKET_ID)
      this._nextSendPacketId = 0;
    const opcode = PacketFlag.AckRequest << 11;
    const buffer = Buffer.alloc(12 + payloadLength, 0);
    buffer.writeUInt16BE(opcode | payloadLength + 12, 0);
    buffer.writeUInt16BE(this._sessionId, 2);
    buffer.writeUInt16BE(packetId, 10);
    buffer.write(payloadHex, 12, payloadLength, "hex");
    this._sendPacket(buffer);
    this._inFlight.push({
      packetId,
      trackingId,
      lastSent: perf_hooks_1.performance.now(),
      payload: buffer,
      resent: 0
    });
    this._triggerRetransmitTimer();
  }
  _recreateSocket() {
    this._closeSocket().catch((_err) => {
    });
    return this._createSocket();
  }
  async _closeSocket() {
    if (this._ackTimer) {
      clearTimeout(this._ackTimer);
      delete this._ackTimer;
    }
    return new Promise((resolve) => {
      try {
        this._socket.close(() => resolve());
      } catch (err) {
        this.log(`Error closing socket: ${err}`);
        resolve();
      }
    });
  }
  _createSocket() {
    this._socket = (0, dgram_1.createSocket)("udp4");
    this._socket.bind();
    this._socket.on("message", (packet, rinfo) => this._receivePacket(packet, rinfo));
    this._socket.on("error", (err) => {
      this.log(`Connection error: ${err}`);
      if (this._connectionState === ConnectionState.Established) {
        this.restartConnection().catch((e) => {
          this.log(`Failed to restartConnection: ${e?.message ?? e}`);
        });
      }
    });
    return this._socket;
  }
  _isPacketCoveredByAck(ackId, packetId) {
    const tolerance = MAX_PACKET_ID / 2;
    const pktIsShortlyBefore = packetId < ackId && packetId + tolerance > ackId;
    const pktIsShortlyAfter = packetId > ackId && packetId < ackId + tolerance;
    const pktIsBeforeWrap = packetId > ackId + tolerance;
    return packetId === ackId || (pktIsShortlyBefore || pktIsBeforeWrap) && !pktIsShortlyAfter;
  }
  _receivePacket(packet, rinfo) {
    if (this._debugBuffers)
      this.log(`RECV ${packet.toString("hex")}`);
    this._lastReceivedAt = perf_hooks_1.performance.now();
    const length = packet.readUInt16BE(0) & 2047;
    if (length !== rinfo.size)
      return;
    const flags = packet.readUInt8(0) >> 3;
    this._sessionId = packet.readUInt16BE(2);
    const remotePacketId = packet.readUInt16BE(10);
    if (flags & PacketFlag.NewSessionId) {
      this._connectionState = ConnectionState.Established;
      this._lastReceivedPacketId = remotePacketId;
      this._sendAck(remotePacketId);
      return;
    }
    const ps = [];
    if (this._connectionState === ConnectionState.Established) {
      if (flags & PacketFlag.RetransmitRequest) {
        const fromPacketId = packet.readUInt16BE(6);
        this.log(`Retransmit request: ${fromPacketId}`);
        ps.push(this._retransmitFrom(fromPacketId));
      }
      if (flags & PacketFlag.AckRequest) {
        if (remotePacketId === (this._lastReceivedPacketId + 1) % MAX_PACKET_ID) {
          this._lastReceivedPacketId = remotePacketId;
          this._sendOrQueueAck();
          if (length > 12) {
            ps.push(this.onCommandsReceived(packet.slice(12), remotePacketId));
          }
        } else if (this._isPacketCoveredByAck(this._lastReceivedPacketId, remotePacketId)) {
          this._sendOrQueueAck();
        }
      }
      if (flags & PacketFlag.AckReply) {
        const ackPacketId = packet.readUInt16BE(4);
        const ackedCommands = [];
        this._inFlight = this._inFlight.filter((pkt) => {
          if (this._isPacketCoveredByAck(ackPacketId, pkt.packetId)) {
            ackedCommands.push({
              packetId: pkt.packetId,
              trackingId: pkt.trackingId
            });
            return false;
          } else {
            return true;
          }
        });
        this._triggerRetransmitTimer();
        ps.push(this.onPacketsAcknowledged(ackedCommands));
      }
    }
    Promise.all(ps).catch((e) => {
      this.log(`Failed to receivePacket: ${e?.message ?? e}`);
    });
  }
  _sendPacket(packet) {
    if (this._debugBuffers)
      this.log(`SEND ${packet.toString("hex")}`);
    this._socket.send(packet, 0, packet.length, this._port, this._address);
  }
  _sendOrQueueAck() {
    this._receivedWithoutAck++;
    if (this._receivedWithoutAck >= MAX_PACKET_PER_ACK) {
      this._receivedWithoutAck = 0;
      if (this._ackTimer) {
        clearTimeout(this._ackTimer);
        delete this._ackTimer;
      }
      this._sendAck(this._lastReceivedPacketId);
    } else if (!this._ackTimer) {
      this._ackTimer = setTimeout(() => {
        delete this._ackTimer;
        this._receivedWithoutAck = 0;
        this._sendAck(this._lastReceivedPacketId);
      }, 5);
    }
  }
  _sendAck(packetId) {
    const opcode = PacketFlag.AckReply << 11;
    const length = 12;
    const buffer = Buffer.alloc(length, 0);
    buffer.writeUInt16BE(opcode | length, 0);
    buffer.writeUInt16BE(this._sessionId, 2);
    buffer.writeUInt16BE(packetId, 4);
    this._sendPacket(buffer);
  }
  async _retransmitFrom(fromId) {
    fromId = fromId % MAX_PACKET_ID;
    const fromIndex = this._inFlight.findIndex((pkt) => pkt.packetId === fromId);
    if (fromIndex === -1) {
      this.log(`Unable to resend: ${fromId}`);
      await this.restartConnection();
    } else {
      this.log(`Resending from ${fromId} to ${this._inFlight[this._inFlight.length - 1].packetId}`);
      const now = perf_hooks_1.performance.now();
      for (let i = fromIndex; i < this._inFlight.length; i++) {
        const sentPacket = this._inFlight[i];
        if (sentPacket.packetId === fromId || !this._isPacketCoveredByAck(fromId, sentPacket.packetId)) {
          sentPacket.lastSent = now;
          sentPacket.resent++;
          this._sendPacket(sentPacket.payload);
        }
      }
    }
  }
  _triggerRetransmitTimer() {
    if (!this._inFlight.length) {
      if (this._retransmitTimer) {
        clearTimeout(this._retransmitTimer);
        delete this._retransmitTimer;
      }
      return;
    }
    if (!this._retransmitTimer) {
      this._retransmitTimer = setTimeout(() => {
        delete this._retransmitTimer;
        this._checkForRetransmit().catch((e) => {
          this.log(`Failed to retransmit: ${e?.message ?? e}`);
        });
      }, RETRANSMIT_INTERVAL);
    }
  }
  async _checkForRetransmit() {
    if (!this._inFlight.length)
      return;
    this._triggerRetransmitTimer();
    const now = perf_hooks_1.performance.now();
    for (const sentPacket of this._inFlight) {
      if (sentPacket.lastSent + IN_FLIGHT_TIMEOUT < now) {
        if (sentPacket.resent <= MAX_PACKET_RETRIES && this._isPacketCoveredByAck(this._nextSendPacketId, sentPacket.packetId)) {
          this.log(`Retransmit from timeout: ${sentPacket.packetId}`);
          return this._retransmitFrom(sentPacket.packetId);
        } else {
          this.log(`Packet timed out: ${sentPacket.packetId}`);
          return this.restartConnection();
        }
      }
    }
    return Promise.resolve();
  }
};
exports.AtemSocketChild = AtemSocketChild;
