'use strict';
const { Server } = require('socket.io');
require('dotenv').config();
const PORT = process.env.PORT || 3003;
const io = new Server(PORT);
let game = io.of('/game');
const {joinLobby, findRole, playerEscape, playerKill, changeRoom,voting} = require('./handler');


let gameData ={
  currentPlayers : [],
  deadArr : [],
  aliveArr : [],
  kickArr : [],
  slayer : null,
  insideRoom : {},
  resultArr : [],
  counts : {},
};

//server: /game namespace
// socket.emit TO THAT Player
// game.emit TO EVERYONE
game.on('connection', (socket) => {
  console.log('PLAYER CONNECTED TO /game', socket.id);
  socket.on('joinLobby', (name) => {
    joinLobby(name, gameData, socket, game);
  });
  socket.on('myRole', (name) => {
    findRole(name,gameData,socket);
  });

  socket.on('won', (name, currentRoom)=>{
    game.emit('globalEvent', `${name} escaped! (And didn't tell anyone where the exit is... What a *#$%#.)`);
    playerEscape(name, currentRoom, gameData, game);
  });

  socket.on('playerKill', (action) => {
    playerKill(action, gameData, socket, game);
    let msg = `[ALERT] ${action[0]} is found DEAD!`;
    game.emit('vote', msg, gameData.aliveArr);
  });

  socket.on('roomChange', (roomChange, name, prevRoom) => {
    changeRoom(roomChange, name, gameData, socket, game, prevRoom);
    socket.emit('playerAction', 'nth');
  });

  socket.on('voteResult', (vote) => {
    voting(vote, gameData, socket, game);
  });

  socket.on('disconnect', () => {
    if (socket.username === gameData.slayer) {
      game.emit('globalEvent', '[Game Over] Slayer has left the game.');
      game.disconnectSockets(true);
    }
    let idx = gameData.currentPlayers.findIndex(obj => obj.name === socket.username);
    gameData.currentPlayers.splice(idx, 1);
    let msg = `${socket.username} is disconnected.`;
    console.log(msg);
    game.emit('globalEvent', msg);
  });

});
