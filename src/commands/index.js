import * as help from './help.js';
import * as playerCount from './player-count.js';
import * as playerList from './player-list.js';
import * as searchPlayer from './search-player.js';
import * as serverStatus from './server-status.js';

export const commands = [searchPlayer, playerCount, playerList, serverStatus, help];
export const commandMap = new Map(commands.map((c) => [c.data.name, c]));
