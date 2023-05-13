'use strict';

class Player {
  constructor(name) {
    this.name = name;
    this.role = 'survivor';
    this.score = 0;
  }
}

function joinLobby(name, gameData, socket, game) {
  socket.username = name;
  if (gameData.currentPlayers.length < 4) {
    gameData.aliveArr.push(name);
    let newPlayer = new Player(name);
    gameData.currentPlayers.push(newPlayer);
    game.emit('lobbyStatus', gameData.currentPlayers);
    // console.log(`currentPlayers: ${JSON.stringify(currentPlayers, null, 2)}`);
  }
  if (gameData.currentPlayers.length === 4) {
    let slayerIdx = Math.floor(Math.random() * gameData.currentPlayers.length);
    gameData.slayer = gameData.currentPlayers[slayerIdx].name;
    gameData.currentPlayers[slayerIdx].role = 'slayer';
    let msg = '[START GAME] ==Objectives== Survivor: Find the exit. Slayer: Hunt down all survivors.';
    game.emit('gameStart', msg);
  }
}

function findRole(name, gameData, socket) {
  let role = null;
  for (let i = 0; i < gameData.currentPlayers.length; i++) {
    if (name === gameData.currentPlayers[i].name) {
      role = gameData.currentPlayers[i].role;
    }
  }
  socket.emit('myRole', role);
}


function playerEscape(name, currentRoom, gameData, game) {
  for (let i = 0; i < gameData.currentPlayers.length; i++) {
    if (name === gameData.currentPlayers[i].name) {
      gameData.currentPlayers[i].role = 'escaped';
    }
  }
  let idx0 = gameData.insideRoom[currentRoom].indexOf(name);
  let updatedInsideRoom = gameData.insideRoom[currentRoom].splice(idx0, 1);
  game.to(currentRoom).emit('roomStatus', updatedInsideRoom, currentRoom);
  let idx = gameData.aliveArr.indexOf(name);
  gameData.aliveArr.splice(idx, 1);
  if (gameData.aliveArr.length === 1 && gameData.aliveArr.includes(gameData.slayer)) {
    let msg = `[Game Over] Last survivor escaped, Slayer ${gameData.slayer} lost!`;
    game.emit('globalEvent', msg);
    game.disconnectSockets(true);
  }
  if (gameData.aliveArr.length === 2 && gameData.aliveArr.includes(gameData.slayer)) {
    let msg = 'Sudden Death: Last survivor must find the exit beofre the slayer finds you!';
    game.emit('globalEvent', msg);
  }
}

function playerKill(action, gameData, socket, game) {
  for (let i = 0; i < gameData.currentPlayers.length; i++) {
    if (action[0] === gameData.currentPlayers[i].name) {
      gameData.currentPlayers[i].role = 'dead';
    }
  }
  // console.log(`68 rooms status: ${JSON.stringify(gameData.insideRoom, null, 2)}`);
  let idx0 = gameData.insideRoom[`${action[1]}`].indexOf(action[0]);
  gameData.insideRoom[`${action[1]}`].splice(idx0, 1);
  game.to(`${action[1]}`).emit('roomStatus', gameData.insideRoom[`${action[1]}`], `${action[1]}`);
  // console.log('73', gameData.currentPlayers);
  gameData.deadArr.push(action[0]);
  let idx = gameData.aliveArr.indexOf(action[0]);
  gameData.aliveArr.splice(idx, 1);
  // console.log('dead77', gameData.deadArr);
  // console.log('alive78', gameData.aliveArr);
  if (gameData.aliveArr.length === 1) {
    socket.broadcast.emit('globalEvent', 'You have been killed!');
    let msg = `[Game Over] No more survivor, Slayer ${gameData.slayer} won!`;
    game.emit('globalEvent', msg);
    return game.disconnectSockets(true);
  }
}

function changeRoom(roomChange, name, gameData, socket, game, prevRoom = 0) {
  if (prevRoom !== 0) {
    socket.leave(prevRoom);
    // let newInsideRoom = insideRoom[`${prevRoom}`].filter(i => i !== name);
    let idx = gameData.insideRoom[`${prevRoom}`].indexOf(name);
    let updatedInsideRoom = gameData.insideRoom[`${prevRoom}`].splice(idx, 1);
    // console.log(updatedInsideRoom);
    game.to(prevRoom).emit('leftRoom', name, updatedInsideRoom);

  }
  socket.join(roomChange);
  //tracking who is in what room
  if (gameData.insideRoom[`${roomChange}`]) {
    gameData.insideRoom[`${roomChange}`].push(name);
  } else {
    gameData.insideRoom[`${roomChange}`] = [];
    gameData.insideRoom[`${roomChange}`].push(name);
  }
  let currentRoomPlayers = gameData.insideRoom[`${roomChange}`];
  // console.log(`currentRoom: ${JSON.stringify(currentRoom, null, 2)}`);
  game.to(roomChange).emit('roomStatus', currentRoomPlayers, roomChange);
}

