'use strict';
const inquirer = require('inquirer');
function myRole(yourRole, gameSocket, playerData) {
  playerData.role = yourRole;
  console.log(`You are a ${playerData.role.toUpperCase()}`);
  let rngRoomIdx = Math.floor(Math.random() * playerData.rooms.length);
  gameSocket.emit('roomChange', playerData.rooms[rngRoomIdx], playerData.name);
  playerData.myCurrentRoom = `${playerData.rooms[rngRoomIdx]}`;
  console.log(`Current location: ${playerData.myCurrentRoom}.`);
}

function roomStatus(currentRoomPlayers, thisRoom, playerData) {
  playerData.myCurrentRoom = thisRoom;
  playerData.playersInCurrentRoom = currentRoomPlayers;
  // TODO: after vote, same person show up in the room twice, if escape, only that person is shown in this room ALSO, test the winning condition because of ppl can escape
  console.log(`Players inside this room: ${currentRoomPlayers.toString()}`);
  // if (currentRoomPlayers.includes(name)){
  //   actionMainList(role);
  // }
}

function leftRoomStatus(name, updatedInsideRoom, playerData) {
  console.log(`${name} has left this room.`);
  //TODO: if room has 1 person, still in this room will be the person who left why
  // console.log('26 updated list from server',updatedInsideRoom);
  // console.log('27 before update this room', playerData.playersInCurrentRoom);
  let idx = playerData.playersInCurrentRoom.indexOf(updatedInsideRoom[0]);
  playerData.playersInCurrentRoom.splice(idx, 1);
  // console.log('29 after update this room', playerData.playersInCurrentRoom);
  console.log(`Still in this room: ${playerData.playersInCurrentRoom}`);
}

function vote(alivePlayers, playerData, gameSocket) {
  let players = alivePlayers.filter(i => i !== playerData.name);
  players.push('[SKIP]');
  players.push(new inquirer.Separator());
  inquirer
    .prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Who is the killer?',
        choices: players,
      },
    ])
    .then((answers) => {
      gameSocket.emit('voteResult', answers.action);
    });
}

function actionMainList(playerData, gameSocket) {
  if (playerData.role === 'slayer') {
    inquirer
      .prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What do you want to do?',
          choices: [
            'Move to another room',
            'Kill a player',
            new inquirer.Separator()
          ],
        },
      ])
      .then((answers) => {
        playerData.choice = answers.action.charAt(0);
        actionSubList(playerData, gameSocket);
      });
  } else if (playerData.role === 'survivor') {
    inquirer
      .prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What do you want to do?',
          choices: [
            'Move to another room',
            'Look around',
            new inquirer.Separator()
          ],
        },
      ])
      .then((answers) => {
        playerData.choice = answers.action.charAt(0);
        actionSubList(playerData, gameSocket);
      });
  }
}


function actionSubList(playerData, gameSocket) {
  //Move to another room
  if (playerData.choice === 'M') {
    playerData.myPrevRoom = playerData.myCurrentRoom;
    let newRooms = playerData.rooms.filter(i => i !== playerData.myCurrentRoom);
    newRooms.push(new inquirer.Separator());
    inquirer
      .prompt([
        {
          type: 'list',
          name: 'action',
          message: 'Which room do you want to go to?',
          choices: newRooms,
        },
      ])
      .then((answers) => {
        playerData.choice = answers.action;
        playerData.myCurrentRoom = playerData.choice;
        gameSocket.emit('roomChange', playerData.choice, playerData.name, playerData.myPrevRoom);
      });
  } else if (playerData.choice === 'K') {
    //Kill a player

    let userArr = playerData.playersInCurrentRoom.filter(i => i !== playerData.name);
    if (userArr.length === 0) {
      console.log('There is noone to kill.');
      actionMainList(playerData, gameSocket);
    } else {
      userArr.push(new inquirer.Separator());
      inquirer
        .prompt([
          {
            type: 'list',
            name: 'action',
            message: 'Which would you like to kill?',
            choices: userArr,

          },
        ])
        .then((answers) => {
          let action = [answers.action, playerData.myCurrentRoom];
          gameSocket.emit('playerKill', action);
        });
    }
  } else if (playerData.choice === 'L') {
    let rngIdx = Math.floor(Math.random() * playerData.tasks.length);
    let msg = playerData.tasks[`${rngIdx}`];

    console.log(msg);
    if (msg.includes('exit')) {
      console.log('[Game Over] Congratulations, you escaped!');
      gameSocket.emit('won', playerData.name, playerData.myCurrentRoom);
      gameSocket.disconnect(playerData.name);
    }
    actionMainList(playerData, gameSocket);
  }

}

module.exports = {
  vote,
  actionMainList,
  actionSubList,
  leftRoomStatus,
  roomStatus,
  myRole,
};
