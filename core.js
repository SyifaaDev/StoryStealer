import fs from "fs"
import path from "path"
import chalk from 'chalk'

function delay(ms){
	return new Promise(r=>setTimeout(r,ms))
} async function clear(){
	const { spawn } = await import('child_process');
	spawn('clear',{
		stdio:'inherit',
		shell: !![]
	});
}

const log = console.log;
const targets = [
    "/sdcard/WhatsApp/Media/.Statuses",
    "/sdcard/Android/media/com.whatsapp/WhatsApp/Media/.Statuses",
    "/sdcard/WhatsApp Business/Media/.Statuses",
    "/sdcard/Android/media/com.whatsapp.w4b/WhatsApp Business/Media/.Statuses"
]

const outputBase = "/sdcard/StoryResult"
const imageDir = path.join(outputBase, "Image")
const videoDir = path.join(outputBase, "Video")
const ensure = dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
}
ensure(imageDir)
ensure(videoDir)
const imageExt = [".jpg", ".jpeg", ".png", ".webp"]
const videoExt = [".mp4", ".mov", ".mkv"]

async function main(){
	for (const target of targets) {
	    if (!fs.existsSync(target)) {
    	    continue
    	}
    	const files = fs.readdirSync(target)
		    for (const file of files) {
        		const ext = path.extname(file).toLowerCase()
        		const source = path.join(target, file)
        			if (!fs.statSync(source).isFile()){
            			continue
        			} if (imageExt.includes(ext)){
            			const dest = path.join(imageDir, file)
            				try {
                				fs.copyFileSync(source, dest)
            				} catch {
            					/**/
            				}
        			}

        		if (videoExt.includes(ext)) {
            		const dest = path.join(videoDir, file)
            			try {
                			fs.copyFileSync(source, dest)
            			} catch {}
        		}
    		}
		}
		log(chalk.bold(`Results Location is at:\n${chalk.cyan.underline('/storage/emulated/0/StoryResult')}\n`));
}

;(async function(){
	clear();
	await delay(500)
	await log(chalk.bold.gray(`
::ccox;,,,,,;:oONNNNNNNNNNNNNNNNNNNNNNNNNNNNXklccccccc::::::
clllo;''',,;:dKWWNNNNNNNNNNNNNNNNNNNNNNNNNNNNNKklcccccccc:::
clll:...,;:ckWMMMWWWNNNNNNNNNNNNNNNNNNNNNNNNNXNWXklccccccccc
lllc,..',;cKMWWWWWNNWWWWNWWNWWNNWWNWWWNXNWNNXNNWWWKocccccccl
xO0k'...':XWNNXNNNNNNNNNNNNNNNXNWNNNWNXXNNNXXNNNNNWKolllllll
0KNx'...:XNNXXXXXXXXXXXXXXKXXXKXXXXXXXXXXXXXXXXXXXXN0lld00K0
O0Kx'..'OWXXXXXXXXXXXXXXXOXXKkXXXXXXXXXXXXKXXXXKXXXXWdlodddd
kxxk,..,WXKXXXXXXXXXKKXXk0X0ok0XXXXXXXXXKkKXXKKxKXXXNKdlcccc
0kxx:..lWOXXXXXKXXXXkXXOxKKdldKXXXXXXXXOxkKX0kxdKXXXNXdlllll
OOkkx'.xXdXXKXX0XXXOOX0kkxkKdd000XXK0KkddOkkoxdd0XXXXXdxkkdo
OOO0d..KOokKkXKO0X0d0kxkOXdOddxxK0KOkxddkdlccOddkKX0KKKOxOOk
xkkd'.;Nxookd0OdOKdoddd0X:;kddddOxOdoodoo:co;,:oO0Kx0xxkOKKO
xkkd..dXdloddkxdOxoddddxXo,lddddxddoodxKk0Noocldx0dddxO0kxdd
kO0o..0OdooooooddodddddoONKdddoooooldKNNK0KOKoloxkkodddollll
KK0o.'NxoooooooooooooooookkddoooooloXNNNNN0NOoocdNOkkkkxxddo
000k,;NolooooooooooooooooolloolololONNNNNNNKOK0dOKxxxdddoooo
xkOX:;NolooooooooooloooooxdloolollxNNNNNNNNNNNNKOKkkxxxddooo
;:c:;'KxlooooooooolooookXNxoolloldxNNNNNNNNNN0O0kkoddddddddo
ccccc'cKoooooololllooo0NNN0oollllo0NNNNNNXK0Oodkdxxdxkkkxxxx
';;;;;,cOdooooolook00xdxOKKoclllooONNNNNN0Olllkl:cccdxxdddxx
......';;cccc:c0KNWWWKxddddoclloollONNNNK;.c:d:,;:codloloool
.....';llllo:,::cokKNW0xdddddolllc,';okO;.,.c:,:loodoolooooo
....';cooolc;'''''',:kX0xdddddooollc.......';;:cxxkkkkdoddoo
..'';loodOOxdolc:,''',ckK0kxddddOold;......',:clkOOO0Odddxxd
..''coxKWWWWWNXKOoc,''':dXNNKkddXkod;......'':clkOOO0Okdoodd
 ..,d0NNNNNNNWWWWNOo:''':xNXNXOxXOKK;.   ....',;cllodkdoxxkk
...:XNNWWWWWWWWWNNWKdl,,;l0WNXWXKKNWd::.......'':lcoddoOOOxx
..'OWX0NWWWWWWWWWNXWXollc:KWWWWNXXKNK:KK'....,::dxodddoxokOk
..'WKxxXWWWWWWWWWWXXNk0:',kWWWWWXOO0XkdW;....'::odolloxKKkdd
..;WKddOWWWWWWWWWWNkNkOd''oWWWWWWWOk0NcN'....',;clccoccxxxkx`));
	await log(chalk.bold.hex('#ff0000')(fs.readFileSync('./banner/.logo')));
	await main();
})();