function voting(vote, gameData,socket, game ) {
  // console.log('165res', resultArr.length);
  gameData.resultArr.push(vote);
  // console.log('vote', resultArr);
  // console.log(`vote results ${JSON.stringify(counts, null, 2)}`);
  // console.log(aliveArr);

  if (gameData.resultArr.length === gameData.aliveArr.length) {
    gameData.resultArr.forEach(element => {
      gameData.counts[element] = (gameData.counts[element] || 0) + 1;
    });

    console.log(`vote results ${JSON.stringify(gameData.counts, null, 2)}`);
    let maxVotes = 0;
    let maxVotePlayer = [];
    let prevVoteCount = null;
    for (let player in gameData.counts) {
      const voteCount = gameData.counts[player];
      if (prevVoteCount === null) {
        prevVoteCount = voteCount;
      }
      if (voteCount > maxVotes) {
        maxVotes = voteCount;
        maxVotePlayer = [player];
      } else if (voteCount === maxVotes) {
        maxVotePlayer.push(player);
      }
    }
    // console.log('137 maxVotePlayer', maxVotePlayer);
    if (maxVotePlayer.length > 1) {
      let msg = `TIED: Nobody got kicked out. Game continues...`;
      game.emit('globalEvent', msg);
      // game.to(roomChange).emit('roomStatus', currentRoomPlayers, roomChange);
      game.emit('playerAction', 'nth');
    } else if (maxVotePlayer.length === 1) {
      if (maxVotePlayer[0] === gameData.slayer) {
        let msg = `[Game Over] Congratulations, SLAYER has been caught!`;
        game.emit('globalEvent', msg);
        game.disconnectSockets(true);
      } else if (maxVotePlayer[0] === '[SKIP]') {
        let msg = `Nobody got kicked out. Game continues...`;
        game.emit('globalEvent', msg);
        game.emit('playerAction', 'nth');
      } else {
        let msg = `${maxVotePlayer[0]} has been kicked out, but SLAYER is still out there! Game continues...`;
        for (let i = 0; i < gameData.currentPlayers.length; i++) {
          if (maxVotePlayer[0] === gameData.currentPlayers[i].name) {
            gameData.currentPlayers[i].role = 'kicked';
          }
        }
        let room = null;
        for (const key in gameData.insideRoom) {
          if (Array.isArray(gameData.insideRoom[key]) && gameData.insideRoom[key].includes(maxVotePlayer[0])) {
            room = key;
          }
        }
        // console.log(`164 rooms status: ${JSON.stringify(gameData.insideRoom, null, 2)}`);
        let idx0 = gameData.insideRoom[room].indexOf(maxVotePlayer[0]);
        gameData.insideRoom[room].splice(idx0, 1);
        // console.log(`166 rooms status: ${JSON.stringify(gameData.insideRoom, null, 2)}`);
        game.to(room).emit('roomStatus', gameData.insideRoom[`${room}`] , room);
        gameData.kickArr.push(maxVotePlayer[0]);
        // console.log(gameData.aliveArr);
        let idx = gameData.aliveArr.indexOf(maxVotePlayer[0]);
        gameData.aliveArr.splice(idx, 1);
        // console.log(gameData.aliveArr);
        game.emit('globalEvent', msg);
        if (gameData.aliveArr.length === 2) {
          let msg = 'Sudden Death: Last survivor must find the exit beofre the slayer finds you!';
          game.emit('globalEvent', msg);
        }
        game.emit('voteResult', maxVotePlayer);
        game.emit('playerAction', 'nth');
      }
      // game.to(roomChange).emit('roomStatus', currentRoomPlayers, roomChange);
    }
    gameData.resultArr = [];
    gameData.counts = {};
  }
}

module.exports = {
  joinLobby,
  findRole,
  playerEscape,
  playerKill,
  changeRoom,
  voting,
};